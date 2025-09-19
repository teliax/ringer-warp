# API Client Implementation Specification

## Overview
This document provides the complete specification for implementing API clients in both customer-frontend and admin-frontend applications. These clients will replace all mock data with real API calls.

## Architecture Decisions

### Technology Stack
- **HTTP Client**: Native fetch API (already available)
- **State Management**: React Query (@tanstack/react-query)
- **Authentication**: Google Identity Platform SDK (@firebase/auth)
- **WebSocket**: Native WebSocket API
- **Type Safety**: TypeScript interfaces generated from OpenAPI

### Client Architecture
```
┌─────────────────────────────────────────────────┐
│                  UI Components                   │
└─────────────────────────────────────────────────┘
                         │
                    Uses Hooks
                         │
┌─────────────────────────────────────────────────┐
│          React Query Hooks Layer                 │
│  (useTrunks, useNumbers, useBilling, etc.)      │
└─────────────────────────────────────────────────┘
                         │
                   Calls Methods
                         │
┌─────────────────────────────────────────────────┐
│             API Client Instance                  │
│  (CustomerApiClient or AdminApiClient)          │
└─────────────────────────────────────────────────┘
                         │
                  Makes Requests
                         │
┌─────────────────────────────────────────────────┐
│            Base API Client Class                 │
│  (Auth, Retry, Error Handling, Token Refresh)   │
└─────────────────────────────────────────────────┘
```

## Base API Client Implementation

### File: `shared/lib/api-client-base.ts`
```typescript
export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    timestamp?: string;
    requestId?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  statusCode: number;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export class BaseApiClient {
  protected config: ApiConfig;
  protected token: string | null = null;
  protected refreshToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(config: ApiConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
    this.loadTokens();
  }

  // Token Management
  private loadTokens(): void {
    this.token = localStorage.getItem('warp_access_token');
    this.refreshToken = localStorage.getItem('warp_refresh_token');
  }

  public setTokens(accessToken: string, refreshToken: string): void {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('warp_access_token', accessToken);
    localStorage.setItem('warp_refresh_token', refreshToken);
  }

  public clearTokens(): void {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('warp_access_token');
    localStorage.removeItem('warp_refresh_token');
  }

  // Core Request Method
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Setup headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0',
      ...options.headers,
    };

    // Add auth token
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Setup request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout!
    );

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle token refresh on 401
      if (response.status === 401 && this.refreshToken) {
        await this.handleTokenRefresh();
        // Retry original request
        return this.request<T>(endpoint, options);
      }

      // Parse response
      const data = await response.json();

      if (!response.ok) {
        throw this.createApiError(response.status, data);
      }

      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw this.createApiError(408, { message: 'Request timeout' });
      }
      throw error;
    }
  }

  // Token Refresh
  private async handleTokenRefresh(): Promise<void> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });

    if (!response.ok) {
      this.clearTokens();
      window.location.href = '/login';
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.setTokens(data.access_token, data.refresh_token);
  }

  // Error Handling
  private createApiError(statusCode: number, data: any): ApiError {
    return {
      statusCode,
      code: data.code || 'UNKNOWN_ERROR',
      message: data.message || 'An error occurred',
      details: data.details || {},
    };
  }

  // Helper Methods
  protected buildQueryString(params: Record<string, any>): string {
    const cleaned = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]);
    
    return new URLSearchParams(cleaned).toString();
  }

  // Convenience Methods
  protected get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const query = params ? `?${this.buildQueryString(params)}` : '';
    return this.request<T>(`${endpoint}${query}`, { method: 'GET' });
  }

  protected post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  protected patch<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  protected put<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  protected delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}
```

## Customer API Client

