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
      confidence_level_top1: preAiFormData.confidenceScore,
      management_confidence: preAiFormData.confidenceScore,
      certainty_level: preAiFormData.certaintyScore,
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
      confidence_level_top1: postAiFormData.confidenceScore,
      management_confidence: postAiFormData.confidenceScore,
      certainty_level: postAiFormData.certaintyScore,
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
    toast.add({ severity: 'success', summary: 'Success', detail: 'Post-AI assessment saved.', life: 2000 });

    const nextCase = caseStore.getNextIncompleteCase();
    if (nextCase) {
      router.push(`/case/${nextCase.id}`);
    } else {
      router.push('/complete');
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
</script>

<template>
  <div class="case-page p-4">
    <Toast />
    <Card>
      <template #title>
        Case Assessment - ID: {{ caseId }} ({{ isPostAiPhase ? 'Post-AI' : 'Pre-AI' }})
      </template>
      <template #content>
        <div v-if="loading" class="text-center">
          <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i> Loading Case Data...
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Carousel :value="images" :numVisible="1" :numScroll="1" v-if="images.length > 0" class="mb-4">
              <template #item="slotProps">
                <div class="border border-surface-200 dark:border-surface-700 rounded m-2 p-4 text-center">
                  <img :src="slotProps.data.image_url" :alt="'Case Image ' + slotProps.data.id" class="w-full block rounded max-h-[60vh] object-contain" />
                </div>
              </template>
            </Carousel>
            <div v-else class="text-center p-4 border border-surface-200 dark:border-surface-700 rounded mb-4">
              No images available for this case.
            </div>

            <Panel header="Case Metadata" toggleable collapsed v-if="metadata" class="mb-4">
              <ul class="list-none p-0 m-0">
                <li v-if="metadata.age !== null && metadata.age !== undefined"><strong>Age:</strong> {{ metadata.age }}</li>
                <li v-if="metadata.gender"><strong>Gender:</strong> {{ metadata.gender }}</li>
                <li v-if="metadata.fever_history !== null && metadata.fever_history !== undefined"><strong>Fever History:</strong> {{ metadata.fever_history ? 'Yes' : 'No' }}</li>
                <li v-if="metadata.psoriasis_history !== null && metadata.psoriasis_history !== undefined"><strong>Psoriasis History:</strong> {{ metadata.psoriasis_history ? 'Yes' : 'No' }}</li>
                <li v-if="metadata.other_notes"><strong>Other Notes:</strong> {{ metadata.other_notes }}</li>
              </ul>
              <p v-if="!metadata.age && !metadata.gender && metadata.fever_history === null && metadata.psoriasis_history === null && !metadata.other_notes">
                No metadata available.
              </p>
            </Panel>
            <Panel header="Case Metadata" v-else class="mb-4">
              <p>Loading metadata...</p>
            </Panel>

            <Panel header="AI Predictions (Top 5)" v-if="isPostAiPhase" class="mb-4">
              <div v-if="aiOutputs.length > 0">
                <DataTable :value="aiOutputs" size="small">
                  <Column field="rank" header="Rank"></Column>
                  <Column field="prediction.name" header="Diagnosis"></Column>
                  <Column field="confidence_score" header="Confidence">
                    <template #body="slotProps">
                      {{ slotProps.data.confidence_score !== null ? (slotProps.data.confidence_score * 100).toFixed(1) + '%' : 'N/A' }}
                    </template>
                  </Column>
                </DataTable>
              </div>
              <p v-else>No AI predictions available for this case.</p>
            </Panel>
          </div>

          <div>
            <form v-if="!isPostAiPhase" @submit.prevent="handlePreAiSubmit">
              <div class="p-fluid space-y-4">
                <h3 class="font-semibold text-lg mb-2">Your Assessment (Pre-AI)</h3>
                <div class="field">
                  <label for="diag1">Top Diagnosis (Rank 1)</label>
                  <Dropdown id="diag1" v-model="preAiFormData.diagnosisRank1Id" :options="diagnosisTerms" optionLabel="name" optionValue="id" placeholder="Select Diagnosis 1" required filter class="w-full" />
                </div>
                <div class="field">
                  <label for="diag2">Second Diagnosis (Rank 2)</label>
                  <Dropdown id="diag2" v-model="preAiFormData.diagnosisRank2Id" :options="diagnosisTerms" optionLabel="name" optionValue="id" placeholder="Select Diagnosis 2" required filter class="w-full" />
                </div>
                <div class="field">
                  <label for="diag3">Third Diagnosis (Rank 3)</label>
                  <Dropdown id="diag3" v-model="preAiFormData.diagnosisRank3Id" :options="diagnosisTerms" optionLabel="name" optionValue="id" placeholder="Select Diagnosis 3" required filter class="w-full" />
                </div>

                <div class="field">
                  <label for="confidence">Confidence in Top Diagnosis (1=Low, 5=High)</label>
                  <div class="flex items-center">
                    <Slider id="confidence" v-model="preAiFormData.confidenceScore" :min="1" :max="5" :step="1" class="w-full mr-4" />
                    <span>{{ preAiFormData.confidenceScore }}</span>
                  </div>
                </div>

                <div class="field">
                  <label for="management">Management Strategy</label>
                  <Dropdown id="management" v-model="preAiFormData.managementStrategyId" :options="managementStrategies" optionLabel="name" optionValue="id" placeholder="Select a strategy" required class="w-full" />
                </div>
                <div class="field">
                  <label for="managementNotes">Management Notes (Optional)</label>
                  <Textarea id="managementNotes" v-model="preAiFormData.managementNotes" rows="3" class="w-full" />
                </div>

                <div class="field">
                  <label for="certainty">Certainty of Management Plan (1=Low, 5=High)</label>
                  <div class="flex items-center">
                    <Slider id="certainty" v-model="preAiFormData.certaintyScore" :min="1" :max="5" :step="1" class="w-full mr-4" />
                    <span>{{ preAiFormData.certaintyScore }}</span>
                  </div>
                </div>

                <Button type="submit" label="Submit Pre-AI & View AI" icon="pi pi-arrow-right" iconPos="right" :loading="submitting" />
              </div>
            </form>

            <form v-else @submit.prevent="handlePostAiSubmit">
              <div class="p-fluid space-y-4">
                <h3 class="font-semibold text-lg mb-2">Your Updated Assessment (Post-AI)</h3>
                <div class="field">
                  <label for="postDiag1">Updated Top Diagnosis (Rank 1)</label>
                  <Dropdown id="postDiag1" v-model="postAiFormData.diagnosisRank1Id" :options="diagnosisTerms" optionLabel="name" optionValue="id" placeholder="Select Updated Diagnosis 1" required filter class="w-full" />
                </div>
                <div class="field">
                  <label for="postDiag2">Updated Second Diagnosis (Rank 2)</label>
                  <Dropdown id="postDiag2" v-model="postAiFormData.diagnosisRank2Id" :options="diagnosisTerms" optionLabel="name" optionValue="id" placeholder="Select Updated Diagnosis 2" required filter class="w-full" />
                </div>
                <div class="field">
                  <label for="postDiag3">Updated Third Diagnosis (Rank 3)</label>
                  <Dropdown id="postDiag3" v-model="postAiFormData.diagnosisRank3Id" :options="diagnosisTerms" optionLabel="name" optionValue="id" placeholder="Select Updated Diagnosis 3" required filter class="w-full" />
                </div>

                <div class="field">
                  <label for="postConfidence">Updated Confidence in Top Diagnosis (1=Low, 5=High)</label>
                  <div class="flex items-center">
                    <Slider id="postConfidence" v-model="postAiFormData.confidenceScore" :min="1" :max="5" :step="1" class="w-full mr-4" />
                    <span>{{ postAiFormData.confidenceScore }}</span>
                  </div>
                </div>

                <div class="field">
                  <label for="postManagement">Updated Management Strategy</label>
                  <Dropdown id="postManagement" v-model="postAiFormData.managementStrategyId" :options="managementStrategies" optionLabel="name" optionValue="id" placeholder="Select updated strategy" required class="w-full" />
                </div>
                <div class="field">
                  <label for="postManagementNotes">Updated Management Notes (Optional)</label>
                  <Textarea id="postManagementNotes" v-model="postAiFormData.managementNotes" rows="3" class="w-full" />
                </div>

                <div class="field">
                  <label for="postCertainty">Updated Certainty of Management Plan (1=Low, 5=High)</label>
                  <div class="flex items-center">
                    <Slider id="postCertainty" v-model="postAiFormData.certaintyScore" :min="1" :max="5" :step="1" class="w-full mr-4" />
                    <span>{{ postAiFormData.certaintyScore }}</span>
                  </div>
                </div>

                <Divider />

                <h4 class="font-semibold text-md mb-2">AI Impact Assessment</h4>
                <div class="field">
                  <label>Did the AI suggestions change your primary diagnosis?</label>
                  <SelectButton v-model="postAiFormData.changeDiagnosis" :options="changeOptions" optionLabel="label" optionValue="value" required />
                </div>
                <div class="field">
                  <label>Did the AI suggestions change your management plan?</label>
                  <SelectButton v-model="postAiFormData.changeManagement" :options="changeOptions" optionLabel="label" optionValue="value" required />
                </div>
                <div class="field">
                  <label for="aiUsefulness">How useful were the AI suggestions?</label>
                  <Dropdown id="aiUsefulness" v-model="postAiFormData.aiUsefulness" :options="aiUsefulnessOptions" optionLabel="label" optionValue="value" placeholder="Select usefulness" required class="w-full" />
                </div>

                <Button type="submit" label="Submit Post-AI & Next Case" icon="pi pi-arrow-right" iconPos="right" :loading="submitting" />
              </div>
            </form>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.case-page {
  max-width: 1400px;
  margin: auto;
}
.field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}
.p-slider {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}
:deep(.p-selectbutton .p-button) {
  margin-right: 0.5rem;
}
:deep(.p-selectbutton .p-button:last-child) {
  margin-right: 0;
}
:deep(.p-datatable .p-datatable-thead > tr > th) {
  background-color: var(--p-surface-100);
  font-weight: bold;
}
:deep(.p-datatable .p-datatable-tbody > tr > td) {
  padding: 0.5rem 1rem;
}
</style>
