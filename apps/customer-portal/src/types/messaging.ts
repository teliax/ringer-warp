/**
 * TCR 10DLC Messaging Type Definitions
 * Matches backend API models exactly
 */

// =============================================================================
// BRAND TYPES
// =============================================================================

export interface Brand10DLC {
  id: string;
  customer_id: string;
  tcr_brand_id?: string;
  display_name: string;
  legal_name: string;
  company_name?: string;
  tax_id?: string;
  entity_type: string;
  identity_status?: string;
  status?: string;
  trust_score?: number;
  vetting_status?: string;
  vetting_provider?: string;
  vetting_class?: string;
  vetting_date?: string;
  // Auth+ progress tracking
  auth_plus_domain_verified?: boolean;
  auth_plus_2fa_verified?: boolean;
  auth_plus_email_sent_at?: string;
  auth_plus_email_opened_at?: string;
  auth_plus_requested_at?: string;
  auth_plus_completed_at?: string;
  auth_plus_failed_at?: string;
  vertical?: string;
  website?: string;
  country: string;
  state?: string;
  city?: string;
  street?: string;
  postal_code?: string;
  stock_exchange?: string;
  stock_symbol?: string;
  alt_business_id?: string;
  alt_business_id_type?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  business_contact_first_name?: string;
  business_contact_last_name?: string;
  business_contact_email?: string;
  business_contact_phone?: string;
  brand_relationship: string;
  reference_id?: string;
  tcr_created_at?: string;
  tcr_updated_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface CreateBrandRequest {
  display_name: string;
  legal_name: string;
  entity_type: string;
  email: string;
  phone: string;
  country: string;
  state?: string;
  city?: string;
  street?: string;
  postal_code?: string;
  company_name?: string;
  website?: string;
  vertical?: string;
  tax_id?: string;
  stock_exchange?: string;
  stock_symbol?: string;
  alt_business_id?: string;
  alt_business_id_type?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  contact_phone?: string;
  reference_id?: string;
}

export interface UpdateBrandRequest {
  display_name?: string;
  website?: string;
  vertical?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  // Business contact fields (required for TCR identity verification & Auth+)
  business_contact_first_name?: string;
  business_contact_last_name?: string;
  business_contact_email?: string;
  business_contact_phone?: string;
}

// =============================================================================
// CAMPAIGN TYPES
// =============================================================================

export interface Campaign10DLC {
  id: string;
  customer_id: string;
  brand_id: string;
  tcr_campaign_id?: string;
  reseller_id?: string;
  use_case: string;
  sub_use_cases?: string[];
  description: string;
  message_flow: string;
  sample_messages: string[];
  subscriber_optin: boolean;
  subscriber_optout: boolean;
  subscriber_help: boolean;
  optin_keywords?: string;
  optin_message?: string;
  optout_keywords: string;
  optout_message?: string;
  help_keywords: string;
  help_message?: string;
  embedded_link: boolean;
  embedded_phone: boolean;
  number_pool: boolean;
  age_gated: boolean;
  direct_lending: boolean;
  privacy_policy_url?: string;
  terms_url?: string;
  auto_renewal: boolean;
  expiration_date?: string;
  throughput_limit?: number;
  daily_cap?: number;
  status: string;
  tcr_submission_date?: string;
  tcr_approval_date?: string;
  trust_score?: number;
  reference_id?: string;
  // Rejection Details
  rejection_reason?: string;
  rejection_code?: string;
  rejection_category?: string;
  rejected_at?: string;
  rejected_by?: string;
  tcr_created_at?: string;
  tcr_updated_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface CreateCampaignRequest {
  brand_id: string;
  use_case: string;
  description: string;
  message_flow: string;
  sample_messages: string[];
  sub_use_cases?: string[];
  subscriber_optin: boolean;
  subscriber_optout: boolean;
  subscriber_help: boolean;
  optin_keywords?: string;
  optin_message?: string;
  optout_keywords: string;
  optout_message?: string;
  help_keywords: string;
  help_message?: string;
  embedded_link: boolean;
  embedded_phone: boolean;
  number_pool: boolean;
  age_gated: boolean;
  direct_lending: boolean;
  affiliate_marketing?: boolean;
  privacy_policy_url?: string;
  terms_url?: string;
  auto_renewal: boolean;
  reference_id?: string;
}

export interface UpdateCampaignRequest {
  description?: string;
  message_flow?: string;
  sample_messages?: string[];
  optin_message?: string;
  optout_message?: string;
  help_message?: string;
  privacy_policy_url?: string;
  terms_url?: string;
  auto_renewal?: boolean;
}

export interface ResubmitCampaignRequest {
  // Optional: specific MNO IDs to resubmit to. If empty, resubmits to all carriers.
  // Valid MNO IDs: 10017 (AT&T), 10035 (T-Mobile), 10038 (Verizon)
  mno_ids?: number[];
}

export interface ResubmitCampaignResponse {
  campaign_id: string;
  tcr_campaign_id: string;
  mno_metadata?: MNOMetadata[];
  message: string;
}

export interface MNOMetadata {
  mno: string;
  mno_support: boolean;
  mno_review?: boolean;
  qualify: boolean;
  min_msg_samples?: number;
  req_subscriber_optin?: boolean;
  req_subscriber_optout?: boolean;
  req_subscriber_help?: boolean;
  no_embedded_link?: boolean;
  no_embedded_phone?: boolean;
  // AT&T specific
  msg_class?: string;
  tpm?: number;
  mms_tpm?: number;
  tpm_scope?: string;
  // T-Mobile specific
  brand_tier?: string;
  brand_daily_cap?: number | null;
}

// =============================================================================
// MNO STATUS TYPES
// =============================================================================

export interface CampaignMNOStatus {
  id: string;
  campaign_id: string;
  mno_id: string;
  mno_name: string;
  status: string; // REGISTERED, REVIEW, REJECTED, SUSPENDED
  status_updated_at: string;
  rejection_reason?: string;
  rejection_code?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// PHONE NUMBER TYPES
// =============================================================================

export interface CampaignPhoneNumber {
  id: string;
  campaign_id: string;
  phone_number: string;
  assigned_at: string;
  assigned_by?: string;
  removed_at?: string;
  removed_by?: string;
  is_active: boolean;
}

export interface AssignNumbersRequest {
  phone_numbers: string[];
}

// =============================================================================
// ENUMERATION TYPES
// =============================================================================

export interface UseCaseInfo {
  code: string;
  display_name: string;
  description: string;
  difficulty: string; // EASY, MEDIUM, HARD
  min_samples: number;
}

export interface EntityTypeInfo {
  code: string;
  display_name: string;
  description: string;
}

export interface VerticalInfo {
  code: string;
  display_name: string;
}

export interface MNOInfo {
  mno_id: string;
  name: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
  };
}

export interface ListResponse<T> {
  items: T[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// =============================================================================
// BRAND/CAMPAIGN STATUS VALUES (from backend)
// =============================================================================

export type BrandStatus =
  | 'PENDING'
  | 'REGISTERED'
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'VETTED_VERIFIED'
  | 'FAILED'
  | 'SUSPENDED';

export type CampaignStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED';

export type MNOStatusType =
  | 'REGISTERED'
  | 'REVIEW'
  | 'REJECTED'
  | 'SUSPENDED';

// =============================================================================
// ENTITY TYPE VALUES
// =============================================================================

export type EntityType =
  | 'PRIVATE_PROFIT'
  | 'PUBLIC_PROFIT'
  | 'NON_PROFIT'
  | 'GOVERNMENT'
  | 'SOLE_PROPRIETOR';

// =============================================================================
// USE CASE VALUES
// =============================================================================

export type UseCase =
  | '2FA'
  | 'ACCOUNT_NOTIFICATION'
  | 'CUSTOMER_CARE'
  | 'DELIVERY_NOTIFICATION'
  | 'FRAUD_ALERT'
  | 'MARKETING'
  | 'POLLING_VOTING'
  | 'PUBLIC_SERVICE_ANNOUNCEMENT'
  | 'SECURITY_ALERT'
  | 'CHARITY'
  | 'POLITICAL'
  | 'SWEEPSTAKE'
  | 'EMERGENCY'
  | 'LOW_VOLUME'
  | 'HIGHER_EDUCATION'
  | 'K12_EDUCATION';

// =============================================================================
// AUTH+ VETTING TYPES
// =============================================================================

export type AuthPlusVettingStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'FAILED'
  | 'EXPIRED';

export interface VettingStatusDetail {
  vettingId: string;
  vettingClass: string;
  vettingProvider: string;
  status: AuthPlusVettingStatus;
  requestedAt: string;
  completedAt?: string;
  expirationDate?: string;
  domainVerified: boolean;
  twoFAVerified: boolean;
  failureReason?: string;
  canResend2FA: boolean;
  canAppeal: boolean;
  daysRemaining: number;
}

export interface AppealCategory {
  code: string;
  description: string;
}

export const AUTH_PLUS_APPEAL_CATEGORIES: AppealCategory[] = [
  {
    code: 'VERIFY_EMAIL_OWNERSHIP',
    description: 'Email delivery issues (bounce, DNS problems, etc.)'
  },
  {
    code: 'VERIFY_DOMAIN_OWNERSHIP',
    description: 'Domain ownership not recognized'
  }
];
