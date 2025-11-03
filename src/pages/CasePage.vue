<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useUserStore } from '../stores/userStore';
import { useCaseStore } from '../stores/caseStore';
import { useGamesStore } from '../stores/gamesStore';
import { useGameStore } from '../stores/gameStore';
import { enableBlockFeedback } from '../featureFlags';
import BlockFeedbackPanel from '../components/BlockFeedbackPanel.vue';
import apiClient from '../api';
import { listAssignmentAssessments } from '../api/assessments';
import type { Assignment } from '../api/games';
import type { MenuItem } from 'primevue/menuitem';
import type { AssessmentNew, InvestigationAction, InvestigationPlanChoice, NextStepAction, NextStepChoice } from '../types/domain';

// Import new components
import CaseProgressSteps from '../components/CaseProgressSteps.vue';
import CaseImageViewer from '../components/CaseImageViewer.vue';
import AIPredictionsTable from '../components/AIPredictionsTable.vue';
import AssessmentForm from '../components/AssessmentForm.vue';
import ProgressBar from 'primevue/progressbar';

import Toast from 'primevue/toast'; // Keep Toast here for page-level messages

// --- Interfaces (Keep necessary interfaces here or move to a central types file) ---
interface ImageRead {
  id: number;
  image_url: string; // relative
  full_url?: string; // absolute provided by API
  case_id: number;
}



interface DiagnosisTermRead {
  name: string;
  id: number;
}

interface AIOutputRead {
  rank: number | null;
  confidence_score: number | null;
  id: number;
  case_id: number;
  prediction_id: number;
  prediction: DiagnosisTermRead;
}

// Updated to match current OpenAPI (see docs/openapi.json):
// DiagnosisEntryCreate: { rank: int; raw_text: string }
interface DiagnosisEntryCreateTS {
  rank: number;
  raw_text: string;
}

interface AssessmentCreate {
  assignment_id: number;
  phase: 'PRE' | 'POST';
  diagnostic_confidence?: number | null;
  management_confidence?: number | null;
  investigation_action?: InvestigationAction | null;
  next_step_action?: NextStepAction | null;
  changed_primary_diagnosis?: boolean | null; // POST only
  changed_management_plan?: boolean | null;   // POST only
  ai_usefulness?: string | null;              // POST only
  diagnosis_entries?: DiagnosisEntryCreateTS[]; // defaults to [] server-side
}

// New extended response metadata returned by backend after submitting an assessment
interface AssessmentSubmitResponse {
  block_index: number | null;
  block_complete: boolean;
  report_available: boolean;
  remaining_in_block: number; // unfinished POST assessments after this submission
  // Allow any additional fields (original assessment) without strict typing
  [key: string]: any;
}

// Legacy Diagnosis/Management interfaces removed (free-text capture pending backend support)

interface Case {
  id: number;
  ground_truth_diagnosis_id: number | null;
  typical_diagnosis: boolean;
  created_at: string | null;
  ground_truth_diagnosis: DiagnosisTermRead | null;
  images: ImageRead[];
  ai_outputs: AIOutputRead[];
}

// --- Component Setup ---
const route = useRoute();
const router = useRouter();
const toast = useToast();
const userStore = useUserStore();
const caseStore = useCaseStore();
const gameStore = useGameStore();
const gamesStore = useGamesStore();

const caseId = computed(() => parseInt(route.params.id as string, 10));
const demoMode = computed(() => route.query.demo === '1' || route.query.demo === 'true');
const userId = computed(() => userStore.user?.id);
const submitted = ref(false);

// --- State ---
const images = ref<ImageRead[]>([]);
const aiOutputs = ref<AIOutputRead[]>([]);
const loading = ref(false);
const submitting = ref(false);
// Track if this case was last remaining when entered
const wasFinalInBlock = ref(false);
const investigationActionMap: Record<InvestigationPlanChoice, InvestigationAction> = {
  none: 'NONE',
  biopsy: 'BIOPSY',
  other: 'OTHER'
};

const nextStepActionMap: Record<NextStepChoice, NextStepAction> = {
  reassure: 'REASSURE',
  manage: 'MANAGE_MYSELF',
  refer: 'REFER'
};

const toInvestigationAction = (choice: InvestigationPlanChoice | null | undefined): InvestigationAction | null => {
  if (!choice) return null;
  return investigationActionMap[choice];
};

const toNextStepAction = (choice: NextStepChoice | null | undefined): NextStepAction | null => {
  if (!choice) return null;
  return nextStepActionMap[choice];
};

function buildDiagnosisEntries(phase: 'PRE' | 'POST'): DiagnosisEntryCreateTS[] {
  const src = phase === 'PRE' ? preAiFormData : postAiFormData;
  return [
    { rank: 1, text: src.diagnosisRank1Text },
    { rank: 2, text: src.diagnosisRank2Text },
    { rank: 3, text: src.diagnosisRank3Text }
  ]
    .filter(e => typeof e.text === 'string' && e.text.trim().length > 0)
    .map(e => ({ rank: e.rank, raw_text: e.text!.trim() }));
}

