/**
 * WARP API Client
 * Centralized API communication layer
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.warp.io/v1';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('warp_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('warp_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Customer endpoints
  async getCustomers() {
    return this.request('/customers');
  }

  // Trunk endpoints
  async getTrunks(customerId: string) {
    return this.request(`/customers/${customerId}/trunks`);
  }

  // CDR endpoints
  async getCDRs(params: Record<string, any>) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/cdrs?${queryString}`);
  }

  // Add more endpoints as needed
}

export const apiClient = new ApiClient();