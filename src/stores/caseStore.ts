import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiClient from '../api'; // Import the API client

// Define interfaces based on OpenAPI schema and project overview
interface Image {
  id: number;
  image_url: string;
  case_id: number;
}

interface CaseMetadata {
  id: number;
  case_id: number;
  age?: number | null;
  gender?: string | null;
  // Add other metadata fields as needed
}

interface Prediction {
    name: string;
    // Add other prediction fields if needed
}

interface AIOutput {
  id: number;
  case_id: number;
  prediction_id: number;
  rank?: number | null;
  confidence_score?: number | null;
  prediction: Prediction;
}

interface Case {
  id: number;
  ground_truth_diagnosis_id?: number | null;
  typical_diagnosis?: boolean | null;
  created_at: string;
  images: Image[];
  case_metadata_relation?: CaseMetadata | null;
  ai_outputs: AIOutput[];
}

interface CaseProgress {
  caseId: number;
  preCompleted: boolean;
  postCompleted: boolean;
}

export const useCaseStore = defineStore('case', () => {
  // State
  const cases = ref<Case[]>([]);
  const currentIndex = ref<number>(0);
  const completedCases = ref<number[]>([]); // For backward compatibility
  const caseProgress = ref<Record<number, CaseProgress>>({});

  // Actions
  async function loadCases() {
    try {
      const response = await apiClient.get<Case[]>('/api/cases/?limit=100');
      cases.value = response.data;
      loadProgressFromCache();
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  }

  function loadProgressFromCache() {
    const storedProgress = localStorage.getItem('caseProgress');
    if (storedProgress) {
      try {
        caseProgress.value = JSON.parse(storedProgress);
        // Update completedCases for backward compatibility
        completedCases.value = Object.values(caseProgress.value)
          .filter(p => p.postCompleted)
          .map(p => p.caseId);
      } catch (e) {
        console.error('Failed to parse case progress:', e);
        caseProgress.value = {};
      }
    }
  }

  function saveProgressToCache() {
    localStorage.setItem('caseProgress', JSON.stringify(caseProgress.value));
  }

  function markCaseComplete(caseId: number) {
    if (!caseProgress.value[caseId]) {
      caseProgress.value[caseId] = { caseId, preCompleted: false, postCompleted: false };
    }
    
    // Update progress based on phase
    const progress = caseProgress.value[caseId];
    if (!progress.preCompleted) {
      progress.preCompleted = true;
    } else {
      progress.postCompleted = true;
      if (!completedCases.value.includes(caseId)) {
        completedCases.value.push(caseId);
      }
    }
    saveProgressToCache();
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
      caseProgress.value[caseId] = { caseId, preCompleted: false, postCompleted: false };
      saveProgressToCache();
    }
    return caseProgress.value[caseId];
  }

  function goToNextCase() {
    if (currentIndex.value < cases.value.length - 1) {
      currentIndex.value++;
      saveProgressToCache();
    } else {
      console.log("No more cases.");
      // Optionally navigate to a completion page
    }
  }

  function goToCase(index: number) {
    if (index >= 0 && index < cases.value.length) {
        currentIndex.value = index;
        saveProgressToCache();
    } else {
        console.warn(`Attempted to navigate to invalid case index: ${index}`);
    }
  }

  // Computed
  const getCurrentCase = computed(() => {
    if (cases.value.length > 0 && currentIndex.value >= 0 && currentIndex.value < cases.value.length) {
      return cases.value[currentIndex.value];
    }
    return null;
  });

  const totalCases = computed(() => cases.value.length);
  const remainingCases = computed(() => getIncompleteCases().length);

  return {
    cases,
    currentIndex,
    completedCases,
    loadCases,
    markCaseComplete,
    goToNextCase,
    goToCase,
    getCurrentCase,
    totalCases,
    remainingCases,
    getIncompleteCases,
    getNextIncompleteCase,
    getCaseProgress,
  };
});