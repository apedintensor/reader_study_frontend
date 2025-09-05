<template>
  <div class="u-page u-page-wide review-container">
    <Toast />
    
    <!-- Header -->
    <div class="mb-4">
      <h1 class="text-3xl font-bold text-900 mb-2">Case Review #{{ caseId }}</h1>
      <div class="flex align-items-center gap-2 mb-4">
        <Tag value="Completed" severity="success" icon="pi pi-check-circle" />
        <Button icon="pi pi-arrow-left" 
                label="Back to Dashboard" 
                severity="secondary" 
                outlined 
                @click="router.push('/')" />
      </div>
    </div>

    <div v-if="loading" class="flex justify-content-center">
      <ProgressSpinner />
    </div>

    <div v-else-if="error" class="surface-card border-round p-4 text-center">
      <i class="pi pi-exclamation-triangle text-4xl text-orange-500 mb-3"></i>
      <h3 class="text-xl font-medium mb-2">Unable to Load Review Data</h3>
      <p class="text-600 mb-4">{{ error }}</p>
      <Button label="Return to Dashboard" @click="router.push('/')" />
    </div>

    <div v-else class="grid">
      <!-- Left Column - Case Information -->
      <div class="col-12 lg:col-5">
        <!-- Case Images -->
        <Card class="mb-4">
          <template #title>Case Images</template>
          <template #content>
            <div v-if="images.length > 0">
              <Galleria :value="images" 
                       :numVisible="5" 
                       :circular="true" 
                       :showItemNavigators="true"
                       :showThumbnails="false"
                       containerStyle="max-width: 100%">
                <template #item="slotProps">
                  <img :src="slotProps.item.full_url || slotProps.item.image_url" 
                       :alt="`Case ${caseId} Image`" 
                       style="width: 100%; height: 400px; object-fit: contain;" />
                </template>
              </Galleria>
            </div>
            <div v-else class="text-center p-4 text-600">
              No images available for this case.
            </div>
          </template>
        </Card>



        <!-- AI Predictions -->
        <Card class="mb-4">
          <template #title>AI Predictions</template>
          <template #content>
            <div v-if="aiOutputs && aiOutputs.length > 0">
              <DataTable :value="aiOutputs" 
                         class="p-datatable-sm" 
                         responsiveLayout="scroll"
                         sortField="rank"
                         :sortOrder="1">
                <Column field="rank" header="Rank" sortable style="width: 15%">
                  <template #body="slotProps">
                    <Tag :value="slotProps.data.rank" rounded />
                  </template>
                </Column>
                <Column field="prediction.name" header="Predicted Diagnosis" sortable style="width: 60%"></Column>
                <Column field="confidence_score" header="Confidence" sortable style="width: 25%">
                  <template #body="slotProps">
                    <ProgressBar :value="(slotProps.data.confidence_score || 0) * 100" 
                                 :showValue="true" 
                                 style="height: 1rem" />
                  </template>
                </Column>
              </DataTable>
            </div>
            <div v-else class="text-600">
              No AI predictions available for this case.
            </div>
          </template>
        </Card>
      </div>

      <!-- Right Column - Assessment Reviews -->
      <div class="col-12 lg:col-7">
        <!-- Assessment Comparison -->
        <Card class="mb-4">
          <template #title>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-chart-bar text-primary"></i>
              <span>Assessment Comparison</span>
            </div>
          </template>
          <template #content>
            <AssessmentComparison 
              :pre-ai-data="preAiData"
              :post-ai-data="postAiData"
              :diagnosis-terms="diagnosisTerms" />
          </template>
        </Card>

        <!-- Pre-AI Assessment Review -->
        <Card class="mb-4">
          <template #title>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-user text-primary"></i>
              <span>Pre-AI Assessment</span>
            </div>
          </template>
          <template #content>
            <ReviewAssessmentDisplay 
              :assessment-data="preAiData"
              :diagnosis-terms="diagnosisTerms"
              phase="Pre-AI" />
          </template>
        </Card>

        <!-- Post-AI Assessment Review -->
        <Card class="mb-4">
          <template #title>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-android text-primary"></i>
              <span>Post-AI Assessment</span>
            </div>
          </template>
          <template #content>
            <ReviewAssessmentDisplay 
              :assessment-data="postAiData"
              :diagnosis-terms="diagnosisTerms"
              phase="Post-AI"
              :show-ai-impact="true" />
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import apiClient from '../api';
import { useGamesStore } from '../stores/gamesStore';
import { listAssignmentAssessments } from '../api/assessments';

// Import components
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import ProgressSpinner from 'primevue/progressspinner';
import Galleria from 'primevue/galleria';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ProgressBar from 'primevue/progressbar';
import ReviewAssessmentDisplay from '../components/ReviewAssessmentDisplay.vue';
import AssessmentComparison from '../components/AssessmentComparison.vue';

