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

export const useCaseStore = defineStore('case', () => {
  // State
  const cases = ref<Case[]>([]);
  const currentIndex = ref<number>(0);
  const completedCases = ref<number[]>([]); // Store IDs of completed cases

  // Actions
  async function loadCases() {
    try {
      // Fetch cases from the API - adjust limit as needed
      const response = await apiClient.get<Case[]>('/cases/?limit=100'); // Assuming endpoint returns Case[]
      cases.value = response.data;
      console.log("Cases loaded:", cases.value);
      // Load progress after fetching cases
      loadProgressFromLocalStorage();
    } catch (error) {
      console.error('Failed to load cases:', error);
      // Handle error appropriately (e.g., show a toast message)
    }
  }

  function markCaseComplete(caseId: number) {
    if (!completedCases.value.includes(caseId)) {
      completedCases.value.push(caseId);
      saveProgressToLocalStorage();
    }
  }

  function goToNextCase() {
    if (currentIndex.value < cases.value.length - 1) {
      currentIndex.value++;
      saveProgressToLocalStorage();
    } else {
      console.log("No more cases.");
      // Optionally navigate to a completion page
    }
  }

  function goToCase(index: number) {
    if (index >= 0 && index < cases.value.length) {
        currentIndex.value = index;
        saveProgressToLocalStorage();
    } else {
        console.warn(`Attempted to navigate to invalid case index: ${index}`);
    }
  }

  function saveProgressToLocalStorage() {
    localStorage.setItem('caseIndex', currentIndex.value.toString());
    localStorage.setItem('completedCases', JSON.stringify(completedCases.value));
  }

  function loadProgressFromLocalStorage() {
    const storedIndex = localStorage.getItem('caseIndex');
    const storedCompleted = localStorage.getItem('completedCases');

    if (storedIndex) {
      const index = parseInt(storedIndex, 10);
      // Ensure the loaded index is valid for the current set of cases
      if (!isNaN(index) && index >= 0 && index < cases.value.length) {
          currentIndex.value = index;
      } else {
          currentIndex.value = 0; // Reset if invalid
      }
    } else {
        currentIndex.value = 0; // Default to first case if nothing stored
    }

    if (storedCompleted) {
      try {
        const completed = JSON.parse(storedCompleted);
        if (Array.isArray(completed) && completed.every(id => typeof id === 'number')) {
            completedCases.value = completed;
        } else {
            completedCases.value = []; // Reset if invalid format
        }
      } catch (e) {
        console.error("Failed to parse completed cases from localStorage", e);
        completedCases.value = []; // Reset on error
      }
    } else {
        completedCases.value = []; // Default to empty array
    }

    console.log(`Resuming at index: ${currentIndex.value}, Completed: ${completedCases.value.join(', ')}`);
  }

  // Getters (computed properties)
  const getCurrentCase = computed<Case | null>(() => {
    if (cases.value.length > 0 && currentIndex.value >= 0 && currentIndex.value < cases.value.length) {
      return cases.value[currentIndex.value];
    }
    return null;
  });

  const totalCases = computed(() => cases.value.length);
  const remainingCases = computed(() => {
      return cases.value.filter(c => !completedCases.value.includes(c.id)).length;
  });

  // Initialize by loading cases (which then loads progress)
  // Consider calling loadCases() from the component where it's first needed,
  // e.g., when the user logs in or navigates to the dashboard.
  // loadCases(); // Or call this explicitly elsewhere

  return {
    cases,
    currentIndex,
    completedCases,
    loadCases,
    markCaseComplete,
    goToNextCase,
    goToCase, // Added for potential direct navigation
    getCurrentCase,
    totalCases,
    remainingCases,
    loadProgressFromLocalStorage, // Expose if needed externally
    saveProgressToLocalStorage, // Expose if needed externally
  };
});