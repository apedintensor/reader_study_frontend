<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useUserStore } from '../stores/userStore';
import { useCaseStore } from '../stores/caseStore';
import apiClient from '../api';
import type { MenuItem } from 'primevue/menuitem';

// Import new components
import CaseProgressSteps from '../components/CaseProgressSteps.vue';
import CaseImageViewer from '../components/CaseImageViewer.vue';
import CaseMetadataDisplay from '../components/CaseMetadataDisplay.vue';
import AIPredictionsTable from '../components/AIPredictionsTable.vue';
import AssessmentForm from '../components/AssessmentForm.vue';

import Toast from 'primevue/toast'; // Keep Toast here for page-level messages

// --- Interfaces (Keep necessary interfaces here or move to a central types file) ---
interface ImageRead {
  id: number;
  image_url: string;
  case_id: number;
}

interface CaseMetaDataRead {
  id: number;
  case_id: number;
  age?: number | null;
  gender?: string | null;
  fever_history?: boolean | null;
  psoriasis_history?: boolean | null;
  other_notes?: string | null;
}

interface ManagementStrategyRead {
  id: number;
  name: string;
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

interface AssessmentCreate {
  is_post_ai: boolean;
  user_id: number;
  case_id: number;
  assessable_image_score?: number | null;
  confidence_level_top1?: number | null;
  management_confidence?: number | null;
  certainty_level?: number | null;
  change_diagnosis_after_ai?: boolean | null;
  change_management_after_ai?: boolean | null;
  ai_usefulness?: string | null;
}

interface DiagnosisCreate {
  assessment_user_id: number;
  assessment_case_id: number;
  assessment_is_post_ai: boolean;
  diagnosis_id: number;
  rank: number;
}

interface ManagementPlanCreate {
  assessment_user_id: number;
  assessment_case_id: number;
  assessment_is_post_ai: boolean;
  strategy_id: number;
  free_text?: string | null;
}

interface Case {
  id: number;
  ground_truth_diagnosis_id: number | null;
  typical_diagnosis: boolean;
  created_at: string | null;
  ground_truth_diagnosis: DiagnosisTermRead | null;
  case_metadata_relation: CaseMetaDataRead | null;
  images: ImageRead[];
  ai_outputs: AIOutputRead[];
}

// --- Component Setup ---
const route = useRoute();
const router = useRouter();
const toast = useToast();
const userStore = useUserStore();
const caseStore = useCaseStore();

const caseId = computed(() => parseInt(route.params.id as string, 10));
const userId = computed(() => userStore.user?.id);
const submitted = ref(false);

// --- State ---
const images = ref<ImageRead[]>([]);
const metadata = ref<CaseMetaDataRead | null>(null);
const managementStrategies = ref<ManagementStrategyRead[]>([]);
const diagnosisTerms = ref<DiagnosisTermRead[]>([]);
const aiOutputs = ref<AIOutputRead[]>([]);
const loading = ref(false);
const submitting = ref(false);

// --- Phase Detection ---
const isPreAiCompleteForCurrentCase = computed(() => {
  const progress = caseStore.caseProgress[caseId.value];
  return progress ? progress.preCompleted : false;
});
const isPostAiPhase = computed(() => isPreAiCompleteForCurrentCase.value);

// --- Steps for Progress Indicator ---
const items = computed<MenuItem[]>(() => [
  { label: 'Pre-AI Assessment', command: () => console.log('Pre-AI step clicked (current phase: ' + (isPostAiPhase.value ? 'post' : 'pre') + ')')},
  { label: 'Post-AI Assessment', command: () => console.log('Post-AI step clicked (current phase: ' + (isPostAiPhase.value ? 'post' : 'pre') + ')') },
  { label: 'Complete', command: () => console.log('Complete step clicked') }
]);

const activeStep = computed(() => {
  const progress = caseStore.caseProgress[caseId.value];
  if (progress?.postCompleted) return 2;
  if (progress?.preCompleted || (route.query.phase === 'post' && progress?.preCompleted)) return 1;
  return 0;
});


// --- Form Data ---
const preAiFormData = reactive({
  diagnosisRank1Id: null as number | null,
  diagnosisRank2Id: null as number | null,
  diagnosisRank3Id: null as number | null,
  confidenceScore: 3,
  managementStrategyId: null as number | null,
  managementNotes: '',
  certaintyScore: 3,
});

const postAiFormData = reactive({
  diagnosisRank1Id: null as number | null,
  diagnosisRank2Id: null as number | null,
  diagnosisRank3Id: null as number | null,
  confidenceScore: 3,
  managementStrategyId: null as number | null,
  managementNotes: '',
  certaintyScore: 3,
  changeDiagnosis: null as boolean | null,
  changeManagement: null as boolean | null,
  aiUsefulness: null as string | null,
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

const scoreOptions = ref([
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 }
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
      apiClient.get<ManagementStrategyRead[]>('/api/management_strategies/'),
      apiClient.get<DiagnosisTermRead[]>('/api/diagnosis_terms/')
    ];

    const [imagesResponse, caseResponse, strategiesResponse, termsResponse] = await Promise.all(commonFetches);

    images.value = imagesResponse.data as ImageRead[];
    const caseData = caseResponse.data as Case;
    if (!caseData) {
      throw new Error('Failed to load case data');
    }
    metadata.value = caseData.case_metadata_relation;
    managementStrategies.value = strategiesResponse.data as ManagementStrategyRead[];
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
                postAiFormData.diagnosisRank1Id = parsedPreAi.diagnosisRank1Id;
                postAiFormData.diagnosisRank2Id = parsedPreAi.diagnosisRank2Id;
                postAiFormData.diagnosisRank3Id = parsedPreAi.diagnosisRank3Id;
                postAiFormData.confidenceScore = parsedPreAi.confidenceScore;
                postAiFormData.managementStrategyId = parsedPreAi.managementStrategyId;
                postAiFormData.managementNotes = parsedPreAi.managementNotes;
                postAiFormData.certaintyScore = parsedPreAi.certaintyScore;
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
    diagnosisRank1Id: null, diagnosisRank2Id: null, diagnosisRank3Id: null,
    confidenceScore: 3, managementStrategyId: null, managementNotes: '', certaintyScore: 3,
  });
  Object.assign(postAiFormData, {
    diagnosisRank1Id: null, diagnosisRank2Id: null, diagnosisRank3Id: null,
    confidenceScore: 3, managementStrategyId: null, managementNotes: '', certaintyScore: 3,
    changeDiagnosis: null, changeManagement: null, aiUsefulness: null,
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
    await fetchData(); // Fetch data for the new case
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
  }
}, { immediate: false }); // `immediate: false` to avoid running on initial load before route watcher

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
  if (preAiFormData.diagnosisRank1Id === null || preAiFormData.diagnosisRank2Id === null || preAiFormData.diagnosisRank3Id === null) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please select all top 3 diagnoses.', life: 3000 });
    return;
  }
  if (preAiFormData.managementStrategyId === null) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please select a management strategy.', life: 3000 });
    return;
  }

  submitting.value = true;
  try {
    const assessmentPayload: AssessmentCreate = {
      is_post_ai: false, user_id: userId.value, case_id: caseId.value,
      confidence_level_top1: preAiFormData.confidenceScore,
      management_confidence: preAiFormData.certaintyScore, // Assuming confidenceScore was intended for both
      certainty_level: preAiFormData.certaintyScore,
    };
    await apiClient.post('/api/assessments/', assessmentPayload);

    const diagnoses: DiagnosisCreate[] = [
      { assessment_user_id: userId.value!, assessment_case_id: caseId.value, assessment_is_post_ai: false, diagnosis_id: preAiFormData.diagnosisRank1Id!, rank: 1 },
      { assessment_user_id: userId.value!, assessment_case_id: caseId.value, assessment_is_post_ai: false, diagnosis_id: preAiFormData.diagnosisRank2Id!, rank: 2 },
      { assessment_user_id: userId.value!, assessment_case_id: caseId.value, assessment_is_post_ai: false, diagnosis_id: preAiFormData.diagnosisRank3Id!, rank: 3 }
    ];
    for (const diagnosis of diagnoses) {
      await apiClient.post('/api/diagnoses/', diagnosis);
    }

    const managementPlanPayload: ManagementPlanCreate = {
      assessment_user_id: userId.value!, assessment_case_id: caseId.value, assessment_is_post_ai: false,
      strategy_id: preAiFormData.managementStrategyId!,
      free_text: preAiFormData.managementNotes || null,
    };
    await apiClient.post('/api/management_plans/', managementPlanPayload);

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
  if (postAiFormData.diagnosisRank1Id === null || postAiFormData.diagnosisRank2Id === null || postAiFormData.diagnosisRank3Id === null) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please select all top 3 updated diagnoses.', life: 3000 });
    return;
  }
  if (postAiFormData.managementStrategyId === null) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please select an updated management strategy.', life: 3000 });
    return;
  }
  if (postAiFormData.changeDiagnosis === null || postAiFormData.changeManagement === null || postAiFormData.aiUsefulness === null) {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please answer the questions about AI impact.', life: 3000 });
    return;
  }

  submitting.value = true;
  try {
    const assessmentPayload: AssessmentCreate = {
      is_post_ai: true, user_id: userId.value, case_id: caseId.value,
      confidence_level_top1: postAiFormData.confidenceScore,
      management_confidence: postAiFormData.certaintyScore, // Assuming confidenceScore was intended for both
      certainty_level: postAiFormData.certaintyScore,
      change_diagnosis_after_ai: postAiFormData.changeDiagnosis,
      change_management_after_ai: postAiFormData.changeManagement,
      ai_usefulness: postAiFormData.aiUsefulness,
    };
    await apiClient.post('/api/assessments/', assessmentPayload);

    const diagnoses: DiagnosisCreate[] = [
      { assessment_user_id: userId.value!, assessment_case_id: caseId.value, assessment_is_post_ai: true, diagnosis_id: postAiFormData.diagnosisRank1Id!, rank: 1 },
      { assessment_user_id: userId.value!, assessment_case_id: caseId.value, assessment_is_post_ai: true, diagnosis_id: postAiFormData.diagnosisRank2Id!, rank: 2 },
      { assessment_user_id: userId.value!, assessment_case_id: caseId.value, assessment_is_post_ai: true, diagnosis_id: postAiFormData.diagnosisRank3Id!, rank: 3 }
    ];
    for (const diagnosis of diagnoses) {
      await apiClient.post('/api/diagnoses/', diagnosis);
    }

    const managementPlanPayload: ManagementPlanCreate = {
      assessment_user_id: userId.value!, assessment_case_id: caseId.value, assessment_is_post_ai: true,
      strategy_id: postAiFormData.managementStrategyId!,
      free_text: postAiFormData.managementNotes || null,
    };
    await apiClient.post('/api/management_plans/', managementPlanPayload);

    await caseStore.markProgress(caseId.value, true); // Mark post-AI as complete
    clearLocalStorage(preAiLocalStorageKey.value); // Clear pre-AI after successful post-AI
    clearLocalStorage(postAiLocalStorageKey.value);
    resetFormData();
    submitted.value = false;

    const nextCase = caseStore.getNextIncompleteCase();
    if (nextCase) {
      toast.add({ severity: 'success', summary: 'Case Completed!', detail: 'Great work! Moving to next case...', life: 2000 });
      router.push({ path: `/case/${nextCase.id}`, query: {} });
    } else {
      toast.add({ severity: 'success', summary: '🏅 All Cases Completed!', detail: 'Thank you for your valuable contributions! You have completed all cases.', life: 5000 });
      router.push('/');
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

</script>

<template>
  <div class="case-container p-4">
    <Toast />
    <CaseProgressSteps :items="items" :activeStep="activeStep" />

    <div class="grid">
      <!-- Left Column -->
      <div class="col-12 lg:col-5">
        <CaseImageViewer :images="images" :loading="loading" />
        <CaseMetadataDisplay :metadata="metadata" :isPostAiPhase="isPostAiPhase" />
        <AIPredictionsTable :aiOutputs="aiOutputs" :isPostAiPhase="isPostAiPhase" />
      </div>

      <!-- Right Column - Assessment Form -->
      <div class="col-12 lg:col-7">
        <AssessmentForm
          :formData="currentFormData"
          :diagnosisTerms="diagnosisTerms"
          :managementStrategies="managementStrategies"
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
.case-container {
  max-width: 1600px;
  margin: 0 auto;
}
/* Styles for child components are in their respective files or global */
</style>
