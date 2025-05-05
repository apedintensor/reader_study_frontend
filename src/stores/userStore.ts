import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiClient from '../api'; // Import the API client

// Define the structure of the user object based on UserRead schema and project needs
interface User {
  id: number | null;
  email: string | null;
  role_id: number | null; // Assuming role_id is needed, adjust if necessary
  // Add other relevant fields from UserRead if needed
}

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(localStorage.getItem('authToken')); // Load token initially

  // Actions
  function setUser(userData: User, authToken: string) {
    user.value = userData;
    token.value = authToken;
    localStorage.setItem('userData', JSON.stringify(userData));
    localStorage.setItem('authToken', authToken);
    // Update apiClient default header after login
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  }

  function logout() {
    user.value = null;
    token.value = null;
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken');
    // Remove Authorization header from apiClient
    delete apiClient.defaults.headers.common['Authorization'];
    // Optionally redirect to login page via router push
  }

  function loadFromLocalStorage() {
    const storedUser = localStorage.getItem('userData');
    const storedToken = localStorage.getItem('authToken');

    if (storedUser && storedToken) {
      try {
        user.value = JSON.parse(storedUser);
        token.value = storedToken;
        // Ensure apiClient has the token loaded on app start
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      } catch (e) {
        console.error("Failed to parse user data from localStorage", e);
        logout(); // Clear invalid data
      }
    } else {
        // Ensure token is cleared if not found
        token.value = null;
        delete apiClient.defaults.headers.common['Authorization'];
    }
  }

  // Initialize store from localStorage
  loadFromLocalStorage();

  return {
    user,
    token,
    setUser,
    logout,
    loadFromLocalStorage,
  };
});