### File: `customer-frontend/src/lib/api-client.ts`
```typescript
import { BaseApiClient, ApiResponse } from '@/shared/lib/api-client-base';
import type {
  Customer,
  Trunk,
  TrunkCreateRequest,
  Number,
  CDR,
  Invoice,
  PaymentMethod,
  Message,
  Metrics,
  // ... other types from OpenAPI
} from '@/types/api';

export class CustomerApiClient extends BaseApiClient {
  constructor() {
    super({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.warp.io/v1'
    });
  }

  // ==================== Authentication ====================
  async login(email: string, password: string, mfaCode?: string) {
    return this.post<AuthResponse>('/auth/login', { email, password, mfa_code: mfaCode });
  }

  async logout() {
    const result = await this.post('/auth/logout', {});
    this.clearTokens();
    return result;
  }

  // ==================== Account Management ====================
  async getAccount() {
    return this.get<Customer>('/account');
  }

  async updateAccount(data: Partial<Customer>) {
    return this.patch<Customer>('/account', data);
  }

  // ==================== Trunk Management ====================
  async getTrunks(params?: { page?: number; limit?: number; status?: string }) {
    const customerId = await this.getCustomerId();
    return this.get<Trunk[]>(`/customers/${customerId}/trunks`, params);
  }

  async getTrunk(trunkId: string) {
    return this.get<Trunk>(`/trunks/${trunkId}`);
  }

  async createTrunk(data: TrunkCreateRequest) {
    const customerId = await this.getCustomerId();
    return this.post<Trunk>(`/customers/${customerId}/trunks`, data);
  }

  async updateTrunk(trunkId: string, data: Partial<Trunk>) {
    return this.patch<Trunk>(`/trunks/${trunkId}`, data);
  }

  async deleteTrunk(trunkId: string) {
    return this.delete(`/trunks/${trunkId}`);
  }

  async testTrunk(trunkId: string, testNumber: string) {
    return this.post(`/trunks/${trunkId}/test`, { test_number: testNumber });
  }

  async getTrunkCredentials(trunkId: string) {
    return this.get<TrunkCredentials>(`/trunks/${trunkId}/credentials`);
  }

  // ==================== Number Management ====================
  async getNumbers(params?: { page?: number; limit?: number; trunk_id?: string }) {
    return this.get<Number[]>('/numbers', params);
  }

  async searchNumbers(params: {
    area_code?: string;
    rate_center?: string;
    state?: string;
    contains?: string;
    limit?: number;
  }) {
    return this.get<Number[]>('/numbers/search', params);
  }

  async orderNumbers(numbers: string[], trunkId: string) {
    return this.post<Number[]>('/numbers/order', { numbers, trunk_id: trunkId });
  }

  async releaseNumber(numberId: string) {
    return this.delete(`/numbers/${numberId}`);
  }

  async updateE911(numberId: string, addressId: string) {
    return this.patch(`/numbers/${numberId}/e911`, { address_id: addressId });
  }

  async portNumbers(data: PortRequest) {
    return this.post<PortOrder>('/numbers/port', data);
  }

  async getPortStatus(portId: string) {
    return this.get<PortOrder>(`/numbers/port/${portId}/status`);
  }

  // ==================== Toll-Free Numbers (Somos) ====================
  async searchTollFreeNumbers(params: {
    area_code?: string;
    pattern?: string;
    quantity?: number;
    consecutive?: boolean;
  }) {
    return this.get<TollFreeNumber[]>('/numbers/tollfree/search', params);
  }

  async reserveTollFreeNumber(tfn: string) {
    return this.post<ReservationResult>('/numbers/tollfree/reserve', { tfn });
  }

  async provisionTollFreeNumber(tfn: string, trunkId: string) {
    return this.post<ProvisionResult>('/numbers/tollfree/provision', {
      tfn,
      trunk_id: trunkId
    });
  }

  async updateTollFreeRouting(tfn: string, routing: RoutingConfig) {
    return this.put(`/numbers/tollfree/${tfn}/routing`, routing);
  }

  async enableTollFreeSMS(tfn: string, options: SMSEnableOptions) {
    return this.post(`/numbers/tollfree/${tfn}/sms/enable`, options);
  }

  async getTollFreeStatus(tfn: string) {
    return this.get<TollFreeStatus>(`/numbers/tollfree/${tfn}/status`);
  }

  // ==================== Messaging ====================
  async sendSMS(data: {
    from: string;
    to: string;
    body: string;
    trunk_id?: string;
    webhook_url?: string;
  }) {
    return this.post<Message>('/messages/sms', data);
  }

  async sendMMS(data: {
    from: string;
    to: string;
    body?: string;
    media_urls: string[];
    trunk_id?: string;
  }) {
    return this.post<Message>('/messages/mms', data);
  }

  async getMessages(params?: {
    direction?: 'inbound' | 'outbound';
    from?: string;
    to?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) {
    return this.get<Message[]>('/messages', params);
  }

  async getMessage(messageId: string) {
    return this.get<Message>(`/messages/${messageId}`);
  }

  // ==================== CDRs ====================
  async getCDRs(params: {
    date_from: string;
    date_to: string;
    trunk_id?: string;
    direction?: string;
    page?: number;
    limit?: number;
  }) {
    return this.get<CDR[]>('/cdrs', params);
  }

  async exportCDRs(params: {
    date_from: string;
    date_to: string;
    format: 'csv' | 'json' | 'pdf';
  }) {
    const response = await this.post('/cdrs/export', params);
    return response.data as { download_url: string };
  }

  // ==================== Billing ====================
  async getBalance() {
    return this.get<Balance>('/billing/balance');
  }

  async getInvoices(params?: { page?: number; limit?: number; status?: string }) {
    return this.get<Invoice[]>('/billing/invoices', params);
  }

  async getInvoice(invoiceId: string) {
    return this.get<Invoice>(`/billing/invoices/${invoiceId}`);
  }

  async downloadInvoice(invoiceId: string) {
    const response = await this.get<{ download_url: string }>(
      `/billing/invoices/${invoiceId}/download`
    );
    return response.data.download_url;
  }

  async getPaymentMethods() {
    return this.get<PaymentMethod[]>('/billing/payment-methods');
  }

  async addPaymentMethod(data: PaymentMethodCreate) {
    return this.post<PaymentMethod>('/billing/payment-methods', data);
  }

  async deletePaymentMethod(methodId: string) {
    return this.delete(`/billing/payment-methods/${methodId}`);
  }

  async setDefaultPaymentMethod(methodId: string) {
    return this.patch(`/billing/payment-methods/${methodId}/default`, {});
  }

  async rechargeBalance(amount: number, paymentMethodId: string) {
    return this.post('/billing/recharge', { amount, payment_method_id: paymentMethodId });
  }

  // ==================== Metrics & Analytics ====================
  async getCurrentMetrics() {
    return this.get<Metrics>('/metrics/current');
  }

  async getUsageSummary(period: 'today' | 'week' | 'month' | 'custom', dates?: {
    start: string;
    end: string;
  }) {
    const params = period === 'custom' ? dates : { period };
    return this.get<UsageSummary>('/usage/summary', params);
  }

  // ==================== API Keys & Webhooks ====================
  async getApiKeys() {
    return this.get<ApiKey[]>('/api-keys');
  }

  async createApiKey(name: string, scopes: string[]) {
    return this.post<ApiKey>('/api-keys', { name, scopes });
  }

  async deleteApiKey(keyId: string) {
    return this.delete(`/api-keys/${keyId}`);
  }

  async getWebhooks() {
    return this.get<Webhook[]>('/webhooks');
  }

  async createWebhook(data: WebhookCreate) {
    return this.post<Webhook>('/webhooks', data);
  }

  async updateWebhook(webhookId: string, data: Partial<WebhookCreate>) {
    return this.patch<Webhook>(`/webhooks/${webhookId}`, data);
  }

  async deleteWebhook(webhookId: string) {
    return this.delete(`/webhooks/${webhookId}`);
  }

  // ==================== Helper Methods ====================
  private async getCustomerId(): Promise<string> {
    // Cache customer ID to avoid repeated calls
    let customerId = sessionStorage.getItem('warp_customer_id');
    if (!customerId) {
      const account = await this.getAccount();
      customerId = account.data.id;
      sessionStorage.setItem('warp_customer_id', customerId);
    }
    return customerId;
  }
}

// Export singleton instance
export const apiClient = new CustomerApiClient();
```

