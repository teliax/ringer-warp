import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://api.rns.ringer.tel';

interface DashboardStats {
  total_customers: number;
  active_customers: number;
  total_revenue: number;
  monthly_growth: number;
  active_vendors: number;
  support_tickets: number;
}

interface UserInfo {
  user_id: string;
  email: string;
  user_type: string;
  name: string;
}

async function fetchWithAuth(url: string) {
  const token = localStorage.getItem('access_token');
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data; // Unwrap from APIResponse format
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => fetchWithAuth(`${API_URL}/v1/dashboard/stats`),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useCurrentUser() {
  return useQuery<UserInfo>({
    queryKey: ['user', 'me'],
    queryFn: () => fetchWithAuth(`${API_URL}/v1/dashboard/me`),
    staleTime: 300000, // 5 minutes
  });
}

