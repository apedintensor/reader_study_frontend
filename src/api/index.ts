import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000', // Use env variable or default
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add interceptor later for token injection

export default apiClient;
