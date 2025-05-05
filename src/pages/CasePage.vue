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

// Interfaces based on OpenAPI schema
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

interface AssessmentCreate {
  is_post_ai: boolean;
  user_id: number;
  case_id: number;
  assessable_image_score?: number | null; // Optional for now
  confidence_level_top1?: number | null;
  management_confidence?: number | null;
  certainty_level?: number | null;
}

interface DiagnosisCreate {
  assessment_id: number;
  diagnosis_id: number; // Mock ID for now
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

const images = ref<ImageRead[]>([]);
const metadata = ref<CaseMetaDataRead | null>(null);
const managementStrategies = ref<ManagementStrategyRead[]>([]);
const loading = ref(false);
const submitting = ref(false);

const formData = reactive({
  diagnosisRank1: '',
  diagnosisRank2: '',
  diagnosisRank3: '',
  confidenceScore: 3, // Default mid-value
  managementStrategyId: null as number | null,
  managementNotes: '',
  certaintyScore: 3, // Default mid-value
});

const localStorageKey = computed(() => `preAiFormData_${caseId.value}`);

// --- Data Fetching ---
const fetchData = async () => {
  if (!caseId.value) return;
  loading.value = true;
  try {
    // Fetch images, metadata, and strategies in parallel
    const [imagesRes, metadataRes, strategiesRes] = await Promise.all([
      apiClient.get<ImageRead[]>(`/api/images/case/${caseId.value}`),
      apiClient.get<CaseMetaDataRead>(`/api/case_metadata/case/${caseId.value}`),
      apiClient.get<ManagementStrategyRead[]>('/api/management_strategies/'),
    ]);

    images.value = imagesRes.data;
    metadata.value = metadataRes.data;
    managementStrategies.value = strategiesRes.data;

    // Load saved form data after fetching is complete
    loadFromLocalStorage();

  } catch (error: any) {
    console.error('Failed to fetch case data:', error);
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load case data. Please try again.', life: 3000 });
    // Optionally redirect or show an error message
  } finally {
    loading.value = false;
  }
};

// --- Local Storage ---
const saveToLocalStorage = () => {
  localStorage.setItem(localStorageKey.value, JSON.stringify(formData));
};

const loadFromLocalStorage = () => {
  const savedData = localStorage.getItem(localStorageKey.value);
  if (savedData) {
    try {
      const parsedData = JSON.parse(savedData);
      Object.assign(formData, parsedData);
      console.log('Loaded pre-AI form data from localStorage for case:', caseId.value);
    } catch (e) {
      console.error('Failed to parse saved form data:', e);
      localStorage.removeItem(localStorageKey.value); // Clear invalid data
    }
  }
};

const clearLocalStorage = () => {
  localStorage.removeItem(localStorageKey.value);
};

// Watch form data and save to localStorage
watch(formData, saveToLocalStorage, { deep: true });

// Fetch data on component mount
onMounted(fetchData);

// Re-fetch data if the case ID changes
watch(caseId, fetchData);


// --- Submission Logic ---
const handleNext = async () => {
  if (!userId.value || !caseId.value) {
    toast.add({ severity: 'warn', summary: 'Missing Info', detail: 'User or Case ID not found.', life: 3000 });
    return;
  }

  // Basic Validation (PrimeVue required prop handles some)
  if (!formData.diagnosisRank1 || !formData.diagnosisRank2 || !formData.diagnosisRank3) {
      toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please enter all top 3 diagnoses.', life: 3000 });
      return;
  }
   if (formData.managementStrategyId === null) {
      toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please select a management strategy.', life: 3000 });
      return;
  }

  submitting.value = true;
  try {
    // 1. Submit Assessment
    const assessmentPayload: AssessmentCreate = {
      is_post_ai: false,
      user_id: userId.value,
      case_id: caseId.value,
      confidence_level_top1: formData.confidenceScore,
      management_confidence: formData.confidenceScore, // As per requirement
      certainty_level: formData.certaintyScore,
      // assessable_image_score: null, // Optional, can add later
    };
    const assessmentRes = await apiClient.post('/api/assessments/', assessmentPayload);
    const assessmentId = assessmentRes.data.id;

    if (!assessmentId) {
        throw new Error("Failed to get assessment ID from response.");
    }

    // 2. Submit Diagnoses (using mock IDs as requested)
    const diagnosesPayload: DiagnosisCreate[] = [
      // Using mock diagnosis_id 1, 2, 3 until lookup is implemented
      { assessment_id: assessmentId, diagnosis_id: 1, rank: 1 },
      { assessment_id: assessmentId, diagnosis_id: 2, rank: 2 },
      { assessment_id: assessmentId, diagnosis_id: 3, rank: 3 },
    ];
    // Note: The actual text from formData.diagnosisRank1 etc. is NOT sent here
    // due to API expecting integer diagnosis_id.
    await apiClient.post('/api/diagnoses/', diagnosesPayload); // Assuming endpoint accepts a list

    // 3. Submit Management Plan
    const managementPlanPayload: ManagementPlanCreate = {
      assessment_id: assessmentId,
      strategy_id: formData.managementStrategyId,
      free_text: formData.managementNotes || null,
    };
    await apiClient.post('/api/management_plans/', managementPlanPayload);

    // 4. Update Store and Navigate
    caseStore.markCaseComplete(caseId.value); // Mark as complete (might need refinement for pre/post)
    clearLocalStorage(); // Clear saved data on successful submission
    toast.add({ severity: 'success', summary: 'Success', detail: 'Pre-AI assessment saved.', life: 2000 });

    // Navigate to next case
    caseStore.goToNextCase();
    const nextCase = caseStore.getCurrentCase;
    if (nextCase) {
      router.push(`/case/${nextCase.id}`);
    } else {
      router.push('/complete'); // Or dashboard if preferred
    }

  } catch (error: any) {
    console.error('Failed to submit assessment:', error);
    let detail = 'Failed to submit assessment. Please try again.';
     if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
            detail = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
            detail = error.response.data.detail.map((err: any) => `${err.loc.join('.')} - ${err.msg}`).join('; ');
        }
    }
    toast.add({ severity: 'error', summary: 'Submission Error', detail: detail, life: 5000 });
  } finally {
    submitting.value = false;
  }
};

