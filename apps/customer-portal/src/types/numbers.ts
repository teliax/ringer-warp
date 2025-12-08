/**
 * Number Inventory Type Definitions for WARP Platform
 * Matches backend models in services/api-gateway/internal/models/number.go
 *
 * Created: 2025-12-08
 */

// ============================================================================
// Core Number Types
// ============================================================================

/**
 * AssignedNumber represents a customer-assigned telephone number
 * Maps to: models.AssignedNumber in Go backend
 */
export interface AssignedNumber {
  id: string;
  customer_id: string;
  number: string; // E.164 format

  // SOA tracking
  soa_number_id?: string;
  soa_last_synced?: string;
  soa_sync_status: string;

  // Number classification
  number_type: 'DID' | 'TOLL_FREE';
  npa?: string;        // Area code
  nxx?: string;        // Exchange
  rate_center?: string;
  state?: string;

  // Features
  voice_enabled: boolean;
  sms_enabled: boolean;
  mms_enabled: boolean;
  fax_enabled: boolean;

  // Voice routing
  trunk_id?: string;
  voice_destination?: string;
  voice_failover_destination?: string;
  voice_routing_type?: string;

  // Messaging/TCR
  campaign_id?: string;
  brand_id?: string;
  tcr_status?: string;

  // E911
  e911_enabled: boolean;
  e911_address_id?: string;

  // CNAM
  cnam_enabled: boolean;
  cnam_display_name?: string;

  // Display
  friendly_name?: string;
  description?: string;

  // Status & Billing
  active: boolean;
  monthly_charge?: number;
  billing_start_date?: string;
  activated_at: string;
  released_at?: string;
  release_reason?: string;

  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request to search available numbers from SOA
 */
export interface SearchNumbersRequest {
  npa?: string;         // Area code
  nxx?: string;         // Exchange
  state?: string;       // State code
  lata?: string;        // LATA number
  rate_center?: string; // Rate center
  page?: number;
  size?: number;
}

/**
 * Request to reserve numbers for purchase
 */
export interface ReserveNumbersRequest {
  numbers: string[]; // E.164 format
}

/**
 * Request to purchase reserved numbers
 */
export interface PurchaseNumbersRequest {
  numbers: string[];     // E.164 format
  voice_enabled?: boolean;
  sms_enabled?: boolean;
  trunk_id?: string;
  campaign_id?: string;
}

/**
 * Request to update a number's configuration
 */
export interface UpdateNumberRequest {
  // Voice configuration
  voice_enabled?: boolean;
  voice_destination?: string;
  voice_failover_destination?: string;
  voice_routing_type?: string;
  trunk_id?: string;

  // Messaging configuration
  sms_enabled?: boolean;
  mms_enabled?: boolean;
  campaign_id?: string;

  // E911 configuration
  e911_enabled?: boolean;
  e911_address_id?: string;

  // CNAM configuration
  cnam_enabled?: boolean;
  cnam_display_name?: string;

  // Display
  friendly_name?: string;
  description?: string;
}

/**
 * Request to release a number
 */
export interface ReleaseNumberRequest {
  reason: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Single number from SOA search results
 */
export interface NumberSearchResult {
  telephone_number: string;
  npa: string;
  nxx: string;
  state: string;
  lata?: number;
  rate_center?: string;
  monthly_rate?: number;
}

/**
 * Paginated search response from SOA
 */
export interface NumberSearchResponse {
  numbers: NumberSearchResult[];
  total_elements: number;
  total_pages: number;
  page: number;
  size: number;
}

/**
 * Paginated list of assigned numbers
 */
export interface NumberListResponse {
  numbers: AssignedNumber[];
  total_elements: number;
  total_pages: number;
  page: number;
  size: number;
}

/**
 * Reserve numbers response
 */
export interface ReserveNumbersResponse {
  reserved: string[];
  count: number;
  errors?: string[];
  partial?: boolean;
}

/**
 * Purchase numbers response
 */
export interface PurchaseNumbersResponse {
  numbers: AssignedNumber[];
  count: number;
  errors?: string[];
  partial?: boolean;
}

/**
 * Inventory summary statistics
 */
export interface NumberInventorySummary {
  customer_id: string;
  active_count: number;
  released_count: number;
  voice_enabled_count: number;
  sms_enabled_count: number;
  campaign_linked_count: number;
  trunk_linked_count: number;
  total_monthly_charge: number;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Options for listing numbers
 */
export interface ListNumbersOptions {
  page?: number;
  per_page?: number;
  active_only?: boolean;
  search?: string;
  voice_enabled?: boolean;
  sms_enabled?: boolean;
  trunk_id?: string;
  campaign_id?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type NumberType = 'DID' | 'TOLL_FREE';
export type NumberStatus = 'active' | 'inactive' | 'porting';
export type SOASyncStatus = 'SYNCED' | 'PENDING' | 'ERROR';
