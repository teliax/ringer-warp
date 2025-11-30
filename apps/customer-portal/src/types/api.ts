/**
 * API Type Definitions for WARP Platform Customer Portal
 *
 * This file contains TypeScript interfaces for all API interactions
 */

// ============================================================================
// Core API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_more?: boolean;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// ============================================================================
// Authentication & Authorization Types
// ============================================================================

export interface LoginCredentials {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user_id?: string;
  email?: string;
  user_type?: string;
}

export interface Permission {
  resource_path: string;
  category?: string | null;
  display_name?: string | null;
  description?: string | null;
  display_order?: number;
  is_deprecated?: boolean;
  requires_wildcard?: boolean;
  icon?: string | null;
}

export interface CustomerAccess {
  customer_id: string;
  company_name: string;
  ban: string;
  role: 'USER' | 'ADMIN' | 'OWNER';
  granted_at?: string;
  granted_by?: string;
}

export interface MyPermissionsResponse {
  user_id: string;
  email: string;
  user_type: string;
  has_wildcard: boolean;
  permissions: string[];
  customer_access: CustomerAccess[];
  accessible_customers: string[] | null;
}

export interface GatekeeperCheckRequest {
  resource_path: string;
}

export interface GatekeeperCheckResponse {
  allowed: boolean;
  user_type: string;
  accessible_customer_ids: string[] | null;
  has_wildcard_permission: boolean;
  reason?: string;
}

// ============================================================================
// User Management Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  display_name: string;
  google_id?: string;
  user_type_id: string;
  user_type: string;
  user_type_display_name?: string;
  photo_url?: string;
  last_login?: string;
  login_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface UserType {
  id: string;
  type_name: string;
  description?: string;
  permissions?: string[];
  user_count?: number;
  has_wildcard_permission?: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface UserRole {
  user_id: string;
  customer_id: string;
  role: 'USER' | 'ADMIN' | 'OWNER';
  granted_at?: string;
  granted_by?: string;
}

export interface InviteUserRequest {
  email: string;
  user_type: string;
  role: 'USER' | 'ADMIN' | 'OWNER';
  message?: string;
}

export interface UpdateUserRoleRequest {
  role: 'USER' | 'ADMIN' | 'OWNER';
}

// ============================================================================
// Customer Types
// ============================================================================

export interface Customer {
  id: string;
  company_name: string;
  legal_name?: string;
  ban: string;
  customer_type: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  billing_email?: string;
  support_email?: string;
  phone?: string;
  address?: Address;
  created_at: string;
  updated_at?: string;
}

export interface Address {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

// ============================================================================
// SIP Trunk Types
// ============================================================================

export interface Trunk {
  id: string;
  customer_id: string;
  name: string;
  description?: string;
  trunk_type: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  sip_uri?: string;
  codec_preferences?: string[];
  max_concurrent_calls?: number;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// Number/DID Types
// ============================================================================

export interface PhoneNumber {
  id: string;
  customer_id: string;
  number: string;
  number_type: 'LOCAL' | 'TOLL_FREE' | 'MOBILE';
  status: 'ACTIVE' | 'RESERVED' | 'SUSPENDED' | 'CANCELLED';
  country_code: string;
  area_code?: string;
  rate_center?: string;
  assigned_trunk_id?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// Messaging Types
// ============================================================================

export interface Message {
  id: string;
  customer_id: string;
  from_number: string;
  to_number: string;
  message_type: 'SMS' | 'MMS' | 'RCS';
  body: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  direction: 'INBOUND' | 'OUTBOUND';
  created_at: string;
  delivered_at?: string;
}

export interface Campaign {
  id: string;
  customer_id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  message_count?: number;
  created_at: string;
}

// ============================================================================
// Billing Types
// ============================================================================

export interface Invoice {
  id: string;
  customer_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  due_date: string;
  paid_date?: string;
  created_at: string;
}

export interface UsageRecord {
  id: string;
  customer_id: string;
  service_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  billing_period_start: string;
  billing_period_end: string;
  created_at: string;
}

// ============================================================================
// Dashboard/Analytics Types
// ============================================================================

export interface DashboardStats {
  total_customers?: number;
  active_trunks?: number;
  total_numbers?: number;
  monthly_calls?: number;
  monthly_messages?: number;
  current_balance?: number;
  period_start?: string;
  period_end?: string;
}

export interface CallStats {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  total_duration_minutes: number;
  average_duration_seconds: number;
  peak_concurrent_calls: number;
}

export interface MessageStats {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  delivery_rate: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Status = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED' | 'CANCELLED';

export type SortOrder = 'asc' | 'desc';

export interface FilterParams {
  [key: string]: string | number | boolean | undefined;
}

export interface SearchParams extends PaginationParams, FilterParams {
  search?: string;
  filter_by?: string;
}
