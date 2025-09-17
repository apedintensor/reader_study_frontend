<template>
  <Card class="mb-4 blocks-wrapper">
    <template #title>
      <div class="flex flex-column align-items-center gap-3 w-full">
        <span class="title-line games-intro">
          <span class="line">Complete at least 10 cases to finish one game,</span>
          <span class="line">but feel free to take more!</span>
        </span>
        <div class="start-btn-container">
          <Button v-if="!allExhausted" :label="nextActionLabel" icon="pi pi-play" class="p-button-rounded big-start-btn cta-start-btn" :loading="advancing" :disabled="advancing" @click="onAdvance" />
          <Tag v-else severity="success" value="All Done" />
        </div>
      </div>
    </template>
    <template #content>
  <div v-if="!games.length && !incompleteBlockExists && !advancing && !allExhausted" class="text-600 text-sm text-center py-3">No games yet. Start your first game.</div>
      <div class="blocks-list flex flex-column gap-3">
  <div v-for="g in gamesSorted" :key="g.block_index" class="block-row u-surface-overlay u-card-pad border-round u-elev-1">
          <div class="row-head flex justify-content-between align-items-center">
            <div class="flex align-items-center gap-2">
              <span class="font-medium">Game #{{ g.block_index + 1 }}</span>
            </div>
            <div class="flex align-items-center gap-2">
              <Button label="Details" text size="small" icon="pi pi-list" @click="toggleDetails(g.block_index)" />
              <Button text size="small" label="Open Report" icon="pi pi-chart-line" @click="viewReport(g.block_index)" />
            </div>
          </div>
          <div class="summary mt-2">
            <div v-if="g.top1_accuracy_pre == null && g.top1_accuracy_post == null" class="text-xs text-500">
              <template v-if="assignmentsByBlock[g.block_index] && assignmentsByBlock[g.block_index].some(a=>!a.completed_post_at)">
                In progress...
              </template>
              <template v-else>
                Summary pending...
              </template>
            </div>
            <div v-else class="metrics flex flex-wrap gap-4 text-sm">
              <div class="acc-group u-surface-overlay">
                <div class="group-title u-heading-sub">Your Accuracy</div>
                <div class="stat-row flex justify-content-between"><span>Top1</span><span>{{ pct(g.top1_accuracy_pre) }} → {{ pct(g.top1_accuracy_post) }} <span :class="['ml-1', deltaClass(g.delta_top1)]">({{ deltaDisplay(g.delta_top1) }})</span></span></div>
                <div class="stat-row flex justify-content-between"><span>Top3</span><span>{{ pct(g.top3_accuracy_pre) }} → {{ pct(g.top3_accuracy_post) }} <span :class="['ml-1', deltaClass(g.delta_top3)]">({{ deltaDisplay(g.delta_top3) }})</span></span></div>
              </div>
            </div>
            <!-- Removed per-game progress bar for a cleaner, more compact card -->
          </div>
          <transition name="fade">
            <div v-if="expandedBlock === g.block_index" class="details mt-3 border-top-1 surface-border pt-2">
              <div class="flex flex-column gap-2">
                <div v-if="reportState[g.block_index]?.loading" class="text-xs text-500">Loading report...</div>
                <div v-else-if="reportState[g.block_index]?.data" class="report-cases text-sm">
                  <div class="font-medium mb-2 flex justify-content-between">
                    <span>Game Report</span>
                    <span class="text-xs text-500">{{ reportState[g.block_index].data.total_cases }} cases</span>
                  </div>
                  <div class="grid text-xs mb-2">
                    <div class="col-6 md:col-3"><strong>Top1</strong> {{ pct(reportState[g.block_index].data.top1_accuracy_pre) }} → {{ pct(reportState[g.block_index].data.top1_accuracy_post) }}</div>
                    <div class="col-6 md:col-3"><strong>Top3</strong> {{ pct(reportState[g.block_index].data.top3_accuracy_pre) }} → {{ pct(reportState[g.block_index].data.top3_accuracy_post) }}</div>
                    <div class="col-6 md:col-3"><strong>Δ Top1</strong> <span :class="deltaClass(reportState[g.block_index].data.delta_top1)">{{ deltaDisplay(reportState[g.block_index].data.delta_top1) }}</span></div>
                    <div class="col-6 md:col-3"><strong>Δ Top3</strong> <span :class="deltaClass(reportState[g.block_index].data.delta_top3)">{{ deltaDisplay(reportState[g.block_index].data.delta_top3) }}</span></div>
                  </div>
                  <GameReportCaseTable :cases="reportState[g.block_index].data.cases" :termMap="termMap" />
                </div>
                <div v-else class="text-xs text-500">Report not ready yet (block may be in progress or finalizing).</div>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useGamesStore } from '../stores/gamesStore';
