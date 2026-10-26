import { apiClient } from '@/api/apiClient';
import { ApiResponse, AuthResponseData, User } from '../types';
import { LoginFormData, RegisterFormData } from '../schemas';

export const authService = {
  login: async (credentials: LoginFormData): Promise<AuthResponseData> => {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>(
      '/auth/login',
      {
        email: credentials.email, // Can be username (Admin) or email
        password: credentials.password,
      }
    );
    return res.data.data;
  },

  register: async (payload: RegisterFormData): Promise<User> => {
    const res = await apiClient.post<ApiResponse<User>>('/auth/register', {
      email: payload.email,
      username: payload.username || undefined,
      password: payload.password,
      first_name: payload.firstName,
      last_name: payload.lastName,
    });
    return res.data.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<User>>('/auth/me');
    return res.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
