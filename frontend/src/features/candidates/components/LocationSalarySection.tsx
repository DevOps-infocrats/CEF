import React, { useEffect, useMemo } from 'react';
import { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { CandidateApplicationFormInput } from '../schemas';
import { GlassInput } from '@/components/GlassInput';
import { Compass, IndianRupee, MapPin } from 'lucide-react';
import { useStates, useDistricts, useBlocks } from '@/features/locations/hooks/useLocations';
import { LocationMultiSelect, MultiSelectOption } from '@/features/locations/components/LocationMultiSelect';

interface LocationSalarySectionProps {
  register: UseFormRegister<CandidateApplicationFormInput>;
  errors: FieldErrors<CandidateApplicationFormInput>;
  watch: UseFormWatch<CandidateApplicationFormInput>;
  setValue: UseFormSetValue<CandidateApplicationFormInput>;
}

export const LocationSalarySection: React.FC<LocationSalarySectionProps> = ({
  register,
  errors,
  watch,
  setValue,
}) => {
  const currentCircle = watch('circle') || '';
  const selectedDistrictIds = watch('district_ids') || [];
  const selectedBlockIds = watch('block_ids') || [];

  // 1. Fetch available administrative states/circles
  const { data: states = [], isLoading: isLoadingStates } = useStates();

  // If no circle selected, default to "Rajasthan" (or first active state)
  useEffect(() => {
    if (!currentCircle && states.length > 0) {
      const defaultState = states.find((s) => s.name.toLowerCase() === 'rajasthan') || states[0];
      if (defaultState) {
        setValue('circle', defaultState.name, { shouldValidate: true });
      }
    }
  }, [currentCircle, states, setValue]);

  // Find the selected state object
  const activeState = useMemo(() => {
    return states.find(
      (s) => s.name.toLowerCase() === currentCircle.toLowerCase()
    );
  }, [states, currentCircle]);

  // 2. Fetch districts for selected circle/state
  const { data: districts = [], isLoading: isLoadingDistricts } = useDistricts(
    activeState?.id || ''
  );

  const districtOptions: MultiSelectOption[] = useMemo(() => {
    return districts.map((d) => ({
      id: d.id,
      name: d.name,
      subtitle: d.blocks_count ? `${d.blocks_count} blocks` : undefined,
    }));
  }, [districts]);

  // 3. Fetch blocks belonging to currently selected districts
  const { data: blocks = [], isLoading: isLoadingBlocks } = useBlocks({
    districtIds: selectedDistrictIds,
  });

  const blockOptions: MultiSelectOption[] = useMemo(() => {
    return blocks.map((b) => ({
      id: b.id,
      name: b.name,
      subtitle: b.district_name || undefined,
    }));
  }, [blocks]);

  // Handle District Change & Prune Blocks belonging to removed districts
  const handleDistrictChange = (newDistrictIds: string[]) => {
    setValue('district_ids', newDistrictIds, { shouldValidate: true });

    // Derive names for human-readable fallback
    const selectedDistNames = districts
      .filter((d) => newDistrictIds.includes(d.id))
      .map((d) => d.name);
    setValue('district', selectedDistNames.join(', '));

    // Prune any selected blocks that no longer belong to the remaining districts
    if (blocks.length > 0) {
      const validBlockIds = new Set(
        blocks
          .filter((b) => newDistrictIds.includes(b.district_id))
          .map((b) => b.id)
      );
      const prunedBlockIds = selectedBlockIds.filter((bId) => validBlockIds.has(bId));
      if (prunedBlockIds.length !== selectedBlockIds.length) {
        setValue('block_ids', prunedBlockIds, { shouldValidate: true });
        const remainingBlockNames = blocks
          .filter((b) => prunedBlockIds.includes(b.id))
          .map((b) => b.name);
        setValue('block', remainingBlockNames.join(', '));
      }
    } else if (newDistrictIds.length === 0) {
      setValue('block_ids', [], { shouldValidate: true });
      setValue('block', '');
    }
  };

  // Handle Block Change
  const handleBlockChange = (newBlockIds: string[]) => {
    setValue('block_ids', newBlockIds, { shouldValidate: true });

    // Derive names for human-readable fallback
    const selectedBlockNames = blocks
      .filter((b) => newBlockIds.includes(b.id))
      .map((b) => b.name);
    setValue('block', selectedBlockNames.join(', '));
  };

  return (
    <div className="space-y-8">
      {/* Location Details Section */}
      <div className="space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-600" />
            <span>Step 4: Location & Salary Details</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the assigned operational state, district(s), and block(s) from the Location Master.
          </p>
        </div>

        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>Location Allocation</span>
          </div>

          {/* Row 1: Circle and District side by side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Circle / State Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Circle *
              </label>
              <div className="relative">
                <select
                  {...register('circle')}
                  onChange={(e) => {
                    setValue('circle', e.target.value, { shouldValidate: true });
                    // Clear districts and blocks on circle switch
                    setValue('district_ids', []);
                    setValue('district', '');
                    setValue('block_ids', []);
                    setValue('block', '');
                  }}
                  className={`w-full h-[42px] px-3.5 py-2 rounded-xl border text-xs font-medium bg-white outline-none transition-all cursor-pointer ${
                    errors.circle
                      ? 'border-red-300 ring-1 ring-red-400/20 text-red-900'
                      : 'border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-800'
                  }`}
                  disabled={isLoadingStates}
                >
                  {states.length === 0 ? (
                    <option value="Rajasthan">Rajasthan (Loading Master...)</option>
                  ) : (
                    states.map((st) => (
                      <option key={st.id} value={st.name}>
                        {st.name} {st.code ? `(${st.code})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {errors.circle ? (
                <p className="text-[11px] font-medium text-red-600 mt-1">{errors.circle.message}</p>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1">Official administrative circle territory</p>
              )}
            </div>

            {/* District Multi-Select */}
            <div>
              <LocationMultiSelect
                label="District * (Multi-Select)"
                placeholder="Search and select districts..."
                options={districtOptions}
                selectedIds={selectedDistrictIds}
                onChange={handleDistrictChange}
                isLoading={isLoadingDistricts}
                disabled={!activeState && states.length > 0}
                error={errors.district_ids?.message as string}
                helperText="Select one or multiple district jurisdictions"
              />
            </div>
          </div>

          {/* Row 2: Block occupying full available width */}
          <div className="w-full">
            <LocationMultiSelect
              label="Block * (Multi-Select)"
              placeholder={
                selectedDistrictIds.length === 0
                  ? 'Select one or more districts above to view available blocks'
                  : 'Search and select assigned blocks...'
              }
              options={blockOptions}
              selectedIds={selectedBlockIds}
              onChange={handleBlockChange}
              isLoading={isLoadingBlocks}
              disabled={selectedDistrictIds.length === 0}
              error={errors.block_ids?.message as string}
              helperText={
                selectedDistrictIds.length === 0
                  ? 'Choose at least one district above to populate blocks'
                  : `Showing blocks for ${selectedDistrictIds.length} selected district${selectedDistrictIds.length > 1 ? 's' : ''}`
              }
            />
          </div>
        </div>
      </div>

      {/* Salary Details Section */}
      <div className="space-y-4 pt-2">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-indigo-600" />
            <span>Salary Details</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Specify candidate compensation numbers in INR. Negative values are prohibited.
          </p>
        </div>

        {/* Row: Current Salary, Asking Salary, Negotiated Salary side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <GlassInput
              label="Current Salary *"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              leftIcon={<span className="text-xs font-bold text-slate-500">₹</span>}
              error={errors.current_salary?.message}
              helperText="Current monthly/annual compensation"
              {...register('current_salary')}
            />
          </div>

          <div>
            <GlassInput
              label="Asking Salary *"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              leftIcon={<span className="text-xs font-bold text-slate-500">₹</span>}
              error={errors.asking_salary?.message}
              helperText="Candidate's expected compensation"
              {...register('asking_salary')}
            />
          </div>

          <div>
            <GlassInput
              label="Negotiated Salary"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              leftIcon={<span className="text-xs font-bold text-slate-500">₹</span>}
              error={errors.negotiated_salary?.message}
              helperText="Final agreed amount (optional)"
              {...register('negotiated_salary')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
