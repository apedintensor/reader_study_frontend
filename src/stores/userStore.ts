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
    delete apiClient.defaults.headers.common['Authorization'];
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
      user.value = response.data;
      localStorage.setItem('userData', JSON.stringify(user.value));
      console.log("Current user fetched:", user.value);
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
    setToken,
    logout,
    fetchCurrentUser,
    loadFromLocalStorage, // Keep if external loading is needed
    clearAuth, // Expose clearAuth
  };
});