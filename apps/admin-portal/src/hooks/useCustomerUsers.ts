import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Customer User type matching backend response
export interface CustomerUser {
  id: string;
  email: string;
  display_name: string;
  photo_url?: string;
  user_type: string;
  is_active: boolean;
  role: "ADMIN" | "USER" | "VIEWER"; // Backend roles
  granted_at: string;
  granted_by?: string;
  last_login?: string;
}

// Frontend-specific type (for display purposes)
export interface CustomerUserDisplay {
  id: string;
  email: string;
  name: string;
  role: "customer_admin" | "developer" | "billing" | "viewer";
  status: "active" | "pending" | "inactive";
  lastLogin?: string;
  createdDate: string;
}

// Map backend role to frontend display role
function mapBackendRole(role: string, userType: string): CustomerUserDisplay["role"] {
  // Map based on user type and role
  if (userType === "customer_admin" || role === "ADMIN") {
    return "customer_admin";
  }
  if (userType === "developer") {
    return "developer";
  }
  if (userType === "billing") {
    return "billing";
  }
  return "viewer";
}

// Map frontend role to backend role
function mapFrontendRole(role: CustomerUserDisplay["role"]): string {
  switch (role) {
    case "customer_admin":
      return "ADMIN";
    case "developer":
    case "billing":
      return "USER";
    case "viewer":
      return "VIEWER";
    default:
      return "VIEWER";
  }
}

// Convert backend user to frontend display format
function toDisplayUser(user: CustomerUser): CustomerUserDisplay {
  return {
    id: user.id,
    email: user.email,
    name: user.display_name,
    role: mapBackendRole(user.role, user.user_type),
    status: user.is_active ? "active" : "inactive",
    lastLogin: user.last_login,
    createdDate: user.granted_at?.split('T')[0] || new Date().toISOString().split('T')[0],
  };
}

// Get all users for a customer (including pending invitations)
export function useCustomerUsers(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customerUsers", customerId],
    queryFn: async () => {
      if (!customerId) {
        throw new Error("Customer ID is required");
      }

      // Get active users
      const usersResponse = await api.get(`/v1/customers/${customerId}/users`);
      const users = usersResponse.data.data as CustomerUser[];
      const displayUsers = users.map(toDisplayUser);

      // Get pending invitations
      try {
        const invitationsResponse = await api.get(`/v1/admin/invitations`, {
          params: {
            customer_id: customerId,
            status: "pending",
          },
        });

        // Add pending invitations as "pending" users
        const invitations = invitationsResponse.data.data?.items || [];
        invitations.forEach((invitation: any) => {
          displayUsers.push({
            id: invitation.id,
            email: invitation.email,
            name: invitation.email, // Name not yet known for invitations
            role: mapBackendRole(invitation.role, invitation.user_type),
            status: "pending",
            lastLogin: undefined,
            createdDate: invitation.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          });
        });
      } catch (error) {
        // Ignore errors getting invitations, just return users
        console.warn("Failed to fetch invitations:", error);
      }

      return displayUsers;
    },
    enabled: !!customerId,
    retry: 1,
  });
}

// Remove user from customer
export function useRemoveCustomerUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, userId }: { customerId: string; userId: string }) => {
      const response = await api.delete(`/v1/customers/${customerId}/users/${userId}`);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the customer users query to refetch
      queryClient.invalidateQueries({ queryKey: ["customerUsers", variables.customerId] });
    },
  });
}

// Update user role
export function useUpdateCustomerUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      userId,
      role,
    }: {
      customerId: string;
      userId: string;
      role: CustomerUserDisplay["role"];
    }) => {
      const backendRole = mapFrontendRole(role);
      const response = await api.put(`/v1/customers/${customerId}/users/${userId}/role`, {
        role: backendRole,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the customer users query to refetch
      queryClient.invalidateQueries({ queryKey: ["customerUsers", variables.customerId] });
    },
  });
}

// Check if there are any pending invitations for the customer
export function useCustomerInvitations(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customerInvitations", customerId],
    queryFn: async () => {
      if (!customerId) {
        throw new Error("Customer ID is required");
      }
      // Get invitations for this customer
      const response = await api.get(`/v1/admin/invitations`, {
        params: {
          customer_id: customerId,
          status: "pending",
        },
      });
      return response.data.data;
    },
    enabled: !!customerId,
  });
}