import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import apiClient from '../api';
import { useUserStore } from './userStore';
import { getActiveGame } from '../api/games';
import { listBlockAssessments } from '../api/assessments'; // new phase-based endpoint (/api/assessment/...)

// (Removed unused local assessment interface; using dynamic typing for now)

interface Case {
  id: number;
  ground_truth_diagnosis_id?: number | null;
  typical_diagnosis: boolean;
  created_at: string | null;
}

interface CaseProgress {
  caseId: number;
  preCompleted: boolean;
  postCompleted: boolean;
}

export const useCaseStore = defineStore('case', () => {
  const userStore = useUserStore();
  // gameStore no longer required here after refactor (progress callbacks removed)
  const cases = ref<Case[]>([]);
  const currentIndex = ref<number>(0);
  const completedCases = ref<number[]>([]);
  // Use reactive object instead of ref wrapper to avoid manual refresh hacks
  const caseProgress = reactive<Record<number, CaseProgress>>({});

  // Fetch assessments and update progress
  async function loadAssessmentsAndProgress(userId: number) {
    try {
      console.log('Fetching assessments for user:', userId);
      // Determine current (or latest) block. If active game available use its block_index, else start with 0.
      let blockIndex = 0;
      try {
        const active = await getActiveGame();
        if (active && typeof active.block_index === 'number') blockIndex = active.block_index;
      } catch { /* ignore if no active game */ }
      const responseData = await listBlockAssessments(userId, blockIndex).catch(() => [] as any[]);
      console.log('Raw block assessments response:', responseData);
      const userAssessments = Array.isArray(responseData) ? responseData : [];
      console.log('User assessments:', userAssessments);

      // Initialize progress map if empty
    if (Object.keys(caseProgress).length === 0) {
        console.log('Initializing empty progress map for cases:', cases.value.map(c => c.id));
        cases.value.forEach(c => {
      caseProgress[c.id] = {
            caseId: c.id,
            preCompleted: false,
            postCompleted: false
          };
        });
      }

      // Update progress based on assessments (phase-based)
      userAssessments.forEach((assessment: any) => {
        // Need case_id, but new Assessment list returns assignment-level; backend block list should include assignment meta.
        const caseIdFromAssignment = (assessment as any).case_id ?? (assessment as any).assignment_case_id ?? (assessment as any).assignment?.case_id;
        if (!caseIdFromAssignment) return; // skip if cannot resolve
        if (!caseProgress[caseIdFromAssignment]) {
          caseProgress[caseIdFromAssignment] = { caseId: caseIdFromAssignment, preCompleted: false, postCompleted: false };
        }
        if (assessment.phase === 'POST') {
          caseProgress[caseIdFromAssignment].postCompleted = true;
          caseProgress[caseIdFromAssignment].preCompleted = true;
          if (!completedCases.value.includes(caseIdFromAssignment)) completedCases.value.push(caseIdFromAssignment);
        } else if (assessment.phase === 'PRE') {
          caseProgress[caseIdFromAssignment].preCompleted = true;
        }
      });

      console.log('Final progress state:', {
  progress: caseProgress,
        completedCases: completedCases.value
      });

      saveProgressToCache();
      return true;
    } catch (error) {
      console.error('Failed to load assessments:', error);
      return false;
    }
  }

  // NEW: Aggregate assessments across multiple block indices to build full progress
  async function loadAssessmentsAcrossBlocks(userId: number, blockIndices: number[]) {
    try {
      if (!Array.isArray(blockIndices) || !blockIndices.length) {
        return loadAssessmentsAndProgress(userId); // fallback single block
      }
      // Initialize progress map if empty
      if (Object.keys(caseProgress).length === 0) {
        cases.value.forEach(c => {
          caseProgress[c.id] = { caseId: c.id, preCompleted: false, postCompleted: false };
        });
      }
      const unique = Array.from(new Set(blockIndices.filter(n=> typeof n === 'number' && n >= 0)));
      const allAssessments: any[] = [];
      await Promise.all(unique.map(async idx => {
        try {
          const res = await listBlockAssessments(userId, idx);
          if (Array.isArray(res)) allAssessments.push(...res);
        } catch {/* ignore individual block failures */}
      }));
      allAssessments.forEach((assessment: any) => {
        const caseIdFromAssignment = (assessment as any).case_id ?? (assessment as any).assignment_case_id ?? (assessment as any).assignment?.case_id;
        if (!caseIdFromAssignment) return;
        if (!caseProgress[caseIdFromAssignment]) {
          caseProgress[caseIdFromAssignment] = { caseId: caseIdFromAssignment, preCompleted: false, postCompleted: false };
        }
        if (assessment.phase === 'POST') {
          caseProgress[caseIdFromAssignment].postCompleted = true;
          caseProgress[caseIdFromAssignment].preCompleted = true;
          if (!completedCases.value.includes(caseIdFromAssignment)) completedCases.value.push(caseIdFromAssignment);
        } else if (assessment.phase === 'PRE') {
          caseProgress[caseIdFromAssignment].preCompleted = true;
        }
      });
      saveProgressToCache();
      return true;
    } catch (e) {
      console.error('Failed to load multi-block assessments', e);
      return false;
    }
  }

  // Actions
  async function loadCases() {
    try {
      const userId = userStore.user?.id;
      if (!userId) {
        throw new Error('User not found');
      }

      const casesResponse = await apiClient.get<Case[]>('/api/cases/?limit=100');
      cases.value = casesResponse.data;

      // Initialize progress for all cases
      cases.value.forEach(c => {
        if (!caseProgress[c.id]) {
          caseProgress[c.id] = {
            caseId: c.id,
            preCompleted: false,
            postCompleted: false
          };
        }
      });

      // Load assessments and update progress
      await loadAssessmentsAndProgress(userId);
      return true;
    } catch (error) {
      console.error('Failed to load cases:', error);
      loadProgressFromCache(); // Fallback to cache if API fails
      return false;
    }
  }

  // Legacy verification removed (old endpoint 404). New flow: rely on block list refresh after submit.
  async function verifyAssessment(_userId: number, _caseId: number, _isPostAi: boolean): Promise<boolean> { return true; }

  // Renamed and modified function to handle both pre and post AI progress updates
  async function markProgress(caseId: number, isPostAi: boolean) {
    const userId = userStore.user?.id;
    if (!userId) {
      console.warn('Cannot mark progress: User ID not found.');
      return; 
    }

    if (!caseProgress[caseId]) {
      // Initialize if somehow missing, though loadCases should handle this
      caseProgress[caseId] = { caseId, preCompleted: false, postCompleted: false };
      console.warn(`Initialized missing progress for case ${caseId} during markProgress`);
    }
    const progress = caseProgress[caseId];

    // --- Optimistic update ---
    if (isPostAi) {
      if (!progress.postCompleted) {
        progress.postCompleted = true;
        progress.preCompleted = true; // ensure pre set
        if (!completedCases.value.includes(caseId)) {
          completedCases.value.push(caseId);
        }
        console.log(`Optimistic: case ${caseId} marked post-AI complete.`);
      }
    } else {
      if (!progress.preCompleted) {
        progress.preCompleted = true;
        console.log(`Optimistic: case ${caseId} marked pre-AI complete.`);
      }
    }
  saveProgressToCache();

  // Background verification removed; instead we will refresh block assessments lazily via loadAssessmentsAndProgress (caller can do this after submit if needed)
  }

  // refreshCaseProgress no longer needed with reactive caseProgress
  function refreshCaseProgress() { /* noop retained for backward compatibility */ }

  function loadProgressFromCache() {
    const storedProgress = localStorage.getItem('caseProgress');
    if (storedProgress) {
      try {
        const parsed = JSON.parse(storedProgress) as Record<number, CaseProgress>;
        Object.keys(parsed).forEach(k => {
          const num = Number(k);
          caseProgress[num] = parsed[num];
        });
        
        // Ensure all cases have a progress entry
        cases.value.forEach(c => {
          if (!caseProgress[c.id]) {
            caseProgress[c.id] = {
              caseId: c.id,
              preCompleted: false,
              postCompleted: false
            };
          }
        });

        // Update completedCases for backward compatibility
  completedCases.value = Object.values(caseProgress)
          .filter(p => p.postCompleted)
          .map(p => p.caseId);
          
        // Save the updated progress state
        saveProgressToCache();
      } catch (e) {
        console.error('Failed to parse case progress:', e);
  Object.keys(caseProgress).forEach(k => { delete caseProgress[Number(k)]; });
        // Initialize empty progress for all cases
        cases.value.forEach(c => {
          caseProgress[c.id] = {
            caseId: c.id,
            preCompleted: false,
            postCompleted: false
          };
        });
        saveProgressToCache();
      }
    } else {
      // If no stored progress, initialize for all cases
      cases.value.forEach(c => {
        caseProgress[c.id] = { caseId: c.id, preCompleted: false, postCompleted: false };
      });
      saveProgressToCache();
    }
  }

  function saveProgressToCache() {
  localStorage.setItem('caseProgress', JSON.stringify(caseProgress));
  }

  function getIncompleteCases() {
    return cases.value.filter(c => {
  const progress = caseProgress[c.id];
      return !progress || !progress.postCompleted;
    });
  }

  function getNextIncompleteCase(): Case | null {
    // First, look for cases that need pre-AI assessment
    const preIncomplete = cases.value.find(c => {
  const progress = caseProgress[c.id];
      return !progress || !progress.preCompleted;
    });
    if (preIncomplete) return preIncomplete;

    // Then, look for cases that need post-AI assessment
    const postIncomplete = cases.value.find(c => {
  const progress = caseProgress[c.id];
      return progress?.preCompleted && !progress.postCompleted;
    });
    return postIncomplete || null;
  }

  function getCaseProgress(caseId: number): CaseProgress {
    if (!caseProgress[caseId]) {
      const userId = userStore.user?.id;
      // Initialize with empty progress
      caseProgress[caseId] = { 
        caseId, 
        preCompleted: false, 
        postCompleted: false 
      };

      // Verify assessments exist if we have a user ID
      if (userId) {
        verifyAssessment(userId, caseId, false).then(preExists => {
          if (preExists) {
            caseProgress[caseId].preCompleted = true;
          }
          verifyAssessment(userId, caseId, true).then(postExists => {
            if (postExists) {
              caseProgress[caseId].postCompleted = true;
              caseProgress[caseId].preCompleted = true;
              if (!completedCases.value.includes(caseId)) {
                completedCases.value.push(caseId);
              }
              saveProgressToCache();
            }
          });
        });
      }

      saveProgressToCache();
    }
  return { ...caseProgress[caseId] };  // Return a copy to avoid mutation
  }

  const getCurrentCase = computed(() => {
    if (cases.value.length > 0 && currentIndex.value >= 0 && currentIndex.value < cases.value.length) {
      return cases.value[currentIndex.value];
    }
    return null;
  });

  return {
    cases,
    currentIndex,
    completedCases,
  caseProgress,
    loadCases,
    loadAssessmentsAndProgress,
  loadAssessmentsAcrossBlocks,
    markProgress, // Export the updated function
    refreshCaseProgress,
    saveProgressToCache,
    getCurrentCase,
    getIncompleteCases,
    getNextIncompleteCase,
    getCaseProgress,
  };
});