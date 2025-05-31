<template>
  <div v-if="isPostAiPhase">
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
                <ProgressBar :value="slotProps.data.confidence_score * 100" :showValue="false" style="height: .8em" />
                <span class="ml-2">{{ (slotProps.data.confidence_score * 100).toFixed(0) }}%</span>
              </template>
            </Column>
          </DataTable>
        </div>
        <div v-else>
          <p>No AI predictions available for this case, or they are still loading.</p>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';

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

defineProps<{
  aiOutputs: AIOutputRead[];
  isPostAiPhase: boolean;
}>();
</script>

<style scoped>
.ml-2 {
  margin-left: 0.5rem;
}
</style>
