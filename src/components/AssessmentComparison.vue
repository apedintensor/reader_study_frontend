<template>
  <div v-if="preAiData && postAiData" class="comparison-container">
    <!-- Diagnoses Comparison -->
    <div class="comparison-section mb-4">
      <h3 class="text-xl font-semibold mb-3 flex align-items-center gap-2">
        <i class="pi pi-list"></i>
        Diagnosis Comparison
      </h3>
      <div class="grid">
        <div class="col-12 md:col-6">
          <Card>
            <template #title>
              <div class="flex align-items-center gap-2">
                <i class="pi pi-user text-primary"></i>
                <span>Pre-AI</span>
              </div>
            </template>
            <template #content>
              <div class="diagnosis-list">
                <div class="diagnosis-item">
                  <span class="rank">1.</span>
                  <span class="diagnosis">{{ getDiagnosisName(preAiData.diagnosisRank1Id) }}</span>
                </div>
                <div class="diagnosis-item">
                  <span class="rank">2.</span>
                  <span class="diagnosis">{{ getDiagnosisName(preAiData.diagnosisRank2Id) }}</span>
                </div>
                <div class="diagnosis-item">
                  <span class="rank">3.</span>
                  <span class="diagnosis">{{ getDiagnosisName(preAiData.diagnosisRank3Id) }}</span>
                </div>
              </div>
            </template>
          </Card>
        </div>
        <div class="col-12 md:col-6">
          <Card>
            <template #title>
              <div class="flex align-items-center gap-2">
                <i class="pi pi-android text-primary"></i>
                <span>Post-AI</span>
              </div>
            </template>
            <template #content>
              <div class="diagnosis-list">
                <div class="diagnosis-item" :class="{ 'changed': isDiagnosisChanged(1) }">
                  <span class="rank">1.</span>
                  <span class="diagnosis">{{ getDiagnosisName(postAiData.diagnosisRank1Id) }}</span>
                  <i v-if="isDiagnosisChanged(1)" class="pi pi-exclamation-circle text-orange-500 ml-2"></i>
                </div>
                <div class="diagnosis-item" :class="{ 'changed': isDiagnosisChanged(2) }">
                  <span class="rank">2.</span>
                  <span class="diagnosis">{{ getDiagnosisName(postAiData.diagnosisRank2Id) }}</span>
                  <i v-if="isDiagnosisChanged(2)" class="pi pi-exclamation-circle text-orange-500 ml-2"></i>
                </div>
                <div class="diagnosis-item" :class="{ 'changed': isDiagnosisChanged(3) }">
                  <span class="rank">3.</span>
                  <span class="diagnosis">{{ getDiagnosisName(postAiData.diagnosisRank3Id) }}</span>
                  <i v-if="isDiagnosisChanged(3)" class="pi pi-exclamation-circle text-orange-500 ml-2"></i>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </div>

    <!-- Confidence & Certainty Comparison -->
    <div class="comparison-section mb-4">
      <h3 class="text-xl font-semibold mb-3 flex align-items-center gap-2">
        <i class="pi pi-chart-bar"></i>
        Confidence & Certainty Comparison
      </h3>
      <div class="grid">
        <div class="col-12 md:col-6">
          <Card>
            <template #title>Confidence in Top Diagnosis</template>
            <template #content>
              <div class="score-comparison">
                <div class="score-item">
                  <span class="label">Pre-AI:</span>
                  <ProgressBar :value="preAiData.confidenceScore * 20" 
                               :showValue="false" 
                               class="score-bar" />
                  <Tag :value="preAiData.confidenceScore" />
                </div>
                <div class="score-item">
                  <span class="label">Post-AI:</span>
                  <ProgressBar :value="postAiData.confidenceScore * 20" 
                               :showValue="false" 
                               class="score-bar"
                               :class="{ 'changed': postAiData.confidenceScore !== preAiData.confidenceScore }" />
                  <Tag :value="postAiData.confidenceScore" 
                       :severity="postAiData.confidenceScore !== preAiData.confidenceScore ? 'warning' : 'secondary'" />
                </div>
                <div v-if="postAiData.confidenceScore !== preAiData.confidenceScore" class="change-indicator">
                  <i class="pi pi-arrow-right text-orange-500"></i>
                  <span class="text-orange-500 font-semibold">
                    {{ postAiData.confidenceScore > preAiData.confidenceScore ? 'Increased' : 'Decreased' }}
                  </span>
                </div>
              </div>
            </template>
          </Card>
        </div>
        <div class="col-12 md:col-6">
          <Card>
            <template #title>Certainty of Management Plan</template>
            <template #content>
              <div class="score-comparison">
                <div class="score-item">
                  <span class="label">Pre-AI:</span>
                  <ProgressBar :value="preAiData.certaintyScore * 20" 
                               :showValue="false" 
                               class="score-bar" />
                  <Tag :value="preAiData.certaintyScore" />
                </div>
                <div class="score-item">
                  <span class="label">Post-AI:</span>
                  <ProgressBar :value="postAiData.certaintyScore * 20" 
                               :showValue="false" 
                               class="score-bar"
                               :class="{ 'changed': postAiData.certaintyScore !== preAiData.certaintyScore }" />
                  <Tag :value="postAiData.certaintyScore" 
                       :severity="postAiData.certaintyScore !== preAiData.certaintyScore ? 'warning' : 'secondary'" />
                </div>
                <div v-if="postAiData.certaintyScore !== preAiData.certaintyScore" class="change-indicator">
                  <i class="pi pi-arrow-right text-orange-500"></i>
                  <span class="text-orange-500 font-semibold">
                    {{ postAiData.certaintyScore > preAiData.certaintyScore ? 'Increased' : 'Decreased' }}
                  </span>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </div>

    <!-- Management Strategy Comparison -->
    <div class="comparison-section mb-4">
      <h3 class="text-xl font-semibold mb-3 flex align-items-center gap-2">
        <i class="pi pi-cog"></i>
        Management Strategy Comparison
      </h3>
      <div class="grid">
        <div class="col-12 md:col-6">
          <Card>
            <template #title>
              <div class="flex align-items-center gap-2">
                <i class="pi pi-user text-primary"></i>
                <span>Pre-AI Management</span>
              </div>
            </template>
            <template #content>
              <div class="management-display">
                <div class="strategy-item">
                  <strong>Strategy:</strong>
                  <span>{{ getManagementStrategyName(preAiData.managementStrategyId) }}</span>
                </div>
                <div v-if="preAiData.managementNotes" class="notes-item">
                  <strong>Notes:</strong>
                  <p>{{ preAiData.managementNotes }}</p>
                </div>
              </div>
            </template>
          </Card>
        </div>
        <div class="col-12 md:col-6">
          <Card>
            <template #title>
              <div class="flex align-items-center gap-2">
                <i class="pi pi-android text-primary"></i>
                <span>Post-AI Management</span>
                <Tag v-if="isManagementChanged()" 
                     value="Changed" 
                     severity="warning" 
                     icon="pi pi-exclamation-triangle" />
              </div>
            </template>
            <template #content>
              <div class="management-display">
                <div class="strategy-item" :class="{ 'changed': postAiData.managementStrategyId !== preAiData.managementStrategyId }">
                  <strong>Strategy:</strong>
                  <span>{{ getManagementStrategyName(postAiData.managementStrategyId) }}</span>
                </div>
                <div v-if="postAiData.managementNotes" class="notes-item" :class="{ 'changed': postAiData.managementNotes !== preAiData.managementNotes }">
                  <strong>Notes:</strong>
                  <p>{{ postAiData.managementNotes }}</p>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </div>

    <!-- Summary Statistics -->
    <div class="comparison-section">
      <h3 class="text-xl font-semibold mb-3 flex align-items-center gap-2">
        <i class="pi pi-chart-pie"></i>
        Assessment Summary
      </h3>
      <Card>
        <template #content>
          <div class="grid text-center">
            <div class="col-12 md:col-3">
              <div class="summary-stat">
                <i class="pi pi-list text-3xl text-primary mb-2"></i>
                <div class="text-2xl font-bold">{{ changedDiagnosesCount }}/3</div>
                <div class="text-600">Diagnoses Changed</div>
              </div>
            </div>
            <div class="col-12 md:col-3">
              <div class="summary-stat">
                <i class="pi pi-chart-line text-3xl text-green-500 mb-2"></i>
                <div class="text-2xl font-bold">{{ confidenceChange > 0 ? '+' : '' }}{{ confidenceChange }}</div>
                <div class="text-600">Confidence Change</div>
              </div>
            </div>
            <div class="col-12 md:col-3">
              <div class="summary-stat">
                <i class="pi pi-target text-3xl text-blue-500 mb-2"></i>
                <div class="text-2xl font-bold">{{ certaintyChange > 0 ? '+' : '' }}{{ certaintyChange }}</div>
                <div class="text-600">Certainty Change</div>
              </div>
            </div>
            <div class="col-12 md:col-3">
              <div class="summary-stat">
                <i class="pi pi-cog text-3xl text-orange-500 mb-2"></i>
                <div class="text-2xl font-bold">{{ isManagementChanged() ? 'Yes' : 'No' }}</div>
                <div class="text-600">Management Changed</div>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
  <div v-else class="text-600 text-center p-4">
    Unable to compare assessments. Both pre-AI and post-AI data are required.
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';

