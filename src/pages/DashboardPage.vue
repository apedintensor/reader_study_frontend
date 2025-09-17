<template>
  <div class="u-page u-page-standard">
    <Toast />
    
    <!-- Progress Overview -->
    <div class="grid">
      <!-- Stats Summary (moved to top) -->
      <div class="col-12 order-0">
        <Card class="mb-4">
          <template #title>
            <div class="flex align-items-center">
              <i class="pi pi-chart-bar text-xl mr-2"></i>
              <span class="text-xl font-medium">Game Progress</span>
            </div>
          </template>
          <template #content>
            <div class="grid game-progress-grid">
              <div class="col-12 md:col-4">
                <div class="u-surface-card shadow-1 border-round p-4 h-full metric-tile compact">
                  <div class="metric-row">
                    <div class="metric-head">
                      <i class="pi pi-list"></i>
                      <span class="label">Total Cases</span>
                    </div>
                    <span class="value">{{ loading ? '—' : totalCases }}</span>
                  </div>
                </div>
              </div>
              
              <div class="col-12 md:col-4">
                <div class="u-surface-card shadow-1 border-round p-4 h-full metric-tile compact">
                  <div class="metric-row">
                    <div class="metric-head">
                      <i class="pi pi-check-circle text-green-500"></i>
                      <span class="label">Completed</span>
                    </div>
                    <span class="value">{{ loading ? '—' : completedCount }}</span>
                  </div>
                </div>
              </div>
              
              <div class="col-12 md:col-4">
                <div class="u-surface-card shadow-1 border-round p-4 h-full metric-tile compact">
                  <div class="metric-row">
                    <div class="metric-head">
                      <i class="pi pi-clock text-orange-500"></i>
                      <span class="label">Remaining</span>
                    </div>
                    <span class="value">{{ loading ? '—' : remainingCount }}</span>
                  </div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="col-12 mt-4">
                <div class="u-surface-card shadow-1 border-round p-4 progress-green-block">
                  <div class="flex justify-content-between align-items-center mb-3">
                    <div class="flex align-items-center">
                      <i class="pi pi-chart-line text-primary mr-2"></i>
                      <span class="text-900 font-medium">Overall Progress</span>
                    </div>
                    <Tag :value="Math.round(completionPercentage) + '%'" 
                         :severity="completionPercentage === 100 ? 'success' : 'info'"
                         :icon="completionPercentage === 100 ? 'pi pi-check' : 'pi pi-chart-line'" />
                  </div>
                  <ProgressBar :value="completionPercentage" :showValue="false" class="h-1rem" />
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>
      <!-- Game Blocks (Server Managed) -->
      <div class="col-12 order-1">
        <DashboardGamesList />
      </div>

  <!-- Available Cases list hidden per request -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useCaseStore } from '../stores/caseStore';
import { useGamesStore } from '../stores/gamesStore';
import { getGameProgress, type GameProgressResponse } from '../api/games';
import DashboardGamesList from '../components/DashboardGamesList.vue';
import Card from 'primevue/card';
// Removed case list components (DataTable, Column, Button) after hiding section
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import Toast from 'primevue/toast';
// import InputText removed
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const userStore = useUserStore();
const caseStore = useCaseStore();
// gameStore removed (cases list deleted)
const gamesStore = useGamesStore();
const toast = useToast();

const loading = ref(true);
const cases = computed(() => caseStore.cases);
// Backend authoritative progress (null until fetched). When null, fall back to local derived counts.
const progress = ref<GameProgressResponse | null>(null);
// blockSize removed (no cases list)
// Landing panel removed

// Update completed cases tracking to be reactive
const completedCases = computed(() => {
  return cases.value.filter(c => {
    const progress = caseStore.getCaseProgress(c.id);
    return progress?.postCompleted;
  });
});

// Add pending cases tracking
const pendingPostAiCases = computed(() => {
  return cases.value.filter(c => {
    const progress = caseStore.getCaseProgress(c.id);
    return progress?.preCompleted && !progress?.postCompleted;
  });
});

// Derived counts (prefer backend stats when available)
const totalCases = computed(() => progress.value ? progress.value.total_cases : cases.value.length);
const completedCount = computed(() => progress.value ? progress.value.completed_cases : completedCases.value.length);
const remainingCount = computed(() => progress.value ? progress.value.remaining_cases : Math.max(0, totalCases.value - completedCount.value));

const completionPercentage = computed(() => {
  if (progress.value) {
    return progress.value.total_cases ? (progress.value.completed_cases / progress.value.total_cases) * 100 : 0;
  }
  return cases.value.length ? (completedCases.value.length / cases.value.length) * 100 : 0;
});

