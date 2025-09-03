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
import type { MenuItem } from 'primevue/menuitem';

// Import new components
import CaseProgressSteps from '../components/CaseProgressSteps.vue';
import CaseImageViewer from '../components/CaseImageViewer.vue';
import AIPredictionsTable from '../components/AIPredictionsTable.vue';
import AssessmentForm from '../components/AssessmentForm.vue';

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
// DiagnosisEntryCreate: { rank: int; raw_text?: string | null; diagnosis_term_id: int }
interface DiagnosisEntryCreateTS {
  rank: number;
  raw_text?: string | null;
  diagnosis_term_id: number; // required, integer
}

interface AssessmentCreate {
  assignment_id: number;
  phase: 'PRE' | 'POST';
  diagnostic_confidence?: number | null;
  management_confidence?: number | null;
  biopsy_recommended?: boolean | null;
  referral_recommended?: boolean | null;
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
const userId = computed(() => userStore.user?.id);
const submitted = ref(false);

// --- State ---
const images = ref<ImageRead[]>([]);
const diagnosisTerms = ref<DiagnosisTermRead[]>([]);
const aiOutputs = ref<AIOutputRead[]>([]);
const loading = ref(false);
const submitting = ref(false);
// Track if this case was last remaining when entered
const wasFinalInBlock = ref(false);
// Track selected diagnosis term objects (from autocomplete select events)
const selectedDiagnosisByRank = reactive<Record<number, { id: number; name: string; synonyms?: string[] } | null>>({ 1: null, 2: null, 3: null });

function onDiagnosisSelected(payload: { rank: number; term: { id: number; name: string; synonyms?: string[] } }) {
  selectedDiagnosisByRank[payload.rank] = payload.term;
  console.debug('Diagnosis selected', payload.rank, payload.term);
}

function buildDiagnosisEntries(phase: 'PRE' | 'POST'): DiagnosisEntryCreateTS[] {
  const src = phase === 'PRE' ? preAiFormData : postAiFormData;
  const raw = [
    { rank: 1, text: src.diagnosisRank1Text, sel: selectedDiagnosisByRank[1] },
    { rank: 2, text: src.diagnosisRank2Text, sel: selectedDiagnosisByRank[2] },
    { rank: 3, text: src.diagnosisRank3Text, sel: selectedDiagnosisByRank[3] }
  ].filter(e => e.text && e.text.trim().length);
  const mapped = raw.map(e => {
    const lookupKey = (e.sel?.name || e.text || '').toLowerCase();
    const fallback = diagnosisTerms.value.find(t => t.name.toLowerCase() === lookupKey);
    // use nullish coalescing so id=0 is preserved
    const id = (e.sel?.id ?? fallback?.id ?? null);
    return { rank: e.rank, raw_text: e.text!.trim(), diagnosis_term_id: id as number | null };
  });
  console.debug('buildDiagnosisEntries mapped (pre-filter)', mapped);
  const filtered = mapped.filter(m => Number.isInteger(m.diagnosis_term_id)) as { rank: number; raw_text: string; diagnosis_term_id: number; }[];
  if (filtered.length !== mapped.length) {
    console.debug('Filtered out diagnosis entries without a resolved term id', { mapped, filtered });
  }
  return filtered as DiagnosisEntryCreateTS[];
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


// --- Form Data ---
const preAiFormData = reactive({
  diagnosisRank1Text: null as string | null,
  diagnosisRank2Text: null as string | null,
  diagnosisRank3Text: null as string | null,
  confidenceScore: 3,
  certaintyScore: 3,
  biopsyRecommended: null as boolean | null,
  referralRecommended: null as boolean | null,
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
  biopsyRecommended: null as boolean | null,
  referralRecommended: null as boolean | null,
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
      apiClient.get<Case>(`/api/cases/${caseId.value}`),
      apiClient.get<DiagnosisTermRead[]>('/api/diagnosis_terms/')
    ];

    const [imagesResponse, caseResponse, termsResponse] = await Promise.all(commonFetches);

    images.value = imagesResponse.data as ImageRead[];
    const caseData = caseResponse.data as Case;
    if (!caseData) {
      throw new Error('Failed to load case data');
    }
  // metadata removed
    diagnosisTerms.value = termsResponse.data as DiagnosisTermRead[];

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
                if (postAiFormData.biopsyRecommended == null) {
                  postAiFormData.biopsyRecommended = parsedPreAi.biopsyRecommended ?? null;
                }
                if (postAiFormData.referralRecommended == null) {
                  postAiFormData.referralRecommended = parsedPreAi.referralRecommended ?? null;
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
  confidenceScore: 3, certaintyScore: 3, biopsyRecommended: null, referralRecommended: null,
  });
  Object.assign(postAiFormData, {
  diagnosisRank1Text: null, diagnosisRank2Text: null, diagnosisRank3Text: null,
  confidenceScore: 3, certaintyScore: 3,
    changeDiagnosis: null, changeManagement: null, aiUsefulness: null,
  biopsyRecommended: null, referralRecommended: null,
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
        if (postAiFormData.biopsyRecommended == null && preAiFormData.biopsyRecommended != null) {
          postAiFormData.biopsyRecommended = preAiFormData.biopsyRecommended;
        }
        if (postAiFormData.referralRecommended == null && preAiFormData.referralRecommended != null) {
          postAiFormData.referralRecommended = preAiFormData.referralRecommended;
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
  submitted.value = true;
  if (!userId.value || !caseId.value) {
    toast.add({ severity: 'warn', summary: 'Missing Info', detail: 'User or Case ID not found.', life: 3000 });
    return;
  }
  if (!preAiFormData.diagnosisRank1Text) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please enter at least a primary diagnosis (Rank 1).', life: 3000 });
    return;
  }
  if (preAiFormData.biopsyRecommended === null || preAiFormData.referralRecommended === null) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please answer both management questions (Biopsy? and Refer to Dermatology?).', life: 3000 });
    return;
  }
  // management strategy removed

  submitting.value = true;
  try {
    // Find assignment for this user+case in any loaded block
    const assignment = Object.values(gamesStore.assignmentsByBlock || {})
      .flat()
      .find((a: any) => a.case_id === caseId.value && a.user_id === userId.value);
    if (!assignment) {
      throw new Error('No assignment found for this case. Start or hydrate the game block first.');
    }
    // Build diagnosis debug info (not yet sent to backend)
    const rawDiagnoses = [
      { rank: 1, raw_text: preAiFormData.diagnosisRank1Text, selected: selectedDiagnosisByRank[1] },
      { rank: 2, raw_text: preAiFormData.diagnosisRank2Text, selected: selectedDiagnosisByRank[2] },
      { rank: 3, raw_text: preAiFormData.diagnosisRank3Text, selected: selectedDiagnosisByRank[3] }
    ].filter(d => d.raw_text);
    const resolvedEntries = rawDiagnoses.map(d => {
      // Attempt to resolve by exact (case-insensitive) name match among loaded diagnosisTerms
      const match = diagnosisTerms.value.find(t => t.name.toLowerCase() === (d.selected?.name || d.raw_text || '').toLowerCase());
      return { rank: d.rank, raw_text: d.raw_text, diagnosis_term_id: d.selected?.id || match?.id || null, selectedName: d.selected?.name || null };
    });
    console.debug('PRE assessment diagnosis debug', {
      case_id: caseId.value,
      assignment_id: assignment.id,
      rawDiagnoses,
      resolvedEntries
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
      biopsy_recommended: preAiFormData.biopsyRecommended,
      referral_recommended: preAiFormData.referralRecommended,
      diagnosis_entries: diagnosisEntries,
    };
    console.debug('Submitting PRE assessment payload', assessmentPayload);
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
  submitted.value = true;
  if (!userId.value || !caseId.value) {
    toast.add({ severity: 'warn', summary: 'Missing Info', detail: 'User or Case ID not found.', life: 3000 });
    return;
  }
  if (!postAiFormData.diagnosisRank1Text) {
  toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Primary diagnosis required.', life: 3000 });
    return;
  }
  if (postAiFormData.changeDiagnosis === null || postAiFormData.changeManagement === null || postAiFormData.aiUsefulness === null) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please answer the questions about AI impact.', life: 3000 });
    return;
  }
  if (postAiFormData.biopsyRecommended === null || postAiFormData.referralRecommended === null) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please answer both management questions (Biopsy? and Refer to Dermatology?).', life: 3000 });
    return;
  }

  submitting.value = true;
  try {
    const assignment = Object.values(gamesStore.assignmentsByBlock || {})
      .flat()
      .find((a: any) => a.case_id === caseId.value && a.user_id === userId.value);
    if (!assignment) {
      throw new Error('No assignment found for this case. Start or hydrate the game block first.');
    }
    const rawDiagnoses = [
      { rank: 1, raw_text: postAiFormData.diagnosisRank1Text, selected: selectedDiagnosisByRank[1] },
      { rank: 2, raw_text: postAiFormData.diagnosisRank2Text, selected: selectedDiagnosisByRank[2] },
      { rank: 3, raw_text: postAiFormData.diagnosisRank3Text, selected: selectedDiagnosisByRank[3] }
    ].filter(d => d.raw_text);
    const resolvedEntries = rawDiagnoses.map(d => {
      const match = diagnosisTerms.value.find(t => t.name.toLowerCase() === (d.selected?.name || d.raw_text || '').toLowerCase());
      return { rank: d.rank, raw_text: d.raw_text, diagnosis_term_id: d.selected?.id || match?.id || null, selectedName: d.selected?.name || null };
    });
    console.debug('POST assessment diagnosis debug', {
      case_id: caseId.value,
      assignment_id: assignment.id,
      rawDiagnoses,
      resolvedEntries
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
      biopsy_recommended: postAiFormData.biopsyRecommended,
      referral_recommended: postAiFormData.referralRecommended,
      diagnosis_entries: diagnosisEntries,
    };
    console.debug('Submitting POST assessment payload', assessmentPayload);
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
        console.debug('Backend indicates block complete; navigating to report', {
          block_index: data.block_index,
          report_available: data.report_available
        });
        router.push({ path: `/game/report/${data.block_index}` });
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
  <div class="case-container p-4">
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
  <CaseImageViewer :images="images" :loading="loading" :caseId="caseId" />
  <AIPredictionsTable :aiOutputs="aiOutputs" :isPostAiPhase="isPostAiPhase" />
  <!-- Metadata display removed -->
      </div>

      <!-- Right Column - Assessment Form -->
      <div class="col-12 lg:col-7">
  <AssessmentForm
          :formData="currentFormData"
          :diagnosisTerms="diagnosisTerms"
          :scoreOptions="scoreOptions"
          :submitted="submitted"
          :submitting="submitting"
          :isPostAiPhase="isPostAiPhase"
          :aiUsefulnessOptions="aiUsefulnessOptions"
          :changeOptions="changeOptions"
          :getConfidenceLabel="getConfidenceLabel"
          :getCertaintyLabel="getCertaintyLabel"
          @submit-form="handleSubmit"
          @select-diagnosis="onDiagnosisSelected"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.case-container {
  max-width: 1600px;
  margin: 0 auto;
}
/* Styles for child components are in their respective files or global */
</style>
