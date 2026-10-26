import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/Modal';
import {
  useVerificationApplications,
  useBulkApproveApplications,
  useBulkRejectApplications,
} from '../hooks/useVerification';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { VerificationStatusBadge } from '../components/VerificationStatusBadge';
import { VerificationProgressBar } from '../components/VerificationProgressBar';
import { BulkCandidateActionResponse } from '../types';
import {
  FileCheck2,
  Search,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Layers,
  CheckCheck,
  XCircle,
  AlertTriangle,
  Check,
} from 'lucide-react';

export const DocumentVerificationListPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: applications = [], isLoading } = useVerificationApplications();
  const { data: currentUser } = useCurrentUser();

  // Permission evaluation based on dynamic permissions & assigned roles
  const userRoles = currentUser?.roles || [];
  const permissions = currentUser?.permissions || [];
  const isAdmin = userRoles.includes('admin') || permissions.includes('users:manage');
  const canApprove = permissions.includes('candidates:approve') || isAdmin;
  const canReject = permissions.includes('candidates:reject') || isAdmin;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHero, setSelectedHero] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Bulk selection state
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [isBulkApproveModalOpen, setIsBulkApproveModalOpen] = useState(false);
  const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkCandidateActionResponse | null>(null);
  const [bulkActionType, setBulkActionType] = useState<'approve' | 'reject' | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const bulkApproveMutation = useBulkApproveApplications();
  const bulkRejectMutation = useBulkRejectApplications();

  // Calculate summary counts from genuine backend records
  const stats = useMemo(() => {
    const total = applications.length;
    const pending = applications.filter(
      (a) => a.status === 'PENDING_VERIFICATION' || a.status === 'SUBMITTED'
    ).length;
    const inProgress = applications.filter((a) => a.status === 'IN_PROGRESS').length;
    const complete = applications.filter((a) => a.status === 'VERIFICATION_COMPLETE').length;
    return { total, pending, inProgress, complete };
  }, [applications]);

  // Filter applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Search matching (Candidate name or Application Reference)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = app.full_name?.toLowerCase().includes(query);
        const matchesRef = app.application_number?.toLowerCase().includes(query);
        if (!matchesName && !matchesRef) return false;
      }

      // Hero Filter
      if (selectedHero !== 'ALL' && app.hero_category !== selectedHero) {
        return false;
      }

      // Role Filter
      if (selectedRole !== 'ALL' && app.role_applied !== selectedRole) {
        return false;
      }

      // Status Filter
      if (selectedStatus !== 'ALL') {
        const normStatus = (app.status || '').toUpperCase();
        if (selectedStatus === 'PENDING_VERIFICATION') {
          if (normStatus !== 'PENDING_VERIFICATION' && normStatus !== 'SUBMITTED') return false;
        } else if (normStatus !== selectedStatus) {
          return false;
        }
      }

      return true;
    });
  }, [applications, searchQuery, selectedHero, selectedRole, selectedStatus]);

  // Selected applications objects
  const selectedApps = useMemo(() => {
    return applications.filter((app) => selectedAppIds.has(app.id));
  }, [applications, selectedAppIds]);

  // Selection handlers
  const toggleSelectApp = (id: string) => {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedAppIds.size === filteredApplications.length && filteredApplications.length > 0) {
      setSelectedAppIds(new Set());
    } else {
      setSelectedAppIds(new Set(filteredApplications.map((app) => app.id)));
    }
  };

  const handleOpenBulkApprove = () => {
    setBulkResult(null);
    setBulkActionType(null);
    setIsBulkApproveModalOpen(true);
  };

  const handleOpenBulkReject = () => {
    setBulkResult(null);
    setBulkActionType(null);
    setRejectionReason('');
    setRejectError(null);
    setIsBulkRejectModalOpen(true);
  };

  const handleConfirmBulkApprove = async () => {
    setFeedbackMessage(null);
    try {
      const res = await bulkApproveMutation.mutateAsync(Array.from(selectedAppIds));
      setBulkResult(res);
      setBulkActionType('approve');
      if (res.approved_count && res.approved_count > 0) {
        // Deselect successful items
        setSelectedAppIds((prev) => {
          const next = new Set(prev);
          for (const id of res.successful_ids) {
            next.delete(id);
          }
          return next;
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to bulk approve candidates.',
      });
    }
  };

  const handleConfirmBulkReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectError('Please enter a valid rejection reason.');
      return;
    }
    setRejectError(null);
    setFeedbackMessage(null);
    try {
      const res = await bulkRejectMutation.mutateAsync({
        applicationIds: Array.from(selectedAppIds),
        reason: rejectionReason.trim(),
      });
      setBulkResult(res);
      setBulkActionType('reject');
      if (res.rejected_count && res.rejected_count > 0) {
        // Deselect successful items
        setSelectedAppIds((prev) => {
          const next = new Set(prev);
          for (const id of res.successful_ids) {
            next.delete(id);
          }
          return next;
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to bulk reject candidates.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              HR Verification Portal
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Candidate Verification
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review candidate submitted details, verify identity credentials, and record verification decisions.
          </p>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <GlassCard className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Applications</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats.total}</div>
          <p className="text-[11px] text-slate-400 mt-1">Submitted in database</p>
        </GlassCard>

        <GlassCard className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Review</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{stats.pending}</div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting review</p>
        </GlassCard>

        <GlassCard className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">In Progress</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-sky-700 mt-2">{stats.inProgress}</div>
          <p className="text-[11px] text-slate-400 mt-1">Partially verified</p>
        </GlassCard>

        <GlassCard className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Completed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{stats.complete}</div>
          <p className="text-[11px] text-slate-400 mt-1">100% verified records</p>
        </GlassCard>
      </div>

      {/* Filter and Search Bar */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by candidate name or application reference (e.g. CEF-APP-2026...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 transition-colors"
            />
          </div>

          {/* Hero Category Filter */}
          <div className="w-full md:w-44">
            <select
              value={selectedHero}
              onChange={(e) => setSelectedHero(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
            >
              <option value="ALL">All Categories</option>
              <option value="Hero 1">Hero 1</option>
              <option value="Hero 2">Hero 2</option>
            </select>
          </div>

          {/* Role Applied Filter */}
          <div className="w-full md:w-44">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
            >
              <option value="ALL">All Roles</option>
              <option value="HDD Operate">HDD Operate</option>
              <option value="HDD Tracker">HDD Tracker</option>
              <option value="HDD Helper">HDD Helper</option>
            </select>
          </div>

          {/* Verification Status Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="VERIFICATION_COMPLETE">Verification Complete</option>
            </select>
          </div>
        </div>

        {/* Active Filter Clear Tag */}
        {(searchQuery || selectedHero !== 'ALL' || selectedRole !== 'ALL' || selectedStatus !== 'ALL') && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500">
              Showing {filteredApplications.length} of {applications.length} results
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedHero('ALL');
                setSelectedRole('ALL');
                setSelectedStatus('ALL');
              }}
              className="text-[11px] text-indigo-700 hover:underline font-semibold"
            >
              Reset filters
            </button>
          </div>
        )}
      </GlassCard>

      {/* Global Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Bulk Action Sticky/Floating Toolbar */}
      {selectedAppIds.size > 0 && (
        <div className="sticky top-4 z-20 bg-white border border-indigo-200 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
              {selectedAppIds.size} application{selectedAppIds.size > 1 ? 's' : ''} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedAppIds(new Set())}
              className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
            >
              Clear Selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canApprove && (
              <button
                type="button"
                onClick={handleOpenBulkApprove}
                disabled={bulkApproveMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-2xs transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bulk Approve ({selectedAppIds.size})</span>
              </button>
            )}

            {canReject && (
              <button
                type="button"
                onClick={handleOpenBulkReject}
                disabled={bulkRejectMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-2xs transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Bulk Reject ({selectedAppIds.size})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading verification records from database...</p>
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 className="w-8 h-8 text-indigo-600" />}
          title="No Applications Pending Verification"
          description="There are currently no candidate applications recorded in the database. When candidate applications are submitted, they will automatically appear here for verification."
        />
      ) : filteredApplications.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8 text-slate-400" />}
          title="No Matching Applications Found"
          description="No candidate records match your selected search query or filter criteria. Try clearing filters to see all applications."
          action={
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedHero('ALL');
                setSelectedRole('ALL');
                setSelectedStatus('ALL');
              }}
            >
              Clear Filters
            </GlassButton>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* List Scope & Select All Control */}
          {(canApprove || canReject) && (
            <div className="flex items-center justify-between px-2 text-xs text-slate-500">
              <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={filteredApplications.length > 0 && selectedAppIds.size === filteredApplications.length}
                  onChange={handleSelectAllFiltered}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <span>Select All ({filteredApplications.length})</span>
              </label>
              <span>Showing {filteredApplications.length} candidate applications</span>
            </div>
          )}

          {filteredApplications.map((app) => {
            const formattedDate = new Date(app.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            const isSelected = selectedAppIds.has(app.id);

            return (
              <GlassCard
                key={app.id}
                className={`p-4 sm:p-5 transition-all duration-200 bg-white shadow-xs ${
                  isSelected ? 'border-indigo-400 bg-indigo-50/20' : 'hover:border-indigo-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Selection Checkbox + Reference & Candidate Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {(canApprove || canReject) && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectApp(app.id)}
                        className="w-4 h-4 mt-1 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0"
                        aria-label={`Select ${app.full_name}`}
                      />
                    )}

                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                          {app.application_number}
                        </span>
                        <VerificationStatusBadge status={app.status} size="sm" />
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          {app.hero_category} • {app.role_applied}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{app.full_name}</span>
                        </div>
                        <div className="text-slate-500">
                          Mobile: <span className="font-mono text-slate-700">{app.mobile_number_masked || '••••••••••'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Submitted on {formattedDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Verification Progress */}
                  <div className="w-full lg:w-64 space-y-1">
                    <VerificationProgressBar progress={app.verification_progress} />
                  </div>

                  {/* Right Column: Open Workspace Action */}
                  <div className="flex-shrink-0 flex items-center justify-end">
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/documents/${app.id}`)}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Open Verification Workspace
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Bulk Approve Confirmation Modal */}
      <Modal
        isOpen={isBulkApproveModalOpen}
        onClose={() => setIsBulkApproveModalOpen(false)}
        title="Bulk Approve Candidates"
        maxWidth="md"
      >
        <div className="space-y-3.5 text-xs">
          {bulkResult && bulkActionType === 'approve' ? (
            /* Outcome Reporting View */
            <div className="space-y-3">
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  bulkResult.approved_count && bulkResult.approved_count > 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="font-bold">
                    Bulk Approval Completed: {bulkResult.approved_count || 0} of {bulkResult.total_requested} approved.
                  </p>
                  <p className="text-slate-600">
                    {bulkResult.approved_count || 0} candidates successfully marked as Approved in the database.
                  </p>
                </div>
              </div>

              {bulkResult.failed_count > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{bulkResult.failed_count} application(s) could not be approved:</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-700">
                    {bulkResult.failed_items.map((fail) => (
                      <li
                        key={fail.id}
                        className="p-2 bg-white rounded-lg border border-amber-200 flex flex-col gap-0.5"
                      >
                        <div className="flex justify-between font-semibold text-slate-900">
                          <span>{fail.candidate_name || fail.application_number}</span>
                          <span className="font-mono text-[11px] text-slate-500">{fail.application_number}</span>
                        </div>
                        <span className="text-rose-700 font-medium text-[11px]">{fail.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsBulkApproveModalOpen(false);
                    setBulkResult(null);
                  }}
                >
                  Close & Refresh
                </GlassButton>
              </div>
            </div>
          ) : (
            /* Confirmation View */
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Confirm Bulk Approval of {selectedApps.length} Candidates</span>
                </div>
                <p className="text-emerald-800">
                  You are about to approve {selectedApps.length} candidate applications. The backend will verify
                  that each candidate has completed all mandatory verification checks (details, Aadhaar, PAN, bank proof)
                  before approving.
                </p>
              </div>

              {/* Selected Candidates List */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 max-h-60 overflow-y-auto">
                <span className="font-bold text-slate-800 block">Selected Candidates:</span>
                <ul className="space-y-1.5">
                  {selectedApps.map((app) => {
                    const isFullyVerified =
                      app.status === 'VERIFICATION_COMPLETE' ||
                      (app.verification_progress &&
                        app.verification_progress.completed_mandatory_items ===
                          app.verification_progress.mandatory_items);

                    return (
                      <li
                        key={app.id}
                        className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700"
                      >
                        <div className="min-w-0">
                          <strong className="text-slate-900 block truncate">{app.full_name}</strong>
                          <span className="font-mono text-[11px] text-slate-500">{app.application_number}</span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isFullyVerified ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              ✓ Verified Eligible
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              Pending Checks
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600 text-[11px] space-y-0.5 border border-slate-200">
                <p className="font-bold text-slate-800">Safe Approval Rule:</p>
                <p>
                  Candidates with incomplete mandatory checks will safely fail and be reported in the results summary without blocking eligible candidates.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsBulkApproveModalOpen(false)}
                  disabled={bulkApproveMutation.isPending}
                >
                  Cancel
                </GlassButton>
                <button
                  type="button"
                  onClick={handleConfirmBulkApprove}
                  disabled={bulkApproveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 shadow-2xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {bulkApproveMutation.isPending
                      ? 'Approving Candidates...'
                      : `Confirm Approval (${selectedApps.length})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Bulk Reject Confirmation Modal */}
      <Modal
        isOpen={isBulkRejectModalOpen}
        onClose={() => setIsBulkRejectModalOpen(false)}
        title="Bulk Reject Candidates"
        maxWidth="md"
      >
        <div className="space-y-3.5 text-xs">
          {bulkResult && bulkActionType === 'reject' ? (
            /* Outcome Reporting View */
            <div className="space-y-3">
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  bulkResult.rejected_count && bulkResult.rejected_count > 0
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="font-bold">
                    Bulk Rejection Completed: {bulkResult.rejected_count || 0} of {bulkResult.total_requested} rejected.
                  </p>
                  <p className="text-slate-600">
                    {bulkResult.rejected_count || 0} candidates marked as Rejected with the specified reason in the database.
                  </p>
                </div>
              </div>

              {bulkResult.failed_count > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{bulkResult.failed_count} application(s) could not be rejected:</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-700">
                    {bulkResult.failed_items.map((fail) => (
                      <li
                        key={fail.id}
                        className="p-2 bg-white rounded-lg border border-amber-200 flex flex-col gap-0.5"
                      >
                        <div className="flex justify-between font-semibold text-slate-900">
                          <span>{fail.candidate_name || fail.application_number}</span>
                          <span className="font-mono text-[11px] text-slate-500">{fail.application_number}</span>
                        </div>
                        <span className="text-rose-700 font-medium text-[11px]">{fail.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsBulkRejectModalOpen(false);
                    setBulkResult(null);
                  }}
                >
                  Close & Refresh
                </GlassButton>
              </div>
            </div>
          ) : (
            /* Confirmation View */
            <div className="space-y-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-rose-900">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Confirm Bulk Rejection of {selectedApps.length} Candidates</span>
                </div>
                <p className="text-rose-800">
                  You are about to reject {selectedApps.length} candidate applications. This will record a
                  <strong>Rejected</strong> status and reason in the database and audit logs.
                </p>
              </div>

              {/* Selected Candidates List */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 max-h-48 overflow-y-auto">
                <span className="font-bold text-slate-800 block">Selected Candidates:</span>
                <ul className="space-y-1 text-slate-700">
                  {selectedApps.map((app) => (
                    <li key={app.id} className="flex justify-between bg-white p-2 rounded-lg border border-slate-200">
                      <strong>{app.full_name}</strong>
                      <span className="font-mono text-slate-500">{app.application_number}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mandatory Rejection Reason */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectError) setRejectError(null);
                  }}
                  placeholder="Enter detailed reason for rejecting selected candidates (required)..."
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 shadow-2xs"
                />
                {rejectError && <p className="text-xs text-rose-600 font-semibold">{rejectError}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsBulkRejectModalOpen(false)}
                  disabled={bulkRejectMutation.isPending}
                >
                  Cancel
                </GlassButton>
                <button
                  type="button"
                  onClick={handleConfirmBulkReject}
                  disabled={bulkRejectMutation.isPending || !rejectionReason.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 shadow-2xs transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>
                    {bulkRejectMutation.isPending
                      ? 'Rejecting Candidates...'
                      : `Confirm Rejection (${selectedApps.length})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
