import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  candidateApplicationSchema,
  CandidateApplicationFormInput,
  CandidateApplicationFormOutput,
} from '../schemas';
import { HeroCategory, RoleApplied, CandidateApplicationResponse, DocumentCategory, CandidateFilterParams } from '../types';
import {
  useMyApplications,
  useCreateApplication,
  useUpdateApplication,
  useStagedDocuments,
  useUploadDocument,
  useDeleteDocument,
} from '../hooks/useCandidates';
import { HeroTabs } from '../components/HeroTabs';
import { RoleSelector } from '../components/RoleSelector';
import { PersonalInformationSection } from '../components/PersonalInformationSection';
import { AddressDetailsSection } from '../components/AddressDetailsSection';
import { BankDetailsSection } from '../components/BankDetailsSection';
import { LocationSalarySection } from '../components/LocationSalarySection';
import { DocumentUploadSection } from '../components/DocumentUploadSection';
import { ApplicationsList } from '../components/ApplicationsList';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ListFilter,
  PlusCircle,
  FileSpreadsheet,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';

export const CandidateApplicationPage: React.FC = () => {
  const { data: currentUser } = useCurrentUser();
  const userPermissions = currentUser?.permissions || [];
  const userRoles = currentUser?.roles || [];
  const isAdmin = userRoles.includes('admin') || userPermissions.includes('users:manage');
  const canCreate =
    isAdmin ||
    userPermissions.includes('candidates:create') ||
    userPermissions.includes('candidates:write') ||
    userPermissions.includes('candidates:submit');

  // Main view mode: 'form' or 'list'
  const [viewMode, setViewMode] = useState<'form' | 'list'>('list');

  React.useEffect(() => {
    if (canCreate) {
      setViewMode('form');
    } else {
      setViewMode('list');
    }
  }, [canCreate]);

  // Hero & Role selection state
  const [selectedHero, setSelectedHero] = useState<HeroCategory>('Hero 1');
  const [selectedRole, setSelectedRole] = useState<RoleApplied | null>(null);

  // Active form section step:
  // 1: Personal Information
  // 2: Address Details
  // 3: Bank Details
  // 4: Location & Salary Details
  // 5: Document Upload & Final Submit
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Success state holding backend response
  const [submittedApp, setSubmittedApp] = useState<CandidateApplicationResponse | null>(null);

  // Edit application state
  const [editingAppId, setEditingAppId] = useState<string | null>(null);

  // Staged document upload state
  const [uploadingCategory, setUploadingCategory] = useState<DocumentCategory | null>(null);

  // Filter state for submitted applications list
  const [filters, setFilters] = useState<CandidateFilterParams>({});

  // Queries & Mutations
  const { data: myAppsData, isLoading: isLoadingApps } = useMyApplications(filters, {
    enabled: viewMode === 'list',
  });
  const { data: stagedDocs = [] } = useStagedDocuments();
  const createMutation = useCreateApplication();
  const updateMutation = useUpdateApplication();
  const uploadDocMutation = useUploadDocument();
  const deleteDocMutation = useDeleteDocument();

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    getValues,
    reset,
    formState: { errors },
  } = useForm<CandidateApplicationFormInput>({
    resolver: zodResolver(candidateApplicationSchema),
    mode: 'onTouched',
    defaultValues: {
      hero_category: 'Hero 1',
      role_applied: 'HDD Operate',
      full_name: '',
      mobile_number: '',
      email: '',
      aadhaar_number: '',
      pan_number: '',
      current_address_line1: '',
      current_address_line2: '',
      current_city: '',
      current_state: '',
      current_pin_code: '',
      current_country: 'India',
      is_permanent_same: false,
      permanent_address_line1: '',
      permanent_address_line2: '',
      permanent_city: '',
      permanent_state: '',
      permanent_pin_code: '',
      permanent_country: 'India',
      account_holder_name: '',
      bank_name: '',
      account_number: '',
      confirm_account_number: '',
      ifsc_code: '',
      branch_name: '',
      circle: '',
      district: '',
      block: '',
      district_ids: [],
      block_ids: [],
      current_salary: '',
      asking_salary: '',
      negotiated_salary: '',
    },
  });

  // Keep form hero_category and role_applied synchronized with state
  const handleSelectHero = (hero: HeroCategory) => {
    setSelectedHero(hero);
    setValue('hero_category', hero, { shouldValidate: true });
  };

  const handleSelectRole = (role: RoleApplied) => {
    setSelectedRole(role);
    setValue('role_applied', role, { shouldValidate: true });
    setCurrentStep(1);
  };

  // Step validation before proceeding
  const handleNextStep = async () => {
    let isValid = false;

    if (currentStep === 1) {
      isValid = await trigger([
        'full_name',
        'mobile_number',
        'email',
        'aadhaar_number',
        'pan_number',
      ]);
    } else if (currentStep === 2) {
      const isSame = watch('is_permanent_same');
      const addressFields: Array<keyof CandidateApplicationFormInput> = [
        'current_address_line1',
        'current_city',
        'current_state',
        'current_pin_code',
        'current_country',
      ];
      if (!isSame) {
        addressFields.push(
          'permanent_address_line1',
          'permanent_city',
          'permanent_state',
          'permanent_pin_code',
          'permanent_country'
        );
      }
      isValid = await trigger(addressFields);
    } else if (currentStep === 3) {
      isValid = await trigger([
        'account_holder_name',
        'bank_name',
        'account_number',
        'confirm_account_number',
        'ifsc_code',
      ]);
    } else if (currentStep === 4) {
      isValid = await trigger([
        'circle',
        'district_ids',
        'block_ids',
        'current_salary',
        'asking_salary',
        'negotiated_salary',
      ]);
    }

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditSection = (step: number) => {
    if (step === 0) {
      // Return to role selection
      setSelectedRole(null);
    } else {
      setCurrentStep(step);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Document upload wrapper
  const handleUploadDocument = async (file: File, category: DocumentCategory) => {
    setUploadingCategory(category);
    try {
      await uploadDocMutation.mutateAsync({ file, category });
    } finally {
      setUploadingCategory(null);
    }
  };

  // Document delete wrapper
  const handleDeleteDocument = async (docId: string) => {
    await deleteDocMutation.mutateAsync(docId);
  };

  // Submit Final to Backend with duplicate submission prevention
  const handleFinalSubmit = () => {
    if (createMutation.isPending || updateMutation.isPending) return;
    handleSubmit((data) => {
      if (editingAppId) {
        updateMutation.mutate(
          {
            id: editingAppId,
            data: data as unknown as Partial<CandidateApplicationFormOutput>,
          },
          {
            onSuccess: (savedApp) => {
              setSubmittedApp(savedApp);
              setEditingAppId(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            },
          }
        );
      } else {
        createMutation.mutate(data as unknown as CandidateApplicationFormOutput, {
          onSuccess: (savedApp) => {
            setSubmittedApp(savedApp);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          },
        });
      }
    })();
  };

  const handleEditApplication = (app: CandidateApplicationResponse) => {
    setEditingAppId(app.id);
    reset({
      hero_category: (app.hero_category as HeroCategory) || 'Hero 1',
      role_applied: (app.role_applied as RoleApplied) || 'HDD Operate',
      full_name: app.full_name || '',
      mobile_number: app.mobile_number || '',
      email: app.email || '',
      aadhaar_number: '',
      pan_number: '',
      current_address_line1: app.current_address_line1 || '',
      current_address_line2: app.current_address_line2 || '',
      current_city: app.current_city || '',
      current_state: app.current_state || '',
      current_pin_code: app.current_pin_code || '',
      current_country: app.current_country || 'India',
      is_permanent_same: app.is_permanent_same || false,
      permanent_address_line1: app.permanent_address_line1 || '',
      permanent_address_line2: app.permanent_address_line2 || '',
      permanent_city: app.permanent_city || '',
      permanent_state: app.permanent_state || '',
      permanent_pin_code: app.permanent_pin_code || '',
      permanent_country: app.permanent_country || 'India',
      account_holder_name: app.account_holder_name || '',
      bank_name: app.bank_name || '',
      account_number: '',
      confirm_account_number: '',
      ifsc_code: app.ifsc_code || '',
      branch_name: app.branch_name || '',
      circle: app.circle || '',
      district: app.district || '',
      block: app.block || '',
      district_ids: [],
      block_ids: [],
      current_salary: app.current_salary !== undefined && app.current_salary !== null ? String(app.current_salary) : '',
      asking_salary: app.asking_salary !== undefined && app.asking_salary !== null ? String(app.asking_salary) : '',
      negotiated_salary: app.negotiated_salary !== undefined && app.negotiated_salary !== null ? String(app.negotiated_salary) : '',
    });
    setSelectedHero((app.hero_category as HeroCategory) || 'Hero 1');
    setSelectedRole((app.role_applied as RoleApplied) || 'HDD Operate');
    setCurrentStep(1);
    setSubmittedApp(null);
    setViewMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartNewApplication = () => {
    reset();
    setSubmittedApp(null);
    setEditingAppId(null);
    setSelectedRole(null);
    setCurrentStep(1);
    setViewMode('form');
  };

  // Steps configuration for step indicator
  const formSteps = [
    { number: 1, label: 'Personal Information' },
    { number: 2, label: 'Address Details' },
    { number: 3, label: 'Bank Details' },
    { number: 4, label: 'Location & Salary' },
    { number: 5, label: 'Documents & Submit' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner / Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-indigo-600" />
            <span>Candidate Application</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Select a Hero category and role to complete and submit candidate enrollment details.
            All submitted records are encrypted and verified against CEF Portal standards.
          </p>
        </div>

        {/* View Switcher: New Application vs My Applications */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setViewMode('form');
                setSubmittedApp(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'form' && !submittedApp
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-700/20'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Application Form</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-700/20'
                : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>
              Submitted Records {myAppsData ? `(${myAppsData.total})` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* VIEW: SUBMITTED LIST */}
      {viewMode === 'list' && (
        <ApplicationsList
          applications={myAppsData?.applications || []}
          isLoading={isLoadingApps}
          onNewApplication={handleStartNewApplication}
          onEditApplication={handleEditApplication}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}

      {/* VIEW: SUCCESS SCREEN */}
      {viewMode === 'form' && submittedApp && (
        <GlassCard className="text-center py-12 px-6 max-w-2xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 border-2 border-emerald-300 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Application Successfully Persisted
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Application Submitted
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your candidate enrollment form and supporting verification documents have been securely recorded.
            </p>
          </div>

          {/* Reference ID Callout */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-md mx-auto text-left space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Permanent Application Reference ID
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-bold text-indigo-800">
                {submittedApp.application_number}
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                {submittedApp.status}
              </span>
            </div>
            <div className="text-xs text-slate-600 pt-2 border-t border-slate-200 flex items-center justify-between">
              <span>Track: <strong>{submittedApp.hero_category}</strong> / {submittedApp.role_applied}</span>
              <span>Candidate: <strong>{submittedApp.full_name}</strong></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <GlassButton
              variant="secondary"
              onClick={() => setViewMode('list')}
              leftIcon={<ListFilter className="w-4 h-4" />}
            >
              View All Applications
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={handleStartNewApplication}
              leftIcon={<PlusCircle className="w-4 h-4" />}
            >
              Submit Another Application
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* VIEW: FORM WORKFLOW */}
      {viewMode === 'form' && !submittedApp && (
        <div className="space-y-6">
          {/* Step 0: Hero & Role Selection */}
          <GlassCard variant="default" className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                  Select Hero Category & Designation Role
                </span>
                {selectedRole && (
                  <button
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="text-xs text-slate-500 hover:text-indigo-700 underline"
                  >
                    Change Selection
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Choose an application track stream, then select an available designation role.
              </p>
            </div>

            {/* Top-level Tabs: Hero 1 and Hero 2 */}
            <HeroTabs
              selectedHero={selectedHero}
              onSelectHero={handleSelectHero}
            />

            {/* Role Options */}
            <RoleSelector
              selectedRole={selectedRole}
              onSelectRole={handleSelectRole}
            />
          </GlassCard>

          {/* Form Container (Visible when a Role is selected) */}
          {selectedRole ? (
            <GlassCard variant="glow" className="space-y-6">
              {/* Breadcrumb & Selected Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span className="text-slate-400">Application Track:</span>
                  <span className="text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                    {selectedHero}
                  </span>
                  <span className="text-slate-300">/</span>
                  <span className="text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                    {selectedRole}
                  </span>
                  {editingAppId && (
                    <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px] font-bold">
                      Editing Saved Record
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {editingAppId && (
                    <button
                      type="button"
                      onClick={handleStartNewApplication}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-700 font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Role Selection (Data Preserved)</span>
                  </button>
                </div>
              </div>

              {/* Step Navigation Progress Bar (5 Steps) */}
              <div className="py-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {formSteps.map((step) => {
                    const isCompleted = currentStep > step.number;
                    const isCurrent = currentStep === step.number;

                    return (
                      <button
                        key={step.number}
                        type="button"
                        onClick={() => {
                          if (step.number < currentStep) {
                            setCurrentStep(step.number);
                          }
                        }}
                        disabled={step.number > currentStep}
                        className={`text-left p-2.5 rounded-xl transition-all border outline-none ${
                          isCurrent
                            ? 'bg-indigo-50/90 border-indigo-500 shadow-xs ring-1 ring-indigo-500/20'
                            : isCompleted
                            ? 'bg-slate-50 hover:bg-indigo-50/40 border-slate-200 cursor-pointer text-slate-700'
                            : 'bg-white/40 border-slate-100 opacity-50 cursor-not-allowed text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCurrent
                                ? 'bg-indigo-600 text-white'
                                : isCompleted
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isCompleted ? <Check className="w-3 h-3" /> : step.number}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Step {step.number}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-800 block truncate">
                          {step.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Section Components */}
              <form onSubmit={(e) => e.preventDefault()} noValidate>
                {currentStep === 1 && (
                  <PersonalInformationSection
                    register={register}
                    errors={errors}
                  />
                )}

                {currentStep === 2 && (
                  <AddressDetailsSection
                    register={register}
                    errors={errors}
                    watch={watch}
                    setValue={setValue}
                  />
                )}

                {currentStep === 3 && (
                  <BankDetailsSection
                    register={register}
                    errors={errors}
                  />
                )}

                {currentStep === 4 && (
                  <LocationSalarySection
                    register={register}
                    errors={errors}
                    watch={watch}
                    setValue={setValue}
                  />
                )}

                {currentStep === 5 && (
                  <DocumentUploadSection
                    stagedDocs={stagedDocs}
                    onUploadDocument={handleUploadDocument}
                    onDeleteDocument={handleDeleteDocument}
                    isUploading={uploadDocMutation.isPending}
                    uploadingCategory={uploadingCategory}
                    formData={getValues()}
                    onEditSection={handleEditSection}
                    onSubmitFinal={handleFinalSubmit}
                    isSubmitting={createMutation.isPending || updateMutation.isPending}
                    isEditing={!!editingAppId}
                    submissionError={
                      createMutation.isError
                        ? (createMutation.error as unknown as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message ||
                          (createMutation.error as unknown as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                          'Failed to submit application. Please verify all requirements and try again.'
                        : updateMutation.isError
                        ? (updateMutation.error as unknown as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message ||
                          (updateMutation.error as unknown as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                          'Failed to update application. Please verify all requirements and try again.'
                        : null
                    }
                  />
                )}

                {/* Step Forward / Backward Actions (Steps 1 to 4) */}
                {currentStep < 5 && (
                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                    {currentStep > 1 ? (
                      <GlassButton
                        type="button"
                        variant="secondary"
                        onClick={handlePrevStep}
                        leftIcon={<ArrowLeft className="w-4 h-4" />}
                      >
                        Previous Step
                      </GlassButton>
                    ) : (
                      <GlassButton
                        type="button"
                        variant="ghost"
                        onClick={() => setSelectedRole(null)}
                        leftIcon={<ArrowLeft className="w-4 h-4" />}
                      >
                        Change Role
                      </GlassButton>
                    )}

                    <GlassButton
                      type="button"
                      variant="primary"
                      onClick={handleNextStep}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      {currentStep === 4 ? 'Continue to Document Upload' : 'Continue to Next Step'}
                    </GlassButton>
                  </div>
                )}
              </form>
            </GlassCard>
          ) : (
            /* Prompt to pick a role */
            <div className="p-6 rounded-2xl bg-indigo-50/40 border border-indigo-200/60 text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-indigo-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Please select one of the three role options above to open the application form.
              </p>
              <p className="text-[11px] text-slate-500">
                (HDD Operate, HDD Tracker, or HDD Helper)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
