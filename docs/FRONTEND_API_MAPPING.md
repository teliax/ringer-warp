# Frontend to API Endpoint Mapping Guide

## Overview
This document provides explicit mapping between frontend UI components and backend API endpoints for hive-mind implementation. Both customer-frontend and admin-frontend are Polymet-generated templates that need to be connected to the WARP API.

## Implementation Priority
1. Replace ALL mock data with real API calls
2. Implement authentication before any other features
3. Use the existing UI components, just connect them to real data

## Customer Frontend (`/customer-frontend`)

### Authentication Flow
```typescript
// Pages: login.tsx
Required Endpoints:
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/mfa/setup (if MFA enabled)

Implementation:
1. Replace simulated login with real Google Identity Platform integration
2. Store JWT token in localStorage/sessionStorage
3. Implement token refresh on 401 responses
4. Add logout functionality
```

### Dashboard Page (`dashboard.tsx`)
```typescript
// Current: Uses mock data from telecom-mock-data.ts
Required Endpoints:
- GET /metrics/current (real-time metrics)
- GET /billing/balance (current balance)
- GET /usage/summary?period=current_month
- GET /trunks?limit=5 (recent trunks)
- WebSocket: /ws/metrics (for real-time updates)

Data Mapping:
- mockCallMetrics → /metrics/current
- mockSipTrunks → /trunks
- Balance widget → /billing/balance
```

### Trunks Page (`trunks.tsx`)
```typescript
// Current: Uses mockSipTrunks
Required Endpoints:
- GET /customers/{customer_id}/trunks
- POST /customers/{customer_id}/trunks
- PATCH /trunks/{trunk_id}
- DELETE /trunks/{trunk_id}
- POST /trunks/{trunk_id}/test
- GET /trunks/{trunk_id}/credentials
- GET /trunks/{trunk_id}/metrics

Component Mapping:
- TrunkConfigForm → POST/PATCH endpoints
- Trunk list table → GET endpoint
- Test button → POST test endpoint
- Metrics charts → GET metrics endpoint
```

### Numbers Page (`numbers.tsx`)
```typescript
// Current: Uses mock data
Required Endpoints:
- GET /numbers (list owned numbers)
- POST /numbers/search (search available)
- POST /numbers/order (purchase numbers)
- DELETE /numbers/{number_id} (release)
- GET /numbers/{number_id}/sms (SMS config)
- PATCH /numbers/{number_id}/e911 (E911 update)
- POST /numbers/port (initiate port)
- GET /numbers/port/{port_id}/status

Component Mapping:
- NumberAcquisitionSection → search/order endpoints
- NumberPortingSection → port endpoints
- Number list → GET /numbers
- E911 form → PATCH e911 endpoint
```

### Messaging Page (`messaging.tsx`)
```typescript
// Current: No implementation
Required Endpoints:
- POST /messages/sms
- POST /messages/mms
- GET /messages?direction=inbound/outbound
- GET /messages/{message_id}/status
- GET /messages/campaigns (10DLC)
- POST /messages/campaigns
- GET /messaging/stats

Implementation Notes:
- Add send message form
- Display message history table
- Show delivery status updates
- Campaign management for 10DLC
```

### Billing Page (`billing.tsx`)
```typescript
// Current: Uses billing-mock-data.ts
Required Endpoints:
- GET /billing/invoices
- GET /billing/invoices/{invoice_id}
- GET /billing/invoices/{invoice_id}/download
- GET /billing/payment-methods
- POST /billing/payment-methods
- DELETE /billing/payment-methods/{method_id}
- POST /billing/recharge (prepaid)
- GET /billing/usage/current
- GET /billing/subscriptions

Component Mapping:
- BillingOverview → /billing/balance, /usage/current
- BillingPaymentMethods → payment-methods endpoints
- Invoice table → /billing/invoices
- Usage charts → /billing/usage/current
```

### Settings Pages (`settings-*.tsx`)
```typescript
// KYC Page (settings-kyc.tsx)
Required Endpoints:
- GET /account/profile
- PATCH /account/profile
- POST /account/documents
- GET /account/verification/status

// OAuth Page (settings-oauth.tsx)
Required Endpoints:
- GET /api-keys
- POST /api-keys
- DELETE /api-keys/{key_id}
- GET /webhooks
- POST /webhooks
- PATCH /webhooks/{webhook_id}

// Users Page (settings-users.tsx)
Required Endpoints:
- GET /account/users
- POST /account/users/invite
- PATCH /account/users/{user_id}/role
- DELETE /account/users/{user_id}
```

## Admin Frontend (`/admin-frontend`)

### Authentication
```typescript
// Same as customer but with admin scope
Required:
- Admin role check after login
- Different Google Identity Platform application ID
- Access to admin-only endpoints
```