// --- Phase Detection ---
// Phase logic:
//  activeStep 0: Pre-AI (no pre assessment yet)
//  activeStep 1: Post-AI phase (preCompleted true, post not yet) -> show post form
//  activeStep 2: Complete (postCompleted true) -> treat as post phase for display/completion
const isPostAiPhase = computed(() => {
  const progress = caseStore.caseProgress[caseId.value];
  if (!progress) return false;
  if (progress.postCompleted) return true;
  if (progress.preCompleted && !progress.postCompleted) return true;
  return false;
});

// --- Steps for Progress Indicator ---
const items = computed<MenuItem[]>(() => [
  { label: 'Pre-AI Assessment', command: () => console.log('Pre-AI step clicked (current phase: ' + (isPostAiPhase.value ? 'post' : 'pre') + ')')},
  { label: 'Post-AI Assessment', command: () => console.log('Post-AI step clicked (current phase: ' + (isPostAiPhase.value ? 'post' : 'pre') + ')') },
  { label: 'Complete', command: () => console.log('Complete step clicked') }
]);

const activeStep = computed(() => {
  const progress = caseStore.caseProgress[caseId.value];
  if (progress?.postCompleted) return 2; // Complete
  if (progress?.preCompleted) return 1;  // Post-AI phase
  return 0;                               // Pre-AI
});

// --- Game (Block) Progress Bar ---
// Determine current block index for this case by scanning assignments
const currentBlockIndex = computed(() => {
  for (const [blockStr, list] of Object.entries(gamesStore.assignmentsByBlock || {})) {
    const block = Number(blockStr);
    if (list.some(a => a.case_id === caseId.value)) return block;
  }
  return null;
});

const currentAssignment = computed<Assignment | null>(() => {
  if (!userId.value || !caseId.value) return null;
  for (const list of Object.values(gamesStore.assignmentsByBlock || {})) {
    const match = list?.find(a => a.case_id === caseId.value && a.user_id === userId.value);
    if (match) return match as Assignment;
  }
  return null;
});

const blockProgress = computed(() => {
  if (currentBlockIndex.value == null) return null;
  return gamesStore.blockProgress(currentBlockIndex.value);
});

// Ensure we have the full assignment list for this block; hydrateActiveGame can seed only the current assignment,
// which makes total=1 and shows 50% after first PRE submission. Force-load the block once we know its index.
watch(currentBlockIndex, async (block) => {
  if (block != null) {
    try {
  await gamesStore.loadAssignments(block, { force: true, verbose: false });
    } catch (_) { /* non-fatal */ }
  }
}, { immediate: false });

const syncedAssignmentIds = new Set<number>();

const syncPhaseFromExistingAssessments = async (assignment: Assignment, { force = false } = {}) => {
  if (!assignment) return;
  if (!force && syncedAssignmentIds.has(assignment.id)) return;
  try {
    const assessments = await listAssignmentAssessments(assignment.id);
    if (!Array.isArray(assessments) || !assessments.length) {
      syncedAssignmentIds.add(assignment.id);
      return;
    }
    const progress = caseStore.caseProgress[caseId.value]
      ? { ...caseStore.caseProgress[caseId.value] }
      : { caseId: caseId.value, preCompleted: false, postCompleted: false };
    let changed = false;
    if (assessments.some((a: AssessmentNew) => a.phase === 'PRE')) {
      if (!progress.preCompleted) changed = true;
      progress.preCompleted = true;
    }
    if (assessments.some((a: AssessmentNew) => a.phase === 'POST')) {
      if (!progress.postCompleted) changed = true;
      progress.postCompleted = true;
      progress.preCompleted = true;
    }
    if (changed) {
      caseStore.caseProgress[caseId.value] = progress as any;
      caseStore.saveProgressToCache();
    }
    syncedAssignmentIds.add(assignment.id);
  } catch (error) {
    console.error('Failed to sync assignment assessments for assignment', assignment.id, error);
  }
};

watch(currentAssignment, (assignment) => {
  if (!assignment) return;
  syncPhaseFromExistingAssessments(assignment).catch(() => {});
}, { immediate: true });

watch(caseId, () => {
  syncedAssignmentIds.clear();
});

// Percent with partial credit for Pre-AI: each pre-only case counts as 0.5, post counts as 1
// Denominator defaults to 15 (current game size)
const gameProgressPercent = computed(() => {
  const prog = blockProgress.value; if (!prog) return 0;
  const { pre = 0, post = 0 } = prog as any;
  const totalCases = Math.max(1, (prog as any).total ?? 15);
  const preOnly = Math.max(0, pre - post);
  const weighted = Math.min(totalCases, post + preOnly * 0.5);
  return Math.round((weighted / totalCases) * 100);
});

