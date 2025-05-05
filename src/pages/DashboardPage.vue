<template>
  <div class="dashboard-container">
    <Toast />
    
    <!-- Progress Overview -->
    <div class="grid">
      <!-- Stats Summary -->
      <div class="col-12">
        <Card class="mb-4">
          <template #title>
            <div class="flex align-items-center">
              <i class="pi pi-chart-bar text-xl mr-2"></i>
              <span class="text-xl font-medium">Study Progress</span>
            </div>
          </template>
          <template #content>
            <div class="grid">
              <div class="col-12 md:col-4">
                <div class="surface-card shadow-1 border-round p-4 h-full">
                  <i class="pi pi-list text-xl text-primary mb-3"></i>
                  <div class="text-500 font-medium">Total Cases</div>
                  <div class="text-900 text-4xl font-bold mt-2">{{ cases.length }}</div>
                  <div class="text-600 mt-2">All available cases</div>
                </div>
              </div>
              
              <div class="col-12 md:col-4">
                <div class="surface-card shadow-1 border-round p-4 h-full">
                  <i class="pi pi-check-circle text-xl text-green-500 mb-3"></i>
                  <div class="text-500 font-medium">Completed</div>
                  <div class="text-900 text-4xl font-bold mt-2">{{ completedCases.length }}</div>
                  <div class="text-600 mt-2">Successfully assessed cases</div>
                </div>
              </div>
              
              <div class="col-12 md:col-4">
                <div class="surface-card shadow-1 border-round p-4 h-full">
                  <i class="pi pi-clock text-xl text-orange-500 mb-3"></i>
                  <div class="text-500 font-medium">Remaining</div>
                  <div class="text-900 text-4xl font-bold mt-2">{{ cases.length - completedCases.length }}</div>
                  <div class="text-600 mt-2">Cases pending assessment</div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="col-12 mt-4">
                <div class="surface-card shadow-1 border-round p-4">
                  <div class="flex justify-content-between align-items-center mb-3">
                    <div class="flex align-items-center">
                      <i class="pi pi-chart-line text-primary mr-2"></i>
                      <span class="text-900 font-medium">Overall Progress</span>
                    </div>
                    <Tag :value="Math.round(completionPercentage) + '%'" 
                         :severity="completionPercentage === 100 ? 'success' : 'info'"
                         :icon="completionPercentage === 100 ? 'pi pi-check' : 'pi pi-chart-line'" />
                  </div>
                  <ProgressBar :value="completionPercentage" class="h-1rem" />
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Cases List -->
      <div class="col-12">
        <Card>
          <template #title>
            <div class="flex align-items-center justify-content-between">
              <div class="flex align-items-center">
                <i class="pi pi-list text-xl mr-2"></i>
                <span class="text-xl font-medium">Available Cases</span>
              </div>
              <span class="p-input-icon-left">
                <i class="pi pi-search" />
                <InputText v-model="searchTerm" placeholder="Search cases..." class="p-inputtext-sm" />
              </span>
            </div>
          </template>
          <template #content>
            <DataTable :value="cases" 
                      :loading="loading" 
                      dataKey="id"
                      stripedRows
                      class="p-datatable-sm"
                      responsiveLayout="stack"
                      @row-click="(event) => navigateToCase(event.data)"
                      v-model:filters="filters"
                      filterDisplay="menu"
                      :globalFilterFields="['id']">
              <Column field="id" header="Case ID" style="width: 15%">
                <template #body="slotProps">
                  <span class="font-semibold">#{{ slotProps.data.id }}</span>
                </template>
              </Column>
              
              <Column header="Status" style="width: 25%">
                <template #body="slotProps">
                  <Tag :value="getStatusLabel(slotProps.data)" 
                       :severity="getStatusSeverity(slotProps.data)"
                       :icon="getStatusIcon(slotProps.data)" />
                </template>
              </Column>
              
              <Column style="width: 20%" header="Action">
                <template #body="slotProps">
                  <Button :icon="getStatusIcon(slotProps.data)"
                         :label="getActionLabel(slotProps.data)"
                         :severity="getStatusSeverity(slotProps.data)"
                         size="small"
                         @click="navigateToCase(slotProps.data)" />
                </template>
              </Column>
            </DataTable>

            <div v-if="!loading && cases.length === 0" class="surface-ground text-center p-5 border-round">
              <i class="pi pi-inbox text-4xl text-600 mb-3"></i>
              <div class="text-900 font-medium mb-2">No Cases Available</div>
              <div class="text-600">There are currently no cases assigned to you.</div>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useCaseStore } from '../stores/caseStore';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import Toast from 'primevue/toast';
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const userStore = useUserStore();
const caseStore = useCaseStore();
const toast = useToast();