### Customer Overview Page (`customer-overview.tsx`)
```typescript
// Current: Uses admin-mock-data.ts
Required Endpoints:
- GET /admin/customers (list all)
- GET /admin/customers/{customer_id}
- PATCH /admin/customers/{customer_id}
- POST /admin/customers/{customer_id}/suspend
- POST /admin/customers/{customer_id}/terminate
- GET /admin/customers/{customer_id}/trunks
- GET /admin/customers/{customer_id}/usage
- GET /admin/customers/{customer_id}/billing

Component Mapping:
- CustomerSearch → GET with search params
- CustomerEditForm → PATCH endpoint
- CustomerTrunkSection → trunks endpoint
- CustomerBillingSection → billing endpoint
- CustomerAnalyticsSection → usage endpoint
```

### Trunk Management Page (`trunk-management.tsx`)
```typescript
// Current: Uses trunk-mock-data.ts
Required Endpoints:
- GET /admin/trunks (all trunks)
- GET /admin/partitions
- POST /admin/partitions
- PATCH /admin/partitions/{partition_id}
- POST /admin/trunks/{trunk_id}/partition
- GET /admin/trunks/{trunk_id}/routes
- POST /admin/overrides
- DELETE /admin/overrides/{override_id}
- POST /admin/exclusions

Component Mapping:
- Partition management → partitions endpoints
- Trunk list → GET /admin/trunks
- TrunkOverrides → overrides endpoints
- TrunkExclusions → exclusions endpoints
- Route testing → routing simulation
```

### Rate Management Page (`rate-management.tsx`)
```typescript
// Current: Mock data only
Required Endpoints:
- GET /admin/rates
- POST /admin/rates/import
- GET /admin/rates/export
- PATCH /admin/rates/bulk
- GET /admin/providers
- POST /admin/providers/{provider_id}/rates
- GET /admin/margins/analysis
- POST /admin/rates/calculate

Component Mapping:
- Rate import form → import endpoint
- Rate table → GET rates with filters
- Margin analysis → margins endpoint
- Provider rates → provider endpoints
```

### Vendors Page (`vendors.tsx`)
```typescript
// Current: Uses mock data
Required Endpoints:
- GET /admin/providers
- POST /admin/providers
- PATCH /admin/providers/{provider_id}
- DELETE /admin/providers/{provider_id}
- GET /admin/providers/{provider_id}/performance
- POST /admin/providers/{provider_id}/dialstrings
- GET /admin/providers/{provider_id}/rates

Component Mapping:
- VendorTrunkSection → providers CRUD
- Performance metrics → performance endpoint
- Dialstring config → dialstrings endpoint
- Rate management → rates endpoint
```

### Support Pages (`support-*.tsx`)
```typescript
// Note: Support endpoints not in OpenAPI - need to add
Required Endpoints:
- GET /admin/support/tickets
- POST /admin/support/tickets
- PATCH /admin/support/tickets/{ticket_id}
- GET /admin/support/tickets/{ticket_id}/messages
- POST /admin/support/tickets/{ticket_id}/messages
- GET /admin/cdrs (for troubleshooting)
- GET /admin/logs

Component Mapping:
- SupportTicketList → tickets endpoint
- SupportTicketDetail → ticket messages
- CDR search → CDRs with filters
```

### Accounting Page (`accounting.tsx`)
```typescript
// Current: Mock billing data
Required Endpoints:
- GET /admin/billing/summary
- GET /admin/billing/ar (accounts receivable)
- GET /admin/billing/revenue
- POST /admin/billing/reconcile
- GET /netsuite/sync/status
- POST /netsuite/sync/trigger
- GET /admin/billing/disputes

Component Mapping:
- Revenue charts → revenue endpoint
- AR aging → ar endpoint
- NetSuite sync → netsuite endpoints
- Dispute management → disputes endpoint
```

### Settings Pages (NEW - To Be Created)
```typescript
// Service Configuration Management
Required Endpoints:
- GET /admin/settings/services
- POST /admin/settings/services
- PATCH /admin/settings/services/{service_id}
- DELETE /admin/settings/services/{service_id}
- POST /admin/settings/services/{service_id}/test
- GET /admin/settings/services/{service_id}/history

Service Types:
- telecom_services (LRN/LERG/CNAM, porting, toll-free)
- messaging_vendors (SMPP configurations)
- business_systems (CRM, ERP, tax)
- payment_processors (credit card, ACH)
- infrastructure (email, DNS, monitoring)

Component Mapping:
- ServiceConfigList → GET services by type
- ServiceConfigForm → POST/PATCH service
- CredentialsManager → Secret Manager integration
- TestConnection → test endpoint
- AuditHistory → history endpoint
```

## WebSocket Events

