<template>
  <Card>
    <template #title>
      {{ isPostAiPhase ? 'Post-AI Assessment' : 'Pre-AI Assessment' }}
    </template>
    <template #content>
      <form @submit.prevent="$emit('submit-form')">
        <Fieldset legend="Differential Diagnoses (Top 3)" class="mb-4">
          <div class="grid formgrid">
            <div class="field col-12">
              <label for="diag1">Rank 1 Diagnosis</label>
              <Dropdown id="diag1"
                        v-model="formData.diagnosisRank1Id"
                        :options="diagnosisTerms"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Select Rank 1 Diagnosis"
                        class="w-full"
                        :class="{'p-invalid': submitted && !formData.diagnosisRank1Id}"
                        filter
                        required
                        v-tooltip.top="'Select the most likely diagnosis.'" />
              <small v-if="submitted && !formData.diagnosisRank1Id" class="p-error">Rank 1 diagnosis is required.</small>
            </div>
            <div class="field col-12">
              <label for="diag2">Rank 2 Diagnosis</label>
              <Dropdown id="diag2"
                        v-model="formData.diagnosisRank2Id"
                        :options="diagnosisTerms"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Select Rank 2 Diagnosis"
                        class="w-full"
                        :class="{'p-invalid': submitted && !formData.diagnosisRank2Id}"
                        filter
                        required
                        v-tooltip.top="'Select the second most likely diagnosis.'" />
              <small v-if="submitted && !formData.diagnosisRank2Id" class="p-error">Rank 2 diagnosis is required.</small>
            </div>
            <div class="field col-12">
              <label for="diag3">Rank 3 Diagnosis</label>
              <Dropdown id="diag3"
                        v-model="formData.diagnosisRank3Id"
                        :options="diagnosisTerms"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Select Rank 3 Diagnosis"
                        class="w-full"
                        :class="{'p-invalid': submitted && !formData.diagnosisRank3Id}"
                        filter
                        required
                        v-tooltip.top="'Select the third most likely diagnosis.'" />
              <small v-if="submitted && !formData.diagnosisRank3Id" class="p-error">Rank 3 diagnosis is required.</small>
            </div>
          </div>
        </Fieldset>

        <Fieldset legend="Confidence & Certainty" class="mb-4">
          <div class="grid formgrid">
            <div class="field col-12 md:col-6">
              <label for="confidence">Confidence in Top Diagnosis (1-5)</label>
              <SelectButton id="confidence"
                            v-model="formData.confidenceScore"
                            :options="scoreOptions"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            v-tooltip.bottom="getConfidenceLabel(formData.confidenceScore || 0)" />
            </div>
            <div class="field col-12 md:col-6">
              <label for="certainty">Certainty of Management Plan (1-5)</label>
              <SelectButton id="certainty"
                            v-model="formData.certaintyScore"
                            :options="scoreOptions"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            v-tooltip.bottom="getCertaintyLabel(formData.certaintyScore || 0)" />
            </div>
          </div>
        </Fieldset>

        <Fieldset legend="Management Plan" class="mb-4">
          <div class="grid formgrid">
            <div class="field col-12">
              <label for="managementStrategy">Management Strategy</label>
              <Dropdown id="managementStrategy"
                        v-model="formData.managementStrategyId"
                        :options="managementStrategies"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Select Management Strategy"
                        class="w-full"
                        :class="{'p-invalid': submitted && !formData.managementStrategyId}"
                        required
                        v-tooltip.top="'Select the most appropriate management strategy.'" />
              <small v-if="submitted && !formData.managementStrategyId" class="p-error">Management strategy is required.</small>
            </div>
            <div class="field col-12">
              <label for="managementNotes">Management Notes (Optional)</label>
              <Textarea id="managementNotes"
                        v-model="formData.managementNotes"
                        rows="3"
                        class="w-full"
                        placeholder="Enter any additional notes for the management plan."
                        v-tooltip.bottom="'Provide any specific details or rationale for your chosen management plan.'" />
            </div>
          </div>
        </Fieldset>

        <!-- Post-AI Specific Questions -->
        <div v-if="isPostAiPhase">
          <Divider />
          <Fieldset legend="AI Impact Assessment" class="mt-4 mb-4">
            <div class="grid formgrid">
              <div class="field col-12 md:col-6">
                <label>Did AI suggestions change your primary diagnosis?</label>
                <SelectButton v-model="formData.changeDiagnosis"
                              :options="changeOptions"
                              optionLabel="label"
                              optionValue="value"
                              class="w-full"
                              :class="{'p-invalid': submitted && formData.changeDiagnosis === null}"
                              required
                              v-tooltip.bottom="changeDiagnosisTooltipText" />
                <small v-if="submitted && formData.changeDiagnosis === null" class="p-error">This field is required.</small>
              </div>
              <div class="field col-12 md:col-6">
                <label>Did AI suggestions change your management plan?</label>
                <SelectButton v-model="formData.changeManagement"
                              :options="changeOptions"
                              optionLabel="label"
                              optionValue="value"
                              class="w-full"
                              :class="{'p-invalid': submitted && formData.changeManagement === null}"
                              required
                              v-tooltip.bottom="changeManagementTooltipText" />
                <small v-if="submitted && formData.changeManagement === null" class="p-error">This field is required.</small>
              </div>
              <div class="field col-12">
                <label>How useful were the AI suggestions?</label>
                <SelectButton v-model="formData.aiUsefulness"
                              :options="aiUsefulnessOptions"
                              optionLabel="label"
                              optionValue="value"
                              class="w-full"
                              :class="{'p-invalid': submitted && !formData.aiUsefulness}"
                              required
                              v-tooltip.bottom="'Rate the overall usefulness of the AI suggestions provided.'" />
                <small v-if="submitted && !formData.aiUsefulness" class="p-error">This field is required.</small>
              </div>
            </div>
          </Fieldset>
        </div>

        <div class="col-12 mt-4">
          <Button type="submit"
                  :label="submitting ? 'Submitting...' : (isPostAiPhase ? 'Complete Assessment' : 'Submit & View AI Suggestions')"
                  :icon="submitting ? 'pi pi-spin pi-spinner' : (isPostAiPhase ? 'pi pi-check-circle' : 'pi pi-arrow-right')"
                  :severity="isPostAiPhase ? 'success' : 'primary'"
                  class="w-full p-3"
                  :loading="submitting"
                  :disabled="submitting"
                  v-tooltip.bottom="isPostAiPhase ? 'Finalize your assessment for this case after reviewing AI suggestions.' : 'Submit your initial assessment and then view AI-generated suggestions.'" />
        </div>
      </form>
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card';
import Fieldset from 'primevue/fieldset';
import Dropdown from 'primevue/dropdown';
import SelectButton from 'primevue/selectbutton';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import Divider from 'primevue/divider';

