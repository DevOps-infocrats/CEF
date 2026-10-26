import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useToast } from '@/components/Toast';
import { LoginFormData, RegisterFormData } from '../schemas';

export const AUTH_USER_QUERY_KEY = ['currentUser'];

export const useCurrentUser = () => {
  return useQuery({
    queryKey: AUTH_USER_QUERY_KEY,
    queryFn: authService.getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (credentials: LoginFormData) => authService.login(credentials),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, data.user);
      success(`Welcome back, ${data.user.full_name}`);
      navigate('/dashboard');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.details ||
        'Authentication failed. Please verify credentials.';
      error(msg);
    },
  });
};

export const useRegister = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (data: RegisterFormData) => authService.register(data),
    onSuccess: () => {
      success('Account registered! An administrator must approve your portal access before you can log in.');
      navigate('/login');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        'Registration failed. Please check details and try again.';
      error(msg);
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { info } = useToast();

  return useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, null);
      queryClient.clear();
      info('You have been logged out.');
      navigate('/login');
    },
    onError: () => {
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, null);
      navigate('/login');
    },
  });
};
