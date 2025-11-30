import axios from 'axios';
import type { User } from './userManagementService';

export interface UserType {
  id: string;
  type_name: string;
  description?: string;
  permissions: string[];
  user_count: number;
  has_wildcard_permission: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface PermissionMetadata {
  resource_path: string;
  category: string | null;
  display_name: string | null;
  description: string | null;
  display_order: number;
  is_deprecated: boolean;
  requires_wildcard: boolean;
  icon: string | null;
}

export interface CreateUserTypeRequest {
  type_name: string;
  description?: string;
}

export interface UpdatePermissionsRequest {
  resource_paths: string[];
}

export const userTypeService = {
  /**
   * List all user types
   */
  async listUserTypes(): Promise<UserType[]> {
    const response = await axios.get('/v1/admin/user-types');
    return response.data.data;
  },

  /**
   * Get user type by ID
   */
  async getUserTypeById(id: string): Promise<UserType> {
    const response = await axios.get(`/v1/admin/user-types/${id}`);
    return response.data.data;
  },

  /**
   * Create new user type
   */
  async createUserType(data: CreateUserTypeRequest): Promise<UserType> {
    const response = await axios.post('/v1/admin/user-types', data);
    return response.data.data;
  },

  /**
   * Update user type name and/or description
   */
  async updateUserType(id: string, data: CreateUserTypeRequest): Promise<UserType> {
    const response = await axios.put(`/v1/admin/user-types/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete user type (only if no users assigned)
   */
  async deleteUserType(id: string): Promise<void> {
    await axios.delete(`/v1/admin/user-types/${id}`);
  },

  /**
   * Get permissions for a user type
   */
  async getPermissions(id: string): Promise<string[]> {
    const response = await axios.get(`/v1/admin/user-types/${id}/permissions`);
    return response.data.data;
  },

  /**
   * Update permissions for a user type
   */
  async updatePermissions(id: string, resourcePaths: string[]): Promise<void> {
    await axios.put(`/v1/admin/user-types/${id}/permissions`, {
      resource_paths: resourcePaths,
    });
  },

  /**
   * Get users assigned to this user type
   */
  async getUsersByType(id: string): Promise<User[]> {
    const response = await axios.get(`/v1/admin/user-types/${id}/users`);
    return response.data.data;
  },

  /**
   * Get all available permissions with metadata
   */
  async getAvailablePermissions(): Promise<PermissionMetadata[]> {
    const response = await axios.get('/v1/gatekeeper/available-permissions');
    return response.data.data;
  },
};
