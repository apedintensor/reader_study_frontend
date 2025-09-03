<template>
  <div class="dashboard-container">
    <Toast />
    
    <!-- Progress Overview -->
    <div class="grid">
      <!-- Game Blocks (Server Managed) -->
      <div class="col-12">
        <DashboardGamesList />
      </div>
      <!-- Stats Summary -->
      <div class="col-12">
        <Card class="mb-4">
          <template #title>
            <div class="flex align-items-center">
              <i class="pi pi-chart-bar text-xl mr-2"></i>
              <span class="text-xl font-medium">Game Progress</span>
            </div>
          </template>
          <template #content>
            <div class="grid">
              <div class="col-12 md:col-4">
                <div class="surface-card shadow-1 border-round p-4 h-full">
                  <i class="pi pi-list text-xl text-primary mb-3"></i>
                  <div class="text-500 font-medium">Total Cases</div>
                  <div class="text-900 text-4xl font-bold mt-2">{{ loading ? '—' : totalCases }}</div>
                  <div class="text-600 mt-2">All available cases</div>
                </div>
              </div>
              
              <div class="col-12 md:col-4">
                <div class="surface-card shadow-1 border-round p-4 h-full">
                  <i class="pi pi-check-circle text-xl text-green-500 mb-3"></i>
                  <div class="text-500 font-medium">Completed</div>
                  <div class="text-900 text-4xl font-bold mt-2">{{ loading ? '—' : completedCount }}</div>
                  <div class="text-600 mt-2">Successfully assessed cases</div>
                </div>
              </div>
              
              <div class="col-12 md:col-4">
                <div class="surface-card shadow-1 border-round p-4 h-full">
                  <i class="pi pi-clock text-xl text-orange-500 mb-3"></i>
                  <div class="text-500 font-medium">Remaining</div>
                  <div class="text-900 text-4xl font-bold mt-2">{{ loading ? '—' : remainingCount }}</div>
                  <div class="text-600 mt-2">Cases pending assessment</div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="col-12 mt-4">
                <div class="surface-card shadow-1 border-round p-4">
                  <div class="flex justify-content-between align-items-center mb-3">
                    <div class="flex align-items-center">
                      <i class="pi pi-chart-line text-primary mr-2"></i>
                      <span class="text-900 font-medium">Overall Progress</span>
                    </div>
                    <Tag :value="Math.round(completionPercentage) + '%'" 
                         :severity="completionPercentage === 100 ? 'success' : 'info'"
                         :icon="completionPercentage === 100 ? 'pi pi-check' : 'pi pi-chart-line'" />
                  </div>
                  <ProgressBar :value="completionPercentage" class="h-1rem" />
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

  <!-- Available Cases list hidden per request -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
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
  // Load server-managed game summaries in parallel (non-blocking for case progress)
  gamesStore.loadAllGames().catch(err => console.warn('Failed to load game summaries', err));
  await loadAndDisplayProgress();
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
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

:deep(.cursor-pointer) {
  cursor: pointer;
}

:deep(.p-card) {
  background: var(--surface-card);
  border-radius: var(--border-radius);
}

:deep(.p-progressbar) {
  background: var(--surface-ground);
}

:deep(.shadow-1) {
  box-shadow: 0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12);
}

@media screen and (max-width: 768px) {
  .dashboard-container {
    padding: 1rem;
  }
}
</style>