// Label for inside bar: show completed and in-progress counts
const gameProgressBarLabel = computed(() => {
  const prog = blockProgress.value; if(!prog) return '';
  const { pre = 0, post = 0 } = prog as any;
  const total = (prog as any).total ?? 15;
  const preOnly = Math.max(0, pre - post);
  return preOnly > 0
    ? `${post}/${total} completed • ${preOnly} pre-AI`
    : `${post}/${total} completed`;
});


// --- Form Data ---
const preAiFormData = reactive({
  diagnosisRank1Text: null as string | null,
  diagnosisRank2Text: null as string | null,
  diagnosisRank3Text: null as string | null,
  confidenceScore: 3,
  certaintyScore: 3,
  investigationPlan: null as InvestigationPlanChoice | null,
  nextStep: null as NextStepChoice | null,
});

const postAiFormData = reactive({
  diagnosisRank1Text: null as string | null,
  diagnosisRank2Text: null as string | null,
  diagnosisRank3Text: null as string | null,
  confidenceScore: 3,
  certaintyScore: 3,
  changeDiagnosis: null as boolean | null,
  changeManagement: null as boolean | null,
  aiUsefulness: null as string | null,
  investigationPlan: null as InvestigationPlanChoice | null,
  nextStep: null as NextStepChoice | null,
});

const currentFormData = computed(() => isPostAiPhase.value ? postAiFormData : preAiFormData);

const preAiLocalStorageKey = computed(() => `preAiFormData_${caseId.value}_${userId.value}`);
const postAiLocalStorageKey = computed(() => `postAiFormData_${caseId.value}_${userId.value}`);

// --- AI Usefulness Options ---
const aiUsefulnessOptions = ref([
  { label: 'Very Useful', value: 'very' },
  { label: 'Somewhat Useful', value: 'somewhat' },
  { label: 'Not Useful', value: 'not' },
]);

const changeOptions = ref([
  { label: 'Yes', value: true },
  { label: 'No', value: false },
]);

// Display highest confidence first (5 → 1)
const scoreOptions = ref([
  { label: '5', value: 5 },
  { label: '4', value: 4 },
  { label: '3', value: 3 },
  { label: '2', value: 2 },
  { label: '1', value: 1 }
]);

// --- Data Fetching ---
const fetchData = async () => {
  if (!caseId.value || !userId.value) return; // Ensure userId is also available
  loading.value = true;
  aiOutputs.value = [];

  console.log(`Fetching data for case ${caseId.value}, user ${userId.value}, isPostAiPhase: ${isPostAiPhase.value}`);

  try {
    const commonFetches = [
      apiClient.get<ImageRead[]>(`/api/images/case/${caseId.value}`),
      apiClient.get<Case>(`/api/cases/${caseId.value}`)
    ];

    const [imagesResponse, caseResponse] = await Promise.all(commonFetches);

    images.value = imagesResponse.data as ImageRead[];
    const caseData = caseResponse.data as Case;
    if (!caseData) {
      throw new Error('Failed to load case data');
    }
  // metadata removed
    if (isPostAiPhase.value) {
      console.log(`Fetching AI outputs for case ${caseId.value}`);
      try {
        const aiResponse = await apiClient.get<AIOutputRead[]>(`/api/ai_outputs/case/${caseId.value}`);
        aiOutputs.value = aiResponse.data.sort((a: AIOutputRead, b: AIOutputRead) => (a.rank ?? 99) - (b.rank ?? 99)).slice(0, 5);
        console.log(`Loaded ${aiOutputs.value.length} AI outputs.`);
        loadFromLocalStorage(postAiLocalStorageKey.value, postAiFormData);
      } catch (aiError) {
        console.error('Failed to fetch AI outputs:', aiError);
        aiOutputs.value = [];
        loadFromLocalStorage(postAiLocalStorageKey.value, postAiFormData);
      }
    } else {
      aiOutputs.value = [];
      loadFromLocalStorage(preAiLocalStorageKey.value, preAiFormData);
    }
     // Check if current phase form data is empty and if previous phase data exists
    if (isPostAiPhase.value && !Object.values(postAiFormData).some(val => val !== null && val !== '' && val !== 3)) {
        const savedPreAiData = localStorage.getItem(preAiLocalStorageKey.value);
        if (savedPreAiData) {
            try {
                const parsedPreAi = JSON.parse(savedPreAiData);
                postAiFormData.diagnosisRank1Text = parsedPreAi.diagnosisRank1Text;
                postAiFormData.diagnosisRank2Text = parsedPreAi.diagnosisRank2Text;
                postAiFormData.diagnosisRank3Text = parsedPreAi.diagnosisRank3Text;
                postAiFormData.confidenceScore = parsedPreAi.confidenceScore;
                postAiFormData.certaintyScore = parsedPreAi.certaintyScore;
                if (postAiFormData.investigationPlan == null) {
                  postAiFormData.investigationPlan = parsedPreAi.investigationPlan ?? null;
                }
                if (postAiFormData.nextStep == null) {
                  postAiFormData.nextStep = parsedPreAi.nextStep ?? null;
                }
                 console.log('Copied Pre-AI data to Post-AI form');
            } catch (e) {
                console.error('Failed to parse pre-AI data for copying:', e);
            }
        }
    }


  } catch (error: any) {
    console.error('Failed to fetch case data:', error);
    if (error.response?.status === 404) {
      toast.add({
        severity: 'error',
        summary: 'Case Not Found',
        detail: 'The requested case could not be found.',
        life: 5000
      });
      router.push('/');
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load case data. Please try again.',
        life: 3000
      });
    }
  } finally {
    loading.value = false;
  }
};

