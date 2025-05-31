<template>
  <Card class="mb-4">
    <template #title>
      <div class="flex justify-content-between align-items-center">
        <span>Case Metadata</span>
        <Tag :value="isPostAiPhase ? 'Post-AI Phase' : 'Pre-AI Phase'" 
             :severity="isPostAiPhase ? 'info' : 'primary'" />
      </div>
    </template>
    <template #content>
      <div v-if="metadata" class="metadata-grid">
        <div v-if="metadata.age !== null && metadata.age !== undefined">
          <strong>Age:</strong> {{ metadata.age }}
        </div>
        <div v-if="metadata.gender">
          <strong>Gender:</strong> {{ metadata.gender }}
        </div>
        <div v-if="metadata.fever_history !== null && metadata.fever_history !== undefined">
          <strong>Fever History:</strong> {{ metadata.fever_history ? 'Yes' : 'No' }}
        </div>
        <div v-if="metadata.psoriasis_history !== null && metadata.psoriasis_history !== undefined">
          <strong>Psoriasis History:</strong> {{ metadata.psoriasis_history ? 'Yes' : 'No' }}
        </div>
        <div v-if="metadata.other_notes" class="notes-section">
          <strong>Other Notes:</strong>
          <p>{{ metadata.other_notes }}</p>
        </div>
      </div>
      <div v-else>
        <p>No metadata available for this case.</p>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card';
import Tag from 'primevue/tag';

interface CaseMetaDataRead {
  id: number;
  case_id: number;
  age?: number | null;
  gender?: string | null;
  fever_history?: boolean | null;
  psoriasis_history?: boolean | null;
  other_notes?: string | null;
}

defineProps<{
  metadata: CaseMetaDataRead | null;
  isPostAiPhase: boolean;
}>();
</script>

<style scoped>
.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}
.notes-section {
  grid-column: 1 / -1; /* Span full width */
}
.notes-section p {
  margin-top: 0.25rem;
  white-space: pre-wrap; /* Preserve line breaks in notes */
}
.flex {
  display: flex;
}
.justify-content-between {
  justify-content: space-between;
}
.align-items-center {
  align-items: center;
}
</style>
