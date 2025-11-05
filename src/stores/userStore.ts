import { defineStore } from 'pinia';
import { ref, computed } from 'vue'; // Import computed
import apiClient from '../api';

// Define the structure based on UserRead schema
interface User {
  id: number; // Changed to number as per UserRead
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  role_id: number | null;
  age_bracket: string | null;
  gender: string | null;
  years_experience: number | null;
  years_derm_experience: number | null;
  created_at: string;
}

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null);
  // Use 'access_token' consistent with LoginPage and apiClient interceptor
  const token = ref<string | null>(localStorage.getItem('access_token'));
  const isNewUser = ref<boolean>(false);

  const PROGRESS_CACHE_KEY = 'gamesReportsCachedByUser';
  const LEGACY_PROGRESS_KEY = 'gamesReportsCached';

  const loadProgressCache = (): Record<string, boolean> => {
    try {
      const raw = localStorage.getItem(PROGRESS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed as Record<string, boolean>;
      }
    } catch (err) {
      console.warn('Unable to parse progress cache, resetting', err);
    }
    return {};
  };

  const persistProgressCache = (cache: Record<string, boolean>) => {
    localStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify(cache));
  };

  const removeLegacyProgressCache = () => {
    if (localStorage.getItem(LEGACY_PROGRESS_KEY) != null) {
      localStorage.removeItem(LEGACY_PROGRESS_KEY);
    }
  };

  const markProgressForUser = (id: number | null | undefined) => {
    if (!id) return;
    const cache = loadProgressCache();
    if (cache[id]) return;
    cache[id] = true;
    persistProgressCache(cache);
  };

  const hasProgressForUser = (id: number | null | undefined) => {
    if (!id) return false;
    const cache = loadProgressCache();
    return !!cache[id];
  };

  const resetDependentStores = () => {
    import('./gamesStore').then(({ useGamesStore }) => {
      try {
        const store = useGamesStore();
        if (typeof store.resetStore === 'function') {
          store.resetStore();
        }
      } catch (err) {
        console.warn('Failed to reset games store', err);
      }
    }).catch(err => console.warn('Unable to import gamesStore for reset', err));

    import('./caseStore').then(({ useCaseStore }) => {
      try {
        const store = useCaseStore();
        if (typeof store.resetStore === 'function') {
          store.resetStore();
        }
      } catch (err) {
        console.warn('Failed to reset case store', err);
      }
    }).catch(err => console.warn('Unable to import caseStore for reset', err));
  };

  // Actions
  function setToken(newToken: string) {
    token.value = newToken;
    localStorage.setItem('access_token', newToken);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  }

  function clearAuth() {
    user.value = null;
    token.value = null;
    localStorage.removeItem('userData');
    localStorage.removeItem('access_token');
    isNewUser.value = false;
    delete apiClient.defaults.headers.common['Authorization'];
    resetDependentStores();
  }

  async function fetchCurrentUser() {
    if (!token.value) {
      console.log("No token found, cannot fetch user.");
      clearAuth(); // Ensure state is clean if token is missing
      return false;
    }
    try {
  // Updated endpoint: backend now exposes /api/auth/me
  const response = await apiClient.get<User>('/api/auth/me');
      const previousId = user.value?.id ?? null;
      user.value = response.data;
      localStorage.setItem('userData', JSON.stringify(user.value));
      console.log("Current user fetched:", user.value);
    removeLegacyProgressCache();
    isNewUser.value = !hasProgressForUser(user.value?.id);
      if (previousId && previousId !== user.value.id) {
        resetDependentStores();
      }
      return true;
    } catch (error: any) {
      console.error('Failed to fetch current user:', error);
      // If fetching user fails (e.g., invalid token), clear auth state
      if (error.response && error.response.status === 401) {
        clearAuth();
      }
      return false;
    }
  }

  function logout() {
    clearAuth();
    // Optionally add router.push('/login') here if router is accessible
    console.log("User logged out.");
  }

  function markHasGameHistory() {
    isNewUser.value = false;
    markProgressForUser(user.value?.id);
  }

  function evaluateNewUserHeuristic({ hasCompletedReports, hasActiveAssignment }: { hasCompletedReports: boolean; hasActiveAssignment: boolean }) {
    const newStatus = !(hasCompletedReports || hasActiveAssignment);
    isNewUser.value = newStatus;
    if (!newStatus) {
      markProgressForUser(user.value?.id);
    }
  }

  function loadFromLocalStorage() {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('userData');

    if (storedToken) {
      token.value = storedToken;
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      if (storedUser) {
        try {
          user.value = JSON.parse(storedUser);
        } catch (e) {
          console.error("Failed to parse user data from localStorage", e);
          localStorage.removeItem('userData'); // Clear invalid data
          user.value = null;
          // Attempt to fetch user data again if token exists but user data is corrupt/missing
          fetchCurrentUser();
        }
      } else {
        // If token exists but no user data, try fetching it
        fetchCurrentUser();
      }
    } else {
      clearAuth(); // Ensure clean state if no token
    }
  }

  // Computed property to check if user is authenticated
  const isAuthenticated = computed(() => !!token.value && !!user.value);

  // Initialize store from localStorage on creation
  loadFromLocalStorage();

  return {
    user,
    token,
    isAuthenticated, // Expose computed property
    isNewUser,
    setToken,
    logout,
    markHasGameHistory,
  evaluateNewUserHeuristic,
    fetchCurrentUser,
    loadFromLocalStorage, // Keep if external loading is needed
    clearAuth, // Expose clearAuth
  };
});