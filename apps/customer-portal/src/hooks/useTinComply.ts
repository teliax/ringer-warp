import { useState } from "react";
import { apiClient } from "@/lib/axios-config";

// Types matching backend
export interface EINLookupResult {
  ein: string;
  company_name: string;
  legal_name?: string;
  business_name?: string;
  verified: boolean;
  match_score?: number;
  entity_type?: string;
  incorporated_at?: string;
  state?: string;
  status?: string;
}

export interface EINLookupResponse {
  request_id: string;
  service_type: string;
  status: "completed" | "pending" | "failed";
  completed_at?: string;
  result?: EINLookupResult;
  error?: string;
  original_params?: Record<string, any>;
}

export interface TINNameMatchResult {
  tin: string;
  company_name: string;
  matched: boolean;
  match_score?: number;
  irs_verified: boolean;
  exact_match: boolean;
  fuzzy_match: boolean;
  confidence: "high" | "medium" | "low";
  match_details?: string;
}

export interface TINNameMatchResponse {
  request_id: string;
  service_type: string;
  status: "completed" | "pending" | "failed";
  completed_at?: string;
  result?: TINNameMatchResult;
  error?: string;
}

export interface EINFormatValidation {
  valid: boolean;
  formatted: string;
  message: string;
}

/**
 * Hook for TinComply EIN/Tax ID verification operations
 */
export function useTinComply() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validate EIN format (client-side check, no API call)
   */
  const validateEINFormat = async (ein: string): Promise<EINFormatValidation> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{ data: EINFormatValidation }>(
        `/v1/tincomply/validate-ein-format`,
        { params: { ein } }
      );

      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to validate EIN format";
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lookup company information by EIN using TinComply API
   */
  const lookupEIN = async (ein: string): Promise<EINLookupResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{ data: EINLookupResponse }>(
        `/v1/tincomply/lookup-ein`,
        { params: { ein } }
      );

      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to lookup EIN";
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verify TIN matches company name using IRS TIN-Name matching
   */
  const verifyTINName = async (
    tin: string,
    companyName: string
  ): Promise<TINNameMatchResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{ data: TINNameMatchResponse }>(
        `/v1/tincomply/verify-tin-name`,
        { tin, company_name: companyName }
      );

      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to verify TIN and name";
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format EIN to standard XX-XXXXXXX format
   */
  const formatEIN = (ein: string): string => {
    // Remove any non-digit characters
    const digits = ein.replace(/\D/g, "");

    // Validate length
    if (digits.length !== 9) {
      return ein; // Return original if invalid
    }

    // Format as XX-XXXXXXX
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  };

  return {
    loading,
    error,
    validateEINFormat,
    lookupEIN,
    verifyTINName,
    formatEIN,
  };
}
