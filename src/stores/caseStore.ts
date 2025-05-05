import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
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
  const caseProgress = ref<Record<number, CaseProgress>>({});

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
      if (Object.keys(caseProgress.value).length === 0) {
        console.log('Initializing empty progress map for cases:', cases.value.map(c => c.id));
        cases.value.forEach(c => {
          caseProgress.value[c.id] = {
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

        if (!caseProgress.value[assessment.case_id]) {
          caseProgress.value[assessment.case_id] = {
            caseId: assessment.case_id,
            preCompleted: false,
            postCompleted: false
          };
        }

        if (assessment.is_post_ai) {
          caseProgress.value[assessment.case_id].postCompleted = true;
          caseProgress.value[assessment.case_id].preCompleted = true;
          if (!completedCases.value.includes(assessment.case_id)) {
            completedCases.value.push(assessment.case_id);
          }
          console.log(`Case ${assessment.case_id} marked as fully completed (post-AI)`);
        } else {
          caseProgress.value[assessment.case_id].preCompleted = true;
          console.log(`Case ${assessment.case_id} marked as pre-AI completed`);
        }
      });

      console.log('Final progress state:', {
        progress: caseProgress.value,
        completedCases: completedCases.value
      });

      saveProgressToCache();
      refreshCaseProgress();
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
        if (!caseProgress.value[c.id]) {
          caseProgress.value[c.id] = {
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

    if (!caseProgress.value[caseId]) {
      // Initialize if somehow missing, though loadCases should handle this
      caseProgress.value[caseId] = { caseId, preCompleted: false, postCompleted: false };
      console.warn(`Initialized missing progress for case ${caseId} during markProgress`);
    }
    
    const progress = caseProgress.value[caseId];

    // Verify the assessment exists before marking progress in the store
    // This prevents marking progress based on optimistic updates if the API call failed silently
    const verified = await verifyAssessment(userId, caseId, isPostAi);

    if (verified) {
      if (isPostAi) {
        // Mark post-AI complete (implies pre-AI is also complete)
        if (!progress.postCompleted) {
          progress.postCompleted = true;
          progress.preCompleted = true; // Ensure pre is marked complete too
          if (!completedCases.value.includes(caseId)) {
            completedCases.value.push(caseId);
          }
          console.log(`Store: Marked case ${caseId} as post-AI complete.`);
        }
      } else {
        // Mark pre-AI complete
        if (!progress.preCompleted) {
          progress.preCompleted = true;
          console.log(`Store: Marked case ${caseId} as pre-AI complete.`);
        }
      }
      saveProgressToCache();
      refreshCaseProgress(); // Trigger reactivity updates
    } else {
      console.warn(`Store: Verification failed for case ${caseId}, isPostAi: ${isPostAi}. Progress not marked.`);
      // Optionally, add a toast message here if verification failure should be user-visible
    }
  }

  function refreshCaseProgress() {
    // This forces Vue's reactivity system to detect changes within the nested object
    const currentProgress = { ...caseProgress.value };
    caseProgress.value = {}; // Clear temporarily
    caseProgress.value = currentProgress; // Assign back to trigger update
    console.log('Store: Refreshed case progress state for reactivity.');
  }

  function loadProgressFromCache() {
    const storedProgress = localStorage.getItem('caseProgress');
    if (storedProgress) {
      try {
        caseProgress.value = JSON.parse(storedProgress);
        
        // Ensure all cases have a progress entry
        cases.value.forEach(c => {
          if (!caseProgress.value[c.id]) {
            caseProgress.value[c.id] = {
              caseId: c.id,
              preCompleted: false,
              postCompleted: false
            };
          }
        });

        // Update completedCases for backward compatibility
        completedCases.value = Object.values(caseProgress.value)
          .filter(p => p.postCompleted)
          .map(p => p.caseId);
          
        // Save the updated progress state
        saveProgressToCache();
      } catch (e) {
        console.error('Failed to parse case progress:', e);
        caseProgress.value = {};
        // Initialize empty progress for all cases
        cases.value.forEach(c => {
          caseProgress.value[c.id] = {
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
        caseProgress.value[c.id] = {
          caseId: c.id,
          preCompleted: false,
          postCompleted: false
        };
      });
      saveProgressToCache();
    }
  }

  function saveProgressToCache() {
    localStorage.setItem('caseProgress', JSON.stringify(caseProgress.value));
  }

  function getIncompleteCases() {
    return cases.value.filter(c => {
      const progress = caseProgress.value[c.id];
      return !progress || !progress.postCompleted;
    });
  }

  function getNextIncompleteCase(): Case | null {
    // First, look for cases that need pre-AI assessment
    const preIncomplete = cases.value.find(c => {
      const progress = caseProgress.value[c.id];
      return !progress || !progress.preCompleted;
    });
    if (preIncomplete) return preIncomplete;

    // Then, look for cases that need post-AI assessment
    const postIncomplete = cases.value.find(c => {
      const progress = caseProgress.value[c.id];
      return progress?.preCompleted && !progress.postCompleted;
    });
    return postIncomplete || null;
  }

  function getCaseProgress(caseId: number): CaseProgress {
    if (!caseProgress.value[caseId]) {
      const userId = userStore.user?.id;
      // Initialize with empty progress
      caseProgress.value[caseId] = { 
        caseId, 
        preCompleted: false, 
        postCompleted: false 
      };

      // Verify assessments exist if we have a user ID
      if (userId) {
        verifyAssessment(userId, caseId, false).then(preExists => {
          if (preExists) {
            caseProgress.value[caseId].preCompleted = true;
          }
          verifyAssessment(userId, caseId, true).then(postExists => {
            if (postExists) {
              caseProgress.value[caseId].postCompleted = true;
              caseProgress.value[caseId].preCompleted = true;
              if (!completedCases.value.includes(caseId)) {
                completedCases.value.push(caseId);
              }
              saveProgressToCache();
              refreshCaseProgress();
            }
          });
        });
      }

      saveProgressToCache();
    }
    return { ...caseProgress.value[caseId] };  // Return a copy to avoid mutation
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