// Interfaces
interface ImageRead {
  id: number;
  image_url: string; // relative path (legacy)
  full_url?: string; // absolute URL provided by backend
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

interface AssessmentData {
  diagnosisRank1Id: number | null;
  diagnosisRank2Id: number | null;
  diagnosisRank3Id: number | null;
  confidenceScore: number;
  certaintyScore: number;
  changeDiagnosis?: boolean | null;
  changeManagement?: boolean | null;
  aiUsefulness?: string | null;
}

// Setup
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const gamesStore = useGamesStore();

const caseId = computed(() => parseInt(route.params.id as string, 10));
const userId = computed(() => userStore.user?.id);

// State
const loading = ref(true);
const error = ref<string | null>(null);
const images = ref<ImageRead[]>([]);
const diagnosisTerms = ref<DiagnosisTermRead[]>([]);
const aiOutputs = ref<AIOutputRead[]>([]);
const preAiData = ref<AssessmentData | null>(null);
const postAiData = ref<AssessmentData | null>(null);

// Data fetching
const fetchData = async () => {
  if (!caseId.value || !userId.value) {
    error.value = 'Invalid case ID or user not authenticated';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // First, try to load from localStorage
    const hasLocalData = loadFromLocalStorage();
    
    if (hasLocalData) {
      console.log('Loading review data from localStorage');
    } else {
      console.log('Loading review data from API');
      // If no local data, fetch assessment data from API
      await loadFromAPI();
    }

    // Always fetch supplementary data (case details, terms, AI outputs)
    const [caseResponse, termsResponse] = await Promise.all([
      apiClient.get(`/api/cases/${caseId.value}`),
      apiClient.get('/api/diagnosis_terms/')
    ]);

    const caseData = caseResponse.data;
    images.value = caseData.images || [];
    diagnosisTerms.value = termsResponse.data;

    // Load AI outputs
    try {
      const aiResponse = await apiClient.get(`/api/ai_outputs/case/${caseId.value}`);
      aiOutputs.value = aiResponse.data.sort((a: AIOutputRead, b: AIOutputRead) => (a.rank ?? 99) - (b.rank ?? 99)).slice(0, 5);
    } catch (aiError) {
      console.warn('Failed to fetch AI outputs:', aiError);
      aiOutputs.value = [];
    }

    // Verify we have both pre-AI and post-AI data
    if (!preAiData.value || !postAiData.value) {
      error.value = 'Assessment data incomplete. Please ensure both pre-AI and post-AI assessments are completed.';
    }
  } catch (err: any) {
    console.error('Failed to fetch review data:', err);
    if (err.response?.status === 404) {
      error.value = 'Case not found. Please check if the case exists and you have access to it.';
    } else {
      error.value = 'Failed to load case data. Please try again.';
    }
  } finally {
    loading.value = false;
  }
};

const loadFromLocalStorage = (): boolean => {
  try {
    const preAiKey = `case_${caseId.value}_preai`;
    const postAiKey = `case_${caseId.value}_postai`;
    
    const preAiDataStr = localStorage.getItem(preAiKey);
    const postAiDataStr = localStorage.getItem(postAiKey);
    
    if (preAiDataStr && postAiDataStr) {
      preAiData.value = JSON.parse(preAiDataStr);
      postAiData.value = JSON.parse(postAiDataStr);
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Failed to parse assessment data from localStorage:', e);
    return false;
  }
};

const loadFromAPI = async (): Promise<void> => {
  try {
    // locate assignment for this case
    const assignment = Object.values(gamesStore.assignmentsByBlock || {})
      .flat()
      .find((a: any) => a.case_id === caseId.value && a.user_id === userId.value);
    if (!assignment) {
      console.warn('No assignment found while loading review page assessments.');
      return;
    }
    const assessments = await listAssignmentAssessments(assignment.id);
    const pre = assessments.find(a => a.phase === 'PRE');
    const post = assessments.find(a => a.phase === 'POST');
    if (pre) {
      preAiData.value = {
        diagnosisRank1Id: null,
        diagnosisRank2Id: null,
        diagnosisRank3Id: null,
        confidenceScore: pre.diagnostic_confidence || 3,
        certaintyScore: pre.management_confidence || 3
      };
    }
    if (post) {
      postAiData.value = {
        diagnosisRank1Id: null,
        diagnosisRank2Id: null,
        diagnosisRank3Id: null,
        confidenceScore: post.diagnostic_confidence || 3,
        certaintyScore: post.management_confidence || 3,
        changeDiagnosis: post.changed_primary_diagnosis || null,
        changeManagement: post.changed_management_plan || null,
        aiUsefulness: post.ai_usefulness || null
      };
    }
  } catch (error) {
    console.error('Failed to load assessment data from API:', error);
    throw error;
  }
};

onMounted(async () => {
  if (!userStore.isAuthenticated) {
    router.push('/login');
    return;
  }
  await fetchData();
});
</script>

<style scoped>
/* Container sizing now via .u-page-wide */

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.notes-section {
  grid-column: 1 / -1;
}

.notes-section p {
  white-space: pre-wrap;
  line-height: 1.5;
}

@media screen and (max-width: 768px) {
  .review-container {
    padding: 1rem;
  }
}
</style>