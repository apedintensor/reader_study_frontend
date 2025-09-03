<template>
  <Dialog :visible="visible" modal header="Game Summary" :style="{ width: '40rem' }" :closable="false">
    <div v-if="loading" class="flex justify-content-center py-6">
      <ProgressSpinner />
    </div>
    <div v-else-if="stats" class="flex flex-column gap-4">
      <div class="grid text-center">
        <div class="col-6">
          <h4>Top-1 Accuracy</h4>
          <div class="accuracy-pair">
            <span class="pre" :title="percent(stats.top1_accuracy_pre)">Pre: {{ percent(stats.top1_accuracy_pre) }}</span>
            <span class="post" :title="percent(stats.top1_accuracy_post)">Post: {{ percent(stats.top1_accuracy_post) }}</span>
          </div>
          <Tag :value="deltaDisplay(stats.delta_top1)" :severity="deltaSeverity(stats.delta_top1)" />
        </div>
        <div class="col-6">
          <h4>Top-3 Accuracy</h4>
          <div class="accuracy-pair">
            <span class="pre" :title="percent(stats.top3_accuracy_pre)">Pre: {{ percent(stats.top3_accuracy_pre) }}</span>
            <span class="post" :title="percent(stats.top3_accuracy_post)">Post: {{ percent(stats.top3_accuracy_post) }}</span>
          </div>
          <Tag :value="deltaDisplay(stats.delta_top3)" :severity="deltaSeverity(stats.delta_top3)" />
        </div>
      </div>
      <div class="peer" v-if="stats.peer_percentile_top1 !== undefined || stats.peer_percentile_top3 !== undefined">
        <Message severity="info" icon="pi pi-users">
          Peer Percentiles: Top1 {{ percentile(stats.peer_percentile_top1) }} | Top3 {{ percentile(stats.peer_percentile_top3) }}
        </Message>
      </div>
      <div class="flex justify-content-end">
        <Button label="Continue" icon="pi pi-arrow-right" @click="$emit('continue')" autofocus />
      </div>
    </div>
    <div v-else class="py-4 text-center text-600">No statistics available for this block.</div>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import type { BlockFeedback } from '../types/domain';

defineProps<{ visible: boolean; stats: BlockFeedback | null; loading?: boolean }>();
defineEmits<{ (e: 'continue'): void }>();

function percent(v?: number) { return v === undefined ? '—' : (v * 100).toFixed(0) + '%'; }
function percentile(v?: number) { return v === undefined ? '—' : (v * 100).toFixed(0) + 'th'; }
function deltaDisplay(v?: number) { return v === undefined ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + ' pts'; }
function deltaSeverity(v?: number) { if (v === undefined) return 'secondary'; if (v > 0) return 'success'; if (v < 0) return 'danger'; return 'info'; }
</script>

<style scoped>
.accuracy-pair { display:flex; flex-direction:column; gap:.25rem; font-size:1.1rem; }
.accuracy-pair .pre { color: var(--text-color-secondary); }
.accuracy-pair .post { font-weight:600; }
</style>