// focusBlockStart removed with cases table

// filteredCases removed with case list section

// Smallest (lowest ID) incomplete case (pre not done preferred implicitly because any not postCompleted qualifies)
// nextCase logic removed with landing panel

const loadAndDisplayProgress = async () => {
  try {
    const userId = userStore.user?.id;
    if (!userId) {
      throw new Error('No user ID available');
    }

    // First load all cases
    const casesSuccess = await caseStore.loadCases();
    if (!casesSuccess) {
      throw new Error('Failed to load cases');
    }

    // Try fetching authoritative progress snapshot
    try {
      progress.value = await getGameProgress();
    } catch (err) {
      console.warn('Failed to fetch /game/progress, falling back to local aggregation', err);
      // Fallback: aggregate across blocks locally
      const blockIndices = gamesStore.games.map(g=>g.block_index).filter(v=> typeof v === 'number');
      const assessmentsLoaded = await caseStore.loadAssessmentsAcrossBlocks(userId, blockIndices.length? blockIndices : [0]);
      if (!assessmentsLoaded) {
        console.warn('Failed to load assessments for fallback progress.');
      } else {
        progress.value = {
          total_cases: cases.value.length,
            completed_cases: completedCases.value.length,
            remaining_cases: Math.max(0, cases.value.length - completedCases.value.length),
            assigned_cases: cases.value.length, // assumption: all loaded are assigned
            unassigned_cases: 0,
            in_progress_cases: Object.values(caseStore.caseProgress).filter(p=>p.preCompleted && !p.postCompleted).length
        };
      }
    }

    // Log detailed progress state
    const progressSummary = {
      total: cases.value.length,
      completed: completedCases.value.length,
      pending: pendingPostAiCases.value.length,
      inProgress: Object.values(caseStore.caseProgress).filter(p => p.preCompleted && !p.postCompleted).length,
      notStarted: Object.values(caseStore.caseProgress).filter(p => !p.preCompleted && !p.postCompleted).length,
      // Add index signature to acc
      progressByCase: Object.entries(caseStore.caseProgress).reduce((acc: { [key: string]: any }, [caseId, progress]) => {
        acc[`case_${caseId}`] = {
          preCompleted: progress.preCompleted,
          postCompleted: progress.postCompleted,
          status: progress.postCompleted ? 'completed' : 
                 progress.preCompleted ? 'post-ai-pending' : 
                 'not-started'
        };
        return acc;
      }, {})
    };

    console.log('Progress Summary:', progressSummary);
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load data. Please try refreshing the page.',
      life: 5000
    });
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  if (!userStore.isAuthenticated) {
    router.push('/login');
    return;
  }
  loading.value = true;
  // Hydrate any active in-progress game so Resume/Start status is correct after refresh
  gamesStore.hydrateActiveGame().catch(() => {});
  // Load existing game summaries (no force); avoids repeated /game/reports when already cached
  gamesStore.loadAllGames().catch(err => console.warn('Failed to load game summaries', err));
  await loadAndDisplayProgress();
});

// If user navigates away and back (e.g., via header click) reuse component instance? In some layouts keep-alive may cache.
// Provide a lightweight interval revalidation while dashboard is active to ensure new summaries appear shortly after finishing a game.
let revalHandle: any = null;
let revalAttempts = 0;
onMounted(()=>{
  if(revalHandle) clearInterval(revalHandle);
  revalHandle = setInterval(async ()=>{
  // Skip if tab is not visible to reduce unnecessary network calls
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    // Identify blocks that are fully completed but have no hydrated summary yet
    const doneBlocks = Object.entries(gamesStore.assignmentsByBlock)
      .map(([k, v]) => ({ block: Number(k), list: v as any[] }))
      .filter(({ list }) => Array.isArray(list) && list.length > 0 && list.every(a => a.completed_post_at));
    const missing = doneBlocks.filter(({ block }) => {
      const s = gamesStore.games.find(g => g.block_index === block);
      return !s || (s.top1_accuracy_post == null && s.top1_accuracy_pre == null);
    });
    if (!missing.length) {
      // Up-to-date: stop polling
      clearInterval(revalHandle); revalHandle = null; return;
    }
    // Limit attempts so we don't poll forever if backend delays; ~2 minutes at 8s interval
    revalAttempts += 1;
    // Fetch only the specific missing summaries (gamesStore.loadGame uses can_view_report guard)
    await Promise.all(missing.map(m => gamesStore.loadGame(m.block, { force: true }))).catch(()=>{});
    if(revalAttempts >= 15){ clearInterval(revalHandle); revalHandle=null; }
  }, 8000); // every 8s until all blocks complete
});