interface DiagnosisTermRead {
  name: string;
  id: number;
}

interface ManagementStrategyRead {
  id: number;
  name: string;
}

interface AssessmentData {
  diagnosisRank1Id: number | null;
  diagnosisRank2Id: number | null;
  diagnosisRank3Id: number | null;
  confidenceScore: number;
  managementStrategyId: number | null;
  managementNotes: string;
  certaintyScore: number;
  changeDiagnosis?: boolean | null;
  changeManagement?: boolean | null;
  aiUsefulness?: string | null;
}

const props = defineProps<{
  preAiData: AssessmentData | null;
  postAiData: AssessmentData | null;
  diagnosisTerms: DiagnosisTermRead[];
  managementStrategies: ManagementStrategyRead[];
}>();

// Helper functions
const getDiagnosisName = (diagnosisId: number | null): string => {
  if (!diagnosisId) return 'Not selected';
  const diagnosis = props.diagnosisTerms.find(d => d.id === diagnosisId);
  return diagnosis ? diagnosis.name : 'Unknown diagnosis';
};

const getManagementStrategyName = (strategyId: number | null): string => {
  if (!strategyId) return 'Not selected';
  const strategy = props.managementStrategies.find(s => s.id === strategyId);
  return strategy ? strategy.name : 'Unknown strategy';
};

