import axios from 'axios';

// PROD: VITE_API_BASE_URL_PROD will be the root domain, e.g., "https://reader-study.onrender.com"
//       API calls from your components should be like apiClient.get('/api/cases')
// DEV:  The baseURL will be empty.
//       API calls from your components should be like apiClient.get('/api/cases'),
//       which will be handled by the Vite proxy.

const productionApiRoot = import.meta.env.VITE_API_BASE_URL_PROD;
const localDevelopmentApiRoot = ''; // Vite proxy will handle the full path including /api

const apiClient = axios.create({
  baseURL: import.meta.env.PROD
    ? productionApiRoot  // e.g., "https://reader-study.onrender.com"
    : localDevelopmentApiRoot, // For local, paths like '/api/cases' will be used directly by Axios
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
    // Axios automatically combines baseURL and the request URL (config.url).
    // For logging, we can construct the full URL if needed, or rely on browser dev tools.
    const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
    console.log('API Request:', {
      method: config.method?.toUpperCase(),
      url: fullUrl, // Log the full constructed URL
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