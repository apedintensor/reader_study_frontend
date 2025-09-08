import axios from 'axios';

// Base URL Strategy
// -------------------------------------------------------------
// We now prefer a single env var: VITE_API_BASE_URL (no trailing slash, no /api suffix).
// For backward compatibility we still accept VITE_API_BASE_URL_PROD.
// Requests in the app ALWAYS include the /api prefix (see docs/API_ENDPOINT_RULES.md) and the backend
// actually serves endpoints mounted under /api (e.g. /api/ping, /api/auth/jwt/login, /api/roles/).
// In development we rely on the Vite proxy which forwards /api/* WITHOUT stripping the prefix now.
// Therefore in dev the safest baseURL is '' (empty) so relative calls go through the proxy unchanged.
// -------------------------------------------------------------
// If you want to BYPASS the proxy locally (not recommended unless you also update all paths):
//   1. Set VITE_API_BASE_URL=http://localhost:8000
//   2. (Not recommended) set baseURL to that origin and DROP the /api prefix in your component calls.
//      This would require updating docs and is discouraged for consistency.
// -------------------------------------------------------------
// Fallback Order (first non-empty wins):
//   1. VITE_API_BASE_URL
//   2. VITE_API_BASE_URL_PROD (legacy)
//   3. '' (dev only, to use proxy)
//   4. https://reader-study.fly.dev (production safety fallback)
// -------------------------------------------------------------

const FALLBACK_FLY_BACKEND = 'https://reader-study.fly.dev';
const rawPrimary = (import.meta.env.VITE_API_BASE_URL as string | undefined) || (import.meta.env.VITE_API_BASE_URL_PROD as string | undefined);

function sanitize(origin?: string): string | undefined {
  if (!origin) return undefined;
  const trimmed = origin.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/$/, ''); // strip single trailing slash
}

let resolvedBase = sanitize(rawPrimary);

if (!resolvedBase) {
  if (import.meta.env.DEV) {
    // Use proxy (empty string keeps relative /api/* requests unchanged so proxy can rewrite)
    resolvedBase = '';
  } else {
    // Production safety fallback
    resolvedBase = FALLBACK_FLY_BACKEND;
    console.warn('[api] No VITE_API_BASE_URL provided; falling back to', FALLBACK_FLY_BACKEND);
  }
}

// Safety: avoid mixed content in production if misconfigured with http://
if (!import.meta.env.DEV && resolvedBase && /^http:\/\//i.test(resolvedBase)) {
  console.warn('[api] Detected insecure base URL in production; upgrading to HTTPS:', resolvedBase);
  resolvedBase = resolvedBase.replace(/^http:\/\//i, 'https://');
}

const apiClient = axios.create({
  baseURL: resolvedBase,
  headers: { 'Content-Type': 'application/json' },
});

if (rawPrimary) {
  console.info('[api] Using configured API base:', resolvedBase || '(relative via proxy)');
}

// Add request logging interceptor
apiClient.interceptors.request.use(
  (config) => {
  // No prefix manipulation: backend is expected to serve routes under /api in all environments.
  // No path mutation: backend expects /api prefix.
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