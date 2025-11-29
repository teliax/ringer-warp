# Admin Portal Integration Guide

## Overview

The admin portal (`apps/admin-portal/`) is a React + Vite + shadcn/ui application that will consume the WARP Platform APIs to manage customers, vendors, trunks, and monitor system health.

---

## 🎯 **Core Use Cases**

### **1. Customer Management**
- Create/edit/view customers
- Assign partitions to customers
- View customer usage and billing
- Manage customer status (active/suspended)

### **2. Vendor Management**
- Add/configure voice vendors (SIP endpoints, rates)
- Add/configure SMS vendors (SMPP binds)
- Assign vendors to partitions
- Monitor vendor health and performance

### **3. Trunk Management**
- Create SIP trunks for customers
- Configure inbound/outbound settings
- Test trunk connectivity
- View trunk status and metrics

### **4. Phone Number (DID) Management**
- Search available numbers
- Assign numbers to customers/trunks
- Enable SMS/voice features
- Configure E911

### **5. System Monitoring**
- Real-time call volume
- SMS throughput
- Vendor performance
- System health dashboards

---

## 📂 **Admin Portal Structure**

```
apps/admin-portal/
├── src/
│   ├── api/
│   │   ├── client.ts                 # API client with auth
│   │   ├── customers.ts              # Customer CRUD
│   │   ├── vendors.ts                # Vendor management
│   │   ├── trunks.ts                 # Trunk management
│   │   ├── dids.ts                   # Phone number management
│   │   ├── messaging.ts              # SMS/MMS operations
│   │   └── analytics.ts              # Usage/reporting
│   │
│   ├── pages/
│   │   ├── dashboard.tsx             # Main dashboard
│   │   ├── customers/
│   │   │   ├── list.tsx              # Customer list
│   │   │   ├── detail.tsx            # Customer detail + trunks
│   │   │   └── create.tsx            # New customer form
│   │   ├── vendors/
│   │   │   ├── voice-vendors.tsx     # Voice vendor management
│   │   │   ├── sms-vendors.tsx       # SMS vendor management
│   │   │   └── partitions.tsx        # Partition configuration
│   │   ├── messaging/
│   │   │   ├── recent-messages.tsx   # Recent SMS/MMS
│   │   │   └── send-test.tsx         # Test SMS sending
│   │   ├── voice/
│   │   │   ├── recent-calls.tsx      # Recent CDRs
│   │   │   └── test-routing.tsx      # Route testing tool
│   │   └── monitoring/
│   │       ├── system-health.tsx     # Overall health
│   │       └── vendor-status.tsx     # Vendor monitoring
│   │
│   ├── components/
│   │   ├── customers/
│   │   │   ├── CustomerForm.tsx      # Reusable customer form
│   │   │   ├── CustomerCard.tsx      # Customer display card
│   │   │   └── CustomerTrunks.tsx    # Trunk list for customer
│   │   ├── vendors/
│   │   │   ├── VoiceVendorForm.tsx   # Voice vendor config
│   │   │   ├── SMSVendorForm.tsx     # SMS vendor config
│   │   │   └── VendorHealth.tsx      # Health indicator
│   │   ├── trunks/
│   │   │   ├── TrunkForm.tsx         # Trunk configuration
│   │   │   └── TrunkTestDialog.tsx   # Route testing modal
│   │   └── shared/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── DataTable.tsx         # Reusable table
│   │
│   ├── hooks/
│   │   ├── useCustomers.ts           # React Query for customers
│   │   ├── useVendors.ts             # React Query for vendors
│   │   ├── useTrunks.ts              # React Query for trunks
│   │   └── useRealtime.ts            # WebSocket for live data
│   │
│   └── types/
│       ├── customer.ts               # Customer TypeScript types
│       ├── vendor.ts                 # Vendor types
│       ├── trunk.ts                  # Trunk types
│       └── api.ts                    # API response types
```

---

## 🔌 **API Integration Pattern**

### **1. API Client Setup**

```typescript
// src/api/client.ts
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.ringer.tel/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('admin_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add error interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Redirect to login
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  get<T>(url: string, params?: any) {
    return this.client.get<T>(url, { params });
  }

  post<T>(url: string, data?: any) {
    return this.client.post<T>(url, data);
  }

  put<T>(url: string, data?: any) {
    return this.client.put<T>(url, data);
  }

  delete<T>(url: string) {
    return this.client.delete<T>(url);
  }
}

export const apiClient = new ApiClient();
```

### **2. Customer API Functions**

```typescript
// src/api/customers.ts
import { apiClient } from './client';
import { Customer, CreateCustomerRequest } from '../types/customer';

export const customersApi = {
  // List all customers
  list: (params?: { search?: string; status?: string; page?: number }) =>
    apiClient.get<{ customers: Customer[]; pagination: any }>('/customers', params),

  // Get customer by ID with relationships
  get: (customerId: string, include?: string[]) =>
    apiClient.get<Customer>(`/customers/${customerId}`, {
      include: include?.join(','),
    }),

  // Get customer by BAN
  getByBan: (ban: string) =>
    apiClient.get<Customer>(`/customers/by-ban/${ban}`),

  // Create customer
  create: (data: CreateCustomerRequest) =>
    apiClient.post<Customer>('/customers', data),

  // Update customer
  update: (customerId: string, data: Partial<Customer>) =>
    apiClient.put<Customer>(`/customers/${customerId}`, data),

  // Get customer trunks
  getTrunks: (customerId: string) =>
    apiClient.get<any>(`/customers/${customerId}/trunks`),

  // Get customer DIDs
  getDids: (customerId: string) =>
    apiClient.get<any>(`/customers/${customerId}/dids`),

  // Get customer usage
  getUsage: (customerId: string, startDate: string, endDate: string) =>
    apiClient.get<any>(`/customers/${customerId}/usage`, {
      start_date: startDate,
      end_date: endDate,
    }),
};
```

