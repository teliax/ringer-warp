import { useState } from 'react';
import axios from 'axios';
import type {
  Brand10DLC,
  CreateBrandRequest,
  UpdateBrandRequest,
  APIResponse,
  ListResponse,
} from '@/types/messaging';

export function useBrands() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * List all brands for the current customer
   */
  const listBrands = async (page: number = 1, perPage: number = 100): Promise<Brand10DLC[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<ListResponse<Brand10DLC>>>(
        `/v1/messaging/brands?page=${page}&per_page=${perPage}`
      );
      return response.data.data?.items || [];
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to list brands';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get a single brand by ID
   */
  const getBrand = async (id: string): Promise<Brand10DLC> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<Brand10DLC>>(`/v1/messaging/brands/${id}`);
      if (!response.data.data) {
        throw new Error('Brand not found');
      }
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get brand';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a new brand registration
   */
  const createBrand = async (data: CreateBrandRequest): Promise<{ brand: Brand10DLC; message: string }> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<APIResponse<{ brand: Brand10DLC; message: string; tcr_brand_id?: string; status?: string; trust_score?: number }>>(
        `/v1/messaging/brands`,
        data
      );
      // Backend returns { brand, message, tcr_brand_id, status, trust_score } structure
      return response.data.data as any;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to create brand';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update an existing brand
   */
  const updateBrand = async (id: string, data: UpdateBrandRequest): Promise<Brand10DLC> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.patch<APIResponse<Brand10DLC>>(
        `/v1/messaging/brands/${id}`,
        data
      );
      if (!response.data.data) {
        throw new Error('Failed to update brand');
      }
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to update brand';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get vetting status for a brand
   */
  const getVettingStatus = async (id: string): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<any>>(`/v1/messaging/brands/${id}/vetting`);
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get vetting status';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Request external vetting for a brand
   */
  const requestVetting = async (
    id: string,
    provider: string,
    vettingClass: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`/v1/messaging/brands/${id}/vetting`, {
        provider,
        vetting_class: vettingClass,
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to request vetting';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resubmit brand for verification after updating core identity fields
   * Required after updating: companyName, ein (tax_id), or entityType
   */
  const resubmitBrand = async (id: string): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<APIResponse<any>>(
        `/v1/messaging/brands/${id}/resubmit`
      );
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to resubmit brand';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    listBrands,
    getBrand,
    createBrand,
    updateBrand,
    getVettingStatus,
    requestVetting,
    resubmitBrand,
  };
}
