import React, { useState } from 'react';
import { CandidateApplicationResponse } from '../types';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import {
  FileText,
  Plus,
  Eye,
  Calendar,
  X,
  User,
  MapPin,
  Landmark,
  Compass,
  FileCheck,
} from 'lucide-react';

interface ApplicationsListProps {
  applications: CandidateApplicationResponse[];
  isLoading: boolean;
  onNewApplication: () => void;
}

export const ApplicationsList: React.FC<ApplicationsListProps> = ({
  applications,
  isLoading,
  onNewApplication,
}) => {
  const [selectedApp, setSelectedApp] = useState<CandidateApplicationResponse | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading candidate applications...</p>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <GlassCard className="text-center py-12 px-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          No Applications Submitted Yet
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
          You haven't submitted any candidate enrollment applications yet. Select a Hero category and role to begin.
        </p>
        <GlassButton
          variant="primary"
          onClick={onNewApplication}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Create Candidate Application
        </GlassButton>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Submitted Candidate Applications ({applications.length})
          </h3>
          <p className="text-xs text-slate-500">
            Official enrollment records registered under your account.
          </p>
        </div>
        <GlassButton
          variant="primary"
          size="sm"
          onClick={onNewApplication}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Application
        </GlassButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {applications.map((app) => (
          <GlassCard
            key={app.id}
            variant="default"
            className="p-5 flex flex-col justify-between hover:border-indigo-400/50 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono font-bold text-xs text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  {app.application_number}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-300">
                  {app.status || 'Submitted'}
                </span>
              </div>

              <div className="space-y-1 mb-4">
                <h4 className="font-bold text-slate-900 text-sm">
                  {app.full_name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{app.hero_category}</span>
                  <span>•</span>
                  <span className="font-semibold text-indigo-700">{app.role_applied}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {new Date(app.created_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono">{app.aadhaar_number_masked}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedApp(app)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Full Details</span>
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Modal for viewing application detail */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Application Summary
                </span>
                <h3 className="text-lg font-bold text-slate-900 font-mono">
                  {selectedApp.application_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stream badge */}
            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Track: </span>
                <strong className="text-slate-900">{selectedApp.hero_category}</strong>
                <span className="mx-2 text-slate-400">/</span>
                <strong className="text-indigo-800">{selectedApp.role_applied}</strong>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                {selectedApp.status}
              </span>
            </div>

            {/* Personal info */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Personal Information</span>
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Full Name</span>
                  <span className="font-semibold text-slate-800">{selectedApp.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Mobile Number</span>
                  <span className="font-semibold text-slate-800">{selectedApp.mobile_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Email</span>
                  <span className="font-semibold text-slate-800 truncate block">{selectedApp.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Aadhaar (Masked)</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedApp.aadhaar_number_masked}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">PAN (Masked)</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedApp.pan_number_masked}</span>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>Addresses</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1">Current Address</span>
                  <p className="text-slate-800 leading-relaxed">
                    {selectedApp.current_address_line1}
                    {selectedApp.current_address_line2 ? `, ${selectedApp.current_address_line2}` : ''}
                    <br />
                    {selectedApp.current_city}, {selectedApp.current_state} — {selectedApp.current_pin_code}
                    <br />
                    {selectedApp.current_country}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1">Permanent Address</span>
                  <p className="text-slate-800 leading-relaxed">
                    {selectedApp.is_permanent_same
                      ? 'Same as Current Address'
                      : `${selectedApp.permanent_address_line1}${selectedApp.permanent_address_line2 ? `, ${selectedApp.permanent_address_line2}` : ''}\n${selectedApp.permanent_city}, ${selectedApp.permanent_state} — ${selectedApp.permanent_pin_code}\n${selectedApp.permanent_country}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Bank details */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                <span>Bank Details</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Account Holder</span>
                  <span className="font-semibold text-slate-800">{selectedApp.account_holder_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Bank Name</span>
                  <span className="font-semibold text-slate-800">{selectedApp.bank_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Account Number</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedApp.account_number_masked}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">IFSC</span>
                  <span className="font-mono font-semibold text-slate-800 uppercase">{selectedApp.ifsc_code}</span>
                </div>
                {selectedApp.branch_name && (
                  <div>
                    <span className="text-slate-400 block">Branch</span>
                    <span className="font-semibold text-slate-800">{selectedApp.branch_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Location & Salary */}
            {(selectedApp.circle || selectedApp.current_salary !== undefined) && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Location & Salary Details</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Circle</span>
                    <span className="font-semibold text-slate-800">{selectedApp.circle || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">District</span>
                    <span className="font-semibold text-slate-800">{selectedApp.district || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Block</span>
                    <span className="font-semibold text-slate-800">{selectedApp.block || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Current Salary</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApp.current_salary ? `₹${Number(selectedApp.current_salary).toLocaleString('en-IN')}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Asking Salary</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApp.asking_salary ? `₹${Number(selectedApp.asking_salary).toLocaleString('en-IN')}` : '—'}
                    </span>
                  </div>
                  {selectedApp.negotiated_salary !== null && selectedApp.negotiated_salary !== undefined && (
                    <div>
                      <span className="text-slate-400 block">Negotiated Salary</span>
                      <span className="font-semibold text-slate-800">
                        ₹{Number(selectedApp.negotiated_salary).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Uploaded Documents */}
            {selectedApp.documents && selectedApp.documents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Verified Documents ({selectedApp.documents.length})</span>
                </h4>
                <div className="space-y-1.5">
                  {selectedApp.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-slate-700 capitalize">
                          {doc.category.replace(/_/g, ' ')}:
                        </span>
                        <span className="text-slate-500 truncate">{doc.original_filename}</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded">
                        Verified
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <GlassButton variant="secondary" onClick={() => setSelectedApp(null)}>
                Close Window
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
