import { useState } from 'react';
import axios from 'axios';

export interface TrunkIP {
  id: string;
  trunk_group_id: string;
  ip_address: string;
  netmask: number;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrunkGroup {
  id: string;
  customer_id: string;
  name: string;
  description: string;
  auth_type: 'IP_ACL' | 'DIGEST' | 'BOTH';
  capacity_cps: number;
  capacity_concurrent_calls: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  ips: TrunkIP[];
}

export interface VendorOriginationIPs {
  region: string;
  ips: string[];
  note: string;
}

export function useTrunks(customerBAN?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Admin Endpoints (manage any customer's trunks)
  // ============================================================================

  const listCustomerTrunks = async (ban: string): Promise<TrunkGroup[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/v1/admin/customers/${ban}/trunks`);
      return response.data.trunks || [];
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to list trunks');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createTrunk = async (
    ban: string,
    data: {
      name: string;
      description?: string;
      auth_type: 'IP_ACL' | 'DIGEST' | 'BOTH';
      capacity_cps: number;
      capacity_concurrent_calls: number;
    }
  ): Promise<TrunkGroup> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`/v1/admin/customers/${ban}/trunks`, data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create trunk');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addTrunkIP = async (
    ban: string,
    trunkID: string,
    data: {
      ip_address: string;
      netmask?: number;
      description?: string;
    }
  ): Promise<TrunkIP> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `/v1/admin/customers/${ban}/trunks/${trunkID}/ips`,
        data
      );
      return response.data.ip;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add IP');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listTrunkIPs = async (ban: string, trunkID: string): Promise<TrunkIP[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `/v1/admin/customers/${ban}/trunks/${trunkID}/ips`
      );
      return response.data.ips || [];
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to list IPs');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTrunkIP = async (
    ban: string,
    trunkID: string,
    ipID: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`/v1/admin/customers/${ban}/trunks/${trunkID}/ips/${ipID}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete IP');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTrunkIP = async (
    ban: string,
    trunkID: string,
    ipID: string,
    data: { description?: string; enabled?: boolean }
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await axios.put(
        `/v1/admin/customers/${ban}/trunks/${trunkID}/ips/${ipID}`,
        data
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update IP');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTrunk = async (ban: string, trunkID: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`/v1/admin/customers/${ban}/trunks/${trunkID}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete trunk');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Customer Self-Service Endpoints
  // ============================================================================

  const listMyTrunks = async (): Promise<TrunkGroup[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/v1/customers/trunks');
      return response.data.trunks || [];
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to list trunks');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addMyTrunkIP = async (
    trunkID: string,
    data: {
      ip_address: string;
      netmask?: number;
      description?: string;
    }
  ): Promise<TrunkIP> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`/v1/customers/trunks/${trunkID}/ips`, data);
      return response.data.ip;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add IP');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteMyTrunkIP = async (trunkID: string, ipID: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`/v1/customers/trunks/${trunkID}/ips/${ipID}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete IP');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Network Information Endpoints
  // ============================================================================

  const getVendorOriginationIPs = async (): Promise<VendorOriginationIPs> => {
    try {
      const response = await axios.get('/v1/network/vendor-ips');
      return response.data;
    } catch (err: any) {
      throw err;
    }
  };

  const getCustomerIngressIPs = async () => {
    try {
      const response = await axios.get('/v1/network/ingress-ips');
      return response.data;
    } catch (err: any) {
      throw err;
    }
  };

  return {
    loading,
    error,
    // Admin operations
    listCustomerTrunks,
    createTrunk,
    addTrunkIP,
    listTrunkIPs,
    deleteTrunkIP,
    updateTrunkIP,
    deleteTrunk,
    // Customer self-service
    listMyTrunks,
    addMyTrunkIP,
    deleteMyTrunkIP,
    // Network information
    getVendorOriginationIPs,
    getCustomerIngressIPs,
  };
}
