import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

interface HubSpotCompany {
  id: string;
  name: string;
  domain?: string;
  phone?: string;
  city?: string;
  state?: string;
  properties: Record<string, any>;
}

const getAuthToken = () => localStorage.getItem('access_token');

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function useHubSpotCompanySearch(searchTerm: string, debounceMs = 300) {
  const [companies, setCompanies] = useState<HubSpotCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setCompanies([]);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/v1/sync/hubspot/companies/search`, {
          params: { q: searchTerm },
        });

        setCompanies(response.data.data.companies || []);
      } catch (err: any) {
        console.error('HubSpot search error:', err);
        setError(err.response?.data?.error?.message || 'Search failed');
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  return { companies, loading, error };
}
