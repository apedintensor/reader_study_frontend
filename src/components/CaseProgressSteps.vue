<template>
  <Card class="mb-4 progress-card">
    <template #content>
      <div
        class="progress-steps"
        role="progressbar"
        :aria-valuemin="1"
        :aria-valuemax="displayedItems.length"
        :aria-valuenow="mappedActive + 1"
      >
        <!-- No connecting line -->

        <div
          v-for="(item, index) in displayedItems"
          :key="index"
          class="step"
          :class="{
            completed: index < mappedActive,
            active: index === mappedActive,
            upcoming: index > mappedActive
          }"
        >
          <div class="circle">{{ index + 1 }}</div>
          <div class="label">{{ item.label }}</div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card';
import { computed } from 'vue';
import type { MenuItem } from 'primevue/menuitem';

const props = defineProps<{ items: MenuItem[]; activeStep: number }>();

// Remove any item labeled 'Complete' from display without changing parent logic
const displayedItems = computed(() => props.items.filter(i => i.label !== 'Complete'));

// Map active step: if original active points to removed final step, clamp to last displayed index
const mappedActive = computed(() => {
  if (props.activeStep >= displayedItems.value.length) {
    return displayedItems.value.length - 1; // collapse 'Complete' into prior step
  }
  return props.activeStep;
});
</script>

<style scoped>
.progress-card {
  overflow: hidden;
}

/* Horizontal steps container */
.progress-steps {
  --circle-size: 2.25rem;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.25rem;
  width: 100%;
  position: relative;
}

.step { flex:1 1 0; display:flex; flex-direction:column; align-items:center; position:relative; padding:0 0.25rem; min-width:0; }

.circle { width:var(--circle-size); height:var(--circle-size); flex:0 0 var(--circle-size); aspect-ratio:1/1; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:500; border:2px solid var(--p-surface-border); background:var(--p-surface-ground); color:var(--p-text-color-secondary); transition:all .25s ease; z-index:2; }

.label { margin-top:.6rem; font-size:.85rem; font-weight:500; text-align:center; color:var(--p-text-color-secondary); min-height:2.2em; display:flex; align-items:center; justify-content:center; padding:0 .25rem; }

/* (Old per-step line removed in favor of unified track) */

/* Completed steps */
.step.completed .circle {
  background: transparent;
  color: var(--p-primary-color);
  border-color: var(--p-primary-color);
  opacity: .55;
}
.step.completed .label {
  color: var(--p-primary-color);
  opacity: .75;
}

/* Active step */
.step.active .circle {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  border-color: var(--p-primary-color);
  box-shadow: 0 0 6px var(--p-primary-color), 0 0 0 4px rgba(0,0,0,.25) inset;
}
.step.active .label {
  color: var(--p-primary-color);
  font-weight: 600;
}

/* Upcoming */
.step.upcoming .circle {
  opacity: 0.65;
}
.step.upcoming .label {
  opacity: 0.65;
}

@media (max-width: 900px) {
  .label { font-size: 0.75rem; }
  .progress-steps { --circle-size: 1.9rem; gap: .75rem; }
}
</style>