## Admin API Client

### File: `admin-frontend/src/lib/api-client.ts`
```typescript
import { BaseApiClient } from '@/shared/lib/api-client-base';
// Import admin-specific types

export class AdminApiClient extends BaseApiClient {
  constructor() {
    super({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.warp.io/v1'
    });
  }

  // ==================== Customer Management ====================
  async getAllCustomers(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    return this.get<Customer[]>('/admin/customers', params);
  }

  async getCustomer(customerId: string) {
    return this.get<CustomerDetail>(`/admin/customers/${customerId}`);
  }

  async updateCustomer(customerId: string, data: Partial<Customer>) {
    return this.patch<Customer>(`/admin/customers/${customerId}`, data);
  }

  async suspendCustomer(customerId: string, reason: string) {
    return this.post(`/admin/customers/${customerId}/suspend`, { reason });
  }

  async terminateCustomer(customerId: string, reason: string) {
    return this.post(`/admin/customers/${customerId}/terminate`, { reason });
  }

  async getCustomerTrunks(customerId: string) {
    return this.get<Trunk[]>(`/admin/customers/${customerId}/trunks`);
  }

  async getCustomerUsage(customerId: string, period: string) {
    return this.get(`/admin/customers/${customerId}/usage`, { period });
  }

  // ==================== Trunk & Partition Management ====================
  async getAllTrunks(params?: {
    page?: number;
    limit?: number;
    customer_id?: string;
    partition_id?: string;
  }) {
    return this.get<Trunk[]>('/admin/trunks', params);
  }

  async getPartitions() {
    return this.get<Partition[]>('/admin/partitions');
  }

  async createPartition(data: PartitionCreate) {
    return this.post<Partition>('/admin/partitions', data);
  }

  async updatePartition(partitionId: string, data: Partial<Partition>) {
    return this.patch<Partition>(`/admin/partitions/${partitionId}`, data);
  }

  async assignTrunkToPartition(trunkId: string, partitionId: string) {
    return this.post(`/admin/trunks/${trunkId}/partition`, { partition_id: partitionId });
  }

  // ==================== Routing & Overrides ====================
  async getRoutes(params?: { partition_id?: string; provider_id?: string }) {
    return this.get<Route[]>('/admin/routes', params);
  }

  async createOverride(data: OverrideCreate) {
    return this.post<Override>('/admin/overrides', data);
  }

  async deleteOverride(overrideId: string) {
    return this.delete(`/admin/overrides/${overrideId}`);
  }

  async createExclusion(data: ExclusionCreate) {
    return this.post<Exclusion>('/admin/exclusions', data);
  }

  async deleteExclusion(exclusionId: string) {
    return this.delete(`/admin/exclusions/${exclusionId}`);
  }

  // ==================== Provider Management ====================
  async getProviders() {
    return this.get<Provider[]>('/admin/providers');
  }

  async createProvider(data: ProviderCreate) {
    return this.post<Provider>('/admin/providers', data);
  }

  async updateProvider(providerId: string, data: Partial<Provider>) {
    return this.patch<Provider>(`/admin/providers/${providerId}`, data);
  }

  async deleteProvider(providerId: string) {
    return this.delete(`/admin/providers/${providerId}`);
  }

  async getProviderPerformance(providerId: string, period: string) {
    return this.get(`/admin/providers/${providerId}/performance`, { period });
  }

  async importProviderRates(providerId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request(`/admin/providers/${providerId}/rates/import`, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type, let browser set it with boundary
      },
    });
  }

  // ==================== Service Configuration Management ====================
  async getServices(type?: ServiceType) {
    return this.get<ServiceConfig[]>('/admin/settings/services', type ? { type } : undefined);
  }

  async getService(serviceId: string) {
    return this.get<ServiceConfig>(`/admin/settings/services/${serviceId}`);
  }

  async createService(config: ServiceConfig) {
    return this.post<ServiceConfig>('/admin/settings/services', config);
  }

  async updateService(serviceId: string, config: Partial<ServiceConfig>) {
    return this.patch<ServiceConfig>(`/admin/settings/services/${serviceId}`, config);
  }

  async deleteService(serviceId: string) {
    return this.delete(`/admin/settings/services/${serviceId}`);
  }

  async testService(serviceId: string) {
    return this.post<TestResult>(`/admin/settings/services/${serviceId}/test`, {});
  }

  async getServiceHistory(serviceId: string) {
    return this.get<AuditEntry[]>(`/admin/settings/services/${serviceId}/history`);
  }

  async rotateServiceCredentials(serviceId: string) {
    return this.post(`/admin/settings/services/${serviceId}/rotate-credentials`, {});
  }

  // ==================== Rate Management ====================
  async getRates(params?: {
    provider_id?: string;
    destination?: string;
    effective_date?: string;
  }) {
    return this.get<Rate[]>('/admin/rates', params);
  }

  async importRates(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request('/admin/rates/import', {
      method: 'POST',
      body: formData,
    });
  }

  async calculateMargins(params: {
    customer_id?: string;
    provider_id?: string;
    destination?: string;
  }) {
    return this.get<MarginAnalysis>('/admin/margins/analysis', params);
  }

  // ==================== Billing & Accounting ====================
  async getBillingSummary(period: string) {
    return this.get<BillingSummary>('/admin/billing/summary', { period });
  }

  async getAccountsReceivable() {
    return this.get<ARReport>('/admin/billing/ar');
  }

  async getRevenue(params: { start_date: string; end_date: string }) {
    return this.get<RevenueReport>('/admin/billing/revenue', params);
  }

  async reconcileBilling(date: string) {
    return this.post('/admin/billing/reconcile', { date });
  }

  async getDisputes() {
    return this.get<Dispute[]>('/admin/billing/disputes');
  }

  async resolveDispute(disputeId: string, resolution: string) {
    return this.patch(`/admin/billing/disputes/${disputeId}`, { resolution });
  }

  // ==================== NetSuite Integration ====================
  async getNetSuiteAuthStatus() {
    return this.get('/netsuite/auth/status');
  }

  async initNetSuiteOAuth() {
    return this.post<{ auth_url: string }>('/netsuite/auth/init', {});
  }

  async getNetSuiteSyncStatus() {
    return this.get('/netsuite/sync/status');
  }

  async triggerNetSuiteSync(type?: 'customers' | 'invoices' | 'all') {
    return this.post('/netsuite/sync/trigger', { type: type || 'all' });
  }

  async syncNetSuiteCustomer(customerId: string) {
    return this.post(`/netsuite/customers/${customerId}/sync`, {});
  }

  async syncNetSuiteInvoice(invoiceId: string) {
    return this.post(`/netsuite/invoices/${invoiceId}/sync`, {});
  }

  async getNetSuiteSyncHistory(params?: { limit?: number; offset?: number }) {
    return this.get('/netsuite/sync/history', params);
  }

  async getNetSuiteMappings() {
    return this.get('/netsuite/mappings');
  }

  async updateNetSuiteMappings(mappings: any) {
    return this.put('/netsuite/mappings', mappings);
  }

  // ==================== Somos Toll-Free Management ====================
  async getRespOrgEntities() {
    return this.get('/admin/resporg/entities');
  }

  async getEntityROIDs(entityId: string) {
    return this.get(`/admin/resporg/entities/${entityId}/roids`);
  }

  async bulkReserveTollFree(numbers: string[], respOrgId: string) {
    return this.post('/admin/numbers/tollfree/bulk/reserve', {
      numbers,
      resp_org_id: respOrgId
    });
  }

  async bulkProvisionTollFree(provisions: Array<{
    tfn: string;
    customer_id: string;
    routing: any;
  }>) {
    return this.post('/admin/numbers/tollfree/bulk/provision', { provisions });
  }

  async initiateTollFreeTransfer(tfn: string, newRespOrgId: string) {
    return this.post('/admin/resporg/transfer', {
      tfn,
      new_resp_org_id: newRespOrgId
    });
  }

  async getTollFreeInventory(params?: {
    status?: string;
    resp_org_id?: string;
  }) {
    return this.get('/admin/numbers/tollfree/inventory', params);
  }

  // ==================== System Monitoring ====================
  async getSystemMetrics() {
    return this.get<SystemMetrics>('/admin/system/metrics');
  }

  async getActiveCalls() {
    return this.get<ActiveCall[]>('/admin/system/active-calls');
  }

  async getSystemAlerts() {
    return this.get<Alert[]>('/admin/system/alerts');
  }

  // ==================== Support ====================
  async getSupportTickets(params?: {
    status?: string;
    customer_id?: string;
    assigned_to?: string;
  }) {
    return this.get<Ticket[]>('/admin/support/tickets', params);
  }

  async createTicket(data: TicketCreate) {
    return this.post<Ticket>('/admin/support/tickets', data);
  }

  async updateTicket(ticketId: string, data: Partial<Ticket>) {
    return this.patch<Ticket>(`/admin/support/tickets/${ticketId}`, data);
  }

  async getTicketMessages(ticketId: string) {
    return this.get<TicketMessage[]>(`/admin/support/tickets/${ticketId}/messages`);
  }

  async addTicketMessage(ticketId: string, message: string) {
    return this.post(`/admin/support/tickets/${ticketId}/messages`, { message });
  }

  // ==================== CDR Analysis ====================
  async searchCDRs(params: {
    customer_id?: string;
    trunk_id?: string;
    date_from: string;
    date_to: string;
    ani?: string;
    dnis?: string;
  }) {
    return this.get<CDR[]>('/admin/cdrs', params);
  }

  async getCDRDetails(cdrId: string) {
    return this.get<CDRDetail>(`/admin/cdrs/${cdrId}`);
  }
}

// Export singleton instance
export const apiClient = new AdminApiClient();
```