### **3. React Query Hook**

```typescript
// src/hooks/useCustomers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers';

export function useCustomers(filters?: { search?: string; status?: string }) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => customersApi.list(filters),
  });
}

export function useCustomer(customerId: string, include?: string[]) {
  return useQuery({
    queryKey: ['customer', customerId, include],
    queryFn: () => customersApi.get(customerId, include),
    enabled: !!customerId,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      // Invalidate customers list to refresh
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      customersApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
```

### **4. Customer List Page**

```typescript
// src/pages/customers/list.tsx
import { useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';

export function CustomerList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, error } = useCustomers({ search, status });

  const columns = [
    { header: 'BAN', accessorKey: 'ban' },
    { header: 'Company Name', accessorKey: 'company_name' },
    { header: 'Type', accessorKey: 'customer_type' },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Balance', accessorKey: 'current_balance' },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <Button onClick={() => navigate(`/customers/${row.original.id}`)}>
          View
        </Button>
      ),
    },
  ];

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading customers</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <Button onClick={() => navigate('/customers/create')}>
          New Customer
        </Button>
      </div>

      <div className="flex gap-4 mb-4">
        <Input
          placeholder="Search by name or BAN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="TRIAL">Trial</option>
        </select>
      </div>

      <DataTable columns={columns} data={data?.customers || []} />
    </div>
  );
}
```

### **5. Customer Detail Page with Trunks**

```typescript
// src/pages/customers/detail.tsx
import { useParams } from 'react-router-dom';
import { useCustomer } from '../../hooks/useCustomers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerTrunks } from '@/components/customers/CustomerTrunks';
import { CustomerDIDs } from '@/components/customers/CustomerDIDs';
import { CustomerUsage } from '@/components/customers/CustomerUsage';

export function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const { data: customer, isLoading } = useCustomer(
    customerId!,
    ['trunks', 'dids', 'usage']
  );

  if (isLoading) return <div>Loading...</div>;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{customer.company_name}</h1>
        <p className="text-gray-600">BAN: {customer.ban}</p>
        <div className="flex gap-4 mt-2">
          <span className={`badge ${customer.status}`}>{customer.status}</span>
          <span className="badge">{customer.customer_type}</span>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trunks">
            Trunks ({customer.trunks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="dids">
            DIDs ({customer.dids?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="usage">Usage & Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-4">
            <div className="border p-4 rounded">
              <h3 className="font-semibold mb-2">Contact</h3>
              <p>{customer.contact.name}</p>
              <p>{customer.contact.email}</p>
              <p>{customer.contact.phone}</p>
            </div>
            <div className="border p-4 rounded">
              <h3 className="font-semibold mb-2">Billing</h3>
              <p>Cycle: {customer.billing_cycle}</p>
              <p>Balance: ${customer.current_balance}</p>
              <p>Terms: Net {customer.payment_terms}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trunks">
          <CustomerTrunks customerId={customerId!} trunks={customer.trunks} />
        </TabsContent>

        <TabsContent value="dids">
          <CustomerDIDs customerId={customerId!} dids={customer.dids} />
        </TabsContent>

        <TabsContent value="usage">
          <CustomerUsage customerId={customerId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 🧪 **Testing Workflow**

### **Phase 1: Setup (Week 1)**
1. ✅ Deploy API Gateway with core endpoints
2. ✅ Set up admin portal API client
3. ✅ Implement customer CRUD in portal
4. ✅ Test create/view/edit customer flow

### **Phase 2: Voice (Week 2)**
1. ✅ Implement vendor management endpoints
2. ✅ Add voice vendor UI to portal
3. ✅ Create partition management UI
4. ✅ Build trunk creation workflow
5. ✅ Test end-to-end: Customer → Trunk → Partition → Vendor

### **Phase 3: Messaging (Week 3)**
1. ✅ Integrate go-smpp APIs
2. ✅ Add SMS vendor UI
3. ✅ Build test SMS interface
4. ✅ Test: Assign DID → Configure SMS → Send test message

### **Phase 4: Monitoring (Week 4)**
1. ✅ Add real-time dashboards
2. ✅ Integrate Prometheus metrics
3. ✅ Build CDR/MDR viewers
4. ✅ Test: View recent calls/messages

---

## 📊 **Key Dashboard Metrics**

```typescript
// Real-time metrics to display
interface DashboardMetrics {
  voice: {
    active_calls: number;
    calls_today: number;
    minutes_today: number;
    asr: number; // Answer Seizure Ratio
  };
  messaging: {
    messages_today: number;
    delivery_rate: number;
    pending_dlrs: number;
  };
  system: {
    kamailio_status: 'healthy' | 'degraded' | 'down';
    voice_vendors_up: number;
    voice_vendors_total: number;
    sms_vendors_connected: number;
    sms_vendors_total: number;
  };
  customers: {
    active_count: number;
    trial_count: number;
    suspended_count: number;
  };
}
```

---

## ✅ **Next Steps**

1. **API Gateway Development** (Go + Gin + Swaggo)
   - Implement customer CRUD endpoints
   - Implement vendor management endpoints
   - Implement trunk management endpoints
   - Add OpenAPI 3.0.3 documentation

2. **Database Setup**
   - Run `01-core-schema.sql` on Cloud SQL
   - Create test customer data
   - Configure BigQuery datasets

3. **Admin Portal Integration**
   - Set up API client
   - Build customer management pages
   - Build vendor management pages
   - Add real-time monitoring

4. **End-to-End Testing**
   - Create test customer
   - Configure trunk
   - Send test SMS
   - Monitor in dashboards

Ready to start implementing the Go API Gateway?
