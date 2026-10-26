import React from 'react';
import { ManageRolesManager } from '../components/ManageRolesManager';
import { GlassCard } from '@/components/GlassCard';
import { Briefcase } from 'lucide-react';

export const ManageRolesPage: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Top Header */}
      <div className="border-b border-slate-200/80 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Briefcase className="w-7 h-7 text-indigo-600" />
          Manage Designation Roles
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage candidate designation options, add new industry roles, and activate or deactivate existing designations.
        </p>
      </div>

      <GlassCard className="bg-white/95 border-slate-200 shadow-md p-6">
        <ManageRolesManager />
      </GlassCard>
    </div>
  );
};