// --- Local Storage ---
const saveToLocalStorage = (key: string, data: object) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const loadFromLocalStorage = (key: string, target: object) => {
  const savedData = localStorage.getItem(key);
  if (savedData) {
    try {
      const parsedData = JSON.parse(savedData);
      Object.assign(target, parsedData);
    } catch (e) {
      console.error(`Failed to parse saved form data for key ${key}:`, e);
      localStorage.removeItem(key);
    }
  }
};

const clearLocalStorage = (key: string) => {
  localStorage.removeItem(key);
};

const resetFormData = () => {
  Object.assign(preAiFormData, {
  diagnosisRank1Text: null, diagnosisRank2Text: null, diagnosisRank3Text: null,
  confidenceScore: 3, certaintyScore: 3, investigationPlan: null, nextStep: null,
  });
  Object.assign(postAiFormData, {
  diagnosisRank1Text: null, diagnosisRank2Text: null, diagnosisRank3Text: null,
  confidenceScore: 3, certaintyScore: 3,
    changeDiagnosis: null, changeManagement: null, aiUsefulness: null,
  investigationPlan: null, nextStep: null,
  });
};

watch(preAiFormData, () => saveToLocalStorage(preAiLocalStorageKey.value, preAiFormData), { deep: true });
watch(postAiFormData, () => saveToLocalStorage(postAiLocalStorageKey.value, postAiFormData), { deep: true });

watch(() => route.params.id, async (newIdStr, oldIdStr) => {
  const newId = newIdStr ? parseInt(newIdStr as string, 10) : null;
  const oldId = oldIdStr ? parseInt(oldIdStr as string, 10) : null;
  console.log(`Route ID changed from ${oldId} to ${newId}`);
  if (newId !== null && newId !== oldId) {
    resetFormData(); // Reset forms for the new case
    // The phase will be determined by caseStore progress, which is re-evaluated by isPostAiPhase
    // Ensure progress loaded for new case before fetching so phase detection is correct
    if (!caseStore.cases.length && userId.value) {
      await caseStore.loadCases();
    } else if (userId.value) {
      // Make sure assessments loaded at least once (idempotent)
      await caseStore.loadAssessmentsAndProgress(userId.value);
    }
    await fetchData(); // Fetch data for the new case after ensuring progress
  }
}, { immediate: true });


watch(isPostAiPhase, async (newPhase, oldPhase) => {
  console.log(`Phase changed from ${oldPhase ? 'Post-AI' : 'Pre-AI'} to ${newPhase ? 'Post-AI' : 'Pre-AI'} for case ${caseId.value}`);
  // Refetch data if the phase changes for the *same* case,
  // e.g., after pre-AI submission, isPostAiPhase becomes true.
  // Avoid refetch if it's part of navigating to a new case (handled by route.params.id watcher)
  if (newPhase !== oldPhase && route.params.id && parseInt(route.params.id as string, 10) === caseId.value) {
      console.log('Phase changed for current case, refetching data...');
      await fetchData();
      // After fetch, ensure management binary choices are carried over if not yet set
      if (newPhase) {
        if (postAiFormData.investigationPlan == null && preAiFormData.investigationPlan != null) {
          postAiFormData.investigationPlan = preAiFormData.investigationPlan;
        }
        if (postAiFormData.nextStep == null && preAiFormData.nextStep != null) {
          postAiFormData.nextStep = preAiFormData.nextStep;
        }
        // Always carry over diagnosis text fields if post-AI fields are still empty
        if (!postAiFormData.diagnosisRank1Text && preAiFormData.diagnosisRank1Text) {
          postAiFormData.diagnosisRank1Text = preAiFormData.diagnosisRank1Text;
        }
        if (!postAiFormData.diagnosisRank2Text && preAiFormData.diagnosisRank2Text) {
          postAiFormData.diagnosisRank2Text = preAiFormData.diagnosisRank2Text;
        }
        if (!postAiFormData.diagnosisRank3Text && preAiFormData.diagnosisRank3Text) {
          postAiFormData.diagnosisRank3Text = preAiFormData.diagnosisRank3Text;
        }
      }
  }
}, { immediate: false }); // `immediate: false` to avoid running on initial load before route watcher

// Auto-set changeManagement when either management choice differs between pre and post
watch([
  () => postAiFormData.investigationPlan,
  () => postAiFormData.nextStep
], ([invPost, stepPost]) => {
  if (!isPostAiPhase.value) return;
  const changed = (preAiFormData.investigationPlan !== invPost) || (preAiFormData.nextStep !== stepPost);
  postAiFormData.changeManagement = changed;
});

