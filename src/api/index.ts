import axios from 'axios';

const apiClient = axios.create({
  baseURL: '', // Remove /api prefix since proxy handles it
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
    console.log('API Request:', {
      method: config.method,
      url: config.url,
      headers: config.headers,
      data: config.data
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