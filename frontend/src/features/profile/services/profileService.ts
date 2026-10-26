import { apiClient } from '@/api/apiClient';
import { ApiResponse } from '@/features/auth/types';
import {
  ChangePasswordFormData,
  PortalUser,
  CreateUserFormData,
  UpdateUserFormData,
  PermissionsCatalogResponse,
} from '../types';

export const profileService = {
  changePassword: async (data: ChangePasswordFormData): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.post<ApiResponse<{ message: string }>>('/auth/change-password', data);
    return res.data;
  },

  getUsers: async (): Promise<ApiResponse<PortalUser[]>> => {
    const res = await apiClient.get<ApiResponse<PortalUser[]>>('/auth/users');
    return res.data;
  },

  getPermissions: async (): Promise<ApiResponse<PermissionsCatalogResponse>> => {
    const res = await apiClient.get<ApiResponse<PermissionsCatalogResponse>>('/auth/permissions');
    return res.data;
  },

  approveUser: async (userId: string): Promise<ApiResponse<PortalUser>> => {
    const res = await apiClient.post<ApiResponse<PortalUser>>(`/auth/users/${userId}/approve`);
    return res.data;
  },

  disableUser: async (userId: string): Promise<ApiResponse<PortalUser>> => {
    const res = await apiClient.post<ApiResponse<PortalUser>>(`/auth/users/${userId}/disable`);
    return res.data;
  },

  createUser: async (data: CreateUserFormData): Promise<ApiResponse<PortalUser>> => {
    const res = await apiClient.post<ApiResponse<PortalUser>>('/auth/users', data);
    return res.data;
  },

  updateUser: async (userId: string, data: UpdateUserFormData): Promise<ApiResponse<PortalUser>> => {
    const res = await apiClient.patch<ApiResponse<PortalUser>>(`/auth/users/${userId}`, data);
    return res.data;
  },
};
