import React, { useState } from 'react';
import { ApplicationRole } from '../types';
import {
  useAllRoles,
  useCreateRole,
  useUpdateRole,
  useToggleRoleActive,
} from '../hooks/useCandidates';
import { GlassInput } from '@/components/GlassInput';
import { GlassButton } from '@/components/GlassButton';
import { Modal } from '@/components/Modal';
import {
  Briefcase,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Edit2,
  AlertCircle,
} from 'lucide-react';

export const ManageRolesManager: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState<{
    name: string;
    description: string;
    is_active: boolean;
  }>({
    name: '',
    description: '',
    is_active: true,
  });
  const [newRoleError, setNewRoleError] = useState('');

  const [editingRole, setEditingRole] = useState<ApplicationRole | null>(null);
  const [editRoleForm, setEditRoleForm] = useState<{
    name: string;
    description: string;
    is_active: boolean;
  }>({
    name: '',
    description: '',
    is_active: true,
  });
  const [editRoleError, setEditRoleError] = useState('');

  const { data: allRoles, isLoading } = useAllRoles();

  const createRoleMutation = useCreateRole(() => {
    setIsAddModalOpen(false);
    setNewRoleForm({ name: '', description: '', is_active: true });
    setNewRoleError('');
  });

  const updateRoleMutation = useUpdateRole(() => {
    setEditingRole(null);
    setEditRoleError('');
  });

  const toggleRoleMutation = useToggleRoleActive();

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewRoleError('');

    const cleanName = newRoleForm.name.trim();
    if (!cleanName) {
      setNewRoleError('Role Name is required.');
      return;
    }
    if (cleanName.length < 2) {
      setNewRoleError('Role Name must be at least 2 characters.');
      return;
    }

    createRoleMutation.mutate(
      {
        name: cleanName,
        description: newRoleForm.description.trim() || undefined,
        is_active: newRoleForm.is_active,
      },
      {
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            'Failed to create role. Please try again.';
          setNewRoleError(msg);
        },
      }
    );
  };

  const handleStartEdit = (role: ApplicationRole) => {
    setEditingRole(role);
    setEditRoleForm({
      name: role.name,
      description: role.description || '',
      is_active: role.is_active,
    });
    setEditRoleError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    setEditRoleError('');

    const cleanName = editRoleForm.name.trim();
    if (!cleanName) {
      setEditRoleError('Role Name is required.');
      return;
    }
    if (cleanName.length < 2) {
      setEditRoleError('Role Name must be at least 2 characters.');
      return;
    }

    updateRoleMutation.mutate(
      {
        id: editingRole.id,
        data: {
          name: cleanName,
          description: editRoleForm.description.trim() || undefined,
          is_active: editRoleForm.is_active,
        },
      },
      {
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            'Failed to update role. Please try again.';
          setEditRoleError(msg);
        },
      }
    );
  };

  const filteredRoles = (allRoles || []).filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            Manage Roles
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, edit, and manage candidate designation roles. Active roles appear immediately in application forms.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search roles by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all bg-white"
            />
          </div>

          <GlassButton
            variant="primary"
            size="sm"
            onClick={() => {
              setNewRoleForm({ name: '', description: '', is_active: true });
              setNewRoleError('');
              setIsAddModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + Create New Role
          </GlassButton>
        </div>
      </div>

      {/* Roles Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50/90 text-slate-700 uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Role Name</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400">
                  <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="mt-2 text-xs">Loading roles from database...</p>
                </td>
              </tr>
            ) : filteredRoles.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400">
                  No roles found matching your search.
                </td>
              </tr>
            ) : (
              filteredRoles.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{role.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-sm truncate">
                    {role.description || <span className="text-slate-400 italic">No description provided</span>}
                  </td>
                  <td className="py-3.5 px-4">
                    {role.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <GlassButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStartEdit(role)}
                        leftIcon={<Edit2 className="w-3 h-3" />}
                      >
                        Edit
                      </GlassButton>

                      <GlassButton
                        variant={role.is_active ? 'danger' : 'primary'}
                        size="sm"
                        onClick={() => toggleRoleMutation.mutate(role.id)}
                        isLoading={
                          toggleRoleMutation.isPending &&
                          toggleRoleMutation.variables === role.id
                        }
                      >
                        {role.is_active ? 'Deactivate' : 'Activate'}
                      </GlassButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: + Create New Role */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Role"
        description="Add a new candidate designation role. Active roles appear immediately in application forms."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
          {newRoleError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 font-medium">{newRoleError}</p>
            </div>
          )}

          <GlassInput
            label="Role Name *"
            placeholder="e.g. HDD Lead Engineer"
            leftIcon={<Briefcase className="w-4 h-4 text-indigo-600" />}
            value={newRoleForm.name}
            onChange={(e) => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
            required
          />

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Brief summary or operational scope of this designation..."
              value={newRoleForm.description}
              onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
              className="w-full text-xs rounded-xl border border-slate-200 bg-white/90 p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Status *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  newRoleForm.is_active
                    ? 'bg-indigo-50/80 border-indigo-500 text-indigo-900 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="create_status"
                  checked={newRoleForm.is_active}
                  onChange={() => setNewRoleForm({ ...newRoleForm, is_active: true })}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold block">Active</span>
                  <span className="text-[10px] text-slate-500 block">Available in forms</span>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  !newRoleForm.is_active
                    ? 'bg-amber-50/80 border-amber-500 text-amber-900 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="create_status"
                  checked={!newRoleForm.is_active}
                  onChange={() => setNewRoleForm({ ...newRoleForm, is_active: false })}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold block">Inactive</span>
                  <span className="text-[10px] text-slate-500 block">Hidden from forms</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              isLoading={createRoleMutation.isPending}
            >
              Save
            </GlassButton>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Role */}
      {editingRole && (
        <Modal
          isOpen={true}
          onClose={() => setEditingRole(null)}
          title={`Edit Role — ${editingRole.name}`}
          description="Update role details. Historical candidate applications will retain their original saved designation."
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            {editRoleError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 font-medium">{editRoleError}</p>
              </div>
            )}

            <GlassInput
              label="Role Name *"
              placeholder="e.g. HDD Lead Engineer"
              leftIcon={<Briefcase className="w-4 h-4 text-indigo-600" />}
              value={editRoleForm.name}
              onChange={(e) => setEditRoleForm({ ...editRoleForm, name: e.target.value })}
              required
            />

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Brief summary or operational scope..."
                value={editRoleForm.description}
                onChange={(e) => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-200 bg-white/90 p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Status *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    editRoleForm.is_active
                      ? 'bg-indigo-50/80 border-indigo-500 text-indigo-900 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="edit_status"
                    checked={editRoleForm.is_active}
                    onChange={() => setEditRoleForm({ ...editRoleForm, is_active: true })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold block">Active</span>
                    <span className="text-[10px] text-slate-500 block">Available in forms</span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    !editRoleForm.is_active
                      ? 'bg-amber-50/80 border-amber-500 text-amber-900 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="edit_status"
                    checked={!editRoleForm.is_active}
                    onChange={() => setEditRoleForm({ ...editRoleForm, is_active: false })}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold block">Inactive</span>
                    <span className="text-[10px] text-slate-500 block">Hidden from forms</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setEditingRole(null)}
              >
                Cancel
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                isLoading={updateRoleMutation.isPending}
              >
                Save
              </GlassButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
