import axios from 'axios';

const apiClient = axios.create({
  baseURL: '', // Remove /api prefix since proxy handles it
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token from localStorage
apiClient.interceptors.request.use(
  (config) => {
    // Retrieve the token from localStorage, matching the key used in LoginPage
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle common errors like 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Handle unauthorized errors (e.g., token expired)
      console.error("Unauthorized access - 401. Redirecting to login.");
      // Clear potentially invalid token and user data
      localStorage.removeItem('access_token');
      localStorage.removeItem('userData');
    }
    return Promise.reject(error);
  }
);

export default apiClient;