// Define tooltip texts
const changeDiagnosisTooltipText = "Indicate if the AI's suggestions led you to change your primary diagnosis.";
const changeManagementTooltipText = "Indicate if the AI's suggestions led you to change your management plan.";

// Interfaces for props
interface DiagnosisTermRead {
  name: string;
  id: number;
}

interface ManagementStrategyRead {
  id: number;
  name: string;
}

interface FormData {
  diagnosisRank1Id: number | null;
  diagnosisRank2Id: number | null;
  diagnosisRank3Id: number | null;
  confidenceScore: number;
  managementStrategyId: number | null;
  managementNotes: string;
  certaintyScore: number;
  // Post-AI specific fields - ensure they are optional or handled in parent
  changeDiagnosis?: boolean | null;
  changeManagement?: boolean | null;
  aiUsefulness?: string | null;
}

interface ScoreOption {
  label: string;
  value: number;
}

interface AiUsefulnessOption {
  label: string;
  value: string;
}

interface ChangeOption {
  label: string;
  value: boolean;
}

defineProps<{
  formData: FormData;
  diagnosisTerms: DiagnosisTermRead[];
  managementStrategies: ManagementStrategyRead[];
  scoreOptions: ScoreOption[];
  submitted: boolean;
  submitting: boolean;
  isPostAiPhase: boolean;
  aiUsefulnessOptions?: AiUsefulnessOption[]; // Optional as they are only for post-AI
  changeOptions?: ChangeOption[];           // Optional as they are only for post-AI
  getConfidenceLabel: (score: number) => string;
  getCertaintyLabel: (score: number) => string;
}>();

defineEmits(['submit-form']);

// Register Tooltip directive locally if not globally registered
// import { Tooltip } from 'primevue/tooltip'; // Already imported
// No need for app.directive if it's globally registered in main.ts
// If not, and you want it local: directives: { Tooltip }
</script>

<style scoped>
.w-full {
  width: 100%;
}
.p-error {
  display: block;
  margin-top: 0.25rem;
}
.mb-4 {
  margin-bottom: 1.5rem; /* Consistent spacing */
}
.mt-4 {
  margin-top: 1.5rem;
}
/* Ensure SelectButton options are visible and well-spaced */
:deep(.p-selectbutton .p-button) {
    flex-grow: 1;
}
</style>
