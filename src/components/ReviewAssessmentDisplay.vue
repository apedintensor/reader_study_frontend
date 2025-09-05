<template>
  <div v-if="assessmentData" class="assessment-display">
    <!-- Diagnoses Section -->
    <Fieldset legend="Differential Diagnoses (Top 3)" class="mb-4">
      <div class="grid equal-cols">
        <div class="col-12 md:col-4">
          <div class="field-display">
            <span class="field-label font-semibold">Rank 1 Diagnosis:</span>
            <div class="value">{{ getDiagnosisName(assessmentData.diagnosisRank1Id) }}</div>
          </div>
        </div>
        <div class="col-12 md:col-4">
          <div class="field-display">
            <span class="field-label font-semibold">Rank 2 Diagnosis:</span>
            <div class="value">{{ getDiagnosisName(assessmentData.diagnosisRank2Id) }}</div>
          </div>
        </div>
        <div class="col-12 md:col-4">
          <div class="field-display">
            <span class="field-label font-semibold">Rank 3 Diagnosis:</span>
            <div class="value">{{ getDiagnosisName(assessmentData.diagnosisRank3Id) }}</div>
          </div>
        </div>
      </div>
    </Fieldset>

    <!-- Confidence & Certainty Section -->
    <Fieldset legend="Confidence & Certainty" class="mb-4">
      <div class="grid equal-cols">
        <div class="col-12 md:col-6">
          <div class="field-display">
            <span class="field-label font-semibold">Confidence in Top Diagnosis:</span>
            <div class="value">
              <div class="flex align-items-center gap-2">
                <Tag :value="assessmentData.confidenceScore" />
                <span class="text-600">{{ getConfidenceLabel(assessmentData.confidenceScore) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 md:col-6">
          <div class="field-display">
            <span class="field-label font-semibold">Certainty of Management Plan:</span>
            <div class="value">
              <div class="flex align-items-center gap-2">
                <Tag :value="assessmentData.certaintyScore" />
                <span class="text-600">{{ getCertaintyLabel(assessmentData.certaintyScore) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Fieldset>

  <!-- Management Plan Section removed (deprecated) -->

    <!-- AI Impact Assessment (Post-AI only) -->
    <div v-if="showAiImpact && assessmentData.changeDiagnosis !== undefined">
      <Fieldset legend="AI Impact Assessment" class="mb-4">
        <div class="grid equal-cols ai-impact-section">
          <div class="col-12 md:col-4">
            <div class="field-display">
              <span class="field-label font-semibold">Changed Primary Diagnosis:</span>
              <div class="value">
                <Tag :value="assessmentData.changeDiagnosis ? 'Yes' : 'No'" 
                     :severity="assessmentData.changeDiagnosis ? 'warning' : 'success'" />
              </div>
            </div>
          </div>
          <div class="col-12 md:col-4">
            <div class="field-display">
              <span class="field-label font-semibold">Changed Management Plan:</span>
              <div class="value">
                <Tag :value="assessmentData.changeManagement ? 'Yes' : 'No'" 
                     :severity="assessmentData.changeManagement ? 'warning' : 'success'" />
              </div>
            </div>
          </div>
          <div class="col-12 md:col-4">
            <div class="field-display">
              <span class="field-label font-semibold">AI Usefulness:</span>
              <div class="value">
                <Tag :value="getAiUsefulnessLabel(assessmentData.aiUsefulness)" 
                     :severity="getAiUsefulnessSeverity(assessmentData.aiUsefulness)" />
              </div>
            </div>
          </div>
        </div>
      </Fieldset>
    </div>
  </div>
  <div v-else class="text-600 text-center p-4">
    No {{ phase }} assessment data available.
  </div>
</template>

<script setup lang="ts">
import Fieldset from 'primevue/fieldset';
import Tag from 'primevue/tag';

interface DiagnosisTermRead {
  name: string;
  id: number;
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

const props = defineProps<{
  assessmentData: AssessmentData | null;
  diagnosisTerms: DiagnosisTermRead[];
  phase: string;
  showAiImpact?: boolean;
}>();

// Helper functions
const getDiagnosisName = (diagnosisId: number | null): string => {
  if (!diagnosisId) return 'Not selected';
  const diagnosis = props.diagnosisTerms.find(d => d.id === diagnosisId);
  return diagnosis ? diagnosis.name : 'Unknown diagnosis';
};

// Management strategies removed

const getConfidenceLabel = (score: number): string => {
  switch (score) {
    case 1: return 'Very Low Confidence';
    case 2: return 'Low Confidence';
    case 3: return 'Moderate Confidence';
    case 4: return 'High Confidence';
    case 5: return 'Very High Confidence';
    default: return 'Not specified';
  }
};

const getCertaintyLabel = (score: number): string => {
  switch (score) {
    case 1: return 'Very Uncertain';
    case 2: return 'Somewhat Uncertain';
    case 3: return 'Moderately Certain';
    case 4: return 'Quite Certain';
    case 5: return 'Very Certain';
    default: return 'Not specified';
  }
};

const getAiUsefulnessLabel = (usefulness: string | null | undefined): string => {
  switch (usefulness) {
    case 'very': return 'Very Useful';
    case 'somewhat': return 'Somewhat Useful';
    case 'not': return 'Not Useful';
    default: return 'Not specified';
  }
};

const getAiUsefulnessSeverity = (usefulness: string | null | undefined): string => {
  switch (usefulness) {
    case 'very': return 'success';
    case 'somewhat': return 'warning';
    case 'not': return 'danger';
    default: return 'secondary';
  }
};
</script>

<style scoped>
.assessment-display {
  width: 100%;
}

.equal-cols > [class*='col-'] {
  display: flex;
  flex-direction: column;
}

.equal-cols .field-display { flex:1 1 auto; display:flex; flex-direction:column; align-items:center; text-align:center; }

.field-display { margin-bottom: .85rem; }

.field-display label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.field-display .value { padding:0.5rem 0.75rem; background:var(--bg-surface-ground); border:1px solid var(--border-color); border-radius:var(--border-radius); min-height:2.4rem; display:flex; align-items:center; justify-content:center; line-height:1.3; }

.field-display .value.notes {
  white-space: pre-wrap;
  line-height: 1.5;
  align-items: flex-start;
  padding-top: 0.75rem;
}

:deep(.p-fieldset) {
  margin-bottom: 1rem;
}

:deep(.p-fieldset-legend) {
  background: var(--primary-color);
  color: var(--primary-color-text);
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
  font-weight: 600;
}

:deep(.p-fieldset-content) { padding: .85rem 1rem 1rem; }

/* Equalize tag line heights */
.value :deep(.p-tag) { line-height:1; font-size:.75rem; font-weight:600; }

/* AI Impact section specific alignment */
.ai-impact-section .field-display { 
  align-items: stretch; 
  text-align: left; 
}

.ai-impact-section .field-label { 
  text-align: center; 
  margin-bottom: 0.5rem; 
}

.ai-impact-section .value { 
  justify-content: center; 
}
</style>
