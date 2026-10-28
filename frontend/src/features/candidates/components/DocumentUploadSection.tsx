import React, { useRef, useState } from 'react';
import { CandidateDocument, DocumentCategory } from '../types';
import { CandidateApplicationFormInput } from '../schemas';
import { GlassButton } from '@/components/GlassButton';
import {
  Upload,
  FileCheck2,
  Trash2,
  AlertCircle,
  FileText,
  ShieldCheck,
  CheckCircle2,
  User,
  MapPin,
  Landmark,
  Compass,
} from 'lucide-react';

interface DocumentCategoryConfig {
  id: DocumentCategory;
  title: string;
  isMandatory: boolean;
  description: string;
}

const MANDATORY_DOCS: DocumentCategoryConfig[] = [
  {
    id: 'aadhaar_card',
    title: 'Aadhaar Card',
    isMandatory: true,
    description: 'Clear copy of official Aadhaar card (PDF or image).',
  },
  {
    id: 'pan_card',
    title: 'PAN Card',
    isMandatory: true,
    description: 'Clear copy of official PAN card (PDF or image).',
  },
  {
    id: 'bank_passbook',
    title: 'Bank Passbook',
    isMandatory: true,
    description: 'First page showing account number and IFSC (or upload Cancelled Cheque).',
  },
  {
    id: 'cancelled_cheque',
    title: 'Cancelled Cheque',
    isMandatory: true,
    description: 'Original cancelled cheque showing candidate name (or upload Bank Passbook).',
  },
];

const OPTIONAL_DOCS: DocumentCategoryConfig[] = [
  {
    id: 'marksheet_10th',
    title: '10th Marksheet',
    isMandatory: false,
    description: 'Secondary education board marksheet or certificate.',
  },
  {
    id: 'marksheet_12th',
    title: '12th Marksheet',
    isMandatory: false,
    description: 'Higher secondary school certificate.',
  },
  {
    id: 'previous_employment',
    title: 'Previous Employment Records',
    isMandatory: false,
    description: 'Experience letter, relieving letter, or last pay slip.',
  },
];

interface DocumentUploadSectionProps {
  stagedDocs: CandidateDocument[];
  onUploadDocument: (file: File, category: DocumentCategory) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  isUploading: boolean;
  uploadingCategory: DocumentCategory | null;
  formData: CandidateApplicationFormInput;
  onEditSection: (sectionStep: number) => void;
  onSubmitFinal: () => void;
  isSubmitting: boolean;
  submissionError: string | null;
  isEditing?: boolean;
}

