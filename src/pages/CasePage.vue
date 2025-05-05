<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useUserStore } from '../stores/userStore';
import { useCaseStore } from '../stores/caseStore';
import apiClient from '../api';

import Card from 'primevue/card';
import Carousel from 'primevue/carousel';
import Panel from 'primevue/panel';
import InputText from 'primevue/inputtext';
import Slider from 'primevue/slider';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import SelectButton from 'primevue/selectbutton';
import Divider from 'primevue/divider';
import Steps from 'primevue/steps';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import ProgressBar from 'primevue/progressbar';

// --- Interfaces ---
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
  assessment_id: number;
  diagnosis_id: number;
  rank: number;
}

interface ManagementPlanCreate {
  assessment_id: number;
  strategy_id: number;
  free_text?: string | null;
}

// --- Component Setup ---
const route = useRoute();
const router = useRouter();
const toast = useToast();
const userStore = useUserStore();
const caseStore = useCaseStore();

const caseId = computed(() => parseInt(route.params.id as string, 10));
const userId = computed(() => userStore.user?.id);

// --- State ---
const images = ref<ImageRead[]>([]);
const metadata = ref<CaseMetaDataRead | null>(null);
const managementStrategies = ref<ManagementStrategyRead[]>([]);
const diagnosisTerms = ref<DiagnosisTermRead[]>([]);
const aiOutputs = ref<AIOutputRead[]>([]);
const loading = ref(false);
const submitting = ref(false);

// --- Phase Detection ---
const caseProgress = computed(() => caseStore.getCaseProgress(caseId.value));
const isPreAiCompleteForCurrentCase = computed(() => caseProgress.value.preCompleted);
const isPostAiPhase = computed(() => isPreAiCompleteForCurrentCase.value);

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

const preAiLocalStorageKey = computed(() => `preAiFormData_${caseId.value}`);
const postAiLocalStorageKey = computed(() => `postAiFormData_${caseId.value}`);

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
  if (!caseId.value) return;
  loading.value = true;
  aiOutputs.value = [];
  diagnosisTerms.value = [];

  try {
    const commonFetches = [
      apiClient.get<ImageRead[]>(`/api/images/case/${caseId.value}`),
      apiClient.get<CaseMetaDataRead>(`/api/case_metadata/case/${caseId.value}`),
      apiClient.get<ManagementStrategyRead[]>('/api/management_strategies/'),
      apiClient.get<DiagnosisTermRead[]>('/api/diagnosis_terms/')
    ];

    if (isPostAiPhase.value) {
      commonFetches.push(apiClient.get<AIOutputRead[]>(`/api/ai_outputs/case/${caseId.value}`));
    }

    const responses = await Promise.all(commonFetches);

    images.value = responses[0].data;
    metadata.value = responses[1].data;
    managementStrategies.value = responses[2].data;
    diagnosisTerms.value = responses[3].data;

    if (isPostAiPhase.value && responses.length > 4) {
      aiOutputs.value = responses[4].data.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).slice(0, 5);
      loadFromLocalStorage(postAiLocalStorageKey.value, postAiFormData);
    } else {
      loadFromLocalStorage(preAiLocalStorageKey.value, preAiFormData);
    }
  } catch (error: any) {
    console.error('Failed to fetch case data:', error);
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load case data. Please try again.', life: 3000 });
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
  // Reset pre-AI form data
  Object.assign(preAiFormData, {
    diagnosisRank1Id: null,
    diagnosisRank2Id: null,
    diagnosisRank3Id: null,
    confidenceScore: 3,
    managementStrategyId: null,
    managementNotes: '',
    certaintyScore: 3,
  });

  // Reset post-AI form data
  Object.assign(postAiFormData, {
    diagnosisRank1Id: null,
    diagnosisRank2Id: null,
    diagnosisRank3Id: null,
    confidenceScore: 3,
    managementStrategyId: null,
    managementNotes: '',
    certaintyScore: 3,
    changeDiagnosis: null,
    changeManagement: null,
    aiUsefulness: null,
  });
};

watch(preAiFormData, () => saveToLocalStorage(preAiLocalStorageKey.value, preAiFormData), { deep: true });
watch(postAiFormData, () => saveToLocalStorage(postAiLocalStorageKey.value, postAiFormData), { deep: true });

