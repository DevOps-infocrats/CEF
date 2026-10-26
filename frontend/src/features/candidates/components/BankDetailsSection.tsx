import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { CandidateApplicationFormInput } from '../schemas';
import { GlassInput } from '@/components/GlassInput';
import { Landmark, ShieldCheck, UserCheck, Hash } from 'lucide-react';

interface BankDetailsSectionProps {
  register: UseFormRegister<CandidateApplicationFormInput>;
  errors: FieldErrors<CandidateApplicationFormInput>;
}

export const BankDetailsSection: React.FC<BankDetailsSectionProps> = ({
  register,
  errors,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Landmark className="w-5 h-5 text-indigo-600" />
          <span>Section 3: Bank Details</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Candidate's active bank account details for official records and disbursements.
        </p>
      </div>

      <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 space-y-0.5">
          <p className="font-bold">Confidential & Secure Banking Records</p>
          <p className="text-slate-600">
            We only collect basic account routing details. CEF Portal will never request your ATM PIN, CVV, OTP, or net-banking passwords.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <GlassInput
            label="Account Holder Name *"
            placeholder="Name as printed on passbook"
            leftIcon={<UserCheck className="w-4 h-4 text-indigo-600" />}
            error={errors.account_holder_name?.message}
            {...register('account_holder_name')}
          />
        </div>

        <div>
          <GlassInput
            label="Bank Name *"
            placeholder="e.g. State Bank of India, HDFC Bank"
            leftIcon={<Landmark className="w-4 h-4 text-indigo-600" />}
            error={errors.bank_name?.message}
            {...register('bank_name')}
          />
        </div>

        <div>
          <GlassInput
            label="Account Number *"
            type="password"
            autoComplete="off"
            placeholder="Enter bank account number"
            leftIcon={<Hash className="w-4 h-4 text-indigo-600" />}
            error={errors.account_number?.message}
            helperText="9 to 18 numeric digits"
            {...register('account_number')}
          />
        </div>

        <div>
          <GlassInput
            label="Confirm Account Number *"
            type="text"
            autoComplete="off"
            placeholder="Re-enter bank account number"
            leftIcon={<Hash className="w-4 h-4 text-indigo-600" />}
            error={errors.confirm_account_number?.message}
            helperText="Must match the account number exactly"
            {...register('confirm_account_number')}
          />
        </div>

        <div>
          <GlassInput
            label="IFSC Code *"
            maxLength={11}
            placeholder="e.g. SBIN0001234"
            error={errors.ifsc_code?.message}
            helperText="11-character Indian Financial System Code"
            {...register('ifsc_code')}
          />
        </div>

        <div>
          <GlassInput
            label="Branch Name (Optional)"
            placeholder="e.g. Nariman Point Branch"
            error={errors.branch_name?.message}
            {...register('branch_name')}
          />
        </div>
      </div>
    </div>
  );
};