export const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({
  stagedDocs,
  onUploadDocument,
  onDeleteDocument,
  isUploading,
  uploadingCategory,
  formData,
  onEditSection,
  onSubmitFinal,
  isSubmitting,
  submissionError,
  isEditing = false,
}) => {
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Helper to find uploaded document by category
  const getUploadedDoc = (cat: DocumentCategory) =>
    stagedDocs.find((d) => d.category === cat);

  // Validation rules for mandatory uploads
  const hasAadhaar = !!getUploadedDoc('aadhaar_card');
  const hasPan = !!getUploadedDoc('pan_card');
  const hasBankDoc = !!getUploadedDoc('bank_passbook') || !!getUploadedDoc('cancelled_cheque');

  const allMandatorySatisfied = hasAadhaar && hasPan && hasBankDoc;

  // File selection handler
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    category: DocumentCategory
  ) => {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLocalError(`File '${file.name}' exceeds the 5MB size limit.`);
      e.target.value = '';
      return;
    }

    // Validate extension
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    const lowerName = file.name.toLowerCase();
    if (!allowed.some((ext) => lowerName.endsWith(ext))) {
      setLocalError(`Unsupported file format. Please upload PDF, PNG, or JPEG.`);
      e.target.value = '';
      return;
    }

    try {
      await onUploadDocument(file, category);
    } catch (err: unknown) {
      const errMessage =
        (err as { response?: { data?: { error?: { message?: string } | string; message?: string } } })?.response?.data?.message ||
        'Upload failed. Please try again.';
      setLocalError(errMessage);
    } finally {
      e.target.value = '';
    }
  };

  // Masking helpers for summary review
  const maskAadhaar = (num?: string) =>
    num && num.length >= 4 ? `•••• •••• ${num.slice(-4)}` : (num || '—');
  const maskPAN = (pan?: string) =>
    pan && pan.length >= 5 ? `•••••${pan.slice(-5).toUpperCase()}` : (pan ? pan.toUpperCase() : '—');
  const maskAccount = (acc?: string) =>
    acc && acc.length >= 4 ? `••••••••${acc.slice(-4)}` : (acc || '—');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const renderDocCard = (cfg: DocumentCategoryConfig, isAlternative = false) => {
    const uploaded = getUploadedDoc(cfg.id);
    const isThisUploading = isUploading && uploadingCategory === cfg.id;

    return (
      <div
        key={cfg.id}
        className={`p-4 rounded-xl border transition-all ${
          uploaded
            ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/20'
            : 'bg-white hover:bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-xs text-slate-900">{cfg.title}</h4>
              {cfg.isMandatory ? (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {isAlternative ? 'Mandatory (Either)' : 'Mandatory'}
                </span>
              ) : (
                <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  Optional
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{cfg.description}</p>
          </div>

          {uploaded && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified</span>
            </span>
          )}
        </div>

        {/* Upload State or File Details */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <input
            ref={(el) => {
              fileInputRefs.current[cfg.id] = el;
            }}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => handleFileChange(e, cfg.id)}
          />

          {uploaded ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 min-w-0">
                <FileCheck2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {uploaded.original_filename}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatFileSize(uploaded.file_size)} • Uploaded
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[cfg.id]?.click()}
                  disabled={isUploading}
                  className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold underline underline-offset-2"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDocument(uploaded.id)}
                  disabled={isUploading}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  aria-label="Remove document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-slate-400">
                Supported: PDF, PNG, JPG (Max 5MB)
              </span>
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={isUploading}
                isLoading={isThisUploading}
                onClick={() => fileInputRefs.current[cfg.id]?.click()}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                Upload File
              </GlassButton>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Step 5 Header */}
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Upload className="w-5 h-5 text-indigo-600" />
          <span>Step 5: Document Upload & Final Submit</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Attach the required identity and verification records. Files are encrypted and stored in private directories.
        </p>
      </div>

      {localError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 font-medium">{localError}</p>
        </div>
      )}

      {submissionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">
            <p className="font-bold">Submission Failed</p>
            <p className="mt-0.5">{submissionError}</p>
          </div>
        </div>
      )}

      {/* Supporting Documents Status Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          allMandatorySatisfied
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : 'bg-indigo-50/70 border-indigo-200 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {allMandatorySatisfied ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <FileCheck2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
          )}
          <div className="text-xs">
            <p className="font-bold">
              {allMandatorySatisfied
                ? 'All Supporting Documents Attached'
                : 'Document Uploads (Optional)'}
            </p>
            <p className="text-[11px] opacity-90 mt-0.5">
              {allMandatorySatisfied
                ? 'Aadhaar Card, PAN Card, and Bank proof have been staged for verification.'
                : 'Document uploads are optional. You can upload Aadhaar, PAN, and Bank proof now or later during verification.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span
            className={`px-2 py-0.5 rounded ${
              hasAadhaar ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}
          >
            Aadhaar: {hasAadhaar ? '✓' : 'Optional'}
          </span>
          <span
            className={`px-2 py-0.5 rounded ${
              hasPan ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}
          >
            PAN: {hasPan ? '✓' : 'Optional'}
          </span>
          <span
            className={`px-2 py-0.5 rounded ${
              hasBankDoc ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}
          >
            Bank Doc: {hasBankDoc ? '✓' : 'Optional'}
          </span>
        </div>
      </div>

      {/* Section A: Mandatory Documents */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Mandatory Documents</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            Aadhaar, PAN & 1 Bank Record Required
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MANDATORY_DOCS.slice(0, 2).map((cfg) => renderDocCard(cfg))}
        </div>

        {/* Bank Proof Alternative Group */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-bold text-slate-800">
                Bank Proof (Provide at least one)
              </h5>
              <p className="text-[11px] text-slate-500">
                Either Bank Passbook OR Cancelled Cheque satisfies this requirement.
              </p>
            </div>
            {hasBankDoc && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Condition Met
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MANDATORY_DOCS.slice(2).map((cfg) => renderDocCard(cfg, true))}
          </div>
        </div>
      </div>

      {/* Section B: Optional Documents */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>Optional Supporting Documents</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            Will not block submission
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {OPTIONAL_DOCS.map((cfg) => renderDocCard(cfg))}
        </div>
      </div>

      {/* Complete Application Summary Review */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>Final Application Review Summary</span>
          </h4>
          <span className="text-xs text-slate-400">
            Review before final submission
          </span>
        </div>

        {/* Selected Track */}
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Track:</span>
            <strong className="text-slate-900">{formData.hero_category}</strong>
            <span className="text-slate-300">/</span>
            <strong className="text-indigo-800">{formData.role_applied}</strong>
          </div>
          <button
            type="button"
            onClick={() => onEditSection(0)}
            className="text-xs text-indigo-700 font-semibold hover:underline"
          >
            Change
          </button>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Card 1: Personal Info */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" /> Personal Details
              </span>
              <button
                type="button"
                onClick={() => onEditSection(1)}
                className="text-indigo-700 hover:underline"
              >
                Edit
              </button>
            </div>
            <p className="text-slate-600 leading-relaxed">
              <strong>{formData.full_name}</strong> • {formData.mobile_number}
              <br />
              {formData.email}
              <br />
              Aadhaar: <span className="font-mono">{maskAadhaar(formData.aadhaar_number)}</span> • PAN: <span className="font-mono">{maskPAN(formData.pan_number)}</span>
            </p>
          </div>

          {/* Card 2: Address */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Address Details
              </span>
              <button
                type="button"
                onClick={() => onEditSection(2)}
                className="text-indigo-700 hover:underline"
              >
                Edit
              </button>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {formData.current_address_line1 || '—'}{formData.current_city ? `, ${formData.current_city}` : ''}{formData.current_state ? `, ${formData.current_state}` : ''}{formData.current_pin_code ? ` — ${formData.current_pin_code}` : ''}
              <br />
              <span className="text-slate-400">
                {formData.is_permanent_same ? '(Permanent same as current)' : (formData.permanent_address_line1 || formData.permanent_city ? `${formData.permanent_address_line1 || ''}${formData.permanent_city ? `, ${formData.permanent_city}` : ''}${formData.permanent_state ? `, ${formData.permanent_state}` : ''}${formData.permanent_pin_code ? ` — ${formData.permanent_pin_code}` : ''}` : 'Permanent address not provided')}
              </span>
            </p>
          </div>

          {/* Card 3: Bank Details */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-indigo-600" /> Bank Details
              </span>
              <button
                type="button"
                onClick={() => onEditSection(3)}
                className="text-indigo-700 hover:underline"
              >
                Edit
              </button>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {formData.bank_name || '—'} • {formData.account_holder_name || '—'}
              <br />
              Account: <span className="font-mono">{maskAccount(formData.account_number)}</span> • IFSC: <span className="font-mono uppercase">{formData.ifsc_code || '—'}</span>
            </p>
          </div>

          {/* Card 4: Location & Salary */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-600" /> Location & Salary
              </span>
              <button
                type="button"
                onClick={() => onEditSection(4)}
                className="text-indigo-700 hover:underline"
              >
                Edit
              </button>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Circle: <strong>{formData.circle || '—'}</strong> • District: <strong>{formData.district || '—'}</strong> • Block: <strong>{formData.block || '—'}</strong>
              <br />
              Current: <strong>{formData.current_salary !== undefined && formData.current_salary !== '' ? `₹${Number(formData.current_salary).toLocaleString('en-IN')}` : '—'}</strong> • Asking: <strong>{formData.asking_salary !== undefined && formData.asking_salary !== '' ? `₹${Number(formData.asking_salary).toLocaleString('en-IN')}` : '—'}</strong>
              {formData.negotiated_salary !== undefined && formData.negotiated_salary !== '' && (
                <span> • Negotiated: <strong>₹{Number(formData.negotiated_salary).toLocaleString('en-IN')}</strong></span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Final Submission Button */}
      <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <GlassButton
          type="button"
          variant="secondary"
          onClick={() => onEditSection(4)}
        >
          Back to Location & Salary
        </GlassButton>

        <GlassButton
          type="button"
          variant="primary"
          size="lg"
          disabled={isSubmitting || isUploading}
          isLoading={isSubmitting}
          onClick={onSubmitFinal}
          rightIcon={<CheckCircle2 className="w-4 h-4" />}
          className="w-full sm:w-auto"
        >
          {isEditing ? 'Save Changes' : 'Submit Application'}
        </GlassButton>
      </div>

      {!allMandatorySatisfied && (
        <p className="text-center text-xs text-slate-500 font-medium">
          Document uploads are optional. You may submit without uploading and attach documents later.
        </p>
      )}
    </div>
  );
};