import { useToast } from 'primevue/usetoast';
import { getGame, canViewReport, type CanViewReportResponse } from '../api/games';
import { fetchDiagnosisTerms } from '../api/diagnosisTerms';
import GameReportCaseTable from './GameReportCaseTable.vue';

const gamesStore = useGamesStore();
const toast = useToast();
const router = useRouter();

const games = computed(()=>gamesStore.games);
// expose assignments map for quick status checks
const assignmentsByBlock = computed(()=> gamesStore.assignmentsByBlock);
// Diagnosis terms cache
const termMap = ref<Record<number,string>>({});
const termsLoaded = ref(false);
async function ensureTerms(){
  if(termsLoaded.value) return;
  try {
    const list = await fetchDiagnosisTerms();
    const map:Record<number,string> = {};
    list.forEach(t=>{ if(t && typeof t.id==='number') map[t.id]=t.name; });
    termMap.value = map; termsLoaded.value = true;
  } catch(e){ /* silent fail; ids will show */ }
}
onMounted(()=>{ ensureTerms(); gamesStore.hydrateActiveGame().catch(()=>{}); });
// Display newest / largest block first (descending order)
const gamesSorted = computed(()=>[...games.value].sort((a,b)=> (b.block_index ?? 0) - (a.block_index ?? 0)));
const advancing = ref(false);
// Identify an in-progress (incomplete) block (has assignments & some not finished)
const incompleteBlockIndex = computed(()=>{
  const map:any = gamesStore.assignmentsByBlock || {};
  const keys = Object.keys(map).map(k=>Number(k)).sort((a,b)=>a-b);
  for(const k of keys){
    const list = map[k];
    if(Array.isArray(list) && list.length && list.some(a=>!a.completed_post_at)) return k;
  }
  return null;
});
const incompleteBlockExists = computed(()=> incompleteBlockIndex.value != null);
const nextActionLabel = computed(()=>{
  if(incompleteBlockIndex.value != null) return 'Resume';
  return 'Start';
});
const allExhausted = computed(()=>gamesStore.activeStatus === 'exhausted');
const expandedBlock = ref<number|null>(null);
interface ReportState { loading:boolean; data:any|null; attempts:number; poller?:any }
const reportState = ref<Record<number, ReportState>>({});

function pct(v?: number) { return v == null ? '—' : Math.round(v*100)+'%'; }
function deltaDisplay(v?: number){ if(v==null) return '—'; const pts = Math.round(v*100); return (pts>=0?'+':'')+pts+' pts'; }
function deltaClass(v?: number){ if(v==null) return 'text-500'; if(v>0) return 'text-green-500'; if(v<0) return 'text-red-500'; return 'text-500'; }
// Removed per-game progress Tag display helpers

async function onAdvance(){
  if(advancing.value) return; advancing.value = true;
  try {
    const r = await gamesStore.advanceToNext();
    if(r.status === 'exhausted') {
      toast.add({ severity:'success', summary:'Completed', detail:'All cases finished. Great job!', life:5000 });
      return;
    }
    if(r.assignment){
      router.push(`/case/${r.assignment.case_id}`);
      // Expand block and ensure assignments loaded
      if(r.block_index!=null){
        expandedBlock.value = r.block_index;
        gamesStore.ensureAssignmentsLoaded(r.block_index);
        gamesStore.startSummaryPolling(r.block_index);
      }
    }
  } catch(e:any){
    toast.add({ severity:'error', summary:'Error', detail: e.message || 'Failed to advance.', life:4000 });
  } finally { advancing.value = false; }
}

function clearPoller(block:number){
  const st = reportState.value[block];
  if(st?.poller){ clearInterval(st.poller); delete st.poller; }
}

