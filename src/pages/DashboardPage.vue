<template>
  <div class="dashboard-page p-4">
    <Toast />
    <Card class="mb-4">
      <template #title>Reader Study Dashboard</template>
      <template #content>
        <p v-if="userStore.user">Welcome, {{ userStore.user.email }}!</p>
        <div class="flex justify-content-between align-items-center mb-4">
          <div>
            <span class="font-bold">Progress: </span>
            {{ completedCount }} / {{ totalCases }} cases completed
          </div>
          <Button label="Start Next Case" icon="pi pi-arrow-right" @click="startNextCase" :disabled="!hasIncompleteCases" />
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Case Progress</template>
      <template #content>
        <DataTable :value="casesWithProgress" :paginator="true" :rows="10" class="mb-4"
          :loading="loading" stripedRows responsiveLayout="scroll">
          <Column field="id" header="Case ID" sortable>
            <template #body="slotProps">
              <Button :label="'Case ' + slotProps.data.id" 
                     link 
                     @click="navigateToCase(slotProps.data.id)"
                     :disabled="!canAccessCase(slotProps.data)" />
            </template>
          </Column>
          <Column field="preAiStatus" header="Pre-AI Status" sortable>
            <template #body="slotProps">
              <Tag :severity="getPreAiSeverity(slotProps.data)" :value="getPreAiLabel(slotProps.data)" />
            </template>
          </Column>
          <Column field="postAiStatus" header="Post-AI Status" sortable>
            <template #body="slotProps">
              <Tag :severity="getPostAiSeverity(slotProps.data)" :value="getPostAiLabel(slotProps.data)" />
            </template>
          </Column>
          <Column header="Actions">
            <template #body="slotProps">
              <Button icon="pi pi-arrow-right" 
                     rounded 
                     @click="navigateToCase(slotProps.data.id)"
                     :disabled="!canAccessCase(slotProps.data)"
                     tooltip="Go to case" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useCaseStore } from '../stores/caseStore';
import Card from 'primevue/card';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const userStore = useUserStore();
const caseStore = useCaseStore();
const toast = useToast();
const loading = ref(true);

const casesWithProgress = computed(() => {
  return caseStore.cases.map(c => ({
    ...c,
    progress: caseStore.getCaseProgress(c.id)
  }));
});

const totalCases = computed(() => caseStore.totalCases);
const completedCount = computed(() => caseStore.completedCases.length);
const hasIncompleteCases = computed(() => caseStore.getIncompleteCases().length > 0);

function getPreAiSeverity(caseData: any) {
  return caseData.progress.preCompleted ? 'success' : 'warning';
}

function getPreAiLabel(caseData: any) {
  return caseData.progress.preCompleted ? 'Completed' : 'Pending';
}

function getPostAiSeverity(caseData: any) {
  if (!caseData.progress.preCompleted) return 'info';
  return caseData.progress.postCompleted ? 'success' : 'warning';
}

function getPostAiLabel(caseData: any) {
  if (!caseData.progress.preCompleted) return 'Locked';
  return caseData.progress.postCompleted ? 'Completed' : 'Pending';
}

function canAccessCase(caseData: any) {
  // Always allow access to pre-AI phase
  if (!caseData.progress.preCompleted) return true;
  // Only allow post-AI access if pre-AI is completed
  return caseData.progress.preCompleted;
}

async function startNextCase() {
  const nextCase = caseStore.getNextIncompleteCase();
  if (nextCase) {
    router.push(`/case/${nextCase.id}`);
  } else {
    toast.add({
      severity: 'info',
      summary: 'All Cases Completed',
      detail: 'You have completed all available cases.',
      life: 3000
    });
    router.push('/complete');
  }
}

function navigateToCase(caseId: number) {
  router.push(`/case/${caseId}`);
}

onMounted(async () => {
  if (!userStore.user) {
    await userStore.fetchCurrentUser();
  }
  await caseStore.loadCases();
  loading.value = false;
});
</script>

<style scoped>
.dashboard-page {
  max-width: 1200px;
  margin: auto;
}
</style>