import React, { useState } from 'react';
import { CandidateApplicationResponse, CandidateFilterParams } from '../types';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { useApplicationCreators, useDownloadCandidatesReport } from '../hooks/useCandidates';
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
  Edit,
  Download,
  Search,
  UserCheck,
  Clock,
  RotateCcw,
  Loader2,
  Filter,
} from 'lucide-react';

interface ApplicationsListProps {
  applications: CandidateApplicationResponse[];
  isLoading: boolean;
  onNewApplication: () => void;
  onEditApplication?: (app: CandidateApplicationResponse) => void;
  filters?: CandidateFilterParams;
  onFiltersChange?: (filters: CandidateFilterParams) => void;
}

export const ApplicationsList: React.FC<ApplicationsListProps> = ({
  applications,
  isLoading,
  onNewApplication,
  onEditApplication,
  filters = {},
  onFiltersChange,
}) => {
  const [selectedApp, setSelectedApp] = useState<CandidateApplicationResponse | null>(null);
  const [nameInput, setNameInput] = useState<string>(filters.candidate_name || '');
  const { data: creators = [] } = useApplicationCreators();
  const downloadReportMutation = useDownloadCandidatesReport();

  // Track latest filters in a ref to avoid stale closures in debounced effects
  const filtersRef = React.useRef(filters);
  React.useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const isClearingRef = React.useRef(false);

  // Sync internal nameInput when filters.candidate_name changes externally (e.g. Clear Filters)
  React.useEffect(() => {
    setNameInput(filters.candidate_name || '');
  }, [filters.candidate_name]);

  // Debounce candidate name search to avoid excessive API requests while typing
  React.useEffect(() => {
    if (isClearingRef.current) {
      isClearingRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const trimmed = nameInput.trim();
      const current = (filtersRef.current.candidate_name || '').trim();
      if (trimmed !== current) {
        onFiltersChange?.({
          ...filtersRef.current,
          candidate_name: trimmed || undefined,
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [nameInput]);

  const hasActiveFilters = Boolean(
    nameInput.trim() ||
    filters.candidate_name ||
    filters.hr_name ||
    filters.created_by_id ||
    filters.start_date ||
    filters.end_date ||
    (filters.status && filters.status !== 'ALL')
  );

  const handleCandidateNameChange = (val: string) => {
    setNameInput(val);
  };

  const handleCandidateNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = nameInput.trim();
      onFiltersChange?.({
        ...filtersRef.current,
        candidate_name: trimmed || undefined,
      });
    }
  };

  const handleHrChange = (val: string) => {
    if (!val) {
      const next = { ...filters };
      delete next.hr_name;
      delete next.created_by_id;
      onFiltersChange?.(next);
    } else {
      onFiltersChange?.({ ...filters, hr_name: val, created_by_id: undefined });
    }
  };

  const handleStartDateChange = (val: string) => {
    onFiltersChange?.({ ...filters, start_date: val || undefined });
  };

  const handleEndDateChange = (val: string) => {
    onFiltersChange?.({ ...filters, end_date: val || undefined });
  };

  const handleClearFilters = () => {
    isClearingRef.current = true;
    setNameInput('');
    onFiltersChange?.({});
  };

  const handleDownloadExcel = () => {
    downloadReportMutation.mutate(filters);
  };

  return (
    <div className="space-y-4">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Submitted Candidate Applications ({applications.length})
            </h3>
            {isLoading && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Updating...</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Candidate enrollment records with HR creator tracking and detailed status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={handleDownloadExcel}
            disabled={downloadReportMutation.isPending}
            leftIcon={
              downloadReportMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              ) : (
                <Download className="w-4 h-4 text-indigo-600" />
              )
            }
          >
            {downloadReportMutation.isPending ? 'Generating Excel...' : 'Download Excel Report'}
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            onClick={onNewApplication}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Application
          </GlassButton>
        </div>
      </div>

      {/* Filter Toolbar */}
      <GlassCard className="p-3.5 space-y-3 bg-white/80 border-slate-200">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Search & Filter Candidates</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Candidate Name Search */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Candidate Name
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by candidate name..."
                value={nameInput}
                onChange={(e) => handleCandidateNameChange(e.target.value)}
                onKeyDown={handleCandidateNameKeyDown}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* HR / Creator Name Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              HR / Creator Name
            </label>
            <div className="relative">
              <select
                value={filters.hr_name || ''}
                onChange={(e) => handleHrChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white cursor-pointer"
              >
                <option value="">All HR / Creators</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <UserCheck className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Start Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              End Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Empty State or Initial Loading when no candidates match or exist */}
      {isLoading && applications.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-white/70 rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading candidate applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <GlassCard className="text-center py-12 px-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6" />
          </div>
          {hasActiveFilters ? (
            <>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                No Applications Match Your Filters
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                Try clearing or adjusting your search criteria, HR creator, or date range to find candidate applications.
              </p>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={handleClearFilters}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Clear Filters
              </GlassButton>
            </>
          ) : (
            <>
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
            </>
          )}
        </GlassCard>
      ) : (
        /* Candidates Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {applications.map((app) => (
            <GlassCard
              key={app.id}
              variant="default"
              className="p-5 flex flex-col justify-between hover:border-indigo-400/50 transition-all bg-white shadow-xs"
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

                <div className="space-y-1 mb-3">
                  <h4 className="font-bold text-slate-900 text-sm">
                    {app.full_name || '—'}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{app.hero_category || '—'}</span>
                    <span>•</span>
                    <span className="font-semibold text-indigo-700">{app.role_applied || '—'}</span>
                  </div>
                </div>

                {/* Creator HR details & Submission Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-3 border-t border-slate-100 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">
                      <span className="text-slate-400">Created by: </span>
                      <strong className="text-slate-700 font-semibold">{app.created_by_name || '—'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:justify-end">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {app.created_at
                        ? new Date(app.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            timeZone: 'Asia/Kolkata',
                          })
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {app.created_at
                        ? new Date(app.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'Asia/Kolkata',
                          })
                        : '—'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono">{app.aadhaar_number_masked || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                {onEditApplication && (
                  <button
                    type="button"
                    onClick={() => onEditApplication(app)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-700 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Form</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedApp(app)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline ml-auto"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Full Details</span>
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

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

            {/* Creator and Audit Information */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Created / Submitted By (HR)
                </span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  {selectedApp.created_by_name || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Submission Date & Time (IST)
                </span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {selectedApp.created_at
                    ? new Date(selectedApp.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                        timeZone: 'Asia/Kolkata',
                      })
                    : '—'}
                </span>
              </div>
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
                  <span className="font-semibold text-slate-800">{selectedApp.full_name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Mobile Number</span>
                  <span className="font-semibold text-slate-800">{selectedApp.mobile_number || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Email</span>
                  <span className="font-semibold text-slate-800 truncate block">{selectedApp.email || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Aadhaar (Masked)</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedApp.aadhaar_number_masked || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">PAN (Masked)</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedApp.pan_number_masked || '—'}</span>
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
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-indigo-800 font-semibold block text-[11px]">Current Address</span>
                  <p className="text-slate-700">
                    {selectedApp.current_address_line1 || '—'}
                    {selectedApp.current_address_line2 ? `, ${selectedApp.current_address_line2}` : ''}
                  </p>
                  <p className="text-slate-500">
                    {[selectedApp.current_city, selectedApp.current_state, selectedApp.current_pin_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-indigo-800 font-semibold block text-[11px]">Permanent Address</span>
                  <p className="text-slate-700">
                    {selectedApp.permanent_address_line1 || '—'}
                    {selectedApp.permanent_address_line2 ? `, ${selectedApp.permanent_address_line2}` : ''}
                  </p>
                  <p className="text-slate-500">
                    {[selectedApp.permanent_city, selectedApp.permanent_state, selectedApp.permanent_pin_code]
                      .filter(Boolean)
                      .join(', ')}
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
              <div className="grid grid-cols-2 gap-3 text-xs p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Bank Name</span>
                  <span className="font-semibold text-slate-800">{selectedApp.bank_name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Account Holder</span>
                  <span className="font-semibold text-slate-800">{selectedApp.account_holder_name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Account Number (Masked)</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedApp.account_number_masked || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">IFSC Code</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedApp.ifsc_code || '—'}</span>
                </div>
              </div>
            </div>

            {/* Location & Salary */}
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
                    {selectedApp.current_salary ? `₹${selectedApp.current_salary}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Asking Salary</span>
                  <span className="font-semibold text-slate-800">
                    {selectedApp.asking_salary ? `₹${selectedApp.asking_salary}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Negotiated Salary</span>
                  <span className="font-semibold text-indigo-700">
                    {selectedApp.negotiated_salary ? `₹${selectedApp.negotiated_salary}` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Uploaded Documents */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Uploaded Documents ({selectedApp.documents?.length || 0})</span>
              </h4>
              {selectedApp.documents && selectedApp.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedApp.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 block truncate">
                          {(doc.category || '').replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate block">
                          {doc.original_filename}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {typeof doc.file_size === 'number' ? `${(doc.file_size / 1024).toFixed(1)} KB` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No documents uploaded.</p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <GlassButton variant="secondary" size="sm" onClick={() => setSelectedApp(null)}>
                Close
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
