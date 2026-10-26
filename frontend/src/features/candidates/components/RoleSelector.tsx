import React from 'react';
import { RoleApplied } from '../types';
import { useActiveRoles } from '../hooks/useCandidates';
import { Cpu, Activity, Wrench, Briefcase, CheckCircle2 } from 'lucide-react';

interface RoleSelectorProps {
  selectedRole: RoleApplied | null;
  onSelectRole: (role: RoleApplied) => void;
}

// Icon helper mapped by role name keywords or fallback
const getRoleIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('operate')) return Cpu;
  if (lower.includes('track')) return Activity;
  if (lower.includes('help')) return Wrench;
  return Briefcase;
};

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  selectedRole,
  onSelectRole,
}) => {
  const { data: activeRoles } = useActiveRoles();

  // Fallback initial roles if query has not completed
  const rolesList = (activeRoles && activeRoles.length > 0)
    ? activeRoles.map((r) => ({ id: r.name, name: r.name }))
    : [
        { id: 'HDD Operate', name: 'HDD Operate' },
        { id: 'HDD Tracker', name: 'HDD Tracker' },
        { id: 'HDD Helper', name: 'HDD Helper' },
      ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          Select Role / Designation
        </label>
        {selectedRole && (
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
            Selected: {selectedRole}
          </span>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Candidate Roles"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
      >
        {rolesList.map((role) => {
          const isSelected = selectedRole === role.id;
          const Icon = getRoleIcon(role.name);

          return (
            <button
              key={role.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onSelectRole(role.id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onSelectRole(role.id);
                }
              }}
              className={`text-left py-2.5 px-3.5 rounded-xl transition-all duration-150 border outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 flex items-center justify-between ${
                isSelected
                  ? 'bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-500/25'
                  : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-xs hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold text-slate-900 text-xs sm:text-sm tracking-tight truncate">
                  {role.name}
                </span>
              </div>

              {isSelected ? (
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
