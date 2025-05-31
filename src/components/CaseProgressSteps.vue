<template>
  <Card class="mb-4">
    <template #content>
      <Steps :model="items" :activeIndex="activeStep" :readonly="true" class="p-steps-readonly" />
    </template>
  </Card>
</template>

<script setup lang="ts">
import Steps from 'primevue/steps';
import Card from 'primevue/card';
import type { MenuItem } from 'primevue/menuitem';

defineProps<{
  items: MenuItem[];
  activeStep: number;
}>();
</script>

<style scoped>
.p-steps-readonly ::v-deep(.p-steps-item) {
  cursor: default !important;
}

.p-steps-readonly ::v-deep(.p-steps-item.p-highlight .p-steps-number) {
  background-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.p-steps-readonly ::v-deep(.p-steps-item:not(.p-highlight) .p-steps-number) {
  background-color: var(--p-surface-border);
  color: var(--p-text-color);
  opacity: 0.6;
}

.p-steps-readonly ::v-deep(.p-steps-item .p-menuitem-link:focus) {
  box-shadow: none !important;
}
</style>
