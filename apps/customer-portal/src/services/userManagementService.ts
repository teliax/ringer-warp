import axios from 'axios';

export interface User {
  id: string;
  email: string;
  display_name: string;
  google_id?: string;
  user_type_id: string;
  user_type: string;
  user_type_display_name?: string;
  last_login?: string;
  created_at: string;
  updated_at?: string;
  is_active?: boolean;
}

export interface UserRole {
  user_id: string;
  customer_id: string;
  role: 'USER' | 'ADMIN' | 'OWNER';
  granted_at?: string;
  granted_by?: string;
}

export interface InviteUserData {
  email: string;
  user_type: string;
  role: 'USER' | 'ADMIN' | 'OWNER';
  message?: string;
}

export const userManagementService = {
  /**
   * List all users for a specific customer
   */
  async listUsers(customerId: string): Promise<User[]> {
    const response = await axios.get(`/v1/customers/${customerId}/users`);
    return response.data.data;
  },

  /**
   * Update a user's role within a customer account
   */
  async updateUserRole(
    customerId: string,
    userId: string,
    role: 'USER' | 'ADMIN' | 'OWNER'
  ): Promise<void> {
    await axios.put(`/v1/customers/${customerId}/users/${userId}/role`, {
      role,
    });
  },

  /**
   * Remove a user from a customer account
   */
  async removeUser(customerId: string, userId: string): Promise<void> {
    await axios.delete(`/v1/customers/${customerId}/users/${userId}`);
  },

  /**
   * Invite a new user to a customer account
   */
  async inviteUser(customerId: string, data: InviteUserData): Promise<void> {
    await axios.post(`/v1/admin/customers/${customerId}/invitations`, data);
  },
};