## NetSuite API Client

### File: `warp/services/netsuite/netsuite-client.ts`
```typescript
import { BaseApiClient, ApiResponse } from '@/shared/lib/api-client-base';
import type {
  NetSuiteCustomer,
  NetSuiteInvoice,
  NetSuitePayment,
  NetSuiteItem,
  NetSuiteJournalEntry,
  NetSuiteSubsidiary,
  NetSuiteCompanyInfo,
  NetSuiteSyncStatus,
  // ... other NetSuite types
} from '@/types/netsuite';

export interface NetSuiteConfig {
  accountId: string;
  baseUrl: string;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class NetSuiteApiClient {
  private config: NetSuiteConfig;
  private tokenManager: NetSuiteTokenManager;
  private baseUrl: string;

  constructor(config: NetSuiteConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl;
    this.tokenManager = new NetSuiteTokenManager(config);
  }

  // ==================== OAuth Management ====================
  async initializeOAuth(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      scope: 'rest_webservices',
      redirect_uri: this.config.redirectUri,
      state: state || this.generateState()
    });
    
    return `${this.config.authUrl}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const tokens = await this.exchangeCodeForTokens(code);
    await this.tokenManager.saveTokens(tokens);
  }

  private async exchangeCodeForTokens(code: string) {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    return response.json();
  }

  // ==================== Request Handling ====================
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.tokenManager.getValidToken();
    
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Token might be expired, try refresh
        await this.tokenManager.refreshToken();
        return this.request<T>(endpoint, options);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new NetSuiteApiError(response.status, data);
      }

      return data;
    } catch (error) {
      if (error instanceof NetSuiteApiError) throw error;
      throw new Error(`NetSuite API request failed: ${error.message}`);
    }
  }

  // ==================== Company Information ====================
  async getCompanyInfo(): Promise<NetSuiteCompanyInfo> {
    return this.request<NetSuiteCompanyInfo>('/config/v1/companyinformation');
  }

  // ==================== Subsidiaries ====================
  async getSubsidiaries(params?: { limit?: number; offset?: number }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : '';
    return this.request<{ items: NetSuiteSubsidiary[] }>(`/record/v1/subsidiary${query}`);
  }

  async getSubsidiary(id: string): Promise<NetSuiteSubsidiary> {
    return this.request<NetSuiteSubsidiary>(`/record/v1/subsidiary/${id}`);
  }

  // ==================== Customers ====================
  async getCustomers(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : '';
    return this.request<{ items: NetSuiteCustomer[] }>(`/record/v1/customer${query}`);
  }

  async getCustomer(id: string): Promise<NetSuiteCustomer> {
    return this.request<NetSuiteCustomer>(`/record/v1/customer/${id}`);
  }

  async createCustomer(customer: Partial<NetSuiteCustomer>): Promise<NetSuiteCustomer> {
    return this.request<NetSuiteCustomer>('/record/v1/customer', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
  }

  async updateCustomer(id: string, updates: Partial<NetSuiteCustomer>): Promise<NetSuiteCustomer> {
    return this.request<NetSuiteCustomer>(`/record/v1/customer/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.request(`/record/v1/customer/${id}`, {
      method: 'DELETE',
    });
  }

  async searchCustomerByWarpId(warpId: string): Promise<NetSuiteCustomer | null> {
    const query = `custentity_warp_customer_id IS "${warpId}"`;
    const result = await this.getCustomers({ q: query, limit: 1 });
    return result.items[0] || null;
  }

  // ==================== Invoices ====================
  async getInvoices(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : '';
    return this.request<{ items: NetSuiteInvoice[] }>(`/record/v1/invoice${query}`);
  }

  async getInvoice(id: string): Promise<NetSuiteInvoice> {
    return this.request<NetSuiteInvoice>(`/record/v1/invoice/${id}`);
  }

  async createInvoice(invoice: Partial<NetSuiteInvoice>): Promise<NetSuiteInvoice> {
    return this.request<NetSuiteInvoice>('/record/v1/invoice', {
      method: 'POST',
      body: JSON.stringify(invoice),
    });
  }

  async updateInvoice(id: string, updates: Partial<NetSuiteInvoice>): Promise<NetSuiteInvoice> {
    return this.request<NetSuiteInvoice>(`/record/v1/invoice/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async searchInvoiceByWarpId(warpInvoiceId: string): Promise<NetSuiteInvoice | null> {
    const query = `custbody_warp_invoice_id IS "${warpInvoiceId}"`;
    const result = await this.getInvoices({ q: query, limit: 1 });
    return result.items[0] || null;
  }

  // ==================== Payments ====================
  async getPayments(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : '';
    return this.request<{ items: NetSuitePayment[] }>(`/record/v1/customerPayment${query}`);
  }

  async getPayment(id: string): Promise<NetSuitePayment> {
    return this.request<NetSuitePayment>(`/record/v1/customerPayment/${id}`);
  }

  async createPayment(payment: Partial<NetSuitePayment>): Promise<NetSuitePayment> {
    return this.request<NetSuitePayment>('/record/v1/customerPayment', {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  }

  // ==================== Items (Services/Products) ====================
  async getServiceItems(params?: { limit?: number; offset?: number }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : '';
    return this.request<{ items: NetSuiteItem[] }>(`/record/v1/serviceItem${query}`);
  }

  async createServiceItem(item: Partial<NetSuiteItem>): Promise<NetSuiteItem> {
    return this.request<NetSuiteItem>('/record/v1/serviceItem', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async getNonInventoryItems(params?: { limit?: number; offset?: number }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : '';
    return this.request<{ items: NetSuiteItem[] }>(`/record/v1/nonInventoryItem${query}`);
  }

  // ==================== Journal Entries ====================
  async getJournalEntries(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : '';
    return this.request<{ items: NetSuiteJournalEntry[] }>(`/record/v1/journalEntry${query}`);
  }

  async createJournalEntry(entry: Partial<NetSuiteJournalEntry>): Promise<NetSuiteJournalEntry> {
    return this.request<NetSuiteJournalEntry>('/record/v1/journalEntry', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  // ==================== Bulk Operations ====================
  async bulkUpsertCustomers(customers: Partial<NetSuiteCustomer>[]): Promise<any> {
    return this.request('/record/v1/customer/bulk', {
      method: 'POST',
      body: JSON.stringify({ records: customers }),
    });
  }

  async bulkCreateInvoices(invoices: Partial<NetSuiteInvoice>[]): Promise<any> {
    return this.request('/record/v1/invoice/bulk', {
      method: 'POST',
      body: JSON.stringify({ records: invoices }),
    });
  }

  // ==================== Helper Methods ====================
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getCompanyInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getSyncStatus(): Promise<NetSuiteSyncStatus> {
    // This would be tracked in our database, not NetSuite
    const response = await fetch('/api/netsuite/sync/status');
    return response.json();
  }
}

// Token Manager
class NetSuiteTokenManager {
  private config: NetSuiteConfig;
  private redisKey = 'netsuite:tokens';
  private refreshLock: Promise<any> | null = null;

  constructor(config: NetSuiteConfig) {
    this.config = config;
  }

  async getValidToken(): Promise<string> {
    const tokens = await this.getTokens();
    
    if (!tokens) {
      throw new Error('No NetSuite tokens available. Please authorize first.');
    }

    if (this.isTokenExpiring(tokens)) {
      return await this.refreshToken();
    }

    return tokens.access_token;
  }

  async refreshToken(): Promise<string> {
    // Prevent concurrent refresh attempts
    if (this.refreshLock) {
      const tokens = await this.refreshLock;
      return tokens.access_token;
    }

    this.refreshLock = this.performRefresh();
    try {
      const tokens = await this.refreshLock;
      return tokens.access_token;
    } finally {
      this.refreshLock = null;
    }
  }

  private async performRefresh(): Promise<any> {
    const tokens = await this.getTokens();
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh NetSuite token');
    }

    const newTokens = await response.json();
    await this.saveTokens({
      ...newTokens,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
      expires_at: Date.now() + (newTokens.expires_in * 1000)
    });

    return newTokens;
  }

  async saveTokens(tokens: any): Promise<void> {
    // Store in Redis or database with encryption
    // This is a simplified version
    const data = {
      ...tokens,
      expires_at: tokens.expires_at || Date.now() + (tokens.expires_in * 1000)
    };
    
    // In production, encrypt before storing
    await this.storeInRedis(this.redisKey, data);
  }

  private async getTokens(): Promise<any> {
    // Retrieve from Redis or database
    return await this.retrieveFromRedis(this.redisKey);
  }

  private isTokenExpiring(tokens: any): boolean {
    // Refresh if less than 5 minutes remaining
    const bufferTime = 5 * 60 * 1000;
    return Date.now() >= (tokens.expires_at - bufferTime);
  }

  // Redis operations (simplified)
  private async storeInRedis(key: string, data: any): Promise<void> {
    // Implementation would use actual Redis client
    localStorage.setItem(key, JSON.stringify(data));
  }

  private async retrieveFromRedis(key: string): Promise<any> {
    // Implementation would use actual Redis client
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }
}

// Error handling
class NetSuiteApiError extends Error {
  constructor(
    public statusCode: number,
    public details: any
  ) {
    super(details.message || `NetSuite API error: ${statusCode}`);
    this.name = 'NetSuiteApiError';
  }
}

// Export singleton instance with configuration
export const netsuiteClient = new NetSuiteApiClient({
  accountId: process.env.NETSUITE_ACCOUNT_ID!,
  baseUrl: process.env.NETSUITE_BASE_URL!,
  authUrl: process.env.NETSUITE_AUTH_URL!,
  tokenUrl: process.env.NETSUITE_TOKEN_URL!,
  clientId: process.env.NETSUITE_CLIENT_ID!,
  clientSecret: process.env.NETSUITE_CLIENT_SECRET!,
  redirectUri: process.env.NETSUITE_REDIRECT_URI!,
});
```

## WebSocket Client Implementation

### File: `shared/lib/websocket-client.ts`
```typescript
export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private listeners: Map<string, Set<Function>> = new Map();
  private isIntentionallyClosed = false;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...config
    };
  }

  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const url = `${this.config.url}?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.event, data.payload);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    this.ws.onclose = () => {
      if (!this.isIntentionallyClosed) {
        this.attemptReconnect(token);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('max_reconnect_exceeded');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
      this.connect(token);
    }, this.config.reconnectInterval);
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.ws?.close();
    this.ws = null;
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  send(event: string, payload: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, payload }));
    }
  }
}
```

## React Query Hooks Examples

### File: `customer-frontend/src/hooks/use-api.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// ==================== Trunks ====================
export function useTrunks(params?: any) {
  return useQuery({
    queryKey: ['trunks', params],
    queryFn: () => apiClient.getTrunks(params),
  });
}

export function useTrunk(trunkId: string) {
  return useQuery({
    queryKey: ['trunks', trunkId],
    queryFn: () => apiClient.getTrunk(trunkId),
    enabled: !!trunkId,
  });
}

export function useCreateTrunk() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: apiClient.createTrunk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks'] });
      toast.success('Trunk created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create trunk');
    },
  });
}

export function useUpdateTrunk(trunkId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => apiClient.updateTrunk(trunkId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks'] });
      queryClient.invalidateQueries({ queryKey: ['trunks', trunkId] });
      toast.success('Trunk updated successfully');
    },
  });
}

