import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import {
  useUsersList,
  useApproveUser,
  useDisableUser,
  useChangePassword,
  useCreateUser,
  useUpdateUser,
  usePermissionsCatalog,
} from '../hooks/useProfile';
import { GlassCard } from '@/components/GlassCard';
import { GlassInput } from '@/components/GlassInput';
import { GlassButton } from '@/components/GlassButton';
import { PortalUser, PermissionDefinition } from '../types';
import {
  User,
  Lock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  UserPlus,
  Eye,
  EyeOff,
  Search,
  KeyRound,
  Mail,
  UserCheck,
  MapPin,
  SlidersHorizontal,
  ArrowLeft,
  AlertTriangle,
  FileEdit,
  FileCheck,
  FileText,
  FileCheck2,
} from 'lucide-react';
import { AdminLocationManager } from '@/features/locations/components/AdminLocationManager';
import { MasterTemplateTab } from '../components/MasterTemplateTab';

export const ProfileSettingsPage: React.FC = () => {
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const isAdmin = currentUser?.roles?.includes('admin') || currentUser?.permissions?.includes('users:manage') || false;
  const canManageTemplates = isAdmin || currentUser?.permissions?.includes('candidates:approve') || false;
  const canViewManagementSection = isAdmin || canManageTemplates;

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [adminTab, setAdminTab] = useState<'users' | 'locations' | 'loi' | 'offer_letter'>(() => {
    if (initialTab === 'locations' && isAdmin) return 'locations';
    if (initialTab === 'loi' || initialTab === 'letter_of_intent') return 'loi';
    if (initialTab === 'offer_letter' || initialTab === 'offer') return 'offer_letter';
    return isAdmin ? 'users' : 'loi';
  });

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Admin user management state
  const [searchQuery, setSearchQuery] = useState('');
  const [userViewMode, setUserViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('data_entry');
  const [newUserForm, setNewUserForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',
    role: 'staff',
    permissions: [
      'portal:access',
      'candidates:read',
      'candidates:create',
      'candidates:edit',
      'candidates:submit',
    ],
    is_active: true,
  });
  const [newUserError, setNewUserError] = useState('');

  // Edit user state
  const [editingUser, setEditingUser] = useState<PortalUser | null>(null);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editUserPreset, setEditUserPreset] = useState<string>('custom');
  const [editUserForm, setEditUserForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',
    role: 'staff',
    permissions: [] as string[],
    is_active: true,
    approval_status: 'APPROVED',
  });
  const [editUserError, setEditUserError] = useState('');

  // Hooks
  const { data: users, isLoading: isUsersLoading } = useUsersList();
  const { data: permissionsCatalog } = usePermissionsCatalog();
  const approveMutation = useApproveUser();
  const disableMutation = useDisableUser();
  const changePasswordMutation = useChangePassword();

  const createUserMutation = useCreateUser(() => {
    setUserViewMode('list');
    setNewUserForm({
      first_name: '',
      last_name: '',
      email: '',
      username: '',
      password: '',
      role: 'staff',
      permissions: [
        'portal:access',
        'candidates:read',
        'candidates:create',
        'candidates:edit',
        'candidates:submit',
      ],
      is_active: true,
    });
    setNewUserError('');
  });

  const updateUserMutation = useUpdateUser(() => {
    setUserViewMode('list');
    setEditingUser(null);
    setEditUserError('');
  });

  // Group permissions by category
  const groupedPermissions = useMemo(() => {
    const catalog = permissionsCatalog?.permissions || [];
    const groups: Record<string, PermissionDefinition[]> = {};
    catalog.forEach((perm) => {
      const cat = perm.category || 'General';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(perm);
    });
    return groups;
  }, [permissionsCatalog]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    changePasswordMutation.mutate(
      {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
      }
    );
  };

  const handlePresetChange = (presetId: string, isEditing: boolean) => {
    if (isEditing) {
      setEditUserPreset(presetId);
      if (presetId === 'custom') return;
      const preset = permissionsCatalog?.presets?.find((p) => p.id === presetId);
      if (preset) {
        setEditUserForm((prev) => ({
          ...prev,
          permissions: [...preset.permissions],
        }));
      }
    } else {
      setSelectedPreset(presetId);
      if (presetId === 'custom') return;
      const preset = permissionsCatalog?.presets?.find((p) => p.id === presetId);
      if (preset) {
        setNewUserForm((prev) => ({
          ...prev,
          permissions: [...preset.permissions],
        }));
      }
    }
  };

  const togglePermission = (code: string, isEditing: boolean) => {
    if (isEditing) {
      setEditUserPreset('custom');
      setEditUserForm((prev) => {
        const current = new Set(prev.permissions);
        if (current.has(code)) {
          current.delete(code);
        } else {
          current.add(code);
        }
        return { ...prev, permissions: Array.from(current) };
      });
    } else {
      setSelectedPreset('custom');
      setNewUserForm((prev) => {
        const current = new Set(prev.permissions);
        if (current.has(code)) {
          current.delete(code);
        } else {
          current.add(code);
        }
        return { ...prev, permissions: Array.from(current) };
      });
    }
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError('');

    if (
      !newUserForm.first_name?.trim() ||
      !newUserForm.last_name?.trim() ||
      !newUserForm.email?.trim() ||
      !newUserForm.password
    ) {
      setNewUserError('First name, last name, email, and password are required.');
      return;
    }
    if (newUserForm.password.length < 8) {
      setNewUserError('Password must be at least 8 characters long.');
      return;
    }

    const trimmedUsername = newUserForm.username?.trim();
    const payload = {
      first_name: newUserForm.first_name.trim(),
      last_name: newUserForm.last_name.trim(),
      email: newUserForm.email.trim().toLowerCase(),
      username: trimmedUsername && trimmedUsername.length > 0 ? trimmedUsername : undefined,
      password: newUserForm.password,
      role: newUserForm.role || 'staff',
      permissions: newUserForm.permissions,
      is_active: newUserForm.is_active ?? true,
      approval_status: 'APPROVED',
    };

    createUserMutation.mutate(payload, {
      onError: (err: any) => {
        setNewUserError(err?.response?.data?.message || 'Failed to create user.');
      },
    });
  };

  const handleOpenCreateUser = () => {
    setNewUserError('');
    setShowNewUserPassword(false);
    setSelectedPreset('data_entry');
    setNewUserForm({
      first_name: '',
      last_name: '',
      email: '',
      username: '',
      password: '',
      role: 'staff',
      permissions: [
        'portal:access',
        'candidates:read',
        'candidates:create',
        'candidates:edit',
        'candidates:submit',
      ],
      is_active: true,
    });
    setUserViewMode('create');
  };

  const openEditUserModal = (user: PortalUser) => {
    setEditingUser(user);
    setEditUserPreset('custom');
    setEditUserError('');
    setShowEditPassword(false);
    setEditUserForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      username: user.username || '',
      password: '',
      role: user.roles?.[0] || 'staff',
      permissions: user.permissions || [],
      is_active: user.is_active,
      approval_status: user.approval_status,
    });
    setUserViewMode('edit');
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserError('');

    if (!editUserForm.first_name?.trim() || !editUserForm.last_name?.trim() || !editUserForm.email?.trim()) {
      setEditUserError('First name, last name, and email are required.');
      return;
    }

    if (editUserForm.password && editUserForm.password.length < 8) {
      setEditUserError('If setting a new password, it must be at least 8 characters long.');
      return;
    }

    const trimmedUsername = editUserForm.username?.trim();
    const payload: any = {
      first_name: editUserForm.first_name.trim(),
      last_name: editUserForm.last_name.trim(),
      email: editUserForm.email.trim().toLowerCase(),
      username: trimmedUsername && trimmedUsername.length > 0 ? trimmedUsername : undefined,
      role: editUserForm.role,
      permissions: editUserForm.permissions,
      is_active: editUserForm.is_active,
      approval_status: editUserForm.is_active ? 'APPROVED' : 'DISABLED',
    };

    if (editUserForm.password) {
      payload.password = editUserForm.password;
    }

    updateUserMutation.mutate(
      {
        userId: editingUser.id,
        data: payload,
      },
      {
        onError: (err: any) => {
          setEditUserError(err?.response?.data?.message || 'Failed to update user.');
        },
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved / Active
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Disabled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  // Render capability tags for quick identification of data entry vs verification vs decision access
  const renderCapabilityBadges = (user: PortalUser) => {
    const perms = user.permissions || [];
    const isDataEntry = perms.includes('candidates:create') || perms.includes('candidates:edit');
    const isVerifier = perms.includes('documents:verify');
    const isApprover = perms.includes('candidates:approve');
    const isRejecter = perms.includes('candidates:reject');
    const isManager = perms.includes('users:manage') || user.roles?.includes('admin');

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {isDataEntry && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
            <FileEdit className="w-3 h-3 text-indigo-600" />
            Data Entry
          </span>
        )}
        {isVerifier && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
            <FileCheck className="w-3 h-3 text-amber-600" />
            Verifier
          </span>
        )}
        {isApprover && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Approver
          </span>
        )}
        {isRejecter && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200/80">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejecter
          </span>
        )}
        {isManager && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200/80">
            <Shield className="w-3 h-3 text-purple-600" />
            Admin
          </span>
        )}
        <span className="text-[10px] text-slate-400 font-mono px-1">
          ({perms.length} {perms.length === 1 ? 'perm' : 'perms'})
        </span>
      </div>
    );
  };

  const filteredUsers = (users || []).filter((u) => {
    const q = searchQuery.toLowerCase();
    const hasPerm = (u.permissions || []).some((p) => p.toLowerCase().includes(q));
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.approval_status?.toLowerCase().includes(q) ||
      hasPerm
    );
  });

  if (isUserLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-fade-in">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <KeyRound className="w-7 h-7 text-indigo-600" />
          Profile & Account Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your account credentials, security preferences, and portal access approvals.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account Profile Details */}
        <div className="lg:col-span-1 space-y-6">
          <GlassCard className="bg-white/95 border-slate-200 shadow-md">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-lg shadow-inner">
                {currentUser?.first_name?.charAt(0) || 'U'}
                {currentUser?.last_name?.charAt(0) || ''}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {currentUser?.full_name || 'Portal User'}
                </h2>
                <p className="text-xs text-slate-500">{currentUser?.email}</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Username / Login ID</span>
                <span className="font-semibold text-slate-800">
                  {currentUser?.username || currentUser?.email}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Portal Roles</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {currentUser?.roles?.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium uppercase tracking-wider"
                    >
                      <Shield className="w-3 h-3 text-indigo-600" />
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Assigned Capabilities</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {currentUser?.permissions && currentUser.permissions.length > 0 ? (
                    currentUser.permissions.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                      >
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 text-[11px] italic">Default role permissions</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Portal Access Status</span>
                <div className="mt-1">
                  {getStatusBadge(currentUser?.approval_status || 'APPROVED')}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Account Member Since</span>
                <span className="text-slate-700 font-medium">
                  {currentUser?.created_at
                    ? new Date(currentUser.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Active'}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Security Overview Tip */}
          <GlassCard className="bg-indigo-50/60 border-indigo-200">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-indigo-900">
                  Credential Security & Audit
                </h4>
                <p className="text-xs text-indigo-800/90 mt-1 leading-relaxed">
                  Your credentials are protected with Argon2 password hashing. All permission updates
                  and account actions are logged to the immutable compliance audit trail.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Change Password */}
        <div className="lg:col-span-2">
          <GlassCard className="bg-white/95 border-slate-200 shadow-md">
            <div className="border-b border-slate-100 pb-4 mb-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                Change Password
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Update your account login password. You must provide your existing password for verification.
              </p>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 font-medium">{passwordError}</p>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
              <GlassInput
                label="Current Password"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-indigo-600" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="p-1 text-slate-400 hover:text-indigo-700 transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <GlassInput
                label="New Password (min. 8 characters)"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftIcon={<KeyRound className="w-4 h-4 text-indigo-600" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="p-1 text-slate-400 hover:text-indigo-700 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <GlassInput
                label="Confirm New Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<KeyRound className="w-4 h-4 text-indigo-600" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="p-1 text-slate-400 hover:text-indigo-700 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <div className="pt-2">
                <GlassButton
                  type="submit"
                  variant="primary"
                  isLoading={changePasswordMutation.isPending}
                >
                  Update Password
                </GlassButton>
              </div>
            </form>
          </GlassCard>
        </div>
      </div>

      {/* Admin Management Section */}
      {canViewManagementSection && (
        <div className="pt-6">
          <GlassCard className="bg-white/95 border-slate-200 shadow-md">
            {/* Admin Section Tabs */}
            <div className="flex items-center gap-4 border-b border-slate-200/80 mb-5 overflow-x-auto">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setAdminTab('users')}
                  className={`flex items-center gap-2 pb-3.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                    adminTab === 'users'
                      ? 'border-indigo-600 text-indigo-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Portal Users & Permissions</span>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setAdminTab('locations')}
                  className={`flex items-center gap-2 pb-3.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                    adminTab === 'locations'
                      ? 'border-indigo-600 text-indigo-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Location Master</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAdminTab('loi')}
                className={`flex items-center gap-2 pb-3.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  adminTab === 'loi'
                    ? 'border-indigo-600 text-indigo-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Letter of Intent</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('offer_letter')}
                className={`flex items-center gap-2 pb-3.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  adminTab === 'offer_letter'
                    ? 'border-indigo-600 text-indigo-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Offer Letter</span>
              </button>
            </div>

            {/* TAB 1: USERS & PERMISSIONS */}
            {adminTab === 'users' && userViewMode === 'list' && (
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-indigo-600" />
                      Dynamic User & Permission Management
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create login accounts, assign specific operational permissions, and control access boundaries.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search by name, login, permission..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all bg-white"
                      />
                    </div>

                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={handleOpenCreateUser}
                      leftIcon={<UserPlus className="w-4 h-4" />}
                    >
                      Create User
                    </GlassButton>
                  </div>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50/80 text-slate-700 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Username / Login ID</th>
                        <th className="py-3 px-4">Operational Capabilities</th>
                        <th className="py-3 px-4">Access Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isUsersLoading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <p className="mt-2 text-xs">Loading portal users...</p>
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No users found matching your criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => {
                          const isCurrentUser = user.id === currentUser?.id;
                          const isPending = user.approval_status === 'PENDING_APPROVAL';
                          const isApproved = user.approval_status === 'APPROVED' && user.is_active;
                          const isDisabled = user.approval_status === 'DISABLED' || !user.is_active;

                          return (
                            <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                  <span>{user.full_name || `${user.first_name} ${user.last_name}`}</span>
                                  {isCurrentUser && (
                                    <span className="px-1.5 py-0.5 text-[10px] bg-indigo-100 text-indigo-800 rounded font-medium">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                                  <Mail className="w-3 h-3" />
                                  {user.email}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-700">
                                {user.username || user.email}
                              </td>
                              <td className="py-3.5 px-4">
                                {renderCapabilityBadges(user)}
                              </td>
                              <td className="py-3.5 px-4">
                                {getStatusBadge(user.approval_status)}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <GlassButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openEditUserModal(user)}
                                    leftIcon={<SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />}
                                    title="Edit user details and assign permissions"
                                  >
                                    Permissions
                                  </GlassButton>

                                  {!isCurrentUser && (
                                    <>
                                      {(isPending || isDisabled) && (
                                        <GlassButton
                                          variant="primary"
                                          size="sm"
                                          onClick={() => approveMutation.mutate(user.id)}
                                          isLoading={
                                            approveMutation.isPending &&
                                            approveMutation.variables === user.id
                                          }
                                          leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                        >
                                          Approve
                                        </GlassButton>
                                      )}
                                      {isApproved && (
                                        <GlassButton
                                          variant="danger"
                                          size="sm"
                                          onClick={() => disableMutation.mutate(user.id)}
                                          isLoading={
                                            disableMutation.isPending &&
                                            disableMutation.variables === user.id
                                          }
                                          leftIcon={<XCircle className="w-3.5 h-3.5" />}
                                        >
                                          Disable
                                        </GlassButton>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAGE-LIKE STRUCTURE: CREATE PORTAL USER */}
            {adminTab === 'users' && userViewMode === 'create' && (
              <form onSubmit={handleCreateUserSubmit} className="space-y-6 animate-fade-in">
                {/* Header Banner with Navigation and Action Buttons */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setUserViewMode('list');
                        setNewUserError('');
                      }}
                      className="p-2 text-slate-500 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all"
                      title="Back to Users List"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                        <span>Portal Users & Permissions</span>
                        <span>/</span>
                        <span className="text-indigo-600 font-bold">New User Account</span>
                      </div>
                      <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                        Create Portal User & Assign Permissions
                      </h2>
                      <p className="text-xs text-slate-500">
                        Set up credentials, assign role profiles, and configure granular operational boundaries.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                    <GlassButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setUserViewMode('list');
                        setNewUserError('');
                      }}
                    >
                      Cancel
                    </GlassButton>
                    <GlassButton
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={createUserMutation.isPending}
                      leftIcon={<UserPlus className="w-4 h-4" />}
                    >
                      Create Account
                    </GlassButton>
                  </div>
                </div>

                {newUserError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2 shadow-2xs">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{newUserError}</span>
                  </div>
                )}

                {/* Two-Column Responsive Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Account Details (5 cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
                      <div className="border-b border-slate-200/80 pb-3">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <User className="w-4 h-4 text-indigo-600" />
                          User Profile & Credentials
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Basic identity information and secure login credentials.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <GlassInput
                          label="First Name"
                          placeholder="e.g. Rahul"
                          leftIcon={<User className="w-4 h-4 text-indigo-600" />}
                          value={newUserForm.first_name}
                          onChange={(e) =>
                            setNewUserForm({ ...newUserForm, first_name: e.target.value })
                          }
                        />
                        <GlassInput
                          label="Last Name"
                          placeholder="e.g. Sharma"
                          leftIcon={<User className="w-4 h-4 text-indigo-600" />}
                          value={newUserForm.last_name}
                          onChange={(e) =>
                            setNewUserForm({ ...newUserForm, last_name: e.target.value })
                          }
                        />
                      </div>

                      <GlassInput
                        label="Email Address"
                        type="email"
                        placeholder="rahul@example.com"
                        leftIcon={<Mail className="w-4 h-4 text-indigo-600" />}
                        value={newUserForm.email}
                        onChange={(e) =>
                          setNewUserForm({ ...newUserForm, email: e.target.value })
                        }
                      />

                      <GlassInput
                        label="Username / Login ID"
                        placeholder="e.g. rahul_ops"
                        leftIcon={<UserCheck className="w-4 h-4 text-indigo-600" />}
                        value={newUserForm.username}
                        onChange={(e) =>
                          setNewUserForm({ ...newUserForm, username: e.target.value })
                        }
                      />

                      <GlassInput
                        label="Initial Password (min. 8 characters)"
                        type={showNewUserPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        leftIcon={<Lock className="w-4 h-4 text-indigo-600" />}
                        rightIcon={
                          <button
                            type="button"
                            onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                            className="p-1 text-slate-400 hover:text-indigo-700 transition-colors"
                          >
                            {showNewUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        }
                        value={newUserForm.password}
                        onChange={(e) =>
                          setNewUserForm({ ...newUserForm, password: e.target.value })
                        }
                      />

                      <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-start gap-2.5 text-xs text-indigo-900">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-bold">Argon2 Security Standard</p>
                          <p className="text-[11px] text-indigo-800/90 leading-relaxed">
                            Credentials are encrypted with Argon2 password hashing. All capability assignments are audited in compliance logs.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Capabilities & Permissions Matrix (7 cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                            Operational Capabilities & Permissions
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Select a preset profile or pick individual operational permissions below.
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 self-start sm:self-auto">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                          {newUserForm.permissions.length} Selected
                        </span>
                      </div>

                      {/* Preset Selector */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-800 tracking-wide">
                          Permission Preset / Profile
                        </label>
                        <select
                          value={selectedPreset}
                          onChange={(e) => handlePresetChange(e.target.value, false)}
                          className="w-full bg-slate-50 text-slate-900 text-xs font-medium rounded-xl px-3.5 py-2.5 transition-all border border-slate-200 hover:border-indigo-400 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        >
                          {permissionsCatalog?.presets?.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.description}
                            </option>
                          ))}
                          <option value="custom">Custom Permissions Configuration</option>
                        </select>
                      </div>

                      {/* Granular Categories Checklist */}
                      <div className="space-y-4 pt-1">
                        {Object.entries(groupedPermissions).map(([category, perms]) => (
                          <div key={category} className="space-y-2 p-3.5 rounded-xl bg-slate-50/60 border border-slate-200/70">
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                                {category}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {perms.filter((p) => newUserForm.permissions.includes(p.code)).length} of {perms.length} enabled
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                              {perms.map((p) => {
                                const isChecked = newUserForm.permissions.includes(p.code);
                                return (
                                  <label
                                    key={p.code}
                                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                                      isChecked
                                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-medium shadow-2xs'
                                        : 'bg-white border-slate-200/90 text-slate-600 hover:border-slate-300'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => togglePermission(p.code, false)}
                                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="leading-tight font-semibold text-slate-900">{p.name}</p>
                                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                        {p.description}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Footer Action Bar */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-slate-200/80">
                        <span className="text-xs text-slate-500 font-medium">
                          Configured capabilities: <strong className="text-slate-800">{newUserForm.permissions.length} operational items</strong>
                        </span>
                        <div className="flex items-center gap-2.5 self-end sm:self-auto">
                          <GlassButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setUserViewMode('list');
                              setNewUserError('');
                            }}
                          >
                            Cancel
                          </GlassButton>
                          <GlassButton
                            type="submit"
                            variant="primary"
                            size="sm"
                            isLoading={createUserMutation.isPending}
                            leftIcon={<UserPlus className="w-4 h-4" />}
                          >
                            Create Account
                          </GlassButton>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* PAGE-LIKE STRUCTURE: EDIT PORTAL USER & PERMISSIONS */}
            {adminTab === 'users' && userViewMode === 'edit' && editingUser && (
              <form onSubmit={handleEditUserSubmit} className="space-y-6 animate-fade-in">
                {/* Header Banner with Navigation and Action Buttons */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setUserViewMode('list');
                        setEditingUser(null);
                        setEditUserError('');
                      }}
                      className="p-2 text-slate-500 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all"
                      title="Back to Users List"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                        <span>Portal Users & Permissions</span>
                        <span>/</span>
                        <span className="text-indigo-600 font-bold">Edit Account Boundaries</span>
                      </div>
                      <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                        Configure Permissions: {editingUser.full_name || editingUser.email}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Update personal details, reset credentials, or adjust exact operational access boundaries.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                    <GlassButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setUserViewMode('list');
                        setEditingUser(null);
                        setEditUserError('');
                      }}
                    >
                      Cancel
                    </GlassButton>
                    <GlassButton
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={updateUserMutation.isPending}
                    >
                      Save Changes
                    </GlassButton>
                  </div>
                </div>

                {editUserError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2 shadow-2xs">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{editUserError}</span>
                  </div>
                )}

                {editingUser.id === currentUser?.id && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5 shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      You are editing your own administrator account. You cannot disable yourself or remove your primary administrative capabilities.
                    </span>
                  </div>
                )}

                {/* Two-Column Responsive Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Account Details (5 cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
                      <div className="border-b border-slate-200/80 pb-3">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <User className="w-4 h-4 text-indigo-600" />
                          Account Information & Status
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Personal information and portal authentication settings.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <GlassInput
                          label="First Name"
                          placeholder="First name"
                          leftIcon={<User className="w-4 h-4 text-indigo-600" />}
                          value={editUserForm.first_name}
                          onChange={(e) =>
                            setEditUserForm({ ...editUserForm, first_name: e.target.value })
                          }
                        />
                        <GlassInput
                          label="Last Name"
                          placeholder="Last name"
                          leftIcon={<User className="w-4 h-4 text-indigo-600" />}
                          value={editUserForm.last_name}
                          onChange={(e) =>
                            setEditUserForm({ ...editUserForm, last_name: e.target.value })
                          }
                        />
                      </div>

                      <GlassInput
                        label="Email Address"
                        type="email"
                        placeholder="user@example.com"
                        leftIcon={<Mail className="w-4 h-4 text-indigo-600" />}
                        value={editUserForm.email}
                        onChange={(e) =>
                          setEditUserForm({ ...editUserForm, email: e.target.value })
                        }
                      />

                      <GlassInput
                        label="Username / Login ID"
                        placeholder="Username"
                        leftIcon={<UserCheck className="w-4 h-4 text-indigo-600" />}
                        value={editUserForm.username}
                        onChange={(e) =>
                          setEditUserForm({ ...editUserForm, username: e.target.value })
                        }
                      />

                      <GlassInput
                        label="Reset Password (leave empty to retain current)"
                        type={showEditPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        leftIcon={<Lock className="w-4 h-4 text-indigo-600" />}
                        rightIcon={
                          <button
                            type="button"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                            className="p-1 text-slate-400 hover:text-indigo-700 transition-colors"
                          >
                            {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        }
                        value={editUserForm.password}
                        onChange={(e) =>
                          setEditUserForm({ ...editUserForm, password: e.target.value })
                        }
                      />

                      {/* Account Status Switch */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                        <div>
                          <p className="text-xs font-bold text-slate-800">Account Access Status</p>
                          <p className="text-[11px] text-slate-500">
                            Disabled accounts cannot authenticate or access any portal resources.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                          <input
                            type="checkbox"
                            checked={editUserForm.is_active}
                            disabled={editingUser.id === currentUser?.id}
                            onChange={(e) =>
                              setEditUserForm({ ...editUserForm, is_active: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                          <span className="ml-2 text-xs font-bold text-slate-700">
                            {editUserForm.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Capabilities & Permissions Matrix (7 cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                            Assigned Permissions & Capabilities
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Modify permissions directly or apply a standardized profile preset.
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 self-start sm:self-auto">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                          {editUserForm.permissions.length} Assigned
                        </span>
                      </div>

                      {/* Preset Selector */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-800 tracking-wide">
                          Apply Permission Preset
                        </label>
                        <select
                          value={editUserPreset}
                          onChange={(e) => handlePresetChange(e.target.value, true)}
                          className="w-full bg-slate-50 text-slate-900 text-xs font-medium rounded-xl px-3.5 py-2.5 transition-all border border-slate-200 hover:border-indigo-400 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        >
                          <option value="custom">Custom Permissions Configuration</option>
                          {permissionsCatalog?.presets?.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Granular Categories Checklist */}
                      <div className="space-y-4 pt-1">
                        {Object.entries(groupedPermissions).map(([category, perms]) => (
                          <div key={category} className="space-y-2 p-3.5 rounded-xl bg-slate-50/60 border border-slate-200/70">
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                                {category}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {perms.filter((p) => editUserForm.permissions.includes(p.code)).length} of {perms.length} enabled
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                              {perms.map((p) => {
                                const isChecked = editUserForm.permissions.includes(p.code);
                                return (
                                  <label
                                    key={p.code}
                                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                                      isChecked
                                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-medium shadow-2xs'
                                        : 'bg-white border-slate-200/90 text-slate-600 hover:border-slate-300'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => togglePermission(p.code, true)}
                                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="leading-tight font-semibold text-slate-900">{p.name}</p>
                                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                        {p.description}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Footer Action Bar */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-slate-200/80">
                        <span className="text-xs text-slate-500 font-medium">
                          Active operational capabilities: <strong className="text-slate-800">{editUserForm.permissions.length} items</strong>
                        </span>
                        <div className="flex items-center gap-2.5 self-end sm:self-auto">
                          <GlassButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setUserViewMode('list');
                              setEditingUser(null);
                              setEditUserError('');
                            }}
                          >
                            Cancel
                          </GlassButton>
                          <GlassButton
                            type="submit"
                            variant="primary"
                            size="sm"
                            isLoading={updateUserMutation.isPending}
                          >
                            Save Changes
                          </GlassButton>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: LOCATION MASTER */}
            {adminTab === 'locations' && isAdmin && <AdminLocationManager />}

            {/* TAB 3: LETTER OF INTENT MASTER */}
            {adminTab === 'loi' && (
              <MasterTemplateTab
                templateType="letter_of_intent"
                title="Letter of Intent"
                description="Manage the master Letter of Intent document template and inspect dynamic candidate placeholder mappings."
                canManage={canManageTemplates}
              />
            )}

            {/* TAB 4: OFFER LETTER MASTER */}
            {adminTab === 'offer_letter' && (
              <MasterTemplateTab
                templateType="offer_letter"
                title="Offer Letter"
                description="Manage the master Offer Letter (Appointment Letter) document template and inspect dynamic candidate placeholder mappings."
                canManage={canManageTemplates}
              />
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
};

