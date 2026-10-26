import React, { useEffect, useRef } from 'react';
import { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { CandidateApplicationFormInput } from '../schemas';
import { GlassInput } from '@/components/GlassInput';
import { MapPin, Home, CheckSquare, Square } from 'lucide-react';

interface AddressDetailsSectionProps {
  register: UseFormRegister<CandidateApplicationFormInput>;
  errors: FieldErrors<CandidateApplicationFormInput>;
  watch: UseFormWatch<CandidateApplicationFormInput>;
  setValue: UseFormSetValue<CandidateApplicationFormInput>;
}

export const AddressDetailsSection: React.FC<AddressDetailsSectionProps> = ({
  register,
  errors,
  watch,
  setValue,
}) => {
  const isPermanentSame = watch('is_permanent_same');
  const currentLine1 = watch('current_address_line1');
  const currentLine2 = watch('current_address_line2');
  const currentCity = watch('current_city');
  const currentState = watch('current_state');
  const currentPin = watch('current_pin_code');
  const currentCountry = watch('current_country') || 'India';

  // Cache previously typed permanent address so unchecking restores it rather than discarding
  const savedPermanentRef = useRef({
    line1: '',
    line2: '',
    city: '',
    state: '',
    pin: '',
    country: 'India',
  });

  // When isPermanentSame is toggled
  const handleToggleSameAddress = (checked: boolean) => {
    setValue('is_permanent_same', checked, { shouldValidate: true });

    if (checked) {
      // Save current permanent values before overwriting
      savedPermanentRef.current = {
        line1: watch('permanent_address_line1') || '',
        line2: watch('permanent_address_line2') || '',
        city: watch('permanent_city') || '',
        state: watch('permanent_state') || '',
        pin: watch('permanent_pin_code') || '',
        country: watch('permanent_country') || 'India',
      };

      // Populate permanent from current
      setValue('permanent_address_line1', currentLine1, { shouldValidate: true });
      setValue('permanent_address_line2', currentLine2 || '', { shouldValidate: true });
      setValue('permanent_city', currentCity, { shouldValidate: true });
      setValue('permanent_state', currentState, { shouldValidate: true });
      setValue('permanent_pin_code', currentPin, { shouldValidate: true });
      setValue('permanent_country', currentCountry, { shouldValidate: true });
    } else {
      // Restore previously entered permanent values if any existed, or leave for user input
      setValue('permanent_address_line1', savedPermanentRef.current.line1, { shouldValidate: true });
      setValue('permanent_address_line2', savedPermanentRef.current.line2);
      setValue('permanent_city', savedPermanentRef.current.city, { shouldValidate: true });
      setValue('permanent_state', savedPermanentRef.current.state, { shouldValidate: true });
      setValue('permanent_pin_code', savedPermanentRef.current.pin, { shouldValidate: true });
      setValue('permanent_country', savedPermanentRef.current.country || 'India');
    }
  };

  // If isPermanentSame is active and current address changes, sync to permanent
  useEffect(() => {
    if (isPermanentSame) {
      setValue('permanent_address_line1', currentLine1);
      setValue('permanent_address_line2', currentLine2 || '');
      setValue('permanent_city', currentCity);
      setValue('permanent_state', currentState);
      setValue('permanent_pin_code', currentPin);
      setValue('permanent_country', currentCountry);
    }
  }, [
    isPermanentSame,
    currentLine1,
    currentLine2,
    currentCity,
    currentState,
    currentPin,
    currentCountry,
    setValue,
  ]);

  return (
    <div className="space-y-8">
      {/* Current Address */}
      <div className="space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            <span>Section 2: Current Address</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Present residential location of the candidate.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <GlassInput
              label="Address Line 1 *"
              placeholder="Flat/House No., Building, Street Name"
              error={errors.current_address_line1?.message}
              {...register('current_address_line1')}
            />
          </div>

          <div className="md:col-span-2">
            <GlassInput
              label="Address Line 2 (Optional)"
              placeholder="Landmark, Area, Locality"
              error={errors.current_address_line2?.message}
              {...register('current_address_line2')}
            />
          </div>

          <div>
            <GlassInput
              label="City *"
              placeholder="e.g. Mumbai, New Delhi"
              error={errors.current_city?.message}
              {...register('current_city')}
            />
          </div>

          <div>
            <GlassInput
              label="State / Province *"
              placeholder="e.g. Maharashtra"
              error={errors.current_state?.message}
              {...register('current_state')}
            />
          </div>

          <div>
            <GlassInput
              label="PIN Code *"
              maxLength={6}
              placeholder="6-digit PIN"
              error={errors.current_pin_code?.message}
              {...register('current_pin_code')}
            />
          </div>

          <div>
            <GlassInput
              label="Country *"
              placeholder="India"
              defaultValue="India"
              error={errors.current_country?.message}
              {...register('current_country')}
            />
          </div>
        </div>
      </div>

      {/* Sync Checkbox */}
      <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between">
        <label
          htmlFor="permanent-same-checkbox"
          className="flex items-center gap-3 cursor-pointer select-none text-xs font-semibold text-slate-800"
        >
          <input
            id="permanent-same-checkbox"
            type="checkbox"
            checked={!!isPermanentSame}
            onChange={(e) => handleToggleSameAddress(e.target.checked)}
            className="sr-only"
          />
          <div className="text-indigo-700">
            {isPermanentSame ? (
              <CheckSquare className="w-5 h-5 text-indigo-600" />
            ) : (
              <Square className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <span>Permanent address same as current address</span>
        </label>
        {isPermanentSame && (
          <span className="text-[11px] font-medium text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-300">
            Synchronized
          </span>
        )}
      </div>

      {/* Permanent Address */}
      <div className={`space-y-4 transition-opacity duration-200 ${isPermanentSame ? 'opacity-80' : 'opacity-100'}`}>
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Home className="w-5 h-5 text-indigo-600" />
              <span>Permanent Address</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Official domicile or permanent residence.
            </p>
          </div>
          {isPermanentSame && (
            <span className="text-xs text-slate-500 italic">
              (Auto-populated from current address)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <GlassInput
              label="Address Line 1 *"
              placeholder="Permanent house, street"
              disabled={isPermanentSame}
              error={errors.permanent_address_line1?.message}
              {...register('permanent_address_line1')}
            />
          </div>

          <div className="md:col-span-2">
            <GlassInput
              label="Address Line 2 (Optional)"
              placeholder="Landmark, Area"
              disabled={isPermanentSame}
              error={errors.permanent_address_line2?.message}
              {...register('permanent_address_line2')}
            />
          </div>

          <div>
            <GlassInput
              label="City *"
              placeholder="e.g. Pune"
              disabled={isPermanentSame}
              error={errors.permanent_city?.message}
              {...register('permanent_city')}
            />
          </div>

          <div>
            <GlassInput
              label="State / Province *"
              placeholder="e.g. Maharashtra"
              disabled={isPermanentSame}
              error={errors.permanent_state?.message}
              {...register('permanent_state')}
            />
          </div>

          <div>
            <GlassInput
              label="PIN Code *"
              maxLength={6}
              placeholder="6-digit PIN"
              disabled={isPermanentSame}
              error={errors.permanent_pin_code?.message}
              {...register('permanent_pin_code')}
            />
          </div>

          <div>
            <GlassInput
              label="Country *"
              placeholder="India"
              defaultValue="India"
              disabled={isPermanentSame}
              error={errors.permanent_country?.message}
              {...register('permanent_country')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
