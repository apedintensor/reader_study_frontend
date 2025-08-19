import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import apiClient from '../api';
import { useUserStore } from './userStore';

// Updated interfaces for composite key structure
interface Assessment {
  user_id: number;
  case_id: number;
  is_post_ai: boolean;
  created_at: string;
  assessable_image_score?: number | null;
  confidence_level_top1?: number | null;
  management_confidence?: number | null;
  certainty_level?: number | null;
  ai_usefulness?: string | null;
  change_diagnosis_after_ai?: boolean | null;
  change_management_after_ai?: boolean | null;
}

interface AssessmentRead extends Assessment {
  diagnoses: DiagnosisRead[];
  management_plan?: ManagementPlanRead | null;
}

interface DiagnosisRead {
  id: number;
  assessment_user_id: number;
  assessment_case_id: number;
  assessment_is_post_ai: boolean;
  diagnosis_id: number;
  rank: number;
}

interface ManagementPlanRead {
  id: number;
  assessment_user_id: number;
  assessment_case_id: number;
  assessment_is_post_ai: boolean;
  strategy_id: number;
  free_text?: string | null;
}

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
  const cases = ref<Case[]>([]);
  const currentIndex = ref<number>(0);
  const completedCases = ref<number[]>([]);
  // Use reactive object instead of ref wrapper to avoid manual refresh hacks
  const caseProgress = reactive<Record<number, CaseProgress>>({});

  // Fetch assessments and update progress
  async function loadAssessmentsAndProgress(userId: number) {
    try {
      console.log('Fetching assessments for user:', userId);
      const response = await apiClient.get<Assessment[]>(`/api/assessments/user/${userId}`);
      console.log('Raw assessments response:', response.data);

      // No need to filter since the endpoint already returns user-specific assessments
      const userAssessments = response.data;
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

      // Update progress based on assessments
      userAssessments.forEach(assessment => {
        console.log(`Processing assessment for case ${assessment.case_id}:`, {
          isPostAi: assessment.is_post_ai,
          userId: assessment.user_id,
          caseId: assessment.case_id
        });

        if (!caseProgress[assessment.case_id]) {
          caseProgress[assessment.case_id] = {
            caseId: assessment.case_id,
            preCompleted: false,
            postCompleted: false
          };
        }

        if (assessment.is_post_ai) {
          caseProgress[assessment.case_id].postCompleted = true;
          caseProgress[assessment.case_id].preCompleted = true;
          if (!completedCases.value.includes(assessment.case_id)) {
            completedCases.value.push(assessment.case_id);
          }
          console.log(`Case ${assessment.case_id} marked as fully completed (post-AI)`);
        } else {
          caseProgress[assessment.case_id].preCompleted = true;
          console.log(`Case ${assessment.case_id} marked as pre-AI completed`);
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

  async function verifyAssessment(userId: number, caseId: number, isPostAi: boolean): Promise<boolean> {
    try {
      console.log('Verifying assessment:', { userId, caseId, isPostAi });
      // Get all assessments for this case
      const response = await apiClient.get<AssessmentRead[]>(`/api/assessments/case/${caseId}`);
      
      // Filter for the current user and pre/post status
      const hasAssessment = response.data.some(assessment => 
        assessment.user_id === userId && 
        assessment.is_post_ai === isPostAi
      );
      
      console.log(`Assessment verification result for case ${caseId}:`, {
        userId,
        isPostAi,
        exists: hasAssessment
      });
      
      return hasAssessment;
    } catch (error) {
      console.error('Failed to verify assessment:', error);
      return false;
    }
  }

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

    // --- Background verification (non-blocking) ---
    verifyAssessment(userId, caseId, isPostAi)
      .then(exists => {
        if (!exists) {
          console.warn(`Verification failed; reverting optimistic flag for case ${caseId} (isPostAi=${isPostAi}).`);
          const p = caseProgress[caseId];
          if (p) {
            if (isPostAi) {
              p.postCompleted = false; // keep pre if it was legitimately completed earlier
            } else {
              p.preCompleted = false;
              // If pre reverted, also ensure post is false
              p.postCompleted = false;
              const idx = completedCases.value.indexOf(caseId);
              if (idx !== -1) completedCases.value.splice(idx, 1);
            }
            saveProgressToCache();
          }
        } else {
          console.log(`Verification success for case ${caseId} (isPostAi=${isPostAi}).`);
        }
      })
      .catch(err => {
        console.warn('Background verify error (ignored):', err);
      });
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
    markProgress, // Export the updated function
    refreshCaseProgress,
    saveProgressToCache,
    getCurrentCase,
    getIncompleteCases,
    getNextIncompleteCase,
    getCaseProgress,
  };
});