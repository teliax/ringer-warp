/**
 * Axios Global Configuration
 * Configures base URL and authentication interceptors for API calls
 */
import axios from 'axios';

// Set base URL from environment
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Request interceptor: Add JWT token to all requests
axios.interceptors.request.use(
  (config) => {
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

// Response interceptor: Handle authentication errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axios;
