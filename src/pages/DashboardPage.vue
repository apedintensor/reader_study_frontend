<template>
  <div class="dashboard-container p-4">
    <Toast />
    
    <!-- Progress Overview -->
    <Card class="mb-4">
      <template #title>
        <span class="text-xl font-bold flex align-items-center">
          <i class="pi pi-chart-bar mr-2"></i> Study Progress
        </span>
      </template>
      <template #content>
        <div class="grid">
          <!-- Stats Cards -->
          <div class="col-12 md:col-4">
            <div class="surface-card border-round p-4 h-full">
              <div class="text-600 mb-2">Total Cases</div>
              <div class="text-primary text-4xl font-bold mb-2">{{ cases.length }}</div>
              <div class="text-sm text-700">All available cases</div>
            </div>
          </div>
          
          <div class="col-12 md:col-4">
            <div class="surface-card border-round p-4 h-full">
              <div class="text-600 mb-2">Completed</div>
              <div class="text-green-500 text-4xl font-bold mb-2">{{ completedCases.length }}</div>
              <div class="text-sm text-700">Successfully assessed cases</div>
            </div>
          </div>
          
          <div class="col-12 md:col-4">
            <div class="surface-card border-round p-4 h-full">
              <div class="text-600 mb-2">Remaining</div>
              <div class="text-orange-500 text-4xl font-bold mb-2">{{ cases.length - completedCases.length }}</div>
              <div class="text-sm text-700">Cases pending assessment</div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="col-12 mt-4">
            <div class="surface-card border-round p-4">
              <div class="flex justify-content-between align-items-center mb-3">
                <span class="text-600">Overall Completion</span>
                <Tag :value="Math.round(completionPercentage) + '%'" 
                     :severity="completionPercentage === 100 ? 'success' : 'info'" />
              </div>
              <ProgressBar :value="completionPercentage" class="h-2rem" />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Cases List -->
    <Card>
      <template #title>
        <span class="text-xl font-bold flex align-items-center">
          <i class="pi pi-list mr-2"></i> Available Cases
        </span>
      </template>
      <template #content>
        <DataTable :value="cases" 
                  :loading="loading" 
                  dataKey="id"
                  stripedRows
                  class="p-datatable-sm"
                  responsiveLayout="scroll"
                  :rowClass="(data) => ({'cursor-pointer': true})">
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
          
          <Column style="width: 20%">
            <template #body="slotProps">
              <Button :icon="getStatusIcon(slotProps.data)"
                     :label="getActionLabel(slotProps.data)"
                     :severity="getStatusSeverity(slotProps.data)"
                     size="small"
                     @click="navigateToCase(slotProps.data)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
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

const router = useRouter();
const userStore = useUserStore();
const caseStore = useCaseStore();

const loading = ref(true);
const cases = computed(() => caseStore.cases);
const completedCases = computed(() => cases.value.filter(c => {
  const progress = caseStore.getCaseProgress(c.id);
  return progress.postCompleted;
}));
const completionPercentage = computed(() => 
  cases.value.length ? (completedCases.value.length / cases.value.length) * 100 : 0
);

onMounted(async () => {
  if (!userStore.isAuthenticated) {
    router.push('/login');
    return;
  }
  
  try {
    await caseStore.loadCases(); // Changed from fetchCases to loadCases
  } catch (error) {
    console.error('Failed to fetch cases:', error);
  } finally {
    loading.value = false;
  }
});

const navigateToCase = (caseData: any) => {
  router.push(`/case/${caseData.id}`);
};

const getStatusSeverity = (caseData: any) => {
  const progress = caseStore.getCaseProgress(caseData.id);
  if (progress.postCompleted) return 'success';
  if (progress.preCompleted) return 'warning';
  return 'info';
};

const getStatusLabel = (caseData: any) => {
  const progress = caseStore.getCaseProgress(caseData.id);
  if (progress.postCompleted) return 'Completed';
  if (progress.preCompleted) return 'Post-AI Pending';
  return 'Not Started';
};

const getStatusIcon = (caseData: any) => {
  const progress = caseStore.getCaseProgress(caseData.id);
  if (progress.postCompleted) return 'pi pi-check-circle';
  if (progress.preCompleted) return 'pi pi-sync';
  return 'pi pi-play';
};

const getActionLabel = (caseData: any) => {
  const progress = caseStore.getCaseProgress(caseData.id);
  if (progress.postCompleted) return 'Review';
  if (progress.preCompleted) return 'Continue';
  return 'Start';
};
</script>

<style scoped>
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
}

:deep(.cursor-pointer) {
  cursor: pointer;
}

:deep(.p-progressbar) {
  background: var(--surface-ground);
}

:deep(.p-card) {
  background: var(--surface-card);
  border-radius: var(--border-radius);
}
</style>