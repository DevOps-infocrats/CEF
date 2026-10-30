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

import { letterService } from '../services/letterService';

import { InteractiveLetterOfIntent, LoiLetterContent } from '../components/InteractiveLetterOfIntent';

import { InteractiveOfferLetter, OfferLetterContent } from '../components/InteractiveOfferLetter';

import { GlassInput } from '@/components/GlassInput';

import { useCurrentUser } from '@/features/auth/hooks/useAuth';

import {

  FileText,

  FileCheck2,

  Mail,

  Send,

  Download,

  AlertTriangle,

  AlertCircle,

  CheckCircle2,

  ArrowLeft,

  Loader2,

  ChevronLeft,

  ChevronRight,

  Eye,

  Save,

  RotateCw,

  FileCode,

  Edit3,

  Calendar,

} from 'lucide-react';



export const CandidateLetterReviewPage: React.FC = () => {

  const { appId } = useParams<{ appId: string }>();

  const navigate = useNavigate();



  const { data: lettersData, isLoading, isError, error, refetch } = useCandidateLetters(appId);

  const updateLetterMutation = useUpdateCandidateLetter(appId);

  const sendLettersMutation = useSendCandidateLetters(appId);



  const [activeTab, setActiveTab] = useState<'loi' | 'offer'>('loi');

  const [currentPage, setCurrentPage] = useState<number>(1);

  const [viewMode, setViewMode] = useState<'interactive' | 'pdf'>('interactive');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);



  // User authorization

  const { data: currentUser } = useCurrentUser();

  const userRoles = currentUser?.roles || [];

  const permissions = currentUser?.permissions || [];

  const isAdmin = userRoles.includes('admin') || permissions.includes('users:manage');

  const canEdit =

    isAdmin ||

    permissions.includes('candidates:approve') ||

    permissions.includes('candidates:edit') ||

    permissions.includes('candidates:write') ||

    permissions.includes('letters:generate');



  // Candidate field values

  const [loiFields, setLoiFields] = useState<Record<string, any>>({});

  const [offerFields, setOfferFields] = useState<Record<string, any>>({});



  // Dynamic content & in-place text edits

  const [loiContent, setLoiContent] = useState<LoiLetterContent>({});

  const [offerContent, setOfferContent] = useState<OfferLetterContent>({});

  const [loiTextEdits, setLoiTextEdits] = useState<Record<string, string>>({});

  const [offerTextEdits, setOfferTextEdits] = useState<Record<string, string>>({});

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);



  // Joining Date Edit Modal State

  const [isJoiningDateModalOpen, setIsJoiningDateModalOpen] = useState<boolean>(false);

  const [joiningDateInput, setJoiningDateInput] = useState<string>('');

  const [joiningDateError, setJoiningDateError] = useState<string | null>(null);

  const [isSavingJoiningDate, setIsSavingJoiningDate] = useState<boolean>(false);



  // PDF Preview State

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);



  // Confirmation modal

  const [isSendModalOpen, setIsSendModalOpen] = useState<boolean>(false);

  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);

  const [sendScope, setSendScope] = useState<'both' | 'letter_of_intent' | 'offer_letter'>('both');

  const [showEmailPreview, setShowEmailPreview] = useState<boolean>(false);

  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);

  const [isEmailPreviewLoading, setIsEmailPreviewLoading] = useState<boolean>(false);

  const [smtpStatus, setSmtpStatus] = useState<{

    success: boolean;

    mode: 'smtp' | 'not_configured' | 'smtp_error';

    message: string;

    config?: { host: string | null; port: number; sender_email: string };

  } | null>(null);



  useEffect(() => {

    if (isSendModalOpen) {

      letterService

        .getSmtpStatus()

        .then((data) => setSmtpStatus(data))

        .catch(() => setSmtpStatus(null));

    }

  }, [isSendModalOpen]);



  const handleToggleEmailPreview = async () => {

    if (showEmailPreview) {

      setShowEmailPreview(false);

      return;

    }

    if (!appId) return;

    setIsEmailPreviewLoading(true);

    try {

      const data = await letterService.previewCandidateEmail(appId, sendScope);

      setEmailPreviewHtml(data.html);

      setShowEmailPreview(true);

    } catch (err: any) {

      alert(err.response?.data?.message || 'Failed to generate email preview.');

    } finally {

      setIsEmailPreviewLoading(false);

    }

  };



  // Populate state from lettersData

  useEffect(() => {

    if (lettersData) {

      const loiF = lettersData.letter_of_intent?.field_values || {};

      const offerF = lettersData.offer_letter?.field_values || {};

      setLoiFields(loiF);

      setOfferFields(offerF);



      // Initialize content from server response including persistent content_edits

      const loiContentEdits =

        (loiF as any)?.content_edits ||

        (lettersData.letter_of_intent?.content as any)?.content_edits ||

        {};

      const serverLoiContent = {

        ...(lettersData.letter_of_intent?.content?.field_values || {}),

        ...loiContentEdits,

      };

      setLoiContent((prev) => ({ ...serverLoiContent, ...loiF, ...prev }));



      const offerContentEdits =

        (offerF as any)?.content_edits ||

        (lettersData.offer_letter?.content as any)?.content_edits ||

        {};

      const serverOfferContent = {

        ...(lettersData.offer_letter?.content?.field_values || {}),

        ...offerContentEdits,

      };

      setOfferContent((prev) => ({ ...serverOfferContent, ...offerF, ...prev }));

    }

  }, [lettersData]);



  const application = lettersData?.application;

  const loiLetter = lettersData?.letter_of_intent;

  const offerLetter = lettersData?.offer_letter;

  const activeLetter = activeTab === 'loi' ? loiLetter : offerLetter;

  const letterVersion = activeLetter?.version;

  const letterEditedAt = activeLetter?.last_edited_at;



  // Load candidate PDF into Blob URL when in PDF view mode

  useEffect(() => {

    if (viewMode !== 'pdf') return;

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

  }, [appId, activeTab, viewMode, letterVersion, letterEditedAt]);





  const totalPages = activeTab === 'loi' ? 2 : 5;



  // Validation & Joining Date resolution

  const loiJoining = loiFields['joining_date']?.trim();

  const offerJoining = offerFields['joining_date']?.trim();

  const currentJoining = loiJoining || offerJoining || (lettersData?.application as any)?.joining_date || '';

  const isJoiningMissing = !currentJoining;



  // Helper date conversions and validation

  const toInputDateFormat = (dmy: string): string => {

    if (!dmy) return '';

    const parts = dmy.split('/');

    if (parts.length === 3) {

      const [d, m, y] = parts;

      return `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

    }

    return dmy;

  };



  const toDisplayDateFormat = (ymd: string): string => {

    if (!ymd) return '';

    const parts = ymd.split('-');

    if (parts.length === 3) {

      const [y, m, d] = parts;

      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;

    }

    return ymd;

  };



  const isValidJoiningDate = (dateStr: string): boolean => {

    if (!dateStr || !dateStr.trim()) return false;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {

      const [y, m, d] = dateStr.split('-').map(Number);

      const dateObj = new Date(y, m - 1, d);

      return dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d;

    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {

      const [d, m, y] = dateStr.split('/').map(Number);

      const dateObj = new Date(y, m - 1, d);

      return dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d;

    }

    return false;

  };



  const handleOpenEditJoiningModal = () => {

    setJoiningDateInput(currentJoining ? toInputDateFormat(currentJoining) : '');

    setJoiningDateError(null);

    setIsJoiningDateModalOpen(true);

  };



  const handleSaveJoiningDate = async () => {

    if (!joiningDateInput.trim()) {

      setJoiningDateError('Please select or enter a valid Joining Date.');

      return;

    }

    if (!isValidJoiningDate(joiningDateInput.trim())) {

      setJoiningDateError('Invalid date. Please choose a valid calendar date in DD/MM/YYYY format.');

      return;

    }



    const formattedDate = joiningDateInput.includes('-')

      ? toDisplayDateFormat(joiningDateInput.trim())

      : joiningDateInput.trim();



    setIsSavingJoiningDate(true);

    setJoiningDateError(null);



    // Capture previous state in case of failure

    const prevLoiJoining = loiFields['joining_date'];

    const prevOfferJoining = offerFields['joining_date'];



    try {

      const activeType = activeTab === 'loi' ? 'letter_of_intent' : 'offer_letter';

      await updateLetterMutation.mutateAsync({

        letterType: activeType,

        fieldValues: {

          ...(activeType === 'letter_of_intent' ? loiFields : offerFields),

          joining_date: formattedDate,

        },

      });



      // Update both local states immediately upon confirmation

      setLoiFields((prev) => ({ ...prev, joining_date: formattedDate }));

      setOfferFields((prev) => ({ ...prev, joining_date: formattedDate }));

      setLoiContent((prev) => ({

        ...prev,

        joining_date: formattedDate,

        p_start_date: `Start Date of Services: ${formattedDate}`,

      }));

      setOfferContent((prev) => ({

        ...prev,

        joining_date: formattedDate,

        p16: `You are requested to join on or before Dated: ${formattedDate}.`,

      }));



      setIsJoiningDateModalOpen(false);

      setFeedback({

        type: 'success',

        text: `Candidate Joining Date updated successfully to ${formattedDate}.`,

      });



      // Synchronize compiled documents

      refetch();

    } catch (err: any) {

      // Preserve previously saved value on failure

      setLoiFields((prev) => ({ ...prev, joining_date: prevLoiJoining }));

      setOfferFields((prev) => ({ ...prev, joining_date: prevOfferJoining }));

      const errorMsg =

        err?.response?.data?.message || err?.message || 'Failed to update Joining Date. Please try again.';

      setJoiningDateError(errorMsg);

    } finally {

      setIsSavingJoiningDate(false);

    }

  };



  // Handle in-place text edits on LOI

  const handleLoiTextChange = (key: string, newText: string) => {

    setLoiContent((prev) => ({ ...prev, [key]: newText }));

    setLoiTextEdits((prev) => ({ ...prev, [key]: newText }));

    setHasUnsavedChanges(true);

  };



  // Handle in-place field updates on LOI

  const handleLoiFieldChange = (field: string, value: string) => {

    setLoiFields((prev) => ({ ...prev, [field]: value }));

    // Synchronize joining date and candidate name to offer letter

    if (field === 'joining_date') {

      setOfferFields((prev) => ({ ...prev, joining_date: value }));

    }

    if (field === 'candidate_full_name') {

      setOfferFields((prev) => ({ ...prev, candidate_full_name: value }));

    }

    if (field === 'monthly_salary') {

      handleSalaryRecalculate(value);

    }

    setHasUnsavedChanges(true);

  };



  // Handle in-place text edits on Offer Letter

  const handleOfferTextChange = (key: string, newText: string) => {

    setOfferContent((prev) => ({ ...prev, [key]: newText }));

    setOfferTextEdits((prev) => ({ ...prev, [key]: newText }));

    setHasUnsavedChanges(true);

  };



  // Handle in-place field updates on Offer Letter

  const handleOfferFieldChange = (field: string, value: string) => {

    setOfferFields((prev) => ({ ...prev, [field]: value }));

    if (field === 'joining_date') {

      setLoiFields((prev) => ({ ...prev, joining_date: value }));

    }

    if (field === 'candidate_full_name') {

      setLoiFields((prev) => ({ ...prev, candidate_full_name: value }));

    }

    setHasUnsavedChanges(true);

  };



  // Salary recalculation

  const handleSalaryRecalculate = (val: string) => {

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



  // Save changes to candidate document

  const handleSaveDraft = (type?: 'letter_of_intent' | 'offer_letter') => {

    const targetType = type || (activeTab === 'loi' ? 'letter_of_intent' : 'offer_letter');

    const values = targetType === 'letter_of_intent' ? loiFields : offerFields;

    const textEdits = targetType === 'letter_of_intent' ? loiTextEdits : offerTextEdits;

    const allContent = targetType === 'letter_of_intent' ? loiContent : offerContent;



    const currentDoc = targetType === 'letter_of_intent' ? loiLetter : offerLetter;

    const mergedContentEdits = {

      ...((currentDoc?.field_values as any)?.content_edits || {}),

      ...allContent,

      ...textEdits,

    };



    setFeedback(null);

    updateLetterMutation.mutate(

      {

        letterType: targetType,

        fieldValues: {

          ...values,

          content_edits: mergedContentEdits,

        },

        textEdits: mergedContentEdits,

      },

      {

        onSuccess: (data: any) => {

          setHasUnsavedChanges(false);

          const savedEdits = (data?.field_values as any)?.content_edits || mergedContentEdits;

          if (targetType === 'letter_of_intent') {

            setLoiContent((prev) => ({ ...prev, ...savedEdits }));

            setLoiTextEdits({});

          } else {

            setOfferContent((prev) => ({ ...prev, ...savedEdits }));

            setOfferTextEdits({});

          }

          setFeedback({

            type: 'success',

            text: `Changes saved successfully to candidate's ${targetType === 'letter_of_intent' ? 'Letter of Intent' : 'Offer Letter'

              }. Master template remains pristine.`,

          });

          refetch();

        },

        onError: (err: any) => {

          setFeedback({

            type: 'error',

            text: err?.response?.data?.message || err?.message || 'Failed to save changes. Your unsaved edits have been preserved.',

          });

        },

      }

    );

  };



  // Email dispatch

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

            text: `Letters successfully emailed to candidate '${data.recipient}'.`,

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

          Loading Candidate Letters...

        </span>

      </div>

    );

  }



  if (isError || !application) {

    const errorResponse = (error as any)?.response?.data;

    const errorMessage =

      errorResponse?.message ||

      (error as any)?.message ||

      'Unable to find or load the candidate letter records.';



    return (

      <div className="max-w-4xl mx-auto p-6">

        <GlassCard className="p-8 text-center bg-rose-50/60 border-rose-200">

          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />

          <h2 className="text-lg font-bold text-slate-900">Unable to Load Letters</h2>

          <p className="text-xs text-slate-600 mt-2 max-w-lg mx-auto">{errorMessage}</p>

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

    <div className="max-w-6xl mx-auto space-y-4 pb-16 animate-fade-in">

      {/* Top Header Navigation */}

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

                Candidate Letter Workspace

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

              Original master Word templates remain strictly read-only. Click any text directly on the letter to edit in place.

            </p>

          </div>

        </div>



        {/* Action Controls */}

        <div className="flex items-center gap-2">

          {canEdit && (

            <GlassButton

              type="button"

              variant="secondary"

              onClick={handleOpenEditJoiningModal}

              leftIcon={<Calendar className="w-3.5 h-3.5 text-indigo-600" />}

              className="text-xs py-2 px-3 flex items-center gap-1.5"

              title="Edit Candidate Joining Date"

            >

              <span>Edit Joining Date</span>

            </GlassButton>

          )}



          <GlassButton

            type="button"

            variant={hasUnsavedChanges ? 'primary' : 'secondary'}

            onClick={() => handleSaveDraft()}

            isLoading={updateLetterMutation.isPending}

            className={`text-xs py-2 px-3.5 flex items-center gap-1.5 ${hasUnsavedChanges ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''

              }`}

          >

            <Save className="w-3.5 h-3.5" />

            <span>{hasUnsavedChanges ? 'Save Changes *' : 'Save Draft'}</span>

          </GlassButton>



          <GlassButton

            type="button"

            variant="primary"

            onClick={() => {

              if (isJoiningMissing) {

                setFeedback({

                  type: 'error',

                  text: 'Mandatory: Joining Date must be entered before letters can be emailed. Click on "Edit Joining Date" to specify it.',

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

      <GlassCard className="bg-white/95 border-slate-200 p-3.5">

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">

          <div>

            <span className="text-slate-400 block text-[11px]">Candidate Name</span>

            <span className="font-bold text-slate-900 text-sm truncate block">{application.full_name}</span>

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

            <span className="font-semibold text-slate-800 truncate block">{application.email}</span>

          </div>

          <div>

            <span className="text-slate-400 block text-[11px]">Assigned Location</span>

            <span className="font-semibold text-slate-800">

              {application.district}, {application.current_state}

            </span>

          </div>

          <div>

            <span className="text-slate-400 block text-[11px]">Joining Date</span>

            <div className="flex items-center gap-1.5 mt-0.5">

              <span

                className={`font-semibold ${currentJoining ? 'text-indigo-900 font-bold' : 'text-amber-600 italic'

                  }`}

              >

                {currentJoining || 'Not specified'}

              </span>

              {canEdit && (

                <button

                  type="button"

                  onClick={handleOpenEditJoiningModal}

                  className="p-1 rounded-md text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-colors"

                  title="Edit Joining Date"

                >

                  <Edit3 className="w-3.5 h-3.5" />

                </button>

              )}

            </div>

          </div>

        </div>

      </GlassCard>



      {/* Missing Joining Date Alert Banner */}

      {isJoiningMissing && (

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">

          <div className="flex items-start gap-3">

            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />

            <div className="text-xs text-amber-800 leading-relaxed">

              <span className="font-bold block text-sm mb-0.5">Mandatory: Joining Date is Required</span>

              Please specify the candidate's agreed service commencement date before letters can be sent.

            </div>

          </div>

          {canEdit && (

            <button

              type="button"

              onClick={handleOpenEditJoiningModal}

              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 shadow-2xs transition-colors shrink-0"

            >

              <Calendar className="w-3.5 h-3.5" />

              <span>Edit Joining Date</span>

            </button>

          )}

        </div>

      )}



      {/* Feedback Alert */}

      {feedback && (

        <div

          className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${feedback.type === 'success'

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



      {/* Document Workspace Tabs */}

      <div className="flex items-center justify-between border-b border-slate-200 gap-4 flex-wrap">

        <div className="flex items-center gap-4">

          <button

            type="button"

            onClick={() => {

              setActiveTab('loi');

              setCurrentPage(1);

            }}

            className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'loi'

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

              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${loiLetter?.status === 'SENT'

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

            className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'offer'

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

              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${offerLetter?.status === 'SENT'

                ? 'bg-emerald-100 text-emerald-800'

                : 'bg-indigo-50 text-indigo-700'

                }`}

            >

              {offerLetter?.status || 'DRAFT'}

            </span>

          </button>

        </div>



        {/* View Mode Toggle: Interactive Click-to-Edit vs. Native PDF View */}

        <div className="flex items-center gap-1 pb-2">

          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center text-xs">

            <button

              type="button"

              onClick={() => setViewMode('interactive')}

              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'interactive'

                ? 'bg-white text-indigo-700 shadow-xs font-semibold'

                : 'text-slate-600 hover:text-slate-900'

                }`}

            >

              <Edit3 className="w-3.5 h-3.5" />

              <span>Interactive (Click to Edit)</span>

            </button>

            <button

              type="button"

              onClick={() => setViewMode('pdf')}

              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'pdf'

                ? 'bg-white text-indigo-700 shadow-xs font-semibold'

                : 'text-slate-600 hover:text-slate-900'

                }`}

            >

              <FileCode className="w-3.5 h-3.5" />

              <span>Compiled PDF</span>

            </button>

          </div>

        </div>

      </div>



      {/* Main Document Preview Container (Center Stage) */}

      <GlassCard className="bg-slate-50/70 border-slate-200 p-4 space-y-3 shadow-md">

        {/* Document Header & Navigation Toolbar */}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">

          <div className="flex items-center gap-2">

            <Eye className="w-4 h-4 text-indigo-600" />

            <span className="font-bold text-slate-900 text-xs">

              {activeTab === 'loi' ? 'Letter of Intent' : 'Appointment & Offer Letter'}

            </span>

            <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-200">

              Click any text on the letter to edit in place

            </span>

          </div>



          {/* Page Controls & Actions */}

          <div className="flex items-center gap-2">

            <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200 shadow-xs">

              <button

                type="button"

                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}

                disabled={currentPage <= 1}

                className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"

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

                className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"

                title="Next Page"

              >

                <ChevronRight className="w-4 h-4" />

              </button>

            </div>



            <button

              type="button"

              onClick={() => handleSaveDraft()}

              disabled={updateLetterMutation.isPending}

              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs ${hasUnsavedChanges

                ? 'border-amber-400 bg-amber-500 text-white hover:bg-amber-600'

                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'

                }`}

              title="Save Changes"

            >

              {updateLetterMutation.isPending ? (

                <Loader2 className="w-3.5 h-3.5 animate-spin" />

              ) : (

                <Save className="w-3.5 h-3.5" />

              )}

              <span>Save</span>

            </button>



            <a

              href={`/api/v1/applications/${appId}/letters/${activeTab === 'loi' ? 'letter_of_intent' : 'offer_letter'}/download?format=pdf&v=${letterVersion || 1}&t=${letterEditedAt ? new Date(letterEditedAt).getTime() : Date.now()}`}

              target="_blank"

              rel="noreferrer"

              className={`px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex items-center gap-1 text-xs shadow-xs ${updateLetterMutation.isPending ? 'pointer-events-none opacity-50' : ''

                }`}

              title="Download Reviewed PDF"

            >

              <Download className="w-3.5 h-3.5" />

              <span>PDF</span>

            </a>



            <a

              href={`/api/v1/applications/${appId}/letters/${activeTab === 'loi' ? 'letter_of_intent' : 'offer_letter'}/download?format=docx&v=${letterVersion || 1}&t=${letterEditedAt ? new Date(letterEditedAt).getTime() : Date.now()}`}

              target="_blank"

              rel="noreferrer"

              className={`px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex items-center gap-1 text-xs shadow-xs ${updateLetterMutation.isPending ? 'pointer-events-none opacity-50' : ''

                }`}

              title="Download Word (.docx) Document"

            >

              <Download className="w-3.5 h-3.5" />

              <span>DOCX</span>

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

              className={`px-2.5 py-0.5 rounded font-mono font-semibold transition-all ${currentPage === pNum

                ? 'bg-indigo-600 text-white shadow-xs'

                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'

                }`}

            >

              Page {pNum}

              {activeTab === 'offer' && pNum === 5 && ' (Annexure II Salary)'}

              {activeTab === 'offer' && (pNum === 2 || pNum === 3 || pNum === 4) && ' (Annexure I Terms)'}

            </button>

          ))}

        </div>



        {/* Central Document Page Preview */}

        <div className="min-h-[960px] py-4 bg-slate-200/60 rounded-xl p-2 sm:p-4 border border-slate-300/80 overflow-x-auto">

          {viewMode === 'interactive' ? (

            activeTab === 'loi' ? (

              <InteractiveLetterOfIntent

                page={currentPage}

                content={loiContent}

                onTextChange={handleLoiTextChange}

                loiFields={loiFields}

                onFieldChange={handleLoiFieldChange}

              />

            ) : (

              <InteractiveOfferLetter

                page={currentPage}

                content={offerContent}

                onTextChange={handleOfferTextChange}

                offerFields={offerFields}

                onFieldChange={handleOfferFieldChange}

              />

            )

          ) : isPdfLoading ? (

            <div className="h-[780px] flex flex-col items-center justify-center gap-3 bg-white rounded-lg">

              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />

              <span className="text-xs font-medium text-slate-600">Loading PDF document...</span>

            </div>

          ) : pdfBlobUrl ? (

            <iframe

              key={`${pdfBlobUrl}#page=${currentPage}`}

              src={`${pdfBlobUrl}#page=${currentPage}&toolbar=0&navpanes=0`}

              title="Official PDF Preview"

              className="w-full max-w-[800px] mx-auto h-[920px] border-0 bg-white rounded-md shadow-lg"

            />

          ) : (

            <div className="h-[780px] flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs bg-white rounded-lg">

              <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />

              <span>Unable to render inline preview. Please use the Interactive view or download the PDF.</span>

            </div>

          )}

        </div>



        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">

          <span>

            {viewMode === 'interactive'

              ? 'Interactive mode: click any text to edit directly. Edits save to this candidate\'s copy only.'

              : 'Compiled PDF view: high-fidelity document rendered via Microsoft Word engine.'}

          </span>

          <span>

            {activeTab === 'loi' ? '2 of 2 pages' : '5 of 5 pages (including Annexures I & II)'}

          </span>

        </div>

      </GlassCard>



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

              <span className="font-mono font-bold text-indigo-700">

                {application.email || <span className="text-rose-600 font-normal">Not Provided</span>}

              </span>

            </div>

            <div className="flex justify-between">

              <span className="text-slate-500">Service Start / Joining Date:</span>

              <span className="font-bold text-slate-900">{loiJoining || offerJoining || 'Not specified'}</span>

            </div>

          </div>



          {/* Missing Email Alert */}

          {(!application.email || !application.email.includes('@')) && (

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2.5 text-xs">

              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />

              <div>

                <p className="font-semibold">Candidate has no registered email address.</p>

                <p className="mt-0.5 text-rose-800">

                  Email dispatch cannot proceed until a valid recipient email is provided. The candidate remains approved and their generated Offer Letter and Letter of Intent are preserved and available for download.

                </p>

              </div>

            </div>

          )}



          {/* SMTP Delivery Channel Status */}

          {smtpStatus && application.email && application.email.includes('@') && (

            <div

              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${smtpStatus.mode === 'smtp'

                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'

                : smtpStatus.mode === 'smtp_error'

                  ? 'bg-rose-50/80 border-rose-200 text-rose-900'

                  : 'bg-amber-50/80 border-amber-200 text-amber-900'

                }`}

            >

              <div className="mt-0.5 shrink-0">

                {smtpStatus.mode === 'smtp' ? (

                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />

                ) : smtpStatus.mode === 'smtp_error' ? (

                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />

                ) : (

                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200" />

                )}

              </div>

              <div className="flex-1">

                <div className="font-semibold flex items-center justify-between">

                  <span>

                    {smtpStatus.mode === 'smtp'

                      ? `Live Email Delivery Active (${smtpStatus.config?.host}:${smtpStatus.config?.port})`

                      : smtpStatus.mode === 'smtp_error'

                        ? 'Live SMTP Authentication Error'

                        : 'Offline / Emulated Mode (Local Storage Only)'}

                  </span>

                  {smtpStatus.config?.sender_email && (

                    <span className="text-[10px] font-mono opacity-80">

                      From: {smtpStatus.config.sender_email}

                    </span>

                  )}

                </div>

                <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">

                  {smtpStatus.mode === 'smtp'

                    ? `An official email with document attachments will be sent directly to ${application.email}.`

                    : smtpStatus.mode === 'smtp_error'

                      ? `Cannot connect to SMTP server: ${smtpStatus.message}. Please verify SMTP credentials in backend/.env.`

                      : 'SMTP is not configured in backend/.env. Letters will be generated and saved to server storage, but no email will reach the candidate. To send live emails, configure SMTP_HOST, SMTP_PORT, SMTP_USERNAME, and SMTP_PASSWORD in backend/.env.'}

                </p>

              </div>

            </div>

          )}



          <div>

            <span className="font-bold text-slate-800 block mb-1.5">Select Documents to Send:</span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">

              <button

                type="button"

                onClick={() => setSendScope('both')}

                className={`p-2.5 rounded-lg border text-left transition-all ${sendScope === 'both'

                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-1 ring-indigo-600'

                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'

                  }`}

              >

                <span className="font-bold block text-xs">Both Letters</span>

                <span className="text-[10px] text-slate-500">LOI + Offer Letter</span>

              </button>

              <button

                type="button"

                onClick={() => setSendScope('letter_of_intent')}

                className={`p-2.5 rounded-lg border text-left transition-all ${sendScope === 'letter_of_intent'

                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-1 ring-indigo-600'

                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'

                  }`}

              >

                <span className="font-bold block text-xs">LOI Only</span>

                <span className="text-[10px] text-slate-500">Letter of Intent</span>

              </button>

              <button

                type="button"

                onClick={() => setSendScope('offer_letter')}

                className={`p-2.5 rounded-lg border text-left transition-all ${sendScope === 'offer_letter'

                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-1 ring-indigo-600'

                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'

                  }`}

              >

                <span className="font-bold block text-xs">Offer Letter Only</span>

                <span className="text-[10px] text-slate-500">Full 5-page letter</span>

              </button>

            </div>

          </div>



          {/* Email Preview Section */}

          <div className="pt-0.5">

            <button

              type="button"

              onClick={handleToggleEmailPreview}

              disabled={isEmailPreviewLoading}

              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"

            >

              {isEmailPreviewLoading ? (

                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />

              ) : (

                <Eye className="w-3.5 h-3.5" />

              )}

              <span>{showEmailPreview ? 'Hide Email Preview' : 'Preview Congratulations Email Design'}</span>

            </button>



            {showEmailPreview && emailPreviewHtml && (

              <div className="mt-2.5 rounded-xl border border-slate-200 overflow-hidden shadow-xs bg-slate-100">

                <div className="p-2.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between text-[11px] px-3 gap-1">

                  <span className="font-semibold text-amber-400">Subject: Congratulations on Your Selection | CEF Portal</span>

                  <span className="text-slate-300 font-mono text-[10px]">To: {application.email}</span>

                </div>

                <iframe

                  srcDoc={emailPreviewHtml}

                  title="Congratulations Email Preview"

                  className="w-full h-[380px] border-0 bg-white"

                />

              </div>

            )}

          </div>



          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/70 border border-amber-200 cursor-pointer">

            <input

              type="checkbox"

              checked={confirmCheckbox}

              onChange={(e) => setConfirmCheckbox(e.target.checked)}

              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"

            />

            <span className="text-xs text-amber-900 leading-relaxed">

              I have verified the candidate details, compensation structure, and start date. I authorize dispatch of official documents.

            </span>

          </label>



          <div className="flex justify-end gap-2 pt-2">

            <GlassButton

              type="button"

              variant="secondary"

              onClick={() => setIsSendModalOpen(false)}

              className="text-xs"

            >

              Cancel

            </GlassButton>

            <GlassButton

              type="button"

              variant="primary"

              disabled={

                !confirmCheckbox ||

                sendLettersMutation.isPending ||

                !application.email ||

                !application.email.includes('@')

              }

              isLoading={sendLettersMutation.isPending}

              onClick={handleConfirmSend}

              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"

              title={

                !application.email || !application.email.includes('@')

                  ? 'Candidate email is required to dispatch emails'

                  : undefined

              }

            >

              Confirm & Email Documents

            </GlassButton>

          </div>

        </div>

      </Modal>



      {/* Modal: Edit Joining Date */}

      <Modal

        isOpen={isJoiningDateModalOpen}

        onClose={() => {

          if (!isSavingJoiningDate) {

            setIsJoiningDateModalOpen(false);

            setJoiningDateError(null);

          }

        }}

        title="Edit Candidate Joining Date"

        description="Select or update the candidate's agreed service commencement / reporting date."

      >

        <form

          onSubmit={(e) => {

            e.preventDefault();

            handleSaveJoiningDate();

          }}

          className="space-y-4 pt-2 text-xs"

        >

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">

            <div className="flex justify-between">

              <span className="text-slate-500">Candidate:</span>

              <span className="font-bold text-slate-900">{application.full_name}</span>

            </div>

            <div className="flex justify-between">

              <span className="text-slate-500">Application Number:</span>

              <span className="font-mono text-indigo-700">{application.application_number}</span>

            </div>

            <div className="flex justify-between">

              <span className="text-slate-500">Current Joining Date:</span>

              <span className="font-bold text-slate-900">{currentJoining || 'Not specified'}</span>

            </div>

          </div>



          <div className="space-y-2">

            <GlassInput

              id="joining-date-input"

              label="Select Joining Date"

              type="date"

              value={joiningDateInput.includes('/') ? toInputDateFormat(joiningDateInput) : joiningDateInput}

              onChange={(e) => {

                setJoiningDateInput(e.target.value);

                setJoiningDateError(null);

              }}

              error={joiningDateError || undefined}

              helperText="Choose reporting date. Standard format: DD/MM/YYYY"

              leftIcon={<Calendar className="w-4 h-4 text-indigo-600" />}

            />



            {joiningDateInput && isValidJoiningDate(joiningDateInput) && (

              <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">

                <span className="text-slate-500 text-[11px]">Formatted Date (DD/MM/YYYY):</span>

                <span className="font-mono font-bold text-indigo-800 text-xs">

                  {joiningDateInput.includes('-') ? toDisplayDateFormat(joiningDateInput) : joiningDateInput}

                </span>

              </div>

            )}

          </div>



          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">

            <GlassButton

              type="button"

              variant="secondary"

              onClick={() => {

                setIsJoiningDateModalOpen(false);

                setJoiningDateError(null);

              }}

              disabled={isSavingJoiningDate}

              className="text-xs"

            >

              Cancel

            </GlassButton>

            <GlassButton

              type="submit"

              variant="primary"

              isLoading={isSavingJoiningDate}

              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"

            >

              Save Joining Date

            </GlassButton>

          </div>

        </form>

      </Modal>

    </div>

  );

};

