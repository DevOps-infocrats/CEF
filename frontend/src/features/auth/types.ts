export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  username?: string;
  approval_status: 'PENDING_APPROVAL' | 'APPROVED' | 'DISABLED' | string;
  is_active: boolean;
  is_verified: boolean;
  roles: string[];
  permissions: string[];
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    details: unknown;
  };
}

export interface AuthResponseData {
  user: User;
  token_type: string;
  access_token: string;
}
