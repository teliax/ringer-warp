/**
 * Axios Global Configuration
 * Configures base URL and authentication interceptors for API calls
 */
import axios from 'axios';

// Set base URL from environment
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Request interceptor: Add JWT token and customer context to all requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add X-Customer-ID header for multi-tenant customer scoping
    const activeBanId = localStorage.getItem('active_ban_id');
    if (activeBanId) {
      config.headers['X-Customer-ID'] = activeBanId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle authentication and authorization errors
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('active_ban_id');
      window.location.href = '/login';
    }

    // Handle 403 Forbidden - Permission Denied
    if (error.response?.status === 403) {
      const message =
        error.response.data?.error?.message ||
        'You do not have permission to perform this action';

      // Dynamically import toast to avoid circular dependencies
      const { toast } = await import('sonner');
      toast.error('Permission Denied', {
        description: message,
        duration: 5000,
      });
    }

    return Promise.reject(error);
  }
);

export default axios;
