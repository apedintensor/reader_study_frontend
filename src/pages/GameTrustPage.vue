<template>
  <div class="u-page u-page-standard trust-page u-surface-card border-round">
    <Toast />
    <Card class="trust-card">
      <template #title>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-shield" /> AI Trust Feedback
        </div>
      </template>
      <template #content>
        <p class="text-sm text-600 mb-3">
          Based on the assessment of these 15 cases, do you trust the AI?
        </p>
        <div class="mb-3">
          <SelectButton
            v-model="selectedScore"
            :options="scoreOptions"
            optionLabel="label"
            optionValue="value"
            :allowEmpty="false"
            :disabled="loading || submitting"
            class="trust-select"
          />
          <div v-if="selectedScore" class="mt-2 text-xs text-500">{{ scoreLabel(selectedScore) }}</div>
        </div>
        <div class="flex gap-2">
          <Button
            label="Submit"
            icon="pi pi-check"
            :disabled="selectedScore == null"
            :loading="submitting"
            @click="handleSubmit"
          />
          <Button
            label="Skip for Now"
            text
            severity="secondary"
            @click="skip"
            :disabled="submitting"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import Toast from 'primevue/toast';
import { getBlockTrust, submitBlockTrust, type BlockTrustResponse } from '../api/games';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const blockIndex = computed(() => {
  const raw = route.params.block;
  const num = typeof raw === 'string' ? Number(raw) : Array.isArray(raw) ? Number(raw[0]) : NaN;
  return Number.isFinite(num) ? num : NaN;
});

const loading = ref(false);
const submitting = ref(false);
const selectedScore = ref<number | null>(null);

const scoreOptions = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 }
];

function scoreLabel(score: number) {
  switch (score) {
    case 1: return 'No, not at all';
    case 2: return 'Slightly trusting';
    case 3: return 'Neutral';
    case 4: return 'Mostly trusting';
    case 5: return 'Yes, completely';
    default: return '';
  }
}

async function loadExistingTrust() {
  loading.value = true;
  try {
    const res: BlockTrustResponse | null = await getBlockTrust(blockIndex.value);
    if (res) {
      const resolved = typeof res.trust_ai_score === 'number' ? res.trust_ai_score : res.score;
      if (typeof resolved === 'number') {
        selectedScore.value = resolved;
      }
    }
  } catch (error: any) {
    console.error('Failed to load trust score', error);
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (selectedScore.value == null || submitting.value) return;
  submitting.value = true;
  try {
    await submitBlockTrust(blockIndex.value, { trust_ai_score: selectedScore.value });
    toast.add({ severity: 'success', summary: 'Thank you', detail: 'Trust feedback recorded.', life: 2500 });
    router.replace({ path: `/game/report/${blockIndex.value}` });
  } catch (error: any) {
    console.error('Failed to submit trust score', error);
    toast.add({ severity: 'error', summary: 'Submission Failed', detail: 'Please try again.', life: 4000 });
  } finally {
    submitting.value = false;
  }
}

function skip() {
  router.replace({ path: `/game/report/${blockIndex.value}` });
}

onMounted(async () => {
  if (!Number.isFinite(blockIndex.value)) {
    toast.add({ severity: 'warn', summary: 'Invalid Block', detail: 'Unable to capture trust score without a valid game.', life: 4000 });
    router.replace('/');
    return;
  }
  await loadExistingTrust();
});
</script>

<style scoped>
.trust-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 4rem);
}

.trust-card {
  max-width: 420px;
  width: 100%;
}

.trust-select :deep(.p-selectbutton .p-button) {
  min-width: 3rem;
  justify-content: center;
}
</style>