// --- Auto-set change flags in Post-AI when user changes diagnosis or management compared to Pre-AI ---
watch(() => postAiFormData.diagnosisRank1Text, (newVal) => {
  if (!isPostAiPhase.value) return;
  const pre = (preAiFormData.diagnosisRank1Text || '').trim().toLowerCase();
  const post = (newVal || '').trim().toLowerCase();
  // Set true when different, false when same/empty match
  postAiFormData.changeDiagnosis = pre !== post;
});

// (legacy biopsy/referral watcher removed; replaced by investigation/nextStep watcher above)

// Ensure cases & assessments are loaded on direct navigation / refresh
onMounted(async () => {
  if (!userId.value) return; // wait for user login if needed
  if (!caseStore.cases.length) {
    await caseStore.loadCases();
  } else {
    // Still ensure assessments loaded (idempotent)
    await caseStore.loadAssessmentsAndProgress(userId.value);
  }
  // Hydrate active game assignments if user refreshed directly on a case page
  await gamesStore.hydrateActiveGame();
  // After hydrating, force-load assignments for the current block so progress totals are accurate
  if (currentBlockIndex.value != null) {
    try { await gamesStore.loadAssignments(currentBlockIndex.value, { force: true, verbose: false }); } catch(_) {}
  }
  // Determine if this case was the final remaining based on activeRemaining (set when navigated via advanceToNext)
  if ((gamesStore as any).activeRemaining === 1) {
    wasFinalInBlock.value = true;
  }
  // Refined fallback: only infer final if we have a fully loaded block (more than 1 assignment) and exactly one incomplete post assessment.
  if (!wasFinalInBlock.value) {
    const assignment = Object.values(gamesStore.assignmentsByBlock || {})
      .flat()
      .find((a: any) => a.case_id === caseId.value && a.user_id === userId.value);
    if (assignment) {
      const blockIdx = assignment.block_index;
      const list = (gamesStore.assignmentsByBlock as any)[blockIdx] || [];
      if (list.length > 1) {
        const remainingInBlock = list.filter((a: any) => !a.completed_post_at).length; // post not finished
        if (remainingInBlock === 1) wasFinalInBlock.value = true;
      }
    }
  }
  // After loading, if URL explicitly has phase=post and preCompleted true, re-run fetch to include AI outputs
  if (route.query.phase === 'post' && isPostAiPhase.value) {
    await fetchData();
  }
});

// --- Submission Logic ---
const handleSubmit = async () => {
  if (isPostAiPhase.value) {
    await handlePostAiSubmit();
  } else {
    await handlePreAiSubmit();
  }
};

