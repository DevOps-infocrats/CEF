import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { CandidateApplicationFormInput } from '../schemas';
import { GlassInput } from '@/components/GlassInput';
import { User, Phone, Mail, CreditCard, FileBadge2 } from 'lucide-react';

interface PersonalInformationSectionProps {
  register: UseFormRegister<CandidateApplicationFormInput>;
  errors: FieldErrors<CandidateApplicationFormInput>;
}

export const PersonalInformationSection: React.FC<PersonalInformationSectionProps> = ({
  register,
  errors,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-600" />
          <span>Section 1: Personal Information</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Provide basic candidate identity and primary contact credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <GlassInput
            label="Full Name *"
            placeholder="Enter candidate's full legal name"
            leftIcon={<User className="w-4 h-4 text-indigo-600" />}
            error={errors.full_name?.message}
            {...register('full_name')}
          />
        </div>

        <div>
          <GlassInput
            label="Mobile Number *"
            type="tel"
            maxLength={10}
            placeholder="10-digit number (e.g. 9876543210)"
            leftIcon={<Phone className="w-4 h-4 text-indigo-600" />}
            error={errors.mobile_number?.message}
            helperText="10-digit primary mobile number"
            {...register('mobile_number')}
          />
        </div>

        <div>
          <GlassInput
            label="Email Address *"
            type="email"
            placeholder="candidate@example.com"
            leftIcon={<Mail className="w-4 h-4 text-indigo-600" />}
            error={errors.email?.message}
            helperText="Active email for status notifications"
            {...register('email')}
          />
        </div>

        <div>
          <GlassInput
            label="Aadhaar Number *"
            maxLength={12}
            placeholder="12-digit Aadhaar number"
            leftIcon={<CreditCard className="w-4 h-4 text-indigo-600" />}
            error={errors.aadhaar_number?.message}
            helperText="12 numeric digits without spaces or dashes"
            {...register('aadhaar_number')}
          />
        </div>

        <div>
          <GlassInput
            label="PAN Number *"
            maxLength={10}
            placeholder="e.g. ABCDE1234F"
            leftIcon={<FileBadge2 className="w-4 h-4 text-indigo-600" />}
            error={errors.pan_number?.message}
            helperText="Format: 5 letters, 4 digits, 1 letter"
            {...register('pan_number')}
          />
        </div>
      </div>
    </div>
  );
};
