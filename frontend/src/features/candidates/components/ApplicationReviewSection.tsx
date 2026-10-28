import React from 'react';
import { CandidateApplicationFormInput } from '../schemas';
import { GlassButton } from '@/components/GlassButton';
import {
  ShieldCheck,
  User,
  MapPin,
  Landmark,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Compass,
} from 'lucide-react';

interface ApplicationReviewSectionProps {
  formData: CandidateApplicationFormInput;
  onEditSection: (sectionStep: number) => void;
  onSubmitFinal: () => void;
  isSubmitting: boolean;
  submissionError: string | null;
}

export const ApplicationReviewSection: React.FC<ApplicationReviewSectionProps> = ({
  formData,
  onEditSection,
  onSubmitFinal,
  isSubmitting,
  submissionError,
}) => {
  // Helper to mask Aadhaar: show only last 4 digits (e.g. •••• •••• 1234)
  const maskAadhaar = (num?: string) => {
    if (!num) return '—';
    if (num.length < 4) return num;
    return `•••• •••• ${num.slice(-4)}`;
  };

  // Helper to mask PAN: show last 5 characters (e.g. •••••1234F)
  const maskPAN = (pan?: string) => {
    if (!pan) return '—';
    if (pan.length < 5) return pan.toUpperCase();
    return `•••••${pan.slice(-5).toUpperCase()}`;
  };

  // Helper to mask Bank Account: show only last 4 digits
  const maskAccount = (acc?: string) => {
    if (!acc) return '—';
    if (acc.length < 4) return acc;
    return `••••••••${acc.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <span>Section 4: Review and Submit</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Carefully review all details before final submission. Once submitted, a permanent application reference ID will be generated.
        </p>
      </div>

      {submissionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">
            <p className="font-bold">Submission Failed</p>
            <p className="mt-0.5">{submissionError}</p>
          </div>
        </div>
      )}

      {/* Selected Stream & Role Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-indigo-600/10 to-indigo-500/5 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700">
            Target Enrollment Track
          </span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-bold text-slate-900 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-xs">
              {formData.hero_category}
            </span>
            <span className="text-slate-400 font-bold">/</span>
            <span className="text-sm font-bold text-indigo-800 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200 shadow-xs">
              {formData.role_applied}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onEditSection(0)}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 bg-white hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors shadow-xs"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>Change Role</span>
        </button>
      </div>

      {/* Review Section 1: Personal Info */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Personal Information
            </h4>
          </div>
          <button
            type="button"
            onClick={() => onEditSection(1)}
            className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-800 font-semibold"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Full Legal Name</span>
            <span className="font-semibold text-slate-800 text-sm">{formData.full_name || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Mobile Number</span>
            <span className="font-semibold text-slate-800 text-sm">{formData.mobile_number || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Email Address</span>
            <span className="font-semibold text-slate-800 text-sm truncate block">{formData.email || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Aadhaar Number (Protected)</span>
            <span className="font-mono font-semibold text-slate-800 text-sm">{maskAadhaar(formData.aadhaar_number)}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">PAN Number (Protected)</span>
            <span className="font-mono font-semibold text-slate-800 text-sm">{maskPAN(formData.pan_number)}</span>
          </div>
        </div>
      </div>

      {/* Review Section 2: Addresses */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Address Details
            </h4>
          </div>
          <button
            type="button"
            onClick={() => onEditSection(2)}
            className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-800 font-semibold"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="font-bold text-slate-700 block">Current Address</span>
            <p className="text-slate-800 font-medium leading-relaxed">
              {formData.current_address_line1}
              {formData.current_address_line2 ? `, ${formData.current_address_line2}` : ''}
              <br />
              {formData.current_city}, {formData.current_state} — {formData.current_pin_code}
              <br />
              {formData.current_country || 'India'}
            </p>
          </div>

          <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 block">Permanent Address</span>
              {formData.is_permanent_same && (
                <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded">
                  Same as Current
                </span>
              )}
            </div>
            <p className="text-slate-800 font-medium leading-relaxed">
              {formData.is_permanent_same
                ? `${formData.current_address_line1}${formData.current_address_line2 ? `, ${formData.current_address_line2}` : ''}`
                : `${formData.permanent_address_line1 || '—'}${formData.permanent_address_line2 ? `, ${formData.permanent_address_line2}` : ''}`}
              <br />
              {formData.is_permanent_same
                ? `${formData.current_city}, ${formData.current_state} — ${formData.current_pin_code}`
                : `${formData.permanent_city || '—'}, ${formData.permanent_state || '—'} — ${formData.permanent_pin_code || '—'}`}
              <br />
              {formData.is_permanent_same
                ? (formData.current_country || 'India')
                : (formData.permanent_country || 'India')}
            </p>
          </div>
        </div>
      </div>

      {/* Review Section 3: Bank Details */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Bank Details (Protected)
            </h4>
          </div>
          <button
            type="button"
            onClick={() => onEditSection(3)}
            className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-800 font-semibold"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Account Holder</span>
            <span className="font-semibold text-slate-800 text-sm">{formData.account_holder_name || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Bank Name</span>
            <span className="font-semibold text-slate-800 text-sm">{formData.bank_name || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Account Number</span>
            <span className="font-mono font-semibold text-slate-800 text-sm">{maskAccount(formData.account_number)}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">IFSC Code</span>
            <span className="font-mono font-semibold text-slate-800 text-sm uppercase">{formData.ifsc_code || '—'}</span>
          </div>
          {formData.branch_name && (
            <div>
              <span className="text-slate-400 font-medium block">Branch</span>
              <span className="font-semibold text-slate-800 text-sm">{formData.branch_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Location & Salary Details */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Location & Salary Allocation
            </h4>
          </div>
          <button
            type="button"
            onClick={() => onEditSection(4)}
            className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-800 font-semibold"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Circle / State</span>
            <span className="font-semibold text-slate-800 text-sm">{formData.circle || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Selected District(s)</span>
            <span className="font-semibold text-slate-800 text-sm">{formData.district || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Selected Block(s)</span>
            <span className="font-semibold text-slate-800 text-sm">{formData.block || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Current Salary</span>
            <span className="font-semibold text-slate-800 text-sm">
              {formData.current_salary !== undefined && formData.current_salary !== ''
                ? `₹${Number(formData.current_salary).toLocaleString('en-IN')}`
                : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Asking Salary</span>
            <span className="font-semibold text-slate-800 text-sm">
              {formData.asking_salary !== undefined && formData.asking_salary !== ''
                ? `₹${Number(formData.asking_salary).toLocaleString('en-IN')}`
                : '—'}
            </span>
          </div>
          {formData.negotiated_salary !== undefined && formData.negotiated_salary !== '' && (
            <div>
              <span className="text-slate-400 font-medium block">Negotiated Salary</span>
              <span className="font-semibold text-slate-800 text-sm">
                ₹{Number(formData.negotiated_salary).toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <GlassButton
          type="button"
          variant="secondary"
          onClick={() => onEditSection(4)}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Location & Salary
        </GlassButton>

        <GlassButton
          type="button"
          variant="primary"
          size="lg"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          onClick={onSubmitFinal}
          rightIcon={<CheckCircle2 className="w-4 h-4" />}
          className="w-full sm:w-auto"
        >
          Confirm & Submit Application
        </GlassButton>
      </div>
    </div>
  );
};