const handlePreAiSubmit = async () => {
  if (submitting.value) return; // prevent double submit
  const progress = caseStore.caseProgress[caseId.value];
  if (progress?.preCompleted) {
    if (!progress.postCompleted) {
      toast.add({ severity: 'info', summary: 'Pre-AI Already Submitted', detail: 'Loading Post-AI assessment instead.', life: 4000 });
      if (currentAssignment.value) {
        try {
          await syncPhaseFromExistingAssessments(currentAssignment.value, { force: true });
        } catch (_) {
          /* non-fatal */
        }
      }
    }
    return;
  }
  submitted.value = true;
  if (!userId.value || !caseId.value) {
    toast.add({ severity: 'warn', summary: 'Missing Info', detail: 'User or Case ID not found.', life: 3000 });
    return;
  }
  if (!preAiFormData.diagnosisRank1Text) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please enter at least a primary diagnosis (Rank 1).', life: 3000 });
    return;
  }
  if (!preAiFormData.investigationPlan || !preAiFormData.nextStep) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please select Investigation and Next Step.', life: 3000 });
    return;
  }
  // management strategy removed

  submitting.value = true;
  try {
    if (demoMode.value) {
      // Simulate pre submit without saving
      await caseStore.markProgress(caseId.value, false);
      toast.add({ severity: 'success', summary: 'Demo', detail: 'Pre-AI step recorded (demo). Proceed to AI suggestions.', life: 2000 });
      return; // phase watcher will refetch as needed
    }
    // Find assignment for this user+case in any loaded block
    const assignment = Object.values(gamesStore.assignmentsByBlock || {})
      .flat()
      .find((a: any) => a.case_id === caseId.value && a.user_id === userId.value);
    if (!assignment) {
      throw new Error('No assignment found for this case. Start or hydrate the game block first.');
    }
    // Build diagnosis debug info (not yet sent to backend)
    const rawDiagnoses = [
      { rank: 1, raw_text: preAiFormData.diagnosisRank1Text?.trim() || null },
      { rank: 2, raw_text: preAiFormData.diagnosisRank2Text?.trim() || null },
      { rank: 3, raw_text: preAiFormData.diagnosisRank3Text?.trim() || null }
    ].filter(d => d.raw_text);
    console.debug('PRE assessment diagnosis debug', {
      case_id: caseId.value,
      assignment_id: assignment.id,
      rawDiagnoses
    });
    const diagnosisEntries = buildDiagnosisEntries('PRE');
    const primary = diagnosisEntries.find(e => e.rank === 1);
    if (!primary) {
      toast.add({ severity: 'warn', summary: 'Unmapped Diagnosis', detail: 'Primary diagnosis must match a known term. Please select from suggestions.', life: 4000 });
      submitting.value = false;
      return;
    }
    const assessmentPayload: AssessmentCreate = {
      assignment_id: assignment.id,
      phase: 'PRE',
      diagnostic_confidence: preAiFormData.confidenceScore,
      management_confidence: preAiFormData.certaintyScore,
      investigation_action: toInvestigationAction(preAiFormData.investigationPlan),
      next_step_action: toNextStepAction(preAiFormData.nextStep),
      diagnosis_entries: diagnosisEntries,
    };
    console.debug('Submitting PRE assessment payload', assessmentPayload);
  // Explicit JSON log for inspection
  try { console.log('[ASSESSMENT_SUBMIT_PRE] /api/assessment/ body=' + JSON.stringify(assessmentPayload, null, 2)); } catch(_) {}
    const { data } = await apiClient.post<AssessmentSubmitResponse>('/api/assessment/', assessmentPayload);
    console.debug('PRE submit response meta', {
      block_index: data?.block_index,
      block_complete: data?.block_complete,
      report_available: data?.report_available,
      remaining_in_block: data?.remaining_in_block
    });

  // TODO: map free-text diagnoses to term IDs (future feature). Currently omitted since backend expects IDs.

  // Mark assignment pre completion locally for dashboard progress
  (assignment as any).completed_pre_at = new Date().toISOString();

  await caseStore.markProgress(caseId.value, false); // Mark pre-AI as complete
    // clearLocalStorage(preAiLocalStorageKey.value); // Keep pre-AI data for potential copy to post-AI
    submitted.value = false;
    toast.add({ severity: 'success', summary: 'Success', detail: 'Pre-AI assessment saved. Proceeding to AI suggestions.', life: 2000 });
    // isPostAiPhase will become true, triggering the watcher to refetch data including AI outputs.
  } catch (error: any) {
    console.error('Failed to submit pre-AI assessment:', error);
    handleApiError(error, 'Pre-AI Submission Error');
  } finally {
    submitting.value = false;
  }
};

