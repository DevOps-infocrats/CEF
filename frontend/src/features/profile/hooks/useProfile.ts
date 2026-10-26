import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService } from '../services/profileService';
import { useToast } from '@/components/Toast';
import { ChangePasswordFormData, CreateUserFormData, UpdateUserFormData } from '../types';

export const USERS_LIST_QUERY_KEY = ['admin', 'users'];
export const PERMISSIONS_CATALOG_QUERY_KEY = ['auth', 'permissions-catalog'];

export const useUsersList = () => {
  return useQuery({
    queryKey: USERS_LIST_QUERY_KEY,
    queryFn: async () => {
      const response = await profileService.getUsers();
      return response.data;
    },
  });
};

export const usePermissionsCatalog = () => {
  return useQuery({
    queryKey: PERMISSIONS_CATALOG_QUERY_KEY,
    queryFn: async () => {
      const response = await profileService.getPermissions();
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 min
  });
};

export const useApproveUser = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (userId: string) => profileService.approveUser(userId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: USERS_LIST_QUERY_KEY });
      success(res.message || 'User portal access approved successfully.');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to approve user access.';
      error(msg);
    },
  });
};

export const useDisableUser = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (userId: string) => profileService.disableUser(userId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: USERS_LIST_QUERY_KEY });
      success(res.message || 'User portal access disabled successfully.');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to disable user access.';
      error(msg);
    },
  });
};

export const useChangePassword = () => {
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (data: ChangePasswordFormData) => profileService.changePassword(data),
    onSuccess: (res) => {
      success(res.message || 'Password changed successfully!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to change password. Please check your current password.';
      error(msg);
    },
  });
};

export const useCreateUser = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (data: CreateUserFormData) => profileService.createUser(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: USERS_LIST_QUERY_KEY });
      success(res.message || 'New user account created and permissions assigned.');
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create user account.';
      error(msg);
    },
  });
};

export const useUpdateUser = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserFormData }) =>
      profileService.updateUser(userId, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: USERS_LIST_QUERY_KEY });
      success(res.message || 'User details and permissions updated.');
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to update user account.';
      error(msg);
    },
  });
};
