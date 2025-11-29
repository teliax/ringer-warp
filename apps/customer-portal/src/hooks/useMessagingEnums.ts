import { useState } from 'react';
import axios from 'axios';
import type {
  UseCaseInfo,
  EntityTypeInfo,
  VerticalInfo,
  MNOInfo,
  APIResponse,
} from '@/types/messaging';

export function useMessagingEnums() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get all available campaign use cases
   */
  const getUseCases = async (): Promise<UseCaseInfo[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<UseCaseInfo[]>>(`/v1/messaging/use-cases`);
      return response.data.data || [];
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get use cases';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get all valid entity types for brand registration
   */
  const getEntityTypes = async (): Promise<EntityTypeInfo[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<EntityTypeInfo[]>>(`/v1/messaging/entity-types`);
      return response.data.data || [];
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get entity types';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get all industry verticals
   */
  const getVerticals = async (): Promise<VerticalInfo[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<VerticalInfo[]>>(`/v1/messaging/verticals`);
      return response.data.data || [];
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get verticals';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get mobile network operators (carriers)
   */
  const getCarriers = async (): Promise<MNOInfo[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<MNOInfo[]>>(`/v1/messaging/carriers`);
      return response.data.data || [];
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get carriers';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get requirements for a specific use case
   */
  const getUseCaseRequirements = async (useCase: string): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<any>>(
        `/v1/messaging/use-case-requirements?use_case=${useCase}`
      );
      return response.data.data || {};
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get use case requirements';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get throughput estimate based on trust score
   */
  const getThroughputEstimate = async (
    trustScore: number,
    vetted: boolean = false
  ): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<APIResponse<any>>(
        `/v1/messaging/throughput-estimate?trust_score=${trustScore}&vetted=${vetted}`
      );
      return response.data.data || {};
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to get throughput estimate';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getUseCases,
    getEntityTypes,
    getVerticals,
    getCarriers,
    getUseCaseRequirements,
    getThroughputEstimate,
  };
}