const handlePostAiSubmit = async () => {
  if (submitting.value) return; // prevent double submit
  submitted.value = true;
  if (!userId.value || !caseId.value) {
    toast.add({ severity: 'warn', summary: 'Missing Info', detail: 'User or Case ID not found.', life: 3000 });
    return;
  }
  if (!postAiFormData.diagnosisRank1Text) {
  toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Primary diagnosis required.', life: 3000 });
    return;
  }
  // Validate required POST fields individually to provide accurate feedback
  const missing: string[] = [];
  if (postAiFormData.changeDiagnosis === null) missing.push('Did AI suggestions change your primary diagnosis?');
  if (postAiFormData.changeManagement === null) missing.push('Did AI suggestions change your management plan?');
  if (postAiFormData.aiUsefulness === null) missing.push('How useful were the AI suggestions?');
  if (missing.length) {
    const detail = missing.length === 1 ? missing[0] : `Please complete: ${missing.join('; ')}`;
    toast.add({ severity: 'warn', summary: 'Validation Error', detail, life: 4000 });
    return;
  }
  if (!postAiFormData.investigationPlan || !postAiFormData.nextStep) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please select Investigation and Next Step.', life: 3000 });
    return;
  }

  submitting.value = true;
  try {
    if (demoMode.value) {
      // Simulate post submit without saving and go to demo completion
      await caseStore.markProgress(caseId.value, true);
      resetFormData();
      toast.add({ severity: 'success', summary: 'Demo', detail: 'Demo completed! Redirecting…', life: 1500 });
      router.push('/demo-complete');
      return;
    }
    const assignment = Object.values(gamesStore.assignmentsByBlock || {})
      .flat()
      .find((a: any) => a.case_id === caseId.value && a.user_id === userId.value);
    if (!assignment) {
      throw new Error('No assignment found for this case. Start or hydrate the game block first.');
    }
    const rawDiagnoses = [
      { rank: 1, raw_text: postAiFormData.diagnosisRank1Text?.trim() || null },
      { rank: 2, raw_text: postAiFormData.diagnosisRank2Text?.trim() || null },
      { rank: 3, raw_text: postAiFormData.diagnosisRank3Text?.trim() || null }
    ].filter(d => d.raw_text);
    console.debug('POST assessment diagnosis debug', {
      case_id: caseId.value,
      assignment_id: assignment.id,
      rawDiagnoses
    });
    const diagnosisEntries = buildDiagnosisEntries('POST');
    const primary = diagnosisEntries.find(e => e.rank === 1);
    if (!primary) {
      toast.add({ severity: 'warn', summary: 'Unmapped Diagnosis', detail: 'Primary diagnosis must match a known term. Please select from suggestions.', life: 4000 });
      submitting.value = false;
      return;
    }
    const assessmentPayload: AssessmentCreate = {
      assignment_id: assignment.id,
      phase: 'POST',
      diagnostic_confidence: postAiFormData.confidenceScore,
      management_confidence: postAiFormData.certaintyScore,
      changed_primary_diagnosis: postAiFormData.changeDiagnosis,
      changed_management_plan: postAiFormData.changeManagement,
      ai_usefulness: postAiFormData.aiUsefulness,
      investigation_action: toInvestigationAction(postAiFormData.investigationPlan),
      next_step_action: toNextStepAction(postAiFormData.nextStep),
      diagnosis_entries: diagnosisEntries,
    };
    console.debug('Submitting POST assessment payload', assessmentPayload);
  try { console.log('[ASSESSMENT_SUBMIT_POST] /api/assessment/ body=' + JSON.stringify(assessmentPayload, null, 2)); } catch(_) {}
    const { data } = await apiClient.post<AssessmentSubmitResponse>('/api/assessment/', assessmentPayload);
    console.debug('POST submit response meta', {
      block_index: data?.block_index,
      block_complete: data?.block_complete,
      report_available: data?.report_available,
      remaining_in_block: data?.remaining_in_block
    });

  // TODO: submit free-text diagnoses when backend supports diagnosis_entries

  // Mark assignment post completion locally so dashboard reflects completion
  (assignment as any).completed_post_at = new Date().toISOString();

    await caseStore.markProgress(caseId.value, true); // Mark post-AI as complete
    clearLocalStorage(preAiLocalStorageKey.value); // Clear pre-AI after successful post-AI
    clearLocalStorage(postAiLocalStorageKey.value);
    resetFormData();
    submitted.value = false;

    // Navigation logic now driven by backend flags
    try {
      if (data?.block_complete && data?.block_index != null) {
        console.debug('Backend indicates block complete; navigating to trust survey', {
          block_index: data.block_index,
          report_available: data.report_available
        });
        router.push({ path: `/game/trust/${data.block_index}` });
        return; // stop further advancement calls
      }
      // Not complete yet -> request next assignment via unified flow
      const resp = await gamesStore.advanceToNext();
      if (resp.status === 'exhausted') {
        toast.add({ severity: 'success', summary: 'All Cases Completed', detail: 'You finished all available cases.', life: 5000 });
        router.push('/');
      } else if (resp.assignment) {
        router.push({ path: `/case/${resp.assignment.case_id}` });
      }
    } catch (e) {
      console.error('Post-submit navigation error', e);
      navigateToNextCase();
    }
  } catch (error: any) {
    console.error('Failed to submit post-AI assessment:', error);
    handleApiError(error, 'Post-AI Submission Error');
  } finally {
    submitting.value = false;
  }
};

const handleApiError = (error: any, summary: string) => {
  let detail = 'An unexpected error occurred. Please try again.';
  if (error.response?.data?.detail) {
    if (typeof error.response.data.detail === 'string') {
      detail = error.response.data.detail;
    } else if (Array.isArray(error.response.data.detail)) {
      detail = error.response.data.detail.map((err: any) => `${err.loc?.join('.')} - ${err.msg}`).join('; ');
    } else if (typeof error.response.data.detail === 'object') {
      detail = JSON.stringify(error.response.data.detail);
    }
  } else if (error.message) {
    detail = error.message;
  }
  toast.add({ severity: 'error', summary: summary, detail: detail, life: 5000 });
};

// --- Computed Functions for Labels (passed to AssessmentForm) ---
const getConfidenceLabel = (score: number) => {
  switch (score) {
    case 1: return 'Very Low Confidence'; case 2: return 'Low Confidence';
    case 3: return 'Moderate Confidence'; case 4: return 'High Confidence';
    case 5: return 'Very High Confidence'; default: return 'Select Confidence Level';
  }
};

const getCertaintyLabel = (score: number) => {
  switch (score) {
    case 1: return 'Very Uncertain'; case 2: return 'Somewhat Uncertain';
    case 3: return 'Moderately Certain'; case 4: return 'Quite Certain';
    case 5: return 'Very Certain'; default: return 'Select Certainty Level';
  }
};

function navigateToNextCase() {
  const nextCase = caseStore.getNextIncompleteCase();
  if (nextCase) {
    router.push({ path: `/case/${nextCase.id}` });
  } else {
    toast.add({ severity: 'success', summary: 'All Cases Completed', detail: 'You finished all available cases.', life: 4000 });
    router.push('/');
  }
}

function handleBlockContinue() {
  gameStore.closeFeedback();
  navigateToNextCase();
}

// ^ CasePage logic end helpers

</script>