// --- Template ---
</script>

<template>
  <div class="case-page p-4">
    <Toast />
    <Card>
      <template #title>
        Case Assessment (Pre-AI) - ID: {{ caseId }}
      </template>
      <template #content>
        <div v-if="loading" class="text-center">
          <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i> Loading Case Data...
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Left Column: Images and Metadata -->
          <div>
            <!-- Images Carousel -->
            <Carousel :value="images" :numVisible="1" :numScroll="1" v-if="images.length > 0" class="mb-4">
              <template #item="slotProps">
                <div class="border border-surface-200 dark:border-surface-700 rounded m-2 p-4 text-center">
                  <img :src="slotProps.data.image_url" :alt="'Case Image ' + slotProps.data.id" class="w-full block rounded" />
                </div>
              </template>
            </Carousel>
             <div v-else class="text-center p-4 border border-surface-200 dark:border-surface-700 rounded mb-4">
                No images available for this case.
            </div>

            <!-- Metadata Panel -->
            <Panel header="Case Metadata" toggleable collapsed v-if="metadata">
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
             <Panel header="Case Metadata" v-else>
                 <p>Loading metadata...</p>
             </Panel>
          </div>

          <!-- Right Column: Form -->
          <div>
            <form @submit.prevent="handleNext">
              <div class="p-fluid space-y-4">
                <!-- Top 3 Diagnoses -->
                <div class="field">
                  <label for="diag1">Top Diagnosis (Rank 1)</label>
                  <InputText id="diag1" v-model="formData.diagnosisRank1" required />
                </div>
                <div class="field">
                  <label for="diag2">Second Diagnosis (Rank 2)</label>
                  <InputText id="diag2" v-model="formData.diagnosisRank2" required />
                </div>
                <div class="field">
                  <label for="diag3">Third Diagnosis (Rank 3)</label>
                  <InputText id="diag3" v-model="formData.diagnosisRank3" required />
                </div>

                <!-- Confidence Score -->
                <div class="field">
                  <label for="confidence">Confidence in Top Diagnosis (1=Low, 5=High)</label>
                  <div class="flex items-center">
                     <Slider id="confidence" v-model="formData.confidenceScore" :min="1" :max="5" :step="1" class="w-full mr-4" />
                     <span>{{ formData.confidenceScore }}</span>
                  </div>
                </div>

                <!-- Management Strategy -->
                <div class="field">
                  <label for="management">Management Strategy</label>
                  <Dropdown id="management" v-model="formData.managementStrategyId" :options="managementStrategies" optionLabel="name" optionValue="id" placeholder="Select a strategy" required class="w-full" />
                </div>
                <div class="field">
                  <label for="managementNotes">Management Notes (Optional)</label>
                  <Textarea id="managementNotes" v-model="formData.managementNotes" rows="3" class="w-full" />
                </div>

                <!-- Certainty Score -->
                 <div class="field">
                  <label for="certainty">Certainty of Management Plan (1=Low, 5=High)</label>
                   <div class="flex items-center">
                     <Slider id="certainty" v-model="formData.certaintyScore" :min="1" :max="5" :step="1" class="w-full mr-4" />
                     <span>{{ formData.certaintyScore }}</span>
                   </div>
                </div>

                <!-- Submit Button -->
                <Button type="submit" label="Next" icon="pi pi-arrow-right" iconPos="right" :loading="submitting" />
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
  max-width: 1200px;
  margin: auto;
}
/* Add Tailwind classes or custom styles if needed */
.field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
}

/* Ensure sliders have some vertical space */
.p-slider {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
}
</style>