async function loadReport(block:number){
  const existing = reportState.value[block];
  if(existing?.loading || existing?.data) return;
  reportState.value[block] = { loading:true, data:null, attempts: (existing?.attempts||0) };
  try {
    // Avoid 404 churn: check availability before fetching
    try {
      const can: CanViewReportResponse = await canViewReport(block);
      const ok = !!(can?.available ?? can?.ready);
      if (!ok) {
        // If block is incomplete, mark not ready and return (poller may continue)
        reportState.value[block] = { loading:false, data:null, attempts: existing?.attempts||0 };
        return;
      }
    } catch(_) { /* on can_view error, fall through to getGame attempt */ }
    const data:any = await getGame(block);
    reportState.value[block] = { loading:false, data, attempts: existing?.attempts||0 };
    clearPoller(block);
  } catch(e:any){
    // Assume 404 => not ready yet
    const attempts = (existing?.attempts||0)+1;
    reportState.value[block] = { loading:false, data:null, attempts };
    if(attempts === 1){
      // start a lightweight poll every 5s until success or 20 attempts
      const poller = setInterval(()=>{
        const st = reportState.value[block];
        if(!st || st.data || st.loading || st.attempts>20){ clearPoller(block); return; }
        loadReport(block);
      },5000);
      reportState.value[block].poller = poller;
    }
  }
}

function toggleDetails(block:number){
  if(expandedBlock.value === block){ expandedBlock.value = null; clearPoller(block); return; }
  expandedBlock.value = block;
  loadReport(block);
}


// (Removed duplicate toggleDetails override; merged report case loading into primary function)

function viewReport(block:number){ router.push(`/game/report/${block}`); }

// No summary polling needed; report fetched on demand.

onUnmounted(()=>{
  // Clear any active pollers on component teardown
  Object.keys(reportState.value).forEach(k=>{
    const st = reportState.value[Number(k)];
    if(st?.poller){ clearInterval(st.poller); delete st.poller; }
  });
});
</script>

<style scoped>
.h-half { height: .5rem; }
.blocks-wrapper { width:100%; }
.start-btn-container { display:flex; justify-content:center; width:100%; }
.big-start-btn { padding:1rem 2.75rem; font-size:1.15rem; font-weight:600; }
.title-line { font-size:1.25rem; font-weight:600; }
.games-intro { display:flex; flex-direction:column; gap:.35rem; max-width:860px; text-align:center; line-height:1.35; font-weight:500; font-size:1.05rem; color:var(--text-color); }
.games-intro .line { display:block; }
.start-btn-container { margin-top:.75rem; margin-bottom:1.75rem; }
.cta-start-btn {
  background: linear-gradient(90deg, var(--accent-cta-start, var(--accent-primary)), var(--accent-cta-end, var(--accent-alt)));
  box-shadow: 0 4px 8px -2px rgba(0,0,0,.4), 0 2px 4px -1px rgba(0,0,0,.3);
  transition: transform var(--motion-base, .18s) var(--easing-standard, ease), box-shadow var(--motion-base, .18s) var(--easing-standard, ease), filter var(--motion-base, .18s) var(--easing-standard, ease);
  letter-spacing:.5px;
  color: var(--color-white, #fff);
}
.cta-start-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow:0 8px 18px -4px rgba(0,0,0,.55), 0 4px 8px -2px rgba(0,0,0,.4); filter:brightness(1.05); }
.cta-start-btn:active:not(:disabled) { transform: translateY(0); box-shadow:0 4px 10px -2px rgba(0,0,0,.5); }
.cta-start-btn.p-button:disabled { filter:grayscale(.4); opacity:.7; }
.blocks-list .block-row { position:relative; }
.metrics { width:100%; }
.acc-group { min-width: 220px; background: var(--surface-overlay); padding:.5rem .75rem; border:1px solid var(--surface-border); border-radius:4px; }
.group-title { font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; color: var(--text-color-secondary); margin-bottom:.25rem; font-weight:600; }
.stat-row span:last-child { font-variant-numeric: tabular-nums; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity:0; }
.report-cases { font-size:.75rem; }
.report-cases li { line-height:1.2; }


/* Dark overrides removed: token system supplies correct surfaces & text */
</style>