// Prevent background polling when leaving the Dashboard
onUnmounted(()=>{
  if(revalHandle){
    clearInterval(revalHandle);
    revalHandle = null;
  }
});

// Add watch for assessment updates
watch(() => caseStore.caseProgress, () => {
  // This will trigger reactivity when assessment status changes
}, { deep: true });

// navigateToCase removed

// getStatusSeverity removed

// getStatusLabel removed

// getStatusIcon removed

// getActionLabel removed

// searchTerm/filters removed

// startGame removed with landing deletion
</script>

<style scoped>

:deep(.cursor-pointer) {
  cursor: pointer;
}

:deep(.p-card) {
  background: var(--surface-card);
  border-radius: var(--border-radius);
}

:deep(.p-progressbar) { background: var(--bg-surface-ground); }

:deep(.shadow-1) {
  box-shadow: 0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12);
}

/* Responsive container spacing handled by .u-page media query */
</style>
<style scoped>
/* Green theming for dashboard overall progress bar (remove purple) */
.progress-green-block {
  --accent-primary: var(--success-color);
  --accent-primary-alt: var(--success-color);
  --focus-ring: var(--success-color);
}
/* Force progress bar fill */
:deep(.progress-green-block .p-progressbar .p-progressbar-value) { background: var(--success-color)!important; }
/* Make info tag green */
:deep(.progress-green-block .p-tag.p-tag-info) { background: var(--highlight-success-bg)!important; color: var(--success-color)!important; border:1px solid var(--success-color)!important; }

/* Metric tiles responsive compact mode */
.metric-tile { transition: padding .18s ease, background .18s ease; }

@media (max-width: 1350px) {
  .game-progress-grid .metric-tile { padding: 1.5rem 1.25rem !important; }
  .game-progress-grid .metric-tile .text-4xl { font-size: 2rem; }
}

@media (max-width: 1100px) {
  .game-progress-grid { gap: .5rem !important; }
  .game-progress-grid .metric-tile { padding: 1.1rem .95rem !important; }
  .game-progress-grid .metric-tile .text-4xl { font-size: 1.75rem; }
  .game-progress-grid .metric-tile i { margin-bottom: .35rem !important; font-size:1.15rem !important; }
  .game-progress-grid .metric-tile .u-text-secondary { font-size:.75rem; }
  .game-progress-grid .metric-tile .u-text-muted { font-size:.65rem; margin-top:.35rem; }
  .progress-green-block { padding: .85rem 1rem !important; }
  :deep(.progress-green-block .p-progressbar) { height: .6rem !important; }
  :deep(.progress-green-block .p-tag) { transform: scale(.85); transform-origin: right center; }
}

@media (max-width: 780px) {
  .game-progress-grid .metric-tile { display:flex; align-items:center; gap:.75rem; padding:.85rem .85rem !important; }
  .game-progress-grid .metric-tile i { margin:0 !important; }
  .game-progress-grid .metric-tile .text-4xl { font-size:1.5rem; margin-top:0; }
  .game-progress-grid .metric-tile .u-text-secondary { margin-top:0; }
  .game-progress-grid .metric-tile .u-text-muted { display:none; }
  .progress-green-block .flex.justify-content-between { flex-wrap:wrap; gap:.5rem; }
}

@media (max-width: 520px) {
  .game-progress-grid .metric-tile { padding:.65rem .65rem !important; }
  .game-progress-grid .metric-tile .text-4xl { font-size:1.35rem; }
  :deep(.progress-green-block .p-progressbar) { height:.5rem !important; }
}

/* Compact metric layout */
.metric-tile.compact { padding:1.1rem 1.25rem !important; }
.metric-tile.compact .metric-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
.metric-tile.compact .metric-head { display:flex; align-items:center; gap:.5rem; font-size:.8rem; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--text-color-secondary); }
.metric-tile.compact i { font-size:1rem; margin:0!important; }
.metric-tile.compact .value { font-size:1.9rem; font-weight:700; font-variant-numeric: tabular-nums; color:var(--text-color); }

@media (max-width:1100px){
  .metric-tile.compact .value { font-size:1.6rem; }
}
@media (max-width:780px){
  .metric-tile.compact { padding:.85rem .9rem !important; }
  .metric-tile.compact .value { font-size:1.45rem; }
  .metric-tile.compact .metric-head { font-size:.7rem; }
}
@media (max-width:520px){
  .metric-tile.compact { padding:.65rem .65rem !important; }
  .metric-tile.compact .value { font-size:1.3rem; }
}
</style>