<template>
  <div class="u-page u-page-wide case-container u-surface-ground border-round case-page-green">
    <Toast />
    <BlockFeedbackPanel
      v-if="enableBlockFeedback"
      :visible="gameStore.blockFeedbackVisible"
      :stats="gameStore.currentBlockFeedback"
      :loading="gameStore.loadingFeedback"
      @continue="handleBlockContinue"
    />
    <CaseProgressSteps :items="items" :activeStep="activeStep" />

    <div class="grid">
      <!-- Left Column -->
      <div class="col-12 lg:col-5">
  <!-- Game Progress Bar (moved above image card) -->
  <div v-if="blockProgress && blockProgress.total" class="mb-3">
    <ProgressBar :value="gameProgressPercent" :showValue="false" class="game-progress-bar">
      <span class="gp-label">{{ gameProgressBarLabel }}</span>
    </ProgressBar>
  </div>
  <!-- Post-AI accuracy reminder -->
  <div v-if="isPostAiPhase" class="ai-accuracy-note mb-3">
    <strong class="mr-1">Note:</strong>
    AI suggestions are assistive tools and not 100% accurate. Performance on validation dataset: Top-1 accuracy <span class="stat">49.50%</span>, Top-3 accuracy <span class="stat">67.50%</span> among 100+ skin conditions.
    Always rely on your clinical judgment.
  </div>
  <AIPredictionsTable :aiOutputs="aiOutputs" :isPostAiPhase="isPostAiPhase" />
  <CaseImageViewer :images="images" :loading="loading" :caseId="caseId" />
  <!-- Metadata display removed -->
      </div>

      <!-- Right Column - Assessment Form -->
      <div class="col-12 lg:col-7">
  <!-- Pre-AI quick guidance -->
  <div v-if="!isPostAiPhase" class="preai-help-note mb-3">
    Start with your own assessment: enter your Top 1–3 diagnoses (Rank 1 required), choose your Investigation and Next Step, and set confidence and certainty. You'll see AI suggestions afterwards.
  </div>
  <!-- Post-AI quick guidance -->
  <div v-if="isPostAiPhase" class="postai-help-note mb-3">
    Review the AI suggestions. If they changed your judgement, update your Diagnosis and Management Choices accordingly, rate AI usefulness, and then submit to complete this case.
  </div>
  <AssessmentForm
          :formData="currentFormData"
          :scoreOptions="scoreOptions"
          :submitted="submitted"
          :submitting="submitting"
          :isPostAiPhase="isPostAiPhase"
          :aiUsefulnessOptions="aiUsefulnessOptions"
          :changeOptions="changeOptions"
          :getConfidenceLabel="getConfidenceLabel"
          :getCertaintyLabel="getCertaintyLabel"
    @submit-form="handleSubmit"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Width now driven by .u-page-wide; keep hook class if future overrides needed */
.case-page-green {
  /* Override accent (purple) tokens with success green for this page only */
  --accent-primary: var(--success-color);
  --accent-primary-alt: var(--success-color);
  --accent-cta-start: var(--success-color);
  --accent-cta-end: var(--success-color);
  --focus-ring: var(--success-color);
  --highlight-bg: var(--highlight-success-bg);
}

/* Force progress bar value to green inside this page (PrimeVue uses .p-progressbar-value) */
.case-page-green :deep(.p-progressbar .p-progressbar-value) {
  background: var(--success-color) !important;
}

/* Tag/info elements also inherit green if they relied on accent */
.case-page-green :deep(.p-tag) {
  background: var(--highlight-success-bg) !important;
  color: var(--success-color) !important;
  border-color: var(--success-color) !important;
}

/* Inline game progress label */
.game-progress-bar { position:relative; }
.game-progress-bar .gp-label { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:.75rem; font-weight:600; letter-spacing:.5px; color:var(--color-white); mix-blend-mode:normal; }
.dark .game-progress-bar .gp-label { color:#fff; }

/* Subtle caution banner for Post-AI phase */
.ai-accuracy-note {
  padding: 0.75rem 0.875rem;
  border-radius: 8px;
  border: 1px solid var(--warning-color, #d97706);
  background: var(--highlight-warning-bg, rgba(245, 158, 11, 0.08));
  color: var(--text-color, #374151);
  font-size: 0.875rem;
  line-height: 1.4;
}
.ai-accuracy-note .stat {
  font-weight: 600;
}

/* Subtle info banner for Pre-AI phase */
.preai-help-note {
  padding: 0.75rem 0.875rem;
  border-radius: 8px;
  border: 1px solid var(--accent-primary, #6366f1);
  background: var(--highlight-bg, rgba(99,102,241,0.08));
  color: var(--text-color, #374151);
  font-size: 0.875rem;
  line-height: 1.4;
}

/* Post-AI guidance banner */
.postai-help-note {
  padding: 0.75rem 0.875rem;
  border-radius: 8px;
  border: 1px solid var(--accent-primary, #6366f1);
  background: var(--highlight-bg, rgba(99,102,241,0.08));
  color: var(--text-color, #374151);
  font-size: 0.875rem;
  line-height: 1.4;
}

</style>