### Customer Portal WebSocket Events
```typescript
// Connect to: wss://api.warp.io/ws
Events to Listen:
- 'metrics.update' - Dashboard real-time metrics
- 'trunk.status' - Trunk online/offline status
- 'call.active' - Active call notifications
- 'balance.low' - Low balance alerts
- 'message.delivered' - SMS delivery updates
```

### Admin Portal WebSocket Events
```typescript
// Connect to: wss://api.warp.io/admin/ws
Events to Listen:
- 'system.metrics' - Platform-wide metrics
- 'customer.alert' - Customer issues
- 'trunk.registration' - Registration events
- 'fraud.alert' - Fraud detection
- 'billing.alert' - Payment failures
```

## API Client Implementation Pattern

### Base Client (Shared)
```typescript
// lib/api-client-base.ts
export class BaseApiClient {
  protected token: string | null = null;
  protected baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }
  
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Add auth header
    // Handle token refresh on 401
    // Implement retry logic
    // Parse errors properly
  }
  
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('warp_token', token);
  }
}
```

### Customer API Client
```typescript
// customer-frontend/src/lib/api-client.ts
import { BaseApiClient } from './api-client-base';

export class CustomerApiClient extends BaseApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_API_URL || 'https://api.warp.io/v1');
  }
  
  // Implement all customer endpoints
  // Group by resource (trunks, numbers, billing, etc.)
}

export const apiClient = new CustomerApiClient();
```

### Admin API Client
```typescript
// admin-frontend/src/lib/api-client.ts
import { BaseApiClient } from './api-client-base';

export class AdminApiClient extends BaseApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_API_URL || 'https://api.warp.io/v1');
  }
  
  // Implement all admin endpoints
  // Include admin-specific headers
}

export const apiClient = new AdminApiClient();
```

## State Management Pattern

### React Query Setup
```typescript
// Both frontends should use React Query for API state
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

// Wrap app with provider
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

### Example Hook Implementation
```typescript
// hooks/use-trunks.ts
export function useTrunks(customerId: string) {
  return useQuery({
    queryKey: ['trunks', customerId],
    queryFn: () => apiClient.getTrunks(customerId),
    enabled: !!customerId,
  });
}

export function useCreateTrunk() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: TrunkCreateRequest) => apiClient.createTrunk(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['trunks']);
      toast.success('Trunk created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create trunk');
    },
  });
}
```

## Error Handling Pattern

### Global Error Handler
```typescript
// lib/error-handler.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}

export function handleApiError(error: any): ApiError {
  if (error.response) {
    return new ApiError(
      error.response.status,
      error.response.data.message || 'An error occurred',
      error.response.data
    );
  }
  return new ApiError(500, 'Network error');
}

// Use in components
try {
  await apiClient.createTrunk(data);
} catch (error) {
  const apiError = handleApiError(error);
  if (apiError.statusCode === 422) {
    // Show validation errors
  } else if (apiError.statusCode === 403) {
    // Handle permission denied
  }
}
```

## Testing Requirements

### API Mock Server
```typescript
// For development, use MSW (Mock Service Worker)
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/v1/trunks', (req, res, ctx) => {
    return res(ctx.json({ data: mockTrunks }));
  }),
  // Add all endpoints for testing
];
```

## Implementation Checklist for Hive-Mind

### Phase 1: Foundation (Days 1-2)
- [ ] Implement base API client class
- [ ] Add Google Identity Platform integration
- [ ] Set up React Query
- [ ] Create error handling utilities
- [ ] Set up WebSocket client

### Phase 2: Customer Portal (Days 3-5)
- [ ] Implement all customer API methods
- [ ] Connect dashboard to real metrics
- [ ] Wire up trunk management
- [ ] Connect billing pages
- [ ] Implement number management

### Phase 3: Admin Portal (Days 6-8)
- [ ] Implement admin API client
- [ ] Connect customer management
- [ ] Wire up trunk/partition management
- [ ] Connect rate management
- [ ] Implement vendor management

### Phase 4: Real-time & Polish (Days 9-10)
- [ ] WebSocket event handling
- [ ] Loading states for all API calls
- [ ] Error boundaries
- [ ] Optimistic updates
- [ ] Response caching

## Notes for Hive-Mind

1. **DO NOT modify the UI components** - They are already well-designed by Polymet
2. **DO replace ALL mock data imports** with API calls
3. **DO implement proper loading and error states**
4. **DO use TypeScript interfaces from OpenAPI spec**
5. **DO NOT forget authentication on every API call**
6. **DO implement token refresh logic**
7. **DO use environment variables for API URLs**

## Missing OpenAPI Endpoints

The following endpoints are referenced in the UI but missing from OpenAPI spec:
1. Support ticket system endpoints
2. WebSocket connection endpoints
3. File upload endpoints (for documents)
4. Bulk operations endpoints
5. Admin-specific metrics endpoints

These should be added to the OpenAPI specification before implementation.
