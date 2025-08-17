import axios from 'axios';

// Base URL Strategy
// -------------------------------------------------------------
// DEV (vite dev server):
//   - baseURL is '' so calls like apiClient.get('/api/cases') rely on the proxy in vite.config.ts
// PROD (Fly.io or any static host):
//   - Set VITE_API_BASE_URL_PROD to the backend root origin (no trailing slash)
//   - Example: VITE_API_BASE_URL_PROD=https://reader-study.fly.dev
//   - We provide a safe fallback to the Fly.io domain if the env var is missing, but emit a warning.
// IMPORTANT:
//   - Do NOT include /api in the base URL.
//   - Always call endpoints with the /api prefix in component code per project rules.

const FALLBACK_FLY_BACKEND = 'https://reader-study.fly.dev';
const envConfiguredBase = import.meta.env.VITE_API_BASE_URL_PROD as string | undefined;
const productionApiRoot = envConfiguredBase && envConfiguredBase.trim().length > 0
  ? envConfiguredBase.replace(/\/$/, '') // strip trailing slash if someone added it
  : FALLBACK_FLY_BACKEND;

const localDevelopmentApiRoot = ''; // Vite proxy will handle the full path including /api

const apiClient = axios.create({
  baseURL: import.meta.env.PROD ? productionApiRoot : localDevelopmentApiRoot,
  headers: { 'Content-Type': 'application/json' },
});

if (import.meta.env.PROD && (!envConfiguredBase || envConfiguredBase === '')) {
  // Provide visibility in production builds if the env var was not injected.
  console.warn('[api] VITE_API_BASE_URL_PROD not set; using fallback:', FALLBACK_FLY_BACKEND);
}

// Add request logging interceptor
apiClient.interceptors.request.use(
  (config) => {
  // No prefix manipulation: backend is expected to serve routes under /api in all environments.
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