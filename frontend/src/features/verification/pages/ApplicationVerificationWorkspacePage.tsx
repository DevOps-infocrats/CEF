import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassButton } from '@/components/GlassButton';
import { Modal } from '@/components/Modal';
import {
  useApplicationVerificationDetail,
  useVerificationChecklist,
  useMarkItemDone,
  useResetItemStatus,
  useBulkMarkItemsDone,
  useApproveCandidate,
  useRejectCandidate,
} from '../hooks/useVerification';
import { VerificationStatusBadge } from '../components/VerificationStatusBadge';
import { CompactVerificationRow } from '../components/CompactVerificationRow';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { CandidateDocument } from '@/features/candidates/types';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  User,
  CreditCard,
  Building,
  MapPin,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  CheckCheck,
  Check,
} from 'lucide-react';

export const ApplicationVerificationWorkspacePage: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();

  const [unmaskSensitive, setUnmaskSensitive] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CandidateDocument | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check verifier permissions independently based on dynamic permissions & roles
  const userRoles = currentUser?.roles || [];
  const permissions = currentUser?.permissions || [];
  const isAdmin = userRoles.includes('admin') || permissions.includes('users:manage');
  const canVerify = permissions.includes('documents:verify') || isAdmin;
  const canBulkVerify = permissions.includes('documents:bulk_verify') || isAdmin;
  const canApprove = permissions.includes('candidates:approve') || isAdmin;
  const canReject = permissions.includes('candidates:reject') || isAdmin;

  // Load application details and checklist
  const {
    data: application,
    isLoading: isAppLoading,
    error: appError,
  } = useApplicationVerificationDetail(appId || '', unmaskSensitive);

  const {
    data: checklistData,
    isLoading: isChecklistLoading,
  } = useVerificationChecklist(appId || '');

  const markDoneMutation = useMarkItemDone();
  const resetMutation = useResetItemStatus();
  const bulkDoneMutation = useBulkMarkItemsDone();
  const approveMutation = useApproveCandidate();
  const rejectMutation = useRejectCandidate();

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkSelectionModalOpen, setIsBulkSelectionModalOpen] = useState(false);
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Create a fast map of item_key -> CandidateVerificationItem
  const itemsMap = React.useMemo(() => {
    const map = new Map<string, any>();
    if (checklistData?.verification_items) {
      for (const it of checklistData.verification_items) {
        map.set(it.item_key, it);
      }
    } else if (application?.verification_items) {
      for (const it of application.verification_items) {
        map.set(it.item_key, it);
      }
    }
    return map;
  }, [checklistData, application]);

  // Documents by category lookup
  const docsByCategory = React.useMemo(() => {
    const map: Record<string, CandidateDocument> = {};
    if (application?.documents) {
      for (const doc of application.documents) {
        map[doc.category] = doc;
      }
    }
    return map;
  }, [application]);

  // All verification items list
  const allItems = React.useMemo(() => {
    return checklistData?.verification_items || application?.verification_items || [];
  }, [checklistData, application]);

  const currentStatus = checklistData?.application_status || application?.status || 'PENDING';
  const currentProgress = checklistData?.verification_progress || application?.verification_progress || {
    total_items: 0,
    completed_items: 0,
    mandatory_items: 0,
    completed_mandatory_items: 0,
    percentage: 0,
  };

  // Determine eligible uploaded documents for bulk completion
  const { eligibleDocs, ineligibleDocItems } = React.useMemo(() => {
    const eligible: Array<{ item: any; doc: CandidateDocument }> = [];
    const ineligible: Array<{ item: any; reason: string }> = [];

    const catMap: Record<string, string> = {
      doc_aadhaar: 'aadhaar_card',
      doc_pan: 'pan_card',
      doc_bank_passbook: 'bank_passbook',
      doc_cancelled_cheque: 'cancelled_cheque',
      doc_marksheet_10th: 'marksheet_10th',
      doc_marksheet_12th: 'marksheet_12th',
      doc_previous_employment: 'previous_employment',
    };

    for (const it of allItems) {
      const isDoc = it.item_key.startsWith('doc_') || it.item_category === 'document';
      if (!isDoc) continue;

      if (it.status === 'DONE') continue;

      const cat = catMap[it.item_key] || it.item_key.replace('doc_', '');
      const doc = docsByCategory[cat];

      if (!doc) {
        ineligible.push({
          item: it,
          reason: 'Document has not been uploaded by candidate',
        });
      } else {
        eligible.push({ item: it, doc });
      }
    }

    return { eligibleDocs: eligible, ineligibleDocItems: ineligible };
  }, [allItems, docsByCategory]);

  // Check mandatory detail items
  const mandatoryDetailKeys = React.useMemo(() => {
    const keys = [
      'personal_info',
      'contact_info',
      'current_address',
      'permanent_address',
      'location_allocation',
      'bank_details',
      'current_salary',
      'asking_salary',
    ];
    if (itemsMap.has('negotiated_salary')) {
      keys.push('negotiated_salary');
    }
    return keys;
  }, [itemsMap]);

  const areDetailsComplete = mandatoryDetailKeys.every(
    (k) => itemsMap.get(k)?.status === 'DONE'
  );

  const isAadhaarDone = itemsMap.get('doc_aadhaar')?.status === 'DONE';
  const isPanDone = itemsMap.get('doc_pan')?.status === 'DONE';
  const isBankDocDone =
    itemsMap.get('doc_bank_passbook')?.status === 'DONE' ||
    itemsMap.get('doc_cancelled_cheque')?.status === 'DONE';
  const isBankDocSatisfied = isBankDocDone;

  const isVerificationComplete =
    areDetailsComplete && isAadhaarDone && isPanDone && isBankDocDone;

  // Pending mandatory checks for approval modal warnings
  const pendingMandatoryLabels = React.useMemo(() => {
    const pending: string[] = [];
    for (const k of mandatoryDetailKeys) {
      if (itemsMap.get(k)?.status !== 'DONE') {
        pending.push(itemsMap.get(k)?.item_label || k);
      }
    }
    if (!isAadhaarDone) pending.push('Aadhaar Card');
    if (!isPanDone) pending.push('PAN Card');
    if (!isBankDocDone) pending.push('Bank Passbook or Cancelled Cheque');
    return pending;
  }, [mandatoryDetailKeys, itemsMap, isAadhaarDone, isPanDone, isBankDocDone]);

  const handleMarkDone = async (itemKey: string, remarks?: string) => {
    if (!appId) return;
    setUpdatingKey(itemKey);
    setFeedbackMessage(null);
    try {
      await markDoneMutation.mutateAsync({
        applicationId: appId,
        itemKey,
        remarks,
      });
      setFeedbackMessage({ type: 'success', text: `Item marked as verified.` });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to update verification status.',
      });
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleReset = async (itemKey: string, remarks?: string) => {
    if (!appId) return;
    setUpdatingKey(itemKey);
    setFeedbackMessage(null);
    try {
      await resetMutation.mutateAsync({
        applicationId: appId,
        itemKey,
        remarks,
      });
      setFeedbackMessage({ type: 'success', text: `Item reset to Pending.` });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to reset item.',
      });
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleConfirmApprove = async () => {
    if (!appId) return;
    setFeedbackMessage(null);
    try {
      await approveMutation.mutateAsync(appId);
      setIsApproveModalOpen(false);
      setFeedbackMessage({
        type: 'success',
        text: `Candidate application ${application?.application_number} approved successfully. Opening letter generation workspace...`,
      });
      // Immediately open the letter generation and review workspace for the approved candidate
      navigate(`/documents/${appId}/letters`);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to approve candidate.',
      });
    }
  };

  const handleConfirmReject = async () => {
    if (!appId) return;
    if (!rejectionReason.trim()) {
      setRejectError('A valid rejection reason must be provided.');
      return;
    }
    setRejectError(null);
    setFeedbackMessage(null);
    try {
      await rejectMutation.mutateAsync({
        applicationId: appId,
        reason: rejectionReason.trim(),
      });
      setIsRejectModalOpen(false);
      setFeedbackMessage({
        type: 'success',
        text: `Candidate application ${application?.application_number} has been rejected.`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to reject candidate.',
      });
    }
  };

  const handleConfirmBulkDone = async () => {
    if (!appId) return;
    setFeedbackMessage(null);
    try {
      const res = await bulkDoneMutation.mutateAsync(appId);
      setIsBulkModalOpen(false);
      if (res.marked_done_count > 0) {
        if (res.ineligible_items && res.ineligible_items.length > 0) {
          const reasons = res.ineligible_items.map((i) => `${i.item_label} (${i.reason})`).join('; ');
          setFeedbackMessage({
            type: 'success',
            text: `Bulk verification complete: ${res.marked_done_count} uploaded document(s) verified. Some could not be verified: ${reasons}`,
          });
        } else {
          setFeedbackMessage({
            type: 'success',
            text: `Bulk verification complete: ${res.marked_done_count} uploaded document(s) marked as Verified.`,
          });
        }
      } else {
        if (res.ineligible_items && res.ineligible_items.length > 0) {
          const reasons = res.ineligible_items.map((i) => `${i.item_label} (${i.reason})`).join('; ');
          setFeedbackMessage({
            type: 'error',
            text: `No uploaded documents could be verified: ${reasons}`,
          });
        } else {
          setFeedbackMessage({
            type: 'success',
            text: `All uploaded documents for this candidate are already verified.`,
          });
        }
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to complete bulk document verification.',
      });
    }
  };

  const pendingSelectableItems = React.useMemo(() => {
    return allItems.filter((it) => it.status !== 'DONE');
  }, [allItems]);

  const toggleSelectItem = (key: string) => {
    setSelectedItemKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAllPending = () => {
    if (selectedItemKeys.size === pendingSelectableItems.length) {
      setSelectedItemKeys(new Set());
    } else {
      setSelectedItemKeys(new Set(pendingSelectableItems.map((it) => it.item_key)));
    }
  };

  const getRowSelectProps = (key: string) => ({
    selectable: canVerify && itemsMap.get(key)?.status !== 'DONE',
    isSelected: selectedItemKeys.has(key),
    onToggleSelect: () => toggleSelectItem(key),
  });

  const selectedItemsList = React.useMemo(() => {
    return Array.from(selectedItemKeys).map((key) => {
      const item = itemsMap.get(key);
      return {
        key,
        label: item?.item_label || key,
        category: item?.item_category || 'item',
        isMandatory: item?.is_mandatory ?? true,
      };
    });
  }, [selectedItemKeys, itemsMap]);

  const handleConfirmBulkSelectedDone = async () => {
    if (!appId || selectedItemKeys.size === 0) return;
    setFeedbackMessage(null);
    try {
      const keys = Array.from(selectedItemKeys);
      const res = await bulkDoneMutation.mutateAsync({
        applicationId: appId,
        itemKeys: keys,
      });
      setSelectedItemKeys(new Set());
      setIsBulkSelectionModalOpen(false);
      if (res.ineligible_items && res.ineligible_items.length > 0) {
        const ineligibles = res.ineligible_items.map((i) => `${i.item_label}: ${i.reason}`).join('; ');
        setFeedbackMessage({
          type: 'success',
          text: `Marked ${res.marked_done_count} item(s) as Done. Some items could not be marked Done: ${ineligibles}`,
        });
      } else {
        setFeedbackMessage({
          type: 'success',
          text: `Successfully marked ${res.marked_done_count} selected item(s) as Done in the database.`,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to bulk mark selected items as Done.',
      });
    }
  };

  if (isAppLoading || isChecklistLoading) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading application workspace from database...</p>
      </div>
    );
  }

  if (appError || !application) {
    return (
      <div className="p-8 text-center space-y-4 max-w-lg mx-auto my-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Application Not Found</h3>
        <p className="text-xs text-slate-500">
          The requested candidate application could not be retrieved. It may have been removed or you do not have permission to inspect it.
        </p>
        <GlassButton variant="primary" size="sm" onClick={() => navigate('/documents')}>
          Back to Candidate Verification
        </GlassButton>
      </div>
    );
  }

  const formattedSubmittedDate = new Date(application.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-3.5 pb-10 max-w-7xl mx-auto">
      {/* 1. Compact Application Header */}
      <div className="bg-white/95 border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Back button + Application ID + Status + Candidate Name + Date */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/documents')}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
              title="Back to candidate list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  {application.application_number}
                </span>
                <VerificationStatusBadge status={currentStatus} size="sm" />
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Submitted: <strong className="text-slate-700">{formattedSubmittedDate}</strong>
                </span>
              </div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
                {application.full_name}
              </h1>
            </div>
          </div>

          {/* Right: Security Control (Mask) & Final Candidate-Level Approve / Reject Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canVerify && (
              <GlassButton
                variant={unmaskSensitive ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setUnmaskSensitive(!unmaskSensitive)}
                leftIcon={unmaskSensitive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                className="text-xs py-1 px-2.5"
              >
                {unmaskSensitive ? 'Mask Sensitive Data' : 'Reveal Identifiers'}
              </GlassButton>
            )}

            {/* If approved, show button to generate / review LOI and Offer Letter */}
            {currentStatus === 'APPROVED' ? (
              <button
                type="button"
                onClick={() => navigate(`/documents/${appId}/letters`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-2xs transition-colors"
                title="Open Letter of Intent and Offer Letter management workspace"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Generate & Review Letters</span>
              </button>
            ) : (
              /* Candidate-Level Approve Action (Enforced by candidates:approve) */
              canApprove && (
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-2xs transition-colors"
                  title="Approve Candidate"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve Candidate</span>
                </button>
              )
            )}

            {/* Candidate-Level Reject Action (Enforced by candidates:reject) */}
            {canReject && (
              <button
                type="button"
                onClick={() => {
                  setRejectionReason(application.rejection_reason || '');
                  setRejectError(null);
                  setIsRejectModalOpen(true);
                }}
                disabled={currentStatus === 'REJECTED'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition-colors"
                title="Reject Candidate"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject Candidate</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Status Banner: Rejection Notice */}
      {currentStatus === 'REJECTED' && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5 shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 flex-1 min-w-0">
            <div className="font-bold text-rose-900 flex flex-wrap items-center gap-2">
              <span>Candidate Application Rejected</span>
              {application.reviewed_by_name && (
                <span className="text-[11px] font-normal text-rose-700">
                  • Reviewed by <strong>{application.reviewed_by_name}</strong>
                  {application.reviewed_at &&
                    ` on ${new Date(application.reviewed_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}`}
                </span>
              )}
            </div>
            {application.rejection_reason && (
              <p className="text-rose-800">
                <strong>Rejection Reason:</strong> {application.rejection_reason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Global Status Banner: Approval Notice */}
      {currentStatus === 'APPROVED' && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="font-bold text-emerald-900 flex flex-wrap items-center gap-2">
                <span>Candidate Application Approved</span>
                {application.reviewed_by_name && (
                  <span className="text-[11px] font-normal text-emerald-700">
                    • Approved by <strong>{application.reviewed_by_name}</strong>
                    {application.reviewed_at &&
                      ` on ${new Date(application.reviewed_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`}
                  </span>
                )}
              </div>
              <p className="text-emerald-800">
                All mandatory verification checks have been completed and formally approved. Both Letter of Intent and Offer Letter are ready for review and dispatch.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/documents/${appId}/letters`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-2xs transition-colors shrink-0 self-start sm:self-center"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate & Review Letters</span>
          </button>
        </div>
      )}

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-2.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
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

      {/* 2. Compact Application Overview Bar (Clean, Denser summary items rather than oversized cards) */}
      <div className="bg-white/90 border border-slate-200/90 rounded-xl p-3 shadow-2xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2 bg-slate-50/80 border border-slate-100 rounded-lg">
            <span className="text-slate-400 text-[10px] block font-medium uppercase tracking-wider">Candidate</span>
            <span className="font-bold text-slate-900 truncate block mt-0.5">{application.full_name}</span>
          </div>
          <div className="p-2 bg-slate-50/80 border border-slate-100 rounded-lg">
            <span className="text-slate-400 text-[10px] block font-medium uppercase tracking-wider">Hero Category</span>
            <span className="font-bold text-indigo-700 block mt-0.5">{application.hero_category}</span>
          </div>
          <div className="p-2 bg-slate-50/80 border border-slate-100 rounded-lg">
            <span className="text-slate-400 text-[10px] block font-medium uppercase tracking-wider">Role Applied</span>
            <span className="font-bold text-indigo-700 block mt-0.5 truncate">{application.role_applied}</span>
          </div>
          <div className="p-2 bg-slate-50/80 border border-slate-100 rounded-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Progress</span>
              <span className="font-bold text-[11px] text-indigo-700">
                {currentProgress.completed_items}/{currentProgress.total_items} ({currentProgress.percentage}%)
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  currentProgress.percentage === 100
                    ? 'bg-emerald-600'
                    : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, currentProgress.percentage))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bulk Selection & Quick Actions Toolbar */}
      {canVerify && pendingSelectableItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 px-3.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={pendingSelectableItems.length > 0 && selectedItemKeys.size === pendingSelectableItems.length}
                onChange={handleSelectAllPending}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <span>Select All Pending Items ({pendingSelectableItems.length})</span>
            </label>
            {selectedItemKeys.size > 0 && (
              <span className="text-xs text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                {selectedItemKeys.size} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedItemKeys.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedItemKeys(new Set())}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkSelectionModalOpen(true)}
                  disabled={bulkDoneMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-2xs transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Bulk Mark as Done ({selectedItemKeys.size})</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 4. Verification Sections — Compact List Layout */}

      {/* Section B: Personal & Contact Information */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span>Section B: Personal & Contact Information</span>
          </h3>
          <span className="text-[11px] text-slate-400">2 verification items</span>
        </div>

        <div className="space-y-1.5">
          {/* Row: Personal Information */}
          {itemsMap.get('personal_info') && (
            <CompactVerificationRow
              item={itemsMap.get('personal_info')}
              itemKey="personal_info"
              itemLabel="Personal Information"
              isMandatory={itemsMap.get('personal_info').is_mandatory}
              categoryIcon={<User className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('personal_info').status}
              summary={
                <span>
                  Aadhaar: <span className="font-mono">{unmaskSensitive && application.aadhaar_number ? application.aadhaar_number : application.aadhaar_number_masked || application.aadhaar_masked || '••••••••••••'}</span>
                  {' • '}
                  PAN: <span className="font-mono">{unmaskSensitive && application.pan_number ? application.pan_number : application.pan_number_masked || application.pan_masked || '••••••••••'}</span>
                </span>
              }
              detailsContent={
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Full Name</span>
                    <strong className="text-slate-900">{application.full_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Aadhaar Number</span>
                    <strong className="font-mono text-slate-900">
                      {unmaskSensitive && application.aadhaar_number
                        ? application.aadhaar_number
                        : application.aadhaar_number_masked || application.aadhaar_masked || '••••••••••••'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">PAN Number</span>
                    <strong className="font-mono text-slate-900">
                      {unmaskSensitive && application.pan_number
                        ? application.pan_number
                        : application.pan_number_masked || application.pan_masked || '••••••••••'}
                    </strong>
                  </div>
                </div>
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'personal_info'}
              canVerify={canVerify}
              {...getRowSelectProps('personal_info')}
            />
          )}

          {/* Row: Contact Information */}
          {itemsMap.get('contact_info') && (
            <CompactVerificationRow
              item={itemsMap.get('contact_info')}
              itemKey="contact_info"
              itemLabel="Contact Information"
              isMandatory={itemsMap.get('contact_info').is_mandatory}
              categoryIcon={<User className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('contact_info').status}
              summary={
                <span>
                  Mobile: <span className="font-mono">{unmaskSensitive ? application.mobile_number : application.mobile_number_masked || application.mobile_number}</span>
                  {' • '}
                  Email: {application.email}
                </span>
              }
              detailsContent={
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mobile Number</span>
                    <strong className="font-mono text-slate-900">
                      {unmaskSensitive
                        ? application.mobile_number
                        : application.mobile_number_masked || application.mobile_number}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email Address</span>
                    <strong className="text-slate-900">{application.email}</strong>
                  </div>
                </div>
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'contact_info'}
              canVerify={canVerify}
              {...getRowSelectProps('contact_info')}
            />
          )}
        </div>
      </div>

      {/* Section C: Address Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>Section C: Address Details</span>
          </h3>
          <span className="text-[11px] text-slate-400">2 verification items</span>
        </div>

        <div className="space-y-1.5">
          {/* Row: Current Address */}
          {itemsMap.get('current_address') && (
            <CompactVerificationRow
              item={itemsMap.get('current_address')}
              itemKey="current_address"
              itemLabel="Current Address"
              isMandatory={itemsMap.get('current_address').is_mandatory}
              categoryIcon={<MapPin className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('current_address').status}
              summary={
                <span>
                  {application.current_city}, {application.current_state} — <span className="font-mono">{application.current_pin_code || application.current_pincode}</span>
                </span>
              }
              detailsContent={
                <div className="space-y-1 text-xs text-slate-800">
                  <p className="font-medium">{application.current_address_line1}</p>
                  {application.current_address_line2 && <p>{application.current_address_line2}</p>}
                  <p>
                    {application.current_city}, {application.current_state} —{' '}
                    <span className="font-mono font-semibold">{application.current_pin_code || application.current_pincode}</span>
                  </p>
                  <p className="text-slate-400 text-[11px]">{application.current_country}</p>
                </div>
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'current_address'}
              canVerify={canVerify}
              {...getRowSelectProps('current_address')}
            />
          )}

          {/* Row: Permanent Address */}
          {itemsMap.get('permanent_address') && (
            <CompactVerificationRow
              item={itemsMap.get('permanent_address')}
              itemKey="permanent_address"
              itemLabel="Permanent Address"
              isMandatory={itemsMap.get('permanent_address').is_mandatory}
              categoryIcon={<MapPin className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('permanent_address').status}
              summary={
                application.is_permanent_same ? (
                  <span className="text-indigo-700 font-medium">Same as Current Address</span>
                ) : (
                  <span>
                    {application.permanent_city}, {application.permanent_state} — <span className="font-mono">{application.permanent_pin_code || application.permanent_pincode}</span>
                  </span>
                )
              }
              detailsContent={
                <div className="space-y-1 text-xs text-slate-800">
                  {application.is_permanent_same && (
                    <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded mb-1">
                      Same as Current Address
                    </span>
                  )}
                  <p className="font-medium">{application.permanent_address_line1}</p>
                  {application.permanent_address_line2 && <p>{application.permanent_address_line2}</p>}
                  <p>
                    {application.permanent_city}, {application.permanent_state} —{' '}
                    <span className="font-mono font-semibold">{application.permanent_pin_code || application.permanent_pincode}</span>
                  </p>
                  <p className="text-slate-400 text-[11px]">{application.permanent_country}</p>
                </div>
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'permanent_address'}
              canVerify={canVerify}
              {...getRowSelectProps('permanent_address')}
            />
          )}
        </div>
      </div>

      {/* Section D: Bank Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-indigo-600" />
            <span>Section D: Bank Account Details</span>
          </h3>
          <span className="text-[11px] text-slate-400">1 verification item</span>
        </div>

        <div className="space-y-1.5">
          {itemsMap.get('bank_details') && (
            <CompactVerificationRow
              item={itemsMap.get('bank_details')}
              itemKey="bank_details"
              itemLabel="Bank Account Details"
              isMandatory={itemsMap.get('bank_details').is_mandatory}
              categoryIcon={<Building className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('bank_details').status}
              summary={
                <span>
                  {application.bank_name} • A/C:{' '}
                  <span className="font-mono">
                    {unmaskSensitive && application.account_number
                      ? application.account_number
                      : application.account_number_masked || application.account_masked || '••••••••••••'}
                  </span>
                  {' • '}IFSC: <span className="font-mono">{application.ifsc_code}</span>
                </span>
              }
              detailsContent={
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Account Holder</span>
                    <strong className="text-slate-900">{application.account_holder_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Bank Name</span>
                    <strong className="text-slate-900">{application.bank_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Account Number</span>
                    <strong className="font-mono text-slate-900">
                      {unmaskSensitive && application.account_number
                        ? application.account_number
                        : application.account_number_masked || application.account_masked || '••••••••••••'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">IFSC Code</span>
                    <strong className="font-mono text-slate-900">{application.ifsc_code}</strong>
                  </div>
                  {application.branch_name && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">Branch Name</span>
                      <strong className="text-slate-900">{application.branch_name}</strong>
                    </div>
                  )}
                </div>
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'bank_details'}
              canVerify={canVerify}
              {...getRowSelectProps('bank_details')}
            />
          )}
        </div>
      </div>

      {/* Section E: Location & Salary Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
            <span>Section E: Location Allocation & Salary Verification</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            {itemsMap.get('negotiated_salary') ? '4 items' : '3 items'}
          </span>
        </div>

        <div className="space-y-1.5">
          {/* Location Allocation */}
          {itemsMap.get('location_allocation') && (
            <CompactVerificationRow
              item={itemsMap.get('location_allocation')}
              itemKey="location_allocation"
              itemLabel="Circle, District & Block"
              isMandatory={itemsMap.get('location_allocation').is_mandatory}
              categoryIcon={<MapPin className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('location_allocation').status}
              summary={
                <span>
                  Circle: {application.circle} • District: {application.district} • Block: {application.block}
                </span>
              }
              detailsContent={
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Circle:</span>
                    <strong className="text-slate-900">{application.circle}</strong>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400">District(s):</span>
                    <div className="flex flex-wrap gap-1">
                      {application.selected_districts && application.selected_districts.length > 0 ? (
                        application.selected_districts.map((d, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                            {d.name}
                          </span>
                        ))
                      ) : (
                        <strong className="text-slate-900">{application.district}</strong>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400">Block(s):</span>
                    <div className="flex flex-wrap gap-1">
                      {application.selected_blocks && application.selected_blocks.length > 0 ? (
                        application.selected_blocks.map((b, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-medium">
                            {b.name}{b.district_name ? ` (${b.district_name})` : ''}
                          </span>
                        ))
                      ) : (
                        <strong className="text-slate-900">{application.block}</strong>
                      )}
                    </div>
                  </div>
                </div>
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'location_allocation'}
              canVerify={canVerify}
              {...getRowSelectProps('location_allocation')}
            />
          )}

          {/* Current Salary */}
          {itemsMap.get('current_salary') && (
            <CompactVerificationRow
              item={itemsMap.get('current_salary')}
              itemKey="current_salary"
              itemLabel="Current Salary"
              isMandatory={itemsMap.get('current_salary').is_mandatory}
              categoryIcon={<CreditCard className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('current_salary').status}
              summary={<span>₹{Number(application.current_salary).toLocaleString('en-IN')} / month</span>}
              detailsContent={
                <div>
                  <span className="text-slate-400 block text-[11px]">Current Salary (Monthly)</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    ₹{Number(application.current_salary).toLocaleString('en-IN')}
                  </div>
                </div>
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'current_salary'}
              canVerify={canVerify}
              {...getRowSelectProps('current_salary')}
            />
          )}

          {/* Asking Salary */}
          {itemsMap.get('asking_salary') && (
            <CompactVerificationRow
              item={itemsMap.get('asking_salary')}
              itemKey="asking_salary"
              itemLabel="Asking Salary"
              isMandatory={itemsMap.get('asking_salary').is_mandatory}
              categoryIcon={<CreditCard className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('asking_salary').status}
              summary={<span>₹{Number(application.asking_salary).toLocaleString('en-IN')} / month</span>}
              detailsContent={
                <div>
                  <span className="text-slate-400 block text-[11px]">Asking Salary (Monthly)</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    ₹{Number(application.asking_salary).toLocaleString('en-IN')}
                  </div>
                </div>
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'asking_salary'}
              canVerify={canVerify}
              {...getRowSelectProps('asking_salary')}
            />
          )}

          {/* Negotiated Salary */}
          {itemsMap.get('negotiated_salary') && (
            <CompactVerificationRow
              item={itemsMap.get('negotiated_salary')}
              itemKey="negotiated_salary"
              itemLabel="Negotiated Salary"
              isMandatory={itemsMap.get('negotiated_salary').is_mandatory}
              categoryIcon={<CreditCard className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('negotiated_salary').status}
              summary={<span>₹{Number(application.negotiated_salary).toLocaleString('en-IN')} / month</span>}
              detailsContent={
                <div>
                  <span className="text-slate-400 block text-[11px]">Negotiated Agreed Salary (Monthly)</span>
                  <div className="text-base font-bold text-indigo-700 mt-0.5">
                    ₹{Number(application.negotiated_salary).toLocaleString('en-IN')}
                  </div>
                </div>
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'negotiated_salary'}
              canVerify={canVerify}
              {...getRowSelectProps('negotiated_salary')}
            />
          )}
        </div>
      </div>

      {/* Section F: Document Verification Workspace */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Section F: Document Verification</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Inspect physical or digital credentials and verify legitimacy.
            </p>
          </div>

          {/* Requirement 2: Dedicated "Mark All Uploaded Documents as Verified" button */}
          {canBulkVerify && currentStatus !== 'APPROVED' && (
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              disabled={eligibleDocs.length === 0 || bulkDoneMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs self-start sm:self-auto shrink-0"
              title={
                eligibleDocs.length === 0
                  ? 'All uploaded documents are already verified'
                  : `Mark ${eligibleDocs.length} uploaded documents as Verified`
              }
            >
              <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Mark All Uploaded Documents as Verified ({eligibleDocs.length})</span>
            </button>
          )}
        </div>

        {/* Bank Proof Alternative Rule Banner */}
        <div
          className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
            isBankDocSatisfied
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
              : 'bg-amber-50/70 border-amber-300 text-amber-900'
          }`}
        >
          {isBankDocSatisfied ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <div className="flex-1">
            <strong>Bank Document Rule:</strong> Either a verified <strong>Bank Passbook</strong> OR a verified <strong>Cancelled Cheque</strong> satisfies the bank proof requirement.
            {isBankDocSatisfied ? (
              <span className="ml-1 text-emerald-700 font-bold">✓ Requirement satisfied.</span>
            ) : (
              <span className="ml-1 text-amber-700 font-medium">(Awaiting verification of at least one uploaded bank document)</span>
            )}
          </div>
        </div>

        {/* Compact Document Rows List */}
        <div className="space-y-1.5">
          {/* Aadhaar Card */}
          {itemsMap.get('doc_aadhaar') && (
            <CompactVerificationRow
              item={itemsMap.get('doc_aadhaar')}
              itemKey="doc_aadhaar"
              itemLabel="Aadhaar Card"
              isMandatory={itemsMap.get('doc_aadhaar').is_mandatory}
              categoryIcon={<FileText className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('doc_aadhaar').status}
              summary={
                docsByCategory['aadhaar_card'] ? (
                  <span>
                    {docsByCategory['aadhaar_card'].original_filename} ({(docsByCategory['aadhaar_card'].file_size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold">Missing file upload</span>
                )
              }
              documentAction={
                docsByCategory['aadhaar_card'] ? (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(docsByCategory['aadhaar_card'])}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                ) : null
              }
              detailsContent={
                docsByCategory['aadhaar_card'] ? (
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        {docsByCategory['aadhaar_card'].original_filename}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {(docsByCategory['aadhaar_card'].file_size / (1024 * 1024)).toFixed(2)} MB • Uploaded & Available
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-rose-600 font-medium">Missing file upload by candidate</span>
                )
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'doc_aadhaar'}
              canVerify={canVerify}
              actionDisabled={!docsByCategory['aadhaar_card']}
              disabledReason="Aadhaar Card file must be uploaded before verification"
              {...getRowSelectProps('doc_aadhaar')}
            />
          )}

          {/* PAN Card */}
          {itemsMap.get('doc_pan') && (
            <CompactVerificationRow
              item={itemsMap.get('doc_pan')}
              itemKey="doc_pan"
              itemLabel="PAN Card"
              isMandatory={itemsMap.get('doc_pan').is_mandatory}
              categoryIcon={<FileText className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('doc_pan').status}
              summary={
                docsByCategory['pan_card'] ? (
                  <span>
                    {docsByCategory['pan_card'].original_filename} ({(docsByCategory['pan_card'].file_size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold">Missing file upload</span>
                )
              }
              documentAction={
                docsByCategory['pan_card'] ? (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(docsByCategory['pan_card'])}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                ) : null
              }
              detailsContent={
                docsByCategory['pan_card'] ? (
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        {docsByCategory['pan_card'].original_filename}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {(docsByCategory['pan_card'].file_size / (1024 * 1024)).toFixed(2)} MB • Uploaded & Available
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-rose-600 font-medium">Missing file upload by candidate</span>
                )
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'doc_pan'}
              canVerify={canVerify}
              actionDisabled={!docsByCategory['pan_card']}
              disabledReason="PAN Card file must be uploaded before verification"
              {...getRowSelectProps('doc_pan')}
            />
          )}

          {/* Bank Passbook */}
          {itemsMap.get('doc_bank_passbook') ? (
            <CompactVerificationRow
              item={itemsMap.get('doc_bank_passbook')}
              itemKey="doc_bank_passbook"
              itemLabel="Bank Passbook"
              isMandatory={itemsMap.get('doc_bank_passbook').is_mandatory}
              categoryIcon={<FileText className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('doc_bank_passbook').status}
              summary={
                docsByCategory['bank_passbook'] ? (
                  <span>
                    {docsByCategory['bank_passbook'].original_filename} ({(docsByCategory['bank_passbook'].file_size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                ) : (
                  <span className="text-slate-400">Alternative cancelled cheque provided</span>
                )
              }
              documentAction={
                docsByCategory['bank_passbook'] ? (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(docsByCategory['bank_passbook'])}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                ) : null
              }
              detailsContent={
                docsByCategory['bank_passbook'] ? (
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        {docsByCategory['bank_passbook'].original_filename}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {(docsByCategory['bank_passbook'].file_size / (1024 * 1024)).toFixed(2)} MB • Uploaded
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500">Not provided (Alternative cancelled cheque uploaded)</span>
                )
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'doc_bank_passbook'}
              canVerify={canVerify}
              actionDisabled={!docsByCategory['bank_passbook']}
              disabledReason="Bank Passbook file must be uploaded before verification"
              {...getRowSelectProps('doc_bank_passbook')}
            />
          ) : (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Bank Passbook</span>
              <span className="text-[10px] font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                Not Provided (Cheque uploaded)
              </span>
            </div>
          )}

          {/* Cancelled Cheque */}
          {itemsMap.get('doc_cancelled_cheque') ? (
            <CompactVerificationRow
              item={itemsMap.get('doc_cancelled_cheque')}
              itemKey="doc_cancelled_cheque"
              itemLabel="Cancelled Cheque"
              isMandatory={itemsMap.get('doc_cancelled_cheque').is_mandatory}
              categoryIcon={<FileText className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('doc_cancelled_cheque').status}
              summary={
                docsByCategory['cancelled_cheque'] ? (
                  <span>
                    {docsByCategory['cancelled_cheque'].original_filename} ({(docsByCategory['cancelled_cheque'].file_size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                ) : (
                  <span className="text-slate-400">Alternative passbook provided</span>
                )
              }
              documentAction={
                docsByCategory['cancelled_cheque'] ? (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(docsByCategory['cancelled_cheque'])}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                ) : null
              }
              detailsContent={
                docsByCategory['cancelled_cheque'] ? (
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        {docsByCategory['cancelled_cheque'].original_filename}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {(docsByCategory['cancelled_cheque'].file_size / (1024 * 1024)).toFixed(2)} MB • Uploaded
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500">Not provided (Alternative passbook uploaded)</span>
                )
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'doc_cancelled_cheque'}
              canVerify={canVerify}
              actionDisabled={!docsByCategory['cancelled_cheque']}
              disabledReason="Cancelled Cheque file must be uploaded before verification"
              {...getRowSelectProps('doc_cancelled_cheque')}
            />
          ) : (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Cancelled Cheque</span>
              <span className="text-[10px] font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                Not Provided (Passbook uploaded)
              </span>
            </div>
          )}

          {/* Optional Credentials */}
          {itemsMap.get('doc_marksheet_10th') ? (
            <CompactVerificationRow
              item={itemsMap.get('doc_marksheet_10th')}
              itemKey="doc_marksheet_10th"
              itemLabel="10th Marksheet"
              isMandatory={itemsMap.get('doc_marksheet_10th').is_mandatory}
              categoryIcon={<FileText className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('doc_marksheet_10th').status}
              summary={
                docsByCategory['marksheet_10th'] ? (
                  <span>{docsByCategory['marksheet_10th'].original_filename}</span>
                ) : (
                  <span className="text-slate-400">Optional — not uploaded</span>
                )
              }
              documentAction={
                docsByCategory['marksheet_10th'] ? (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(docsByCategory['marksheet_10th'])}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                ) : null
              }
              detailsContent={
                docsByCategory['marksheet_10th'] ? (
                  <span className="text-slate-800 font-medium">{docsByCategory['marksheet_10th'].original_filename}</span>
                ) : (
                  <span className="text-slate-400">Optional credential not uploaded</span>
                )
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'doc_marksheet_10th'}
              canVerify={canVerify}
              actionDisabled={!docsByCategory['marksheet_10th']}
              disabledReason="10th Marksheet file must be uploaded before verification"
              {...getRowSelectProps('doc_marksheet_10th')}
            />
          ) : (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">10th Marksheet</span>
              <span className="text-[10px] font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                Optional — Not Uploaded
              </span>
            </div>
          )}

          {itemsMap.get('doc_marksheet_12th') ? (
            <CompactVerificationRow
              item={itemsMap.get('doc_marksheet_12th')}
              itemKey="doc_marksheet_12th"
              itemLabel="12th Marksheet"
              isMandatory={itemsMap.get('doc_marksheet_12th').is_mandatory}
              categoryIcon={<FileText className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('doc_marksheet_12th').status}
              summary={
                docsByCategory['marksheet_12th'] ? (
                  <span>{docsByCategory['marksheet_12th'].original_filename}</span>
                ) : (
                  <span className="text-slate-400">Optional — not uploaded</span>
                )
              }
              documentAction={
                docsByCategory['marksheet_12th'] ? (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(docsByCategory['marksheet_12th'])}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                ) : null
              }
              detailsContent={
                docsByCategory['marksheet_12th'] ? (
                  <span className="text-slate-800 font-medium">{docsByCategory['marksheet_12th'].original_filename}</span>
                ) : (
                  <span className="text-slate-400">Optional credential not uploaded</span>
                )
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'doc_marksheet_12th'}
              canVerify={canVerify}
              actionDisabled={!docsByCategory['marksheet_12th']}
              disabledReason="12th Marksheet file must be uploaded before verification"
              {...getRowSelectProps('doc_marksheet_12th')}
            />
          ) : (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">12th Marksheet</span>
              <span className="text-[10px] font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                Optional — Not Uploaded
              </span>
            </div>
          )}

          {itemsMap.get('doc_previous_employment') ? (
            <CompactVerificationRow
              item={itemsMap.get('doc_previous_employment')}
              itemKey="doc_previous_employment"
              itemLabel="Previous Employment Records"
              isMandatory={itemsMap.get('doc_previous_employment').is_mandatory}
              categoryIcon={<FileText className="w-4 h-4 text-indigo-600" />}
              status={itemsMap.get('doc_previous_employment').status}
              summary={
                docsByCategory['previous_employment'] ? (
                  <span>{docsByCategory['previous_employment'].original_filename}</span>
                ) : (
                  <span className="text-slate-400">Optional — not uploaded</span>
                )
              }
              documentAction={
                docsByCategory['previous_employment'] ? (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(docsByCategory['previous_employment'])}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                ) : null
              }
              detailsContent={
                docsByCategory['previous_employment'] ? (
                  <span className="text-slate-800 font-medium">{docsByCategory['previous_employment'].original_filename}</span>
                ) : (
                  <span className="text-slate-400">Optional credential not uploaded</span>
                )
              }
              onMarkDone={handleMarkDone}
              onReset={handleReset}
              isUpdating={updatingKey === 'doc_previous_employment'}
              canVerify={canVerify}
              actionDisabled={!docsByCategory['previous_employment']}
              disabledReason="Previous employment record must be uploaded before verification"
              {...getRowSelectProps('doc_previous_employment')}
            />
          ) : (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Employment Records</span>
              <span className="text-[10px] font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                Optional — Not Uploaded
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Document Inspection Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Requirement 2: Bulk Mark All Uploaded Documents as Verified Confirmation Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Mark All Uploaded Documents as Verified"
        maxWidth="md"
      >
        <div className="space-y-3.5 text-xs">
          {eligibleDocs.length === 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-700">
              <p className="font-semibold text-slate-900">No eligible uploaded documents pending verification.</p>
              <p className="text-slate-500">
                All currently uploaded documents are already marked as Verified. Any remaining checklist items are either details or un-uploaded optional documents.
              </p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-indigo-900">
                  <CheckCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{eligibleDocs.length} uploaded documents eligible for verification</span>
                </div>
                <p className="text-indigo-800">
                  You are about to verify all currently uploaded candidate documents in one action. This will record your reviewer credentials and decision timestamp in the audit trail.
                </p>
              </div>

              {/* Uploaded Documents List */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 block">Uploaded Documents to be Verified:</span>
                <ul className="space-y-1.5">
                  {eligibleDocs.map(({ item, doc }) => (
                    <li key={item.item_key} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-slate-700">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="font-semibold truncate">{item.item_label}:</span>
                        <span className="text-slate-500 truncate max-w-xs">{doc.original_filename}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {(doc.file_size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Ineligible (un-uploaded) documents warning if any */}
              {ineligibleDocItems.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-950">
                  <span className="font-bold text-amber-900 text-[11px]">
                    Note: {ineligibleDocItems.length} document items will remain Pending (No file uploaded)
                  </span>
                  <ul className="list-disc list-inside text-amber-900 space-y-0.5 text-[11px]">
                    {ineligibleDocItems.map(({ item }) => (
                      <li key={item.item_key}>
                        <strong>{item.item_label}</strong>: Not uploaded
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Important Safeguard Notice */}
              <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600 text-[11px] space-y-1 border border-slate-200">
                <p className="font-bold text-slate-800">Important Safeguards:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                  <li>Only the uploaded documents listed above will be marked Verified.</li>
                  <li>Personal details, addresses, and salary checks will remain Pending.</li>
                  <li>This bulk action does NOT automatically approve the candidate.</li>
                </ul>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => setIsBulkModalOpen(false)}
              disabled={bulkDoneMutation.isPending}
            >
              Cancel
            </GlassButton>
            {eligibleDocs.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmBulkDone}
                disabled={bulkDoneMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 shadow-2xs transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>
                  {bulkDoneMutation.isPending
                    ? 'Verifying...'
                    : `Confirm & Verify All (${eligibleDocs.length}) Documents`}
                </span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Requirement 3: Approve Candidate Modal */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Confirm Candidate Approval"
        maxWidth="md"
      >
        <div className="space-y-3.5 text-xs">
          {!isVerificationComplete ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Candidate details or verification checks are incomplete.</p>
                <p className="mt-1 text-amber-800">
                  You can approve this candidate now and generate their Offer Letter using available details. Missing items will remain blank without blocking letter generation.
                </p>
                {pendingMandatoryLabels.length > 0 && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Pending items: {pendingMandatoryLabels.join(', ')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">All mandatory verification checks are satisfied.</p>
                <p className="mt-1 text-emerald-800">
                  Approving this candidate will record the final <strong>Approved</strong> status in the database and store your reviewer authorization in the audit trail.
                </p>
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-700">
            <div>Candidate: <strong className="text-slate-900">{application.full_name || '—'}</strong></div>
            <div>Application ID: <strong className="font-mono text-slate-900">{application.application_number}</strong></div>
            <div>Role: <strong className="text-slate-900">{application.hero_category || '—'} — {application.role_applied || '—'}</strong></div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => setIsApproveModalOpen(false)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </GlassButton>
            <button
              type="button"
              onClick={handleConfirmApprove}
              disabled={approveMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 shadow-2xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{approveMutation.isPending ? 'Saving Approval...' : 'Confirm Candidate Approval'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Requirement 3: Reject Candidate Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Candidate Application"
        maxWidth="md"
      >
        <div className="space-y-3.5 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Confirm candidate rejection.</p>
              <p className="mt-1 text-rose-800">
                This action will persist a <strong>Rejected</strong> status and your rejection reason in the database. Application records and uploaded files will remain intact in the audit history.
              </p>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 space-y-0.5">
            <div>Candidate: <strong className="text-slate-900">{application.full_name}</strong></div>
            <div>Ref: <strong className="font-mono text-slate-900">{application.application_number}</strong></div>
          </div>

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
              placeholder="Enter detailed reason for candidate rejection (required)..."
              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 shadow-2xs"
            />
            {rejectError && <p className="text-xs text-rose-600">{rejectError}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </GlassButton>
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 shadow-2xs transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Mark as Done Confirmation Modal */}
      <Modal
        isOpen={isBulkSelectionModalOpen}
        onClose={() => setIsBulkSelectionModalOpen(false)}
        title="Confirm Bulk Mark as Done"
        maxWidth="md"
      >
        <div className="space-y-3.5 text-xs">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-indigo-900">
              <CheckCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Bulk Mark {selectedItemsList.length} Selected Items as Done</span>
            </div>
            <p className="text-indigo-800">
              You are about to mark {selectedItemsList.length} verification items as Done for candidate <strong>{application.full_name}</strong>.
              The backend will validate each item and record your reviewer credentials and timestamp in the audit trail.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 max-h-60 overflow-y-auto">
            <span className="font-bold text-slate-800 block">Selected Items:</span>
            <ul className="space-y-1.5">
              {selectedItemsList.map((item) => (
                <li key={item.key} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{item.label}</span>
                    <span className="text-[10px] text-slate-400 capitalize">({item.category})</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    item.isMandatory
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {item.isMandatory ? 'Mandatory' : 'Optional'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => setIsBulkSelectionModalOpen(false)}
              disabled={bulkDoneMutation.isPending}
            >
              Cancel
            </GlassButton>
            <button
              type="button"
              onClick={handleConfirmBulkSelectedDone}
              disabled={bulkDoneMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 shadow-2xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{bulkDoneMutation.isPending ? 'Marking as Done...' : `Confirm Mark as Done (${selectedItemsList.length})`}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