watch(() => route.params.id, async (newId) => {
  const progress = caseStore.getCaseProgress(parseInt(newId as string, 10));
  if (!progress.preCompleted && route.query.phase === 'post') {
    toast.add({
      severity: 'warn',
      summary: 'Access Denied',
      detail: 'Please complete the Pre-AI assessment first.',
      life: 3000
    });
    router.replace(`/case/${newId}`);
    return;
  }
  await fetchData();
}, { immediate: true });

// --- Submission Logic ---
const handlePreAiSubmit = async () => {
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
      is_post_ai: false,
      user_id: userId.value,
      case_id: caseId.value,
      confidence_level_top1: parseInt(String(preAiFormData.confidenceScore)),
      management_confidence: parseInt(String(preAiFormData.confidenceScore)),
      certainty_level: parseInt(String(preAiFormData.certaintyScore)),
    };
    const assessmentRes = await apiClient.post('/api/assessments/', assessmentPayload);
    console.log('Assessment response:', assessmentRes.data);
    const assessmentId = assessmentRes.data.id;

    if (!assessmentId) throw new Error("Failed to get assessment ID from response.");

    // Submit diagnoses one at a time
    const diagnoses = [
      { assessment_id: assessmentId, diagnosis_id: preAiFormData.diagnosisRank1Id!, rank: 1 },
      { assessment_id: assessmentId, diagnosis_id: preAiFormData.diagnosisRank2Id!, rank: 2 },
      { assessment_id: assessmentId, diagnosis_id: preAiFormData.diagnosisRank3Id!, rank: 3 }
    ];

    for (const diagnosis of diagnoses) {
      console.log('Submitting diagnosis:', diagnosis);
      await apiClient.post('/api/diagnoses/', diagnosis);
    }
    
    const managementPlanPayload: ManagementPlanCreate = {
      assessment_id: assessmentId,
      strategy_id: preAiFormData.managementStrategyId!,
      free_text: preAiFormData.managementNotes || null,
    };
    await apiClient.post('/api/management_plans/', managementPlanPayload);

    caseStore.markCaseComplete(caseId.value);
    clearLocalStorage(preAiLocalStorageKey.value);
    resetFormData();
    toast.add({ severity: 'success', summary: 'Success', detail: 'Pre-AI assessment saved. Proceeding to AI suggestions.', life: 2000 });

    await fetchData();
  } catch (error: any) {
    console.error('Failed to submit pre-AI assessment:', error);
    handleApiError(error, 'Pre-AI Submission Error');
  } finally {
    submitting.value = false;
  }
};

