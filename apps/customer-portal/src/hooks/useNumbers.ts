/**
 * useNumbers Hook
 * Provides API operations for number inventory management
 *
 * Created: 2025-12-08
 */

import { useState } from 'react';
import axios from 'axios';
import {
  AssignedNumber,
  NumberSearchResponse,
  NumberListResponse,
  NumberInventorySummary,
  SearchNumbersRequest,
  ReserveNumbersRequest,
  ReserveNumbersResponse,
  PurchaseNumbersRequest,
  PurchaseNumbersResponse,
  UpdateNumberRequest,
  ReleaseNumberRequest,
  ListNumbersOptions,
} from '@/types/numbers';

export function useNumbers() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Search & Acquisition (SOA JIT)
  // ============================================================================

  /**
   * Search available numbers from SOA inventory
   */
  const searchAvailableNumbers = async (
    params: SearchNumbersRequest
  ): Promise<NumberSearchResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/v1/numbers/search', { params });
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to search numbers';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reserve numbers for purchase (15 minute hold)
   */
  const reserveNumbers = async (
    numbers: string[]
  ): Promise<ReserveNumbersResponse> => {
    setLoading(true);
    setError(null);
    try {
      const request: ReserveNumbersRequest = { numbers };
      const response = await axios.post('/v1/numbers/reserve', request);
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to reserve numbers';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Purchase reserved numbers and assign to customer
   */
  const purchaseNumbers = async (
    request: PurchaseNumbersRequest
  ): Promise<PurchaseNumbersResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/v1/numbers/purchase', request);
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to purchase numbers';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Inventory Management
  // ============================================================================

  /**
   * List assigned numbers with filtering and pagination
   */
  const listNumbers = async (
    options?: ListNumbersOptions
  ): Promise<NumberListResponse> => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: options?.page || 1,
        per_page: options?.per_page || 20,
        active_only: options?.active_only ?? true,
        search: options?.search,
        voice_enabled: options?.voice_enabled,
        sms_enabled: options?.sms_enabled,
        trunk_id: options?.trunk_id,
        campaign_id: options?.campaign_id,
      };

      // Remove undefined values
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined)
      );

      const response = await axios.get('/v1/numbers', { params: cleanParams });
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to list numbers';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get a single number by ID
   */
  const getNumber = async (id: string): Promise<AssignedNumber> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/v1/numbers/${id}`);
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get number';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get a number by telephone number (E.164)
   */
  const getNumberByTN = async (tn: string): Promise<AssignedNumber> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/v1/numbers/tn/${encodeURIComponent(tn)}`);
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get number';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update number configuration
   */
  const updateNumber = async (
    id: string,
    updates: UpdateNumberRequest
  ): Promise<AssignedNumber> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.patch(`/v1/numbers/${id}`, updates);
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to update number';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Release a number back to the pool
   */
  const releaseNumber = async (
    id: string,
    reason: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const request: ReleaseNumberRequest = { reason };
      await axios.post(`/v1/numbers/${id}/release`, request);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to release number';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Summary & Statistics
  // ============================================================================

  /**
   * Get inventory summary statistics
   */
  const getInventorySummary = async (
    customerId?: string
  ): Promise<NumberInventorySummary> => {
    setLoading(true);
    setError(null);
    try {
      const params = customerId ? { customer_id: customerId } : {};
      const response = await axios.get('/v1/numbers/summary', { params });
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get summary';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Format E.164 number for display
   */
  const formatPhoneNumber = (number: string): string => {
    const cleaned = number.replace(/\D/g, '');
    const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
    }
    return number;
  };

  /**
   * Clear any error state
   */
  const clearError = () => {
    setError(null);
  };

  return {
    // State
    loading,
    error,

    // Search & Acquisition
    searchAvailableNumbers,
    reserveNumbers,
    purchaseNumbers,

    // Inventory Management
    listNumbers,
    getNumber,
    getNumberByTN,
    updateNumber,
    releaseNumber,

    // Summary
    getInventorySummary,

    // Utilities
    formatPhoneNumber,
    clearError,
  };
}
