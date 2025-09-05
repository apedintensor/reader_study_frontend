<template>
  <div class="u-page u-page-standard report-container u-surface-card border-round">
    <Toast />
    <Card v-if="loading" class="mb-4"><template #title>Loading Report...</template><template #content><ProgressBar mode="indeterminate" style="height:.5rem" /></template></Card>
    <Card v-else-if="!canView">
      <template #title>Report Not Ready</template>
      <template #content>
  <p class="text-600">This game report is not yet available. It may still be finalizing. Try again shortly.</p>
        <Button label="Retry" icon="pi pi-refresh" class="mr-2" :loading="checking" @click="checkAvailability" />
        <Button label="Back" icon="pi pi-arrow-left" severity="secondary" @click="goBack" />
      </template>
    </Card>
    <Card v-else class="mb-4">
      <template #title>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-chart-line" /> Game #{{ blockIndex + 1 }} Performance
        </div>
      </template>
      <template #content>
        <div class="congrats-banner u-surface-overlay border-round p-3 mb-4 flex align-items-center gap-3">
          <span class="emoji" aria-hidden="true">🎉</span>
          <div class="flex flex-column">
            <span class="font-medium">{{ congratsTitle }}</span>
            <span class="u-text-muted text-sm">{{ improvementMessage }}</span>
          </div>
          <div class="ml-auto flex gap-2">
            <Button label="Start Next Game" icon="pi pi-play" size="small" @click="startNext" />
          </div>
        </div>
        <div class="grid">
          <div class="col-12 md:col-6">
            <h3 class="mt-0 mb-2">Accuracy (Pre vs Post)</h3>
            <ul class="list-none m-0 p-0 flex flex-column gap-2 text-sm">
              <li class="flex justify-content-between"><span>Top-1</span><span>{{ pct(report.top1_accuracy_pre) }} → {{ pct(report.top1_accuracy_post) }} (<strong :class="deltaClass(report.delta_top1)">{{ deltaDisplay(report.delta_top1) }}</strong>)</span></li>
              <li class="flex justify-content-between"><span>Top-3</span><span>{{ pct(report.top3_accuracy_pre) }} → {{ pct(report.top3_accuracy_post) }} (<strong :class="deltaClass(report.delta_top3)">{{ deltaDisplay(report.delta_top3) }}</strong>)</span></li>
            </ul>
          </div>
          <div class="col-12 md:col-6">
              <h3 class="mt-0 mb-2">Peer Accuracy</h3>
            <ul class="list-none m-0 p-0 flex flex-column gap-2 text-sm">
              <li class="flex justify-content-between"><span>Top-1 Post</span><span>{{ pct(report.top1_accuracy_post) }} ({{ percentile(report.peer_percentile_top1) }})</span></li>
              <li class="flex justify-content-between"><span>Top-3 Post</span><span>{{ pct(report.top3_accuracy_post) }} ({{ percentile(report.peer_percentile_top3) }})</span></li>
            </ul>
          </div>
          <div class="col-12">
            <Divider />
            <div class="flex gap-2 flex-wrap">
              <Button label="Dashboard" icon="pi pi-home" severity="secondary" @click="goDashboard" />
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import ProgressBar from 'primevue/progressbar';
import Divider from 'primevue/divider';
import { useToast } from 'primevue/usetoast';
import { useGamesStore } from '../stores/gamesStore';
import { getGame, canViewReport } from '../api/games';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const gamesStore = useGamesStore();
const blockIndex = computed(()=> {
  const raw = route.params.block as string | undefined;
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : -1;
});

const loading = ref(true);
const checking = ref(false);
const canView = ref(false);
const polling = ref(false);
const report: any = ref({});

const congratsTitle = computed(() => 'Game Complete!');
const improvementMessage = computed(() => {
  const r: any = report.value || {};
  const parts: string[] = [];
  if (typeof r.delta_top1 === 'number') {
    const pts = Math.round(r.delta_top1 * 100);
    if (pts > 0) parts.push(`Top-1 +${pts} pts`); else if (pts === 0) parts.push('Top-1 unchanged');
  }
  if (typeof r.delta_top3 === 'number') {
    const pts = Math.round(r.delta_top3 * 100);
    if (pts > 0) parts.push(`Top-3 +${pts} pts`); else if (pts === 0) parts.push('Top-3 unchanged');
  }
  if (!parts.length) return 'Great effort completing this game. Keep the momentum going!';
  return `Great job – ${parts.join(' · ')}. Ready for the next challenge?`;
});

function pct(v?: number){ return v==null ? '—' : Math.round(v*100)+'%'; }
function deltaDisplay(v?: number){ if(v==null) return '—'; const pts=Math.round(v*100); return (pts>=0?'+':'')+pts+' pts'; }
function deltaClass(v?: number){ if(v==null) return 'text-500'; if(v>0) return 'text-green-500'; if(v<0) return 'text-red-500'; return 'text-500'; }
function percentile(v?: number){ return v==null ? '—' : `P${Math.round(v*100)}`; }

async function fetchReport(){
  if(!Number.isInteger(blockIndex.value) || blockIndex.value < 0){
    console.warn('fetchReport guard hit invalid blockIndex', blockIndex.value);
    return;
  }
  loading.value = true;
  try {
    const data = await getGame(blockIndex.value);
    report.value = data;
    // Add/update store summary cache
  // Optionally integrate into store (skipped: upsertGame not exported)
  } catch(e:any){
    toast.add({ severity:'warn', summary:'Unavailable', detail:'Report not finalized yet.', life:3000 });
  } finally { loading.value = false; }
}

async function checkAvailability(){
  if(!Number.isInteger(blockIndex.value) || blockIndex.value < 0){
    console.warn('checkAvailability guard invalid blockIndex', blockIndex.value);
    return;
  }
  checking.value = true;
  try {
    const res = await canViewReport(blockIndex.value);
    canView.value = !!res.ready || (res as any).available === true;
    if(canView.value){ await fetchReport(); }
  } catch(e){ canView.value = false; } finally { checking.value=false; }
}

function startPolling(){
  if(polling.value || canView.value) return;
  polling.value = true;
  const interval = setInterval(async ()=>{
    console.debug('Report poll blockIndex=', blockIndex.value, typeof blockIndex.value);
    if(!Number.isInteger(blockIndex.value) || blockIndex.value < 0){
      clearInterval(interval); polling.value=false; return;
    }
    await checkAvailability();
    if(canView.value){ clearInterval(interval); polling.value=false; }
  }, 3000);
}

async function startNext(){
  try {
    const r = await gamesStore.advanceToNext();
    if(r.status === 'exhausted') {
      toast.add({ severity:'info', summary:'Finished', detail:'No more cases remaining.', life:4000 });
      return;
    }
    if(r.assignment){ router.push(`/case/${r.assignment.case_id}`); }
  } catch(e:any){ toast.add({ severity:'error', summary:'Error', detail:e.message||'Failed to start next block.', life:4000 }); }
}
function goDashboard(){ router.push('/'); }
function goBack(){ router.back(); }

onMounted(async () => { await checkAvailability(); if(!canView.value) startPolling(); });
</script>

<style scoped>
/* Max width handled by .u-page-standard; .report-container retained as a hook */
.congrats-banner { position:relative; overflow:hidden; }
.congrats-banner .emoji { font-size:1.75rem; line-height:1; }
.congrats-banner::after { content:''; position:absolute; inset:0; pointer-events:none; border:1px solid var(--border-color); border-radius:inherit; }
</style>
