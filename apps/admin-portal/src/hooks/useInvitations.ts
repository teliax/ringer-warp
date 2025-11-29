import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

// Types
export interface Invitation {
  id: string;
  token?: string; // Only included on creation
  email: string;
  user_type: string;
  user_type_description?: string;
  customer: {
    id: string;
    ban: string;
    company_name: string;
  };
  role: string;
  invited_by: {
    name: string;
    email: string;
  };
  message?: string;
  expires_at: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  sent_at: string;
  accepted_at?: string;
}

export interface CreateInvitationRequest {
  email: string;
  user_type: 'customer_admin' | 'developer' | 'billing' | 'viewer';
  role: 'USER' | 'ADMIN' | 'OWNER';
  message?: string;
}

export interface AcceptInvitationRequest {
  google_id: string;
  email: string;
  name: string;
}

export interface AcceptInvitationResponse {
  user: {
    id: string;
    email: string;
    name: string;
    user_type: string;
  };
  customer_access: {
    customer_id: string;
    company_name: string;
    ban: string;
    role: string;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
}

export interface InvitationListResponse {
  items: Invitation[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}

// API client with auth token
const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API functions
const createInvitation = async (customerId: string, data: CreateInvitationRequest): Promise<Invitation> => {
  const response = await api.post<{ success: boolean; data: Invitation }>(
    `/v1/admin/customers/${customerId}/invitations`,
    data
  );
  return response.data.data;
};

const listInvitations = async (
  status?: string,
  page = 1,
  perPage = 20
): Promise<InvitationListResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
  });
  if (status) {
    params.append('status', status);
  }

  const response = await api.get<{ success: boolean; data: InvitationListResponse }>(
    `/v1/admin/invitations?${params.toString()}`
  );
  return response.data.data;
};

const revokeInvitation = async (invitationId: string): Promise<void> => {
  await api.delete(`/v1/admin/invitations/${invitationId}`);
};

const resendInvitation = async (invitationId: string): Promise<void> => {
  await api.post(`/v1/admin/invitations/${invitationId}/resend`);
};

// Public endpoints (no auth)
const getInvitationByToken = async (token: string): Promise<Invitation> => {
  const response = await axios.get<{ success: boolean; data: Invitation }>(
    `${API_URL}/invitations/${token}`
  );
  return response.data.data;
};

const acceptInvitation = async (
  token: string,
  data: AcceptInvitationRequest
): Promise<AcceptInvitationResponse> => {
  const response = await axios.post<{ success: boolean; data: AcceptInvitationResponse }>(
    `${API_URL}/invitations/${token}/accept`,
    data
  );
  return response.data.data;
};

// React Query Hooks

/**
 * Hook to fetch paginated list of invitations
 */
export const useInvitations = (
  status?: string,
  page = 1,
  perPage = 20,
  options?: Omit<UseQueryOptions<InvitationListResponse>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['invitations', status, page, perPage],
    queryFn: () => listInvitations(status, page, perPage),
    staleTime: 10000, // 10 seconds
    ...options,
  });
};

/**
 * Hook to fetch invitation by token (PUBLIC)
 */
export const useInvitation = (
  token: string,
  options?: Omit<UseQueryOptions<Invitation>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: () => getInvitationByToken(token),
    enabled: !!token,
    retry: false, // Don't retry on 404/410
    ...options,
  });
};

/**
 * Hook to create invitation
 */
export const useCreateInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, data }: { customerId: string; data: CreateInvitationRequest }) =>
      createInvitation(customerId, data),
    onSuccess: () => {
      // Invalidate invitation list
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
};

/**
 * Hook to revoke invitation
 */
export const useRevokeInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
};

/**
 * Hook to resend invitation
 */
export const useResendInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => resendInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
};

/**
 * Hook to accept invitation (PUBLIC)
 */
export const useAcceptInvitation = () => {
  return useMutation({
    mutationFn: ({ token, data }: { token: string; data: AcceptInvitationRequest }) =>
      acceptInvitation(token, data),
  });
};