const handlePostAiSubmit = async () => {
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
      is_post_ai: true,
      user_id: userId.value,
      case_id: caseId.value,
      confidence_level_top1: parseInt(String(postAiFormData.confidenceScore)),
      management_confidence: parseInt(String(postAiFormData.confidenceScore)),
      certainty_level: parseInt(String(postAiFormData.certaintyScore)),
      change_diagnosis_after_ai: postAiFormData.changeDiagnosis,
      change_management_after_ai: postAiFormData.changeManagement,
      ai_usefulness: postAiFormData.aiUsefulness,
    };
    const assessmentRes = await apiClient.post('/api/assessments/', assessmentPayload);
    const assessmentId = assessmentRes.data.id;

    if (!assessmentId) throw new Error("Failed to get assessment ID from response.");

    // Submit diagnoses one at a time
    const diagnoses = [
      { assessment_id: assessmentId, diagnosis_id: postAiFormData.diagnosisRank1Id!, rank: 1 },
      { assessment_id: assessmentId, diagnosis_id: postAiFormData.diagnosisRank2Id!, rank: 2 },
      { assessment_id: assessmentId, diagnosis_id: postAiFormData.diagnosisRank3Id!, rank: 3 }
    ];

    for (const diagnosis of diagnoses) {
      console.log('Submitting post-AI diagnosis:', diagnosis);
      await apiClient.post('/api/diagnoses/', diagnosis);
    }

    const managementPlanPayload: ManagementPlanCreate = {
      assessment_id: assessmentId,
      strategy_id: postAiFormData.managementStrategyId!,
      free_text: postAiFormData.managementNotes || null,
    };
    await apiClient.post('/api/management_plans/', managementPlanPayload);

    caseStore.markCaseComplete(caseId.value);
    clearLocalStorage(postAiLocalStorageKey.value);
    resetFormData();

    const nextCase = caseStore.getNextIncompleteCase();
    if (nextCase) {
      toast.add({ 
        severity: 'success', 
        summary: 'Case Completed!', 
        detail: 'Great work! Moving to next case...', 
        life: 2000 
      });
      router.push(`/case/${nextCase.id}`);
    } else {
      toast.add({ 
        severity: 'success', 
        summary: '🏅 All Cases Completed!', 
        detail: 'Thank you for your valuable contributions! You have completed all cases.', 
        life: 5000 
      });
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

// --- Computed Functions for Labels ---
const getConfidenceLabel = (score: number) => {
  switch(score) {
    case 1: return 'Very Low Confidence';
    case 2: return 'Low Confidence';
    case 3: return 'Moderate Confidence';
    case 4: return 'High Confidence';
    case 5: return 'Very High Confidence';
    default: return 'Select Confidence Level';
  }
};

const getCertaintyLabel = (score: number) => {
  switch(score) {
    case 1: return 'Very Uncertain';
    case 2: return 'Somewhat Uncertain';
    case 3: return 'Moderately Certain';
    case 4: return 'Quite Certain';
    case 5: return 'Very Certain';
    default: return 'Select Certainty Level';
  }
};
</script>

<template>
  <div class="case-container p-4">
    <Toast />
    
    <!-- Progress Steps -->
    <Card class="mb-4">
      <template #content>
        <Steps :model="items" :activeIndex="activeStep" />
      </template>
    </Card>

    <div class="grid">
      <!-- Left Column -->
      <div class="col-12 lg:col-5">
        <!-- Images Section -->
        <Card class="mb-4">
          <template #title>
            <span class="text-xl font-bold flex align-items-center">
              <i class="pi pi-images mr-2"></i> Case Images
            </span>
          </template>
          <template #content>
            <div v-if="loading" class="flex align-items-center justify-content-center p-4">
              <i class="pi pi-spin pi-spinner text-2xl mr-2"></i>
              <span>Loading images...</span>
            </div>
            <div v-else>
              <Carousel :value="images" :numVisible="1" :numScroll="1" v-if="images.length > 0"
                       :showNavigators="false" class="mb-4">
                <template #item="slotProps">
                  <div class="surface-card border-round m-2 text-center">
                    <img :src="slotProps.data.image_url" :alt="'Case Image ' + slotProps.data.id" 
                         class="w-full block shadow-2 border-round max-h-[60vh] object-contain" />
                  </div>
                </template>
              </Carousel>
              <Message v-else severity="info" text="No images available for this case." />
            </div>
          </template>
        </Card>

        <!-- Metadata Section -->
        <Card class="mb-4">
          <template #title>
            <span class="text-xl font-bold flex align-items-center">
              <i class="pi pi-info-circle mr-2"></i> Case Information
              <Tag :value="isPostAiPhase ? 'Post-AI Phase' : 'Pre-AI Phase'"
                   :severity="isPostAiPhase ? 'info' : 'warning'"
                   class="ml-auto" />
            </span>
          </template>
          <template #content>
            <div v-if="metadata" class="grid">
              <div v-if="metadata.age !== null" class="col-12 md:col-6">
                <div class="surface-card border-round p-3">
                  <div class="text-500 font-medium mb-2">Age</div>
                  <div class="text-900">{{ metadata.age }}</div>
                </div>
              </div>
              
              <div v-if="metadata.gender" class="col-12 md:col-6">
                <div class="surface-card border-round p-3">
                  <div class="text-500 font-medium mb-2">Gender</div>
                  <div class="text-900">{{ metadata.gender }}</div>
                </div>
              </div>
              
              <div v-if="metadata.fever_history !== null" class="col-12 md:col-6">
                <div class="surface-card border-round p-3">
                  <div class="text-500 font-medium mb-2">Fever History</div>
                  <div class="text-900">
                    <i :class="metadata.fever_history ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'" />
                    {{ metadata.fever_history ? 'Yes' : 'No' }}
                  </div>
                </div>
              </div>
              
              <div v-if="metadata.psoriasis_history !== null" class="col-12 md:col-6">
                <div class="surface-card border-round p-3">
                  <div class="text-500 font-medium mb-2">Psoriasis History</div>
                  <div class="text-900">
                    <i :class="metadata.psoriasis_history ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'" />
                    {{ metadata.psoriasis_history ? 'Yes' : 'No' }}
                  </div>
                </div>
              </div>
              
              <div v-if="metadata.other_notes" class="col-12">
                <div class="surface-card border-round p-3">
                  <div class="text-500 font-medium mb-2">Additional Notes</div>
                  <div class="text-900">{{ metadata.other_notes }}</div>
                </div>
              </div>
            </div>
            <div v-else class="flex align-items-center justify-content-center p-4">
              <i class="pi pi-spin pi-spinner mr-2"></i>
              <span>Loading metadata...</span>
            </div>
          </template>
        </Card>

        <!-- AI Predictions Section -->
        <Card v-if="isPostAiPhase" class="mb-4">
          <template #title>
            <span class="text-xl font-bold flex align-items-center">
              <i class="pi pi-star mr-2"></i> AI Predictions
            </span>
          </template>
          <template #content>
            <DataTable :value="aiOutputs" 
                      class="p-datatable-sm" 
                      v-if="aiOutputs.length > 0"
                      :showGridlines="true"
                      stripedRows>
              <Column field="rank" header="Rank" style="width: 15%">
                <template #body="slotProps">
                  <Tag :value="'#' + slotProps.data.rank" severity="info" />
                </template>
              </Column>
              <Column field="prediction.name" header="Diagnosis" />
              <Column field="confidence_score" header="Confidence">
                <template #body="slotProps">
                  <div class="flex flex-column">
                    <ProgressBar :value="(slotProps.data.confidence_score * 100)"
                               :class="{'bg-primary': slotProps.data.confidence_score >= 0.7,
                                       'bg-warning': slotProps.data.confidence_score >= 0.4 && slotProps.data.confidence_score < 0.7,
                                       'bg-danger': slotProps.data.confidence_score < 0.4}"
                               class="mb-2" />
                    <small class="text-600">{{ Math.round(slotProps.data.confidence_score * 100) }}%</small>
                  </div>
                </template>
              </Column>
            </DataTable>
            <Message v-else severity="info" text="No AI predictions available for this case." />
          </template>
        </Card>
      </div>

      <!-- Right Column - Assessment Form -->
      <div class="col-12 lg:col-7">
        <Card>
          <template #title>
            <span class="text-xl font-bold flex align-items-center">
              <i :class="isPostAiPhase ? 'pi pi-check-circle' : 'pi pi-user-edit'" class="mr-2"></i>
              {{ isPostAiPhase ? 'Post-AI Assessment' : 'Pre-AI Assessment' }}
            </span>
          </template>
          <template #content>
            <!-- Pre-AI Assessment Form -->
            <form v-if="!isPostAiPhase" @submit.prevent="handlePreAiSubmit" class="p-fluid">
              <div class="grid">
                <div class="col-12">
                  <div class="card">
                    <h3 class="text-lg font-medium mb-3">
                      <i class="pi pi-list mr-2"></i>Diagnosis Ranking
                    </h3>
                    
                    <div class="field mb-4">
                      <label for="diag1" class="text-600">Primary Diagnosis (Rank 1)</label>
                      <Dropdown id="diag1" 
                              v-model="preAiFormData.diagnosisRank1Id"
                              :options="diagnosisTerms"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Select primary diagnosis"
                              class="w-full"
                              :class="{'p-invalid': submitted && !preAiFormData.diagnosisRank1Id}"
                              filter
                              v-tooltip.top="'Select your primary diagnosis'"
                              required />
                    </div>

                    <div class="field mb-4">
                      <label for="diag2" class="text-600">Secondary Diagnosis (Rank 2)</label>
                      <Dropdown id="diag2"
                              v-model="preAiFormData.diagnosisRank2Id"
                              :options="diagnosisTerms"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Select secondary diagnosis"
                              class="w-full"
                              :class="{'p-invalid': submitted && !preAiFormData.diagnosisRank2Id}"
                              filter
                              v-tooltip.top="'Select your secondary diagnosis'"
                              required />
                    </div>

                    <div class="field mb-4">
                      <label for="diag3" class="text-600">Tertiary Diagnosis (Rank 3)</label>
                      <Dropdown id="diag3"
                              v-model="preAiFormData.diagnosisRank3Id"
                              :options="diagnosisTerms"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Select tertiary diagnosis"
                              class="w-full"
                              :class="{'p-invalid': submitted && !preAiFormData.diagnosisRank3Id}"
                              filter
                              v-tooltip.top="'Select your tertiary diagnosis'"
                              required />
                    </div>
                  </div>
                </div>

                <Divider />

                <div class="col-12">
                  <div class="card">
                    <h3 class="text-lg font-medium mb-3">
                      <i class="pi pi-chart-line mr-2"></i>Confidence Assessment
                    </h3>
                    
                    <div class="field mb-4">
                      <label class="text-600 block mb-2">Confidence in Primary Diagnosis</label>
                      <div class="flex align-items-center gap-3">
                        <SelectButton v-model="preAiFormData.confidenceScore"
                                    :options="scoreOptions"
                                    optionLabel="label"
                                    optionValue="value"
                                    v-tooltip.top="'1=Low confidence, 5=High confidence'" />
                        <span class="text-sm text-600">{{ getConfidenceLabel(preAiFormData.confidenceScore) }}</span>
                      </div>
                    </div>

                    <div class="field mb-4">
                      <label for="management" class="text-600">Management Strategy</label>
                      <Dropdown id="management"
                              v-model="preAiFormData.managementStrategyId"
                              :options="managementStrategies"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Select management strategy"
                              class="w-full"
                              :class="{'p-invalid': submitted && !preAiFormData.managementStrategyId}"
                              v-tooltip.top="'Choose the most appropriate management strategy'"
                              required />
                    </div>

                    <div class="field mb-4">
                      <label for="managementNotes" class="text-600">Management Notes</label>
                      <Textarea id="managementNotes"
                              v-model="preAiFormData.managementNotes"
                              rows="3"
                              autoResize
                              placeholder="Enter any additional notes about the management plan" />
                    </div>

                    <div class="field mb-4">
                      <label class="text-600 block mb-2">Management Plan Certainty</label>
                      <div class="flex align-items-center gap-3">
                        <SelectButton v-model="preAiFormData.certaintyScore"
                                    :options="scoreOptions"
                                    optionLabel="label"
                                    optionValue="value"
                                    v-tooltip.top="'1=Low certainty, 5=High certainty'" />
                        <span class="text-sm text-600">{{ getCertaintyLabel(preAiFormData.certaintyScore) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="col-12">
                  <Button type="submit"
                          :label="submitting ? 'Submitting...' : 'Submit & View AI Suggestions'"
                          :loading="submitting"
                          severity="primary"
                          class="w-full"
                          :disabled="submitting" />
                </div>
              </div>
            </form>

            <!-- Post-AI Assessment Form -->
            <form v-else @submit.prevent="handlePostAiSubmit" class="p-fluid">
              <div class="grid">
                <div class="col-12">
                  <div class="card">
                    <h3 class="text-lg font-medium mb-3">
                      <i class="pi pi-list mr-2"></i>Updated Diagnosis Ranking
                    </h3>
                    
                    <div class="field mb-4">
                      <label for="postDiag1" class="text-600">Updated Primary Diagnosis (Rank 1)</label>
                      <Dropdown id="postDiag1"
                              v-model="postAiFormData.diagnosisRank1Id"
                              :options="diagnosisTerms"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Select updated primary diagnosis"
                              class="w-full"
                              :class="{'p-invalid': submitted && !postAiFormData.diagnosisRank1Id}"
                              filter
                              required />
                    </div>

                    <div class="field mb-4">
                      <label for="postDiag2" class="text-600">Updated Secondary Diagnosis (Rank 2)</label>
                      <Dropdown id="postDiag2"
                              v-model="postAiFormData.diagnosisRank2Id"
                              :options="diagnosisTerms"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Select updated secondary diagnosis"
                              class="w-full"
                              :class="{'p-invalid': submitted && !postAiFormData.diagnosisRank2Id}"
                              filter
                              required />
                    </div>

                    <div class="field mb-4">
                      <label for="postDiag3" class="text-600">Updated Tertiary Diagnosis (Rank 3)</label>
                      <Dropdown id="postDiag3"
                              v-model="postAiFormData.diagnosisRank3Id"
                              :options="diagnosisTerms"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Select updated tertiary diagnosis"
                              class="w-full"
                              :class="{'p-invalid': submitted && !postAiFormData.diagnosisRank3Id}"
                              filter
                              required />
                    </div>
                  </div>
                </div>

                <Divider />

                <div class="col-12">
                  <div class="card">
                    <h3 class="text-lg font-medium mb-3">
                      <i class="pi pi-chart-line mr-2"></i>Updated Confidence Assessment
                    </h3>
                    
                    <div class="field mb-4">
                      <label class="text-600 block mb-2">Updated Confidence in Primary Diagnosis</label>
                      <div class="flex align-items-center gap-3">
                        <SelectButton v-model="postAiFormData.confidenceScore"
                                    :options="scoreOptions"
                                    optionLabel="label"
                                    optionValue="value"
                                    v-tooltip.top="'1=Low confidence, 5=High confidence'" />
                        <span class="text-sm text-600">{{ getConfidenceLabel(postAiFormData.confidenceScore) }}</span>
                      </div>
                    </div>

                    <div class="field mb-4">
                      <label for="postManagement" class="text-600">Updated Management Strategy</label>
                      <Dropdown id="postManagement"
                              v-model="postAiFormData.managementStrategyId"
                              :options="managementStrategies"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Select updated management strategy"
                              class="w-full"
                              :class="{'p-invalid': submitted && !postAiFormData.managementStrategyId}"
                              required />
                    </div>

                    <div class="field mb-4">
                      <label for="postManagementNotes" class="text-600">Updated Management Notes</label>
                      <Textarea id="postManagementNotes"
                              v-model="postAiFormData.managementNotes"
                              rows="3"
                              autoResize
                              placeholder="Enter any additional notes about the updated management plan" />
                    </div>

                    <div class="field mb-4">
                      <label class="text-600 block mb-2">Updated Management Plan Certainty</label>
                      <div class="flex align-items-center gap-3">
                        <SelectButton v-model="postAiFormData.certaintyScore"
                                    :options="scoreOptions"
                                    optionLabel="label"
                                    optionValue="value"
                                    v-tooltip.top="'1=Low certainty, 5=High certainty'" />
                        <span class="text-sm text-600">{{ getCertaintyLabel(postAiFormData.certaintyScore) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Divider />

                <div class="col-12">
                  <div class="card">
                    <h3 class="text-lg font-medium mb-3">
                      <i class="pi pi-star mr-2"></i>AI Impact Assessment
                    </h3>
                    
                    <div class="field mb-4">
                      <label class="text-600 block mb-2">Did AI suggestions change your primary diagnosis?</label>
                      <SelectButton v-model="postAiFormData.changeDiagnosis"
                                  :options="changeOptions"
                                  optionLabel="label"
                                  optionValue="value"
                                  required />
                    </div>

                    <div class="field mb-4">
                      <label class="text-600 block mb-2">Did AI suggestions change your management plan?</label>
                      <SelectButton v-model="postAiFormData.changeManagement"
                                  :options="changeOptions"
                                  optionLabel="label"
                                  optionValue="value"
                                  required />
                    </div>

                    <div class="field mb-4">
                      <label for="aiUsefulness" class="text-600">How useful were the AI suggestions?</label>
                      <Dropdown id="aiUsefulness"
                              v-model="postAiFormData.aiUsefulness"
                              :options="aiUsefulnessOptions"
                              optionLabel="label"
                              optionValue="value"
                              placeholder="Select usefulness level"
                              class="w-full"
                              required />
                    </div>
                  </div>
                </div>

                <div class="col-12">
                  <Button type="submit"
                          :label="submitting ? 'Submitting...' : 'Complete Assessment'"
                          icon="pi pi-check-circle"
                          :loading="submitting"
                          severity="success"
                          class="w-full"
                          :disabled="submitting" />
                </div>
              </div>
            </form>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.case-container {
  max-width: 1600px;
  margin: 0 auto;
}

:deep(.p-card) {
  background: var(--surface-card);
  border-radius: var(--border-radius);
}

:deep(.p-steps) {
  background: var(--surface-card);
  border-radius: var(--border-radius);
  padding: 1.5rem;
}

:deep(.p-datatable) {
  background: var(--surface-card);
}

:deep(.p-selectbutton) {
  display: flex;
  flex-wrap: wrap;
}

:deep(.p-selectbutton .p-button) {
  flex: 1;
}

:deep(.p-dropdown), :deep(.p-selectbutton) {
  width: 100%;
}

:deep(.p-progressbar) {
  height: 0.5rem;
}

@media screen and (max-width: 960px) {
  .case-container {
    padding: 1rem;
  }
}
</style>