// ==================== Numbers ====================
export function useNumbers(params?: any) {
  return useQuery({
    queryKey: ['numbers', params],
    queryFn: () => apiClient.getNumbers(params),
  });
}

export function useSearchNumbers(params: any) {
  return useQuery({
    queryKey: ['numbers', 'search', params],
    queryFn: () => apiClient.searchNumbers(params),
    enabled: !!params.area_code || !!params.rate_center,
  });
}

export function useOrderNumbers() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ numbers, trunkId }: any) => 
      apiClient.orderNumbers(numbers, trunkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
      toast.success('Numbers ordered successfully');
    },
  });
}

// ==================== Billing ====================
export function useBalance() {
  return useQuery({
    queryKey: ['billing', 'balance'],
    queryFn: apiClient.getBalance,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useInvoices(params?: any) {
  return useQuery({
    queryKey: ['billing', 'invoices', params],
    queryFn: () => apiClient.getInvoices(params),
  });
}

export function useRechargeBalance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ amount, paymentMethodId }: any) =>
      apiClient.rechargeBalance(amount, paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
      toast.success('Balance recharged successfully');
    },
  });
}

// ==================== Real-time Metrics ====================
export function useMetrics() {
  return useQuery({
    queryKey: ['metrics', 'current'],
    queryFn: apiClient.getCurrentMetrics,
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}
```

## Implementation Notes for Hive-Mind

1. **Replace Mock Data Imports**
   - Search for all imports from `mock-data.ts` files
   - Replace with hooks that call the API client
   - Remove all mock data files after replacement

2. **Add Loading States**
   ```typescript
   const { data, isLoading, error } = useTrunks();
   
   if (isLoading) return <Skeleton />;
   if (error) return <Alert>{error.message}</Alert>;
   ```

3. **Implement Error Boundaries**
   ```typescript
   <ErrorBoundary fallback={<ErrorFallback />}>
     <TrunkManagement />
   </ErrorBoundary>
   ```

4. **Setup Google Identity Platform Provider**
   ```typescript
   // In _app.tsx or main.tsx
   <Firebase Auth Provider
     domain={process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
     clientId={process.env.NEXT_PUBLIC_FIREBASE_API_KEY}
     redirectUri={window.location.origin}
   >
     <QueryClientProvider client={queryClient}>
       <App />
     </QueryClientProvider>
   </Firebase Auth Provider>
   ```

5. **Environment Variables**
   ```env
   # .env.development
   NEXT_PUBLIC_API_URL=http://localhost:8080/v1
   NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_API_KEY=your-client-id
   ```

6. **Type Generation**
   ```bash
   # Generate TypeScript types from OpenAPI
   npx openapi-typescript warp/api/openapi.yaml --output src/types/api.ts
   ```

## Testing Strategy

1. **Mock Service Worker (MSW)**
   - Set up MSW for development and testing
   - Create handlers for all API endpoints
   - Use for Storybook and unit tests

2. **Integration Tests**
   - Test API client methods
   - Test React Query hooks
   - Test error handling

3. **E2E Tests**
   - Test complete user flows
   - Test authentication flow
   - Test critical business operations

This specification provides complete implementation details for both API clients. The hive-mind should follow this exactly to connect the Polymet UI to the backend API.
