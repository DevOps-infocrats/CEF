import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { Modal } from '@/components/Modal';
import { apiClient } from '@/api/apiClient';
import {
  useCandidateLetters,
  useUpdateCandidateLetter,
  useSendCandidateLetters,
} from '../hooks/useLetters';
import {
  FileText,
  FileCheck2,
  Mail,
  Send,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  DollarSign,
  ArrowLeft,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye,
  Save,
  RotateCw,
} from 'lucide-react';

export const CandidateLetterReviewPage: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();

  const { data: lettersData, isLoading, isError, error, refetch } = useCandidateLetters(appId);
  const updateLetterMutation = useUpdateCandidateLetter(appId);
  const sendLettersMutation = useSendCandidateLetters(appId);

  const [activeTab, setActiveTab] = useState<'loi' | 'offer'>('loi');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for Letter of Intent
  const [loiFields, setLoiFields] = useState<Record<string, any>>({});
  // Form states for Offer Letter
  const [offerFields, setOfferFields] = useState<Record<string, any>>({});

  // PDF Preview State
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(true);

  // Confirmation modal
  const [isSendModalOpen, setIsSendModalOpen] = useState<boolean>(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);
  const [sendScope, setSendScope] = useState<'both' | 'letter_of_intent' | 'offer_letter'>('both');

  // Populate form fields from lettersData
  useEffect(() => {
    if (lettersData) {
      setLoiFields(lettersData.letter_of_intent?.field_values || {});
      setOfferFields(lettersData.offer_letter?.field_values || {});
    }
  }, [lettersData]);

  // Load candidate PDF into Blob URL for inline iframe preview
  useEffect(() => {
    let isCancelled = false;
    const fetchPdfPreview = async () => {
      if (!appId) return;
      setIsPdfLoading(true);
      try {
        const letterType = activeTab === 'loi' ? 'letter_of_intent' : 'offer_letter';
        const res = await apiClient.get<Blob>(
          `/applications/${appId}/letters/${letterType}/download?format=pdf&inline=1`,
          { responseType: 'blob' }
        );
        if (!isCancelled) {
          const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          setPdfBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          setCurrentPage(1);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF preview:', err);
        }
      } finally {
        if (!isCancelled) setIsPdfLoading(false);
      }
    };

    fetchPdfPreview();
    return () => {
      isCancelled = true;
    };
  }, [appId, activeTab, lettersData]);

  const application = lettersData?.application;
  const loiLetter = lettersData?.letter_of_intent;
  const offerLetter = lettersData?.offer_letter;

  const currentLetter = activeTab === 'loi' ? loiLetter : offerLetter;
  const totalPages = currentLetter?.page_count || (activeTab === 'loi' ? 2 : 5);

  // Validation
  const loiJoining = loiFields['joining_date']?.trim();
  const offerJoining = offerFields['joining_date']?.trim();
  const isJoiningMissing = !loiJoining || !offerJoining;

  const handleSalaryChange = (val: string) => {
    const monthlyNum = parseFloat(val) || 0;
    const basic = Math.round(monthlyNum * 0.6);
    const medical = 45;
    const bonus = Math.round(basic * 0.0833);
    const gratuity = Math.round(basic * 0.0481);
    const other = Math.max(0, monthlyNum - basic - medical - bonus - gratuity);
    const gross = monthlyNum;
    const deductions = 45;
    const takeHome = gross - deductions;
    const yearly = monthlyNum * 12;

    const updated = {
      monthly_salary: val,
      total_salary: val,
      monthly_ctc: String(monthlyNum),
      yearly_ctc: String(yearly),
      total_ctc_monthly: String(monthlyNum),
      basic_monthly: String(basic),
      basic_yearly: String(basic * 12),
      hra_monthly: '0',
      hra_yearly: '0',
      conveyance_monthly: '0',
      conveyance_yearly: '0',
      other_allowance_monthly: String(other),
      other_allowance_yearly: String(other * 12),
      medical_monthly: String(medical),
      medical_yearly: String(medical * 12),
      bonus_monthly: String(bonus),
      bonus_yearly: String(bonus * 12),
      gratuity_monthly: String(gratuity),
      gratuity_yearly: String(gratuity * 12),
      gross_monthly: String(gross),
      gross_yearly: String(gross * 12),
      deductions_monthly: String(deductions),
      deductions_yearly: String(deductions * 12),
      take_home_monthly: String(takeHome),
      take_home_yearly: String(takeHome * 12),
      net_take_home_monthly: String(takeHome),
      net_take_home_yearly: String(takeHome * 12),
    };

    setLoiFields((prev) => ({ ...prev, monthly_salary: val, total_salary: val }));
    setOfferFields((prev) => ({ ...prev, ...updated }));
  };

  const handleSaveDraft = (type: 'letter_of_intent' | 'offer_letter') => {
    const values = type === 'letter_of_intent' ? loiFields : offerFields;
    setFeedback(null);
    updateLetterMutation.mutate(
      {
        letterType: type,
        fieldValues: values,
      },
      {
        onSuccess: () => {
          setFeedback({
            type: 'success',
            text: `${type === 'letter_of_intent' ? 'Letter of Intent' : 'Offer Letter'} updated and regenerated successfully.`,
          });
          refetch();
        },
        onError: (err: any) => {
          setFeedback({
            type: 'error',
            text: err?.response?.data?.message || err?.message || 'Failed to save draft.',
          });
        },
      }
    );
  };



  const handleConfirmSend = () => {
    if (!appId) return;
    setFeedback(null);
    sendLettersMutation.mutate(
      { forceResend: true, documentScope: sendScope },
      {
        onSuccess: (data) => {
          setIsSendModalOpen(false);
          setFeedback({
            type: 'success',
            text: `Congratulations! The reviewed PDF letter(s) were successfully emailed to '${data.recipient}'.`,
          });
          refetch();
        },
        onError: (err: any) => {
          setFeedback({
            type: 'error',
            text: err?.response?.data?.message || err?.message || 'Failed to send letters.',
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs uppercase tracking-widest text-slate-400 font-mono">
          Loading Letter Workspace...
        </span>
      </div>
    );
  }

  if (isError || !application) {
    const errorResponse = (error as any)?.response?.data;
    const errorMessage =
      errorResponse?.message ||
      (error as any)?.message ||
      (application ? `Candidate application status is '${application.status}'. Letters can only be generated for APPROVED candidates.` : 'Unable to find or load the candidate letter records.');

    const isApprovalError =
      (error as any)?.response?.status === 400 &&
      errorMessage.toLowerCase().includes('approved');

    return (
      <div className="max-w-4xl mx-auto p-6">
        <GlassCard className="p-8 text-center bg-rose-50/60 border-rose-200">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">
            {isApprovalError ? 'Candidate Not Approved' : 'Unable to Load Letters'}
          </h2>
          <p className="text-xs text-slate-600 mt-2 max-w-lg mx-auto">
            {errorMessage}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <RotateCw className="w-3.5 h-3.5 mr-1.5" />
              Retry Loading
            </button>
            <Link to="/documents">
              <GlassButton variant="secondary" className="text-xs">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Document Verification
              </GlassButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const isSent = loiLetter?.status === 'SENT' && offerLetter?.status === 'SENT';

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-16 animate-fade-in">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/documents/${appId}`)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
            title="Back to Candidate Verification"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Candidate Letter Review & Dispatch Workspace
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Approved Candidate
              </span>
              {isSent && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-indigo-600" />
                  Letters Dispatched
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Original master Word templates remain untouched. Review candidate-specific letters page-by-page before emailing final PDFs.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <GlassButton
            type="button"
            variant="secondary"
            onClick={() => handleSaveDraft(activeTab === 'loi' ? 'letter_of_intent' : 'offer_letter')}
            isLoading={updateLetterMutation.isPending}
            className="text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span>Save Draft</span>
          </GlassButton>

          <GlassButton
            type="button"
            variant="primary"
            onClick={() => {
              if (isJoiningMissing) {
                setFeedback({
                  type: 'error',
                  text: 'Mandatory field: Joining Date must be entered before letters can be sent.',
                });
                return;
              }
              setConfirmCheckbox(false);
              setIsSendModalOpen(true);
            }}
            disabled={sendLettersMutation.isPending}
            className="text-xs py-2 px-4 bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Send Letters</span>
          </GlassButton>
        </div>
      </div>

      {/* Candidate Profile Summary Header Card */}
      <GlassCard className="bg-white/95 border-slate-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Candidate Name</span>
            <span className="font-bold text-slate-900 text-sm">{application.full_name}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Application ID</span>
            <span className="font-mono font-semibold text-slate-700">{application.application_number}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Approved Role</span>
            <span className="font-semibold text-slate-800">{application.role_applied}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Registered Email</span>
            <span className="font-semibold text-slate-800">{application.email}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Assigned Location</span>
            <span className="font-semibold text-slate-800">
              {application.district}, {application.current_state}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Missing Joining Date Alert Banner */}
      {isJoiningMissing && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <span className="font-bold block text-sm mb-0.5">Mandatory Action: Joining Date is Required</span>
            Please specify the candidate's agreed service start date in the field on the left. The official Letter of Intent and Offer Letter require this mandatory field before email dispatch.
          </div>
        </div>
      )}

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="text-xs font-medium leading-relaxed">{feedback.text}</div>
        </div>
      )}

      {/* Dual Document Workspace Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('loi');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'loi'
              ? 'border-indigo-600 text-indigo-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>1. Letter of Intent (LOI)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
            2 Pages
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              loiLetter?.status === 'SENT'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-indigo-50 text-indigo-700'
            }`}
          >
            {loiLetter?.status || 'DRAFT'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('offer');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'offer'
              ? 'border-indigo-600 text-indigo-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>2. Appointment & Offer Letter (FFPL)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
            5 Pages
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              offerLetter?.status === 'SENT'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-indigo-50 text-indigo-700'
            }`}
          >
            {offerLetter?.status || 'DRAFT'}
          </span>
        </button>
      </div>

      {/* Main Workspace Split: Controls vs. Real Multi-Page Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Controls & Candidate-Specific Fields */}
        <div className="lg:col-span-5 space-y-4">
          <GlassCard className="bg-white/95 border-slate-200 p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  {activeTab === 'loi' ? 'Letter of Intent Parameters' : 'Offer Letter & Salary Structure'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Edits modify only this candidate's working document. The master Word template remains read-only.
                </p>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Joining / Reporting Date <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 01/11/2026"
                    value={activeTab === 'loi' ? (loiFields['joining_date'] || '') : (offerFields['joining_date'] || '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLoiFields((p) => ({ ...p, joining_date: v }));
                      setOfferFields((p) => ({ ...p, joining_date: v }));
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-lg border font-mono ${
                      isJoiningMissing
                        ? 'border-amber-400 bg-amber-50/40 text-amber-900 focus:border-amber-600'
                        : 'border-slate-300 text-slate-900 focus:border-indigo-600'
                    } focus:outline-none`}
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Synchronized across both the Letter of Intent and Offer Letter.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Monthly Compensation (INR) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={loiFields['monthly_salary'] || '40000'}
                    onChange={(e) => handleSalaryChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 font-mono focus:border-indigo-600 focus:outline-none"
                  />
                  <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Annual CTC: ₹{(Number(loiFields['monthly_salary'] || 40000) * 12).toLocaleString()}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Assigned Work Location
                </label>
                <input
                  type="text"
                  value={activeTab === 'loi' ? (loiFields['approved_location'] || '') : (offerFields['approved_location'] || '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (activeTab === 'loi') setLoiFields((p) => ({ ...p, approved_location: v }));
                    else setOfferFields((p) => ({ ...p, approved_location: v }));
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              {activeTab === 'offer' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Company Appointment Reference ID
                  </label>
                  <input
                    type="text"
                    value={offerFields['reference_number'] || ''}
                    onChange={(e) => setOfferFields((p) => ({ ...p, reference_number: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 font-mono focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Annexure II Structured Breakdown in Offer Letter Tab */}
            {activeTab === 'offer' && (
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Annexure II Salary Heads
                </h4>
                <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200/80 max-h-52 overflow-y-auto">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-700">Basic (60%)</span>
                    <span className="font-mono text-slate-900">₹{offerFields['basic_monthly'] || '0'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-700">Advance Bonus</span>
                    <span className="font-mono text-slate-900">₹{offerFields['bonus_monthly'] || '0'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-700">Advance Gratuity</span>
                    <span className="font-mono text-slate-900">₹{offerFields['gratuity_monthly'] || '0'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-700">Medical Allowance</span>
                    <span className="font-mono text-slate-900">₹{offerFields['medical_monthly'] || '45'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-700">Other Allowances</span>
                    <span className="font-mono text-slate-900">₹{offerFields['other_allowance_monthly'] || '0'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-700">GPA Insurance</span>
                    <span className="font-mono text-slate-900">-₹45</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-slate-900 bg-indigo-50/70 px-2 rounded">
                    <span>Net Take Home</span>
                    <span className="font-mono text-indigo-700">₹{offerFields['take_home_monthly'] || '0'}</span>
                  </div>
                </div>
              </div>
            )}

          </GlassCard>
        </div>

        {/* RIGHT COLUMN: Full Page-by-Page Document Preview */}
        <div className="lg:col-span-7 space-y-3">
          <GlassCard className="bg-white/95 border-slate-200 p-4 space-y-3 shadow-md">
            {/* Document Header & Navigation Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-900 text-xs">
                  {activeTab === 'loi' ? 'Letter of Intent' : 'Appointment & Offer Letter'} Preview
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                  Candidate Master Copy — High-Fidelity Word Layout
                </span>
              </div>

              {/* Page Controls & Actions */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2.5 text-xs font-mono font-semibold text-slate-700 select-none">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => refetch()}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                  title="Reload Preview"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveDraft(activeTab === 'loi' ? 'letter_of_intent' : 'offer_letter')}
                  disabled={updateLetterMutation.isPending}
                  className="p-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors flex items-center gap-1 text-xs font-semibold"
                  title={`Save ${activeTab === 'loi' ? 'Letter of Intent' : 'Offer Letter'} Changes`}
                >
                  {updateLetterMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span className="hidden sm:inline">Save</span>
                </button>

                <a
                  href={`/api/v1/applications/${appId}/letters/${activeTab === 'loi' ? 'letter_of_intent' : 'offer_letter'}/download?format=pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex items-center gap-1 text-xs"
                  title="Download Reviewed PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </a>
              </div>
            </div>

            {/* Quick Page Jump Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <span className="text-slate-400 font-medium mr-1">Jump to page:</span>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setCurrentPage(pNum)}
                  className={`px-2 py-0.5 rounded font-mono font-semibold transition-all ${
                    currentPage === pNum
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Page {pNum}
                  {activeTab === 'offer' && pNum === 5 && ' (Annexure II)'}
                  {activeTab === 'offer' && (pNum === 3 || pNum === 4) && ' (Annexure I)'}
                </button>
              ))}
            </div>

            {/* Document Rendering Surface */}
            <div className="relative w-full min-h-[820px] max-h-[920px] overflow-y-auto bg-slate-100/70 rounded-xl p-2 sm:p-3 border border-slate-200">
              {isPdfLoading ? (
                <div className="h-[780px] flex flex-col items-center justify-center gap-3 bg-white/80 rounded-lg">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <span className="text-xs font-medium text-slate-600">
                    Generating document preview...
                  </span>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  key={`${pdfBlobUrl}#page=${currentPage}`}
                  src={`${pdfBlobUrl}#page=${currentPage}&toolbar=0&navpanes=0`}
                  title="Reviewed Candidate Letter PDF Preview"
                  className="w-full h-[780px] border-0 bg-white rounded-lg shadow-sm"
                />
              ) : (
                <div className="h-[780px] flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                  <span>Unable to render preview inline. Click Download PDF above to view the document.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>
                Format: Microsoft Word master document rendered via native PDF engine preserving exact layout, fonts, margins, stamps, and tables.
              </span>
              <span>
                {activeTab === 'loi' ? '2 of 2 pages rendered' : '5 of 5 pages rendered (including Annexures I & II)'}
              </span>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Confirmation Modal: Send Letters */}
      <Modal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        title="Confirm Letter Dispatch to Candidate"
        description="Verify candidate contact and generated document attachments before final transmission."
      >
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Candidate Name:</span>
              <span className="font-bold text-slate-900">{application.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Recipient Email:</span>
              <span className="font-mono font-bold text-indigo-700">{application.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Service Start / Joining Date:</span>
              <span className="font-bold text-slate-900">{loiJoining || offerJoining}</span>
            </div>
          </div>

          <div>
            <span className="font-bold text-slate-800 block mb-1.5">Select Documents to Send:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSendScope('both')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  sendScope === 'both'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">Both Documents</div>
                <div className="text-[11px] text-slate-500">LOI + Offer Letter</div>
              </button>

              <button
                type="button"
                onClick={() => setSendScope('letter_of_intent')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  sendScope === 'letter_of_intent'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">Only LOI</div>
                <div className="text-[11px] text-slate-500">Letter of Intent PDF</div>
              </button>

              <button
                type="button"
                onClick={() => setSendScope('offer_letter')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  sendScope === 'offer_letter'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">Only Offer Letter</div>
                <div className="text-[11px] text-slate-500">FFPL 5-page PDF</div>
              </button>
            </div>

            <span className="font-bold text-slate-800 block mb-1.5">Attached PDF Document(s):</span>
            <div className="space-y-1.5">
              {(sendScope === 'both' || sendScope === 'letter_of_intent') && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50/60 border border-indigo-100 text-indigo-900 font-medium">
                  <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span className="truncate">Letter_of_Intent_{application.full_name.replace(/\s+/g, '_')}.pdf</span>
                </div>
              )}
              {(sendScope === 'both' || sendScope === 'offer_letter') && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50/60 border border-indigo-100 text-indigo-900 font-medium">
                  <FileCheck2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span className="truncate">Offer_Letter_{application.full_name.replace(/\s+/g, '_')}.pdf</span>
                </div>
              )}
            </div>
          </div>

          <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmCheckbox}
              onChange={(e) => setConfirmCheckbox(e.target.checked)}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-slate-600 leading-snug">
              I confirm that the selected document(s) have been reviewed page-by-page, details are accurate, and the candidate's joining date is finalized.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => setIsSendModalOpen(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              disabled={!confirmCheckbox || sendLettersMutation.isPending}
              isLoading={sendLettersMutation.isPending}
              onClick={handleConfirmSend}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Send className="w-4 h-4 mr-1.5" />
              <span>Confirm & Send Email</span>
            </GlassButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};