const loading = ref(true);
const cases = computed(() => caseStore.cases);

// Update completed cases tracking to be reactive
const completedCases = computed(() => {
  return cases.value.filter(c => {
    const progress = caseStore.getCaseProgress(c.id);
    return progress?.postCompleted;
  });
});

// Add pending cases tracking
const pendingPostAiCases = computed(() => {
  return cases.value.filter(c => {
    const progress = caseStore.getCaseProgress(c.id);
    return progress?.preCompleted && !progress?.postCompleted;
  });
});

const completionPercentage = computed(() => 
  cases.value.length ? (completedCases.value.length / cases.value.length) * 100 : 0
);

const loadAndDisplayProgress = async () => {
  try {
    const userId = userStore.user?.id;
    if (!userId) {
      throw new Error('No user ID available');
    }

    // First load all cases
    const casesSuccess = await caseStore.loadCases();
    if (!casesSuccess) {
      throw new Error('Failed to load cases');
    }

    // Then fetch all assessments for the current user to update progress state
    const assessmentsLoaded = await caseStore.loadAssessmentsAndProgress(userId);
    if (!assessmentsLoaded) {
      console.warn('Failed to load assessments, falling back to cached progress');
    }

    // Log detailed progress state
    const progressSummary = {
      total: cases.value.length,
      completed: completedCases.value.length,
      pending: pendingPostAiCases.value.length,
      inProgress: Object.values(caseStore.caseProgress).filter(p => p.preCompleted && !p.postCompleted).length,
      notStarted: Object.values(caseStore.caseProgress).filter(p => !p.preCompleted && !p.postCompleted).length,
      progressByCase: Object.entries(caseStore.caseProgress).reduce((acc, [caseId, progress]) => {
        acc[`case_${caseId}`] = {
          preCompleted: progress.preCompleted,
          postCompleted: progress.postCompleted,
          status: progress.postCompleted ? 'completed' : 
                 progress.preCompleted ? 'post-ai-pending' : 
                 'not-started'
        };
        return acc;
      }, {})
    };

    console.log('Progress Summary:', progressSummary);
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load data. Please try refreshing the page.',
      life: 5000
    });
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  if (!userStore.isAuthenticated) {
    router.push('/login');
    return;
  }
  loading.value = true;
  await loadAndDisplayProgress();
});

// Add watch for assessment updates
watch(() => caseStore.caseProgress, () => {
  // This will trigger reactivity when assessment status changes
}, { deep: true });

const navigateToCase = (caseData: any) => {
  if (!caseData || typeof caseData.id === 'undefined') {
    console.error('Invalid case data:', caseData);
    return;
  }
  
  const progress = caseStore.getCaseProgress(caseData.id);
  if (progress?.preCompleted && !progress?.postCompleted) {
    // If pre-AI is completed but post-AI isn't, navigate directly to post-AI phase
    router.push(`/case/${caseData.id}?phase=post`);
  } else {
    router.push(`/case/${caseData.id}`);
  }
};

const getStatusSeverity = (caseData: any) => {
  const progress = caseStore.getCaseProgress(caseData.id);
  // Ensure we have progress data
  if (!progress) return 'info';
  if (progress.postCompleted) return 'success';
  if (progress.preCompleted) return 'warning';
  return 'info';
};

const getStatusLabel = (caseData: any) => {
  const progress = caseStore.getCaseProgress(caseData.id);
  // Ensure we have progress data
  if (!progress) return 'Not Started';
  if (progress.postCompleted) return 'Completed';
  if (progress.preCompleted) return 'Post-AI Pending';
  return 'Not Started';
};

const getStatusIcon = (caseData: any) => {
  const progress = caseStore.getCaseProgress(caseData.id);
  // Ensure we have progress data
  if (!progress) return 'pi pi-play';
  if (progress.postCompleted) return 'pi pi-check-circle';
  if (progress.preCompleted) return 'pi pi-sync';
  return 'pi pi-play';
};

const getActionLabel = (caseData: any) => {
  const progress = caseStore.getCaseProgress(caseData.id);
  // Ensure we have progress data
  if (!progress) return 'Start';
  if (progress.postCompleted) return 'Review';
  if (progress.preCompleted) return 'Continue';
  return 'Start';
};

const searchTerm = ref('');
const filters = ref({});
</script>

<style scoped>
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

:deep(.cursor-pointer) {
  cursor: pointer;
}

:deep(.p-card) {
  background: var(--surface-card);
  border-radius: var(--border-radius);
}

:deep(.p-progressbar) {
  background: var(--surface-ground);
}

:deep(.shadow-1) {
  box-shadow: 0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12);
}

@media screen and (max-width: 768px) {
  .dashboard-container {
    padding: 1rem;
  }
}
</style>