const isDiagnosisChanged = (rank: number): boolean => {
  if (!props.preAiData || !props.postAiData) return false;
  
  const preValue = rank === 1 ? props.preAiData.diagnosisRank1Id :
                   rank === 2 ? props.preAiData.diagnosisRank2Id :
                   props.preAiData.diagnosisRank3Id;
  
  const postValue = rank === 1 ? props.postAiData.diagnosisRank1Id :
                    rank === 2 ? props.postAiData.diagnosisRank2Id :
                    props.postAiData.diagnosisRank3Id;
  
  return preValue !== postValue;
};

const isManagementChanged = (): boolean => {
  if (!props.preAiData || !props.postAiData) return false;
  return props.preAiData.managementStrategyId !== props.postAiData.managementStrategyId ||
         props.preAiData.managementNotes !== props.postAiData.managementNotes;
};

const changedDiagnosesCount = computed(() => {
  let count = 0;
  if (isDiagnosisChanged(1)) count++;
  if (isDiagnosisChanged(2)) count++;
  if (isDiagnosisChanged(3)) count++;
  return count;
});

const confidenceChange = computed(() => {
  if (!props.preAiData || !props.postAiData) return 0;
  return props.postAiData.confidenceScore - props.preAiData.confidenceScore;
});

const certaintyChange = computed(() => {
  if (!props.preAiData || !props.postAiData) return 0;
  return props.postAiData.certaintyScore - props.preAiData.certaintyScore;
});
</script>

<style scoped>
.comparison-container {
  width: 100%;
}

.comparison-section {
  margin-bottom: 2rem;
}

.diagnosis-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.diagnosis-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background: var(--surface-ground);
  border-radius: var(--border-radius);
  border: 1px solid var(--surface-border);
  transition: all 0.3s ease;
}

.diagnosis-item.changed {
  background: var(--orange-50);
  border-color: var(--orange-200);
}

.diagnosis-item .rank {
  font-weight: bold;
  margin-right: 0.75rem;
  width: 1.5rem;
  flex-shrink: 0;
}

.diagnosis-item .diagnosis {
  flex-grow: 1;
}

.score-comparison {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.score-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.score-item .label {
  font-weight: 600;
  min-width: 4rem;
}

.score-bar {
  flex-grow: 1;
  height: 0.75rem;
}

.change-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--orange-50);
  border-radius: var(--border-radius);
  border: 1px solid var(--orange-200);
}

.management-display {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.strategy-item,
.notes-item {
  padding: 0.75rem;
  background: var(--surface-ground);
  border-radius: var(--border-radius);
  border: 1px solid var(--surface-border);
  transition: all 0.3s ease;
}

.strategy-item.changed,
.notes-item.changed {
  background: var(--orange-50);
  border-color: var(--orange-200);
}

.strategy-item strong,
.notes-item strong {
  display: block;
  margin-bottom: 0.5rem;
}

.notes-item p {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
}

.summary-stat {
  padding: 1rem;
  text-align: center;
}

.summary-stat .text-2xl {
  color: var(--text-color);
}

:deep(.p-progressbar) {
  border-radius: var(--border-radius);
}

:deep(.p-progressbar.changed .p-progressbar-value) {
  background: var(--orange-500);
}
</style>
