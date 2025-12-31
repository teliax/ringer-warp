import { useState } from 'react';
import axios from 'axios';
import type {
  Campaign10DLC,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  ResubmitCampaignRequest,
  ResubmitCampaignResponse,
  CampaignMNOStatus,
  CampaignPhoneNumber,
  AssignNumbersRequest,
  APIResponse,
  ListResponse,
} from '@/types/messaging';

export function useCampaigns() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * List all campaigns for the current customer
   */
  const listCampaigns = async (
    brandId?: string,
    status?: string,
    page: number = 1,
    perPage: number = 100
  ): Promise<Campaign10DLC[]> => {
    setLoading(true);
    setError(null);
    try {
      let url = `/v1/messaging/campaigns?page=${page}&per_page=${perPage}`;
      if (brandId) url += `&brand_id=${brandId}`;
      if (status) url += `&status=${status}`;

      const response = await axios.get<APIResponse<ListResponse<Campaign10DLC>>>(url);
      return response.data.data?.items || [];
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to list campaigns';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get a single campaign by ID
   */
  const getCampaign = async (id: string): Promise<Campaign10DLC> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<Campaign10DLC>>(
        `/v1/messaging/campaigns/${id}`
      );
      if (!response.data.data) {
        throw new Error('Campaign not found');
      }
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get campaign';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a new campaign registration
   */
  const createCampaign = async (data: CreateCampaignRequest): Promise<Campaign10DLC> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<APIResponse<{ campaign: Campaign10DLC; message: string }>>(
        `/v1/messaging/campaigns`,
        data
      );
      // Backend returns { campaign, message } structure
      return response.data.data?.campaign || response.data.data as any;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to create campaign';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update an existing campaign
   * Only REJECTED or PENDING campaigns can be updated
   */
  const updateCampaign = async (
    id: string,
    data: UpdateCampaignRequest
  ): Promise<Campaign10DLC> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.patch<APIResponse<{ campaign: Campaign10DLC; message: string }>>(
        `/v1/messaging/campaigns/${id}`,
        data
      );
      // Backend returns { campaign, message } structure
      return response.data.data?.campaign || response.data.data as any;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to update campaign';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resubmit a rejected campaign for carrier re-review
   * Call this after updating campaign fields to address rejection reasons
   */
  const resubmitCampaign = async (
    id: string,
    data?: ResubmitCampaignRequest
  ): Promise<ResubmitCampaignResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.put<APIResponse<ResubmitCampaignResponse>>(
        `/v1/messaging/campaigns/${id}/resubmit`,
        data || {}
      );
      if (!response.data.data) {
        throw new Error('Failed to resubmit campaign');
      }
      return response.data.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to resubmit campaign';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get MNO (carrier) status for a campaign
   * Returns approval status from T-Mobile, AT&T, Verizon, etc.
   */
  const getMNOStatus = async (campaignId: string): Promise<CampaignMNOStatus[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<{ campaign_id: string; mno_statuses: CampaignMNOStatus[] }>>(
        `/v1/messaging/campaigns/${campaignId}/mno-status`
      );
      return response.data.data?.mno_statuses || [];
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get MNO status';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Assign phone numbers to a campaign
   */
  const assignNumbers = async (campaignId: string, phoneNumbers: string[]): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(
        `/v1/messaging/campaigns/${campaignId}/numbers`,
        { phone_numbers: phoneNumbers } as AssignNumbersRequest
      );
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to assign numbers';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Remove phone numbers from a campaign
   */
  const removeNumbers = async (campaignId: string, phoneNumbers: string[]): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`/v1/messaging/campaigns/${campaignId}/numbers`, {
        data: { phone_numbers: phoneNumbers } as AssignNumbersRequest,
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to remove numbers';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get phone numbers assigned to a campaign
   */
  const getAssignedNumbers = async (campaignId: string): Promise<CampaignPhoneNumber[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<{ campaign_id: string; phone_numbers: CampaignPhoneNumber[]; count: number }>>(
        `/v1/messaging/campaigns/${campaignId}/numbers`
      );
      return response.data.data?.phone_numbers || [];
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get assigned numbers';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    listCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    resubmitCampaign,
    getMNOStatus,
    assignNumbers,
    removeNumbers,
    getAssignedNumbers,
  };
}
