import axios from 'axios';

const productionApiRoot = import.meta.env.VITE_API_BASE_URL_PROD; // e.g., "https://reader-study.onrender.com"
const localDevelopmentApiRoot = ''; // Vite proxy will handle the full path including /api

const apiClient = axios.create({
  baseURL: import.meta.env.PROD
    ? productionApiRoot  // e.g., "https://reader-study.onrender.com"
    : localDevelopmentApiRoot, // For local, paths like '/api/cases' will be used directly
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request logging interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Log the request details
    // Axios automatically combines baseURL and the request URL if baseURL is absolute.
    // If baseURL is relative (like '' for dev), config.url will be the full path passed (e.g., '/api/cases').
    const fullUrl = config.baseURL && !config.baseURL.startsWith('/') ? `${config.baseURL}${config.url}` : config.url;
    console.log('API Request:', {
      method: config.method?.toUpperCase(),
      url: fullUrl,
      data: config.data,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response logging interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Log the response details
    console.log('API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error("Unauthorized access - 401. Redirecting to login.");
      localStorage.removeItem('access_token');
      localStorage.removeItem('userData');
    }
    // Log the error response
    console.error('API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      error: error.response?.data || error.message
    });
    return Promise.reject(error);
  }
);

export default apiClient;