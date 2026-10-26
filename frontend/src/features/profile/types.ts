export interface ChangePasswordFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface PermissionDefinition {
  code: string;
  name: string;
  category: string;
  description: string;
}

export interface PermissionPreset {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface PermissionsCatalogResponse {
  permissions: PermissionDefinition[];
  presets: PermissionPreset[];
}

export interface PortalUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  roles: string[];
  permissions: string[];
  is_active: boolean;
  approval_status: 'PENDING_APPROVAL' | 'APPROVED' | 'DISABLED' | string;
  created_at: string;
}

export interface CreateUserFormData {
  email: string;
  username?: string;
  first_name: string;
  last_name: string;
  password: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
  approval_status?: string;
}

export interface UpdateUserFormData {
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
  approval_status?: string;
}
