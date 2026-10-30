import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { GlassButton } from '@/components/GlassButton';
import { VerificationApplication } from '../types';
import { useUpdateApplication } from '@/features/candidates/hooks/useCandidates';
import {
  MapPin,
  Landmark,
  IndianRupee,
  Calendar,
  Save,
  Loader2,
  AlertTriangle,
  Building,
} from 'lucide-react';

interface EditCandidateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: VerificationApplication | null;
  onSuccess?: () => void;
}

type TabType = 'personal' | 'address' | 'bank' | 'salary';

export const EditCandidateDetailsModal: React.FC<EditCandidateDetailsModalProps> = ({
  isOpen,
  onClose,
  candidate,
  onSuccess,
}) => {
  const updateMutation = useUpdateApplication();
  const [activeTab, setActiveTab] = useState<TabType>('personal');

  // Form State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');

  // Current Address
  const [currentLine1, setCurrentLine1] = useState('');
  const [currentLine2, setCurrentLine2] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [currentState, setCurrentState] = useState('');
  const [currentPincode, setCurrentPincode] = useState('');

  // Permanent Address
  const [isPermanentSame, setIsPermanentSame] = useState(false);
  const [permLine1, setPermLine1] = useState('');
  const [permLine2, setPermLine2] = useState('');
  const [permCity, setPermCity] = useState('');
  const [permState, setPermState] = useState('');
  const [permPincode, setPermPincode] = useState('');

  // Bank Details
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');

  // Location & Salary
  const [circle, setCircle] = useState('');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [currentSalary, setCurrentSalary] = useState('');
  const [askingSalary, setAskingSalary] = useState('');
  const [negotiatedSalary, setNegotiatedSalary] = useState('');
  const [joiningDate, setJoiningDate] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (candidate && isOpen) {
      setFullName(candidate.full_name || '');
      setMobileNumber(candidate.mobile_number || '');
      setEmail(candidate.email || '');
      // Aadhaar and PAN (unmasked if available, otherwise blank unless user enters new)
      setAadhaarNumber(candidate.aadhaar_number || '');
      setPanNumber(candidate.pan_number || '');

      setCurrentLine1(candidate.current_address_line1 || '');
      setCurrentLine2(candidate.current_address_line2 || '');
      setCurrentCity(candidate.current_city || '');
      setCurrentState(candidate.current_state || '');
      setCurrentPincode(candidate.current_pin_code || candidate.current_pincode || '');

      setIsPermanentSame(Boolean(candidate.is_permanent_same));
      setPermLine1(candidate.permanent_address_line1 || '');
      setPermLine2(candidate.permanent_address_line2 || '');
      setPermCity(candidate.permanent_city || '');
      setPermState(candidate.permanent_state || '');
      setPermPincode(candidate.permanent_pin_code || candidate.permanent_pincode || '');

      setAccountHolderName(candidate.account_holder_name || '');
      setBankName(candidate.bank_name || '');
      setAccountNumber(candidate.account_number || '');
      setIfscCode(candidate.ifsc_code || '');
      setBranchName(candidate.branch_name || '');

      setCircle(candidate.circle || '');
      setDistrict(candidate.district || '');
      setBlock(candidate.block || '');
      setCurrentSalary(candidate.current_salary !== undefined && candidate.current_salary !== null ? String(candidate.current_salary) : '');
      setAskingSalary(candidate.asking_salary !== undefined && candidate.asking_salary !== null ? String(candidate.asking_salary) : '');
      setNegotiatedSalary(candidate.negotiated_salary !== undefined && candidate.negotiated_salary !== null ? String(candidate.negotiated_salary) : '');
      setJoiningDate(candidate.joining_date || candidate.site_joining_date || '');

      setFormError(null);
      setActiveTab('personal');
    }
  }, [candidate, isOpen]);

  if (!candidate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('Candidate full name is required.');
      setActiveTab('personal');
      return;
    }

    const payload: Record<string, any> = {
      full_name: fullName.trim(),
      mobile_number: mobileNumber.trim(),
      email: email.trim() || undefined,
      current_address_line1: currentLine1.trim(),
      current_address_line2: currentLine2.trim() || undefined,
      current_city: currentCity.trim(),
      current_state: currentState.trim(),
      current_pin_code: currentPincode.trim(),
      is_permanent_same: isPermanentSame,
      permanent_address_line1: isPermanentSame ? currentLine1.trim() : permLine1.trim(),
      permanent_address_line2: isPermanentSame ? (currentLine2.trim() || undefined) : (permLine2.trim() || undefined),
      permanent_city: isPermanentSame ? currentCity.trim() : permCity.trim(),
      permanent_state: isPermanentSame ? currentState.trim() : permState.trim(),
      permanent_pin_code: isPermanentSame ? currentPincode.trim() : permPincode.trim(),
      account_holder_name: accountHolderName.trim() || undefined,
      bank_name: bankName.trim() || undefined,
      ifsc_code: ifscCode.trim() ? ifscCode.trim().toUpperCase() : undefined,
      branch_name: branchName.trim() || undefined,
      circle: circle.trim() || undefined,
      district: district.trim() || undefined,
      block: block.trim() || undefined,
      current_salary: currentSalary.trim() ? currentSalary.trim() : undefined,
      asking_salary: askingSalary.trim() ? askingSalary.trim() : undefined,
      negotiated_salary: negotiatedSalary.trim() ? negotiatedSalary.trim() : undefined,
      joining_date: joiningDate.trim() || undefined,
    };

    if (aadhaarNumber.trim() && !aadhaarNumber.includes('•')) {
      payload.aadhaar_number = aadhaarNumber.trim();
    }
    if (panNumber.trim() && !panNumber.includes('•')) {
      payload.pan_number = panNumber.trim().toUpperCase();
    }
    if (accountNumber.trim() && !accountNumber.includes('•')) {
      payload.account_number = accountNumber.trim();
    }

    try {
      await updateMutation.mutateAsync({
        id: candidate.id,
        data: payload as any,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to update candidate details. Please verify the entered information.'
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Candidate Details — ${candidate.full_name}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Application Ref Badge & Creator Notice */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
              {candidate.application_number}
            </span>
            <span className="font-semibold text-slate-700">
              {candidate.hero_category} • {candidate.role_applied}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Original Creator: <strong className="text-slate-700">{candidate.created_by_name || 'System'}</strong>
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'personal'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Personal Information
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('address')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'address'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Address Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'bank'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Bank Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('salary')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'salary'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Location & Salary
          </button>
        </div>

        {/* Tab 1: Personal Information */}
        {activeTab === 'personal' && (
          <div className="space-y-3 animate-in fade-in-50">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Full Legal Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Candidate Full Name"
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mobile Number *</label>
                <input
                  type="text"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidate@example.com"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Aadhaar Number</label>
                <input
                  type="text"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  placeholder={candidate.aadhaar_masked || '12-digit Aadhaar'}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">PAN Number</label>
                <input
                  type="text"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value)}
                  placeholder={candidate.pan_masked || '10-character PAN'}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono uppercase"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Address Details */}
        {activeTab === 'address' && (
          <div className="space-y-3 animate-in fade-in-50">
            <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Current Residential Address</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={currentLine1}
                  onChange={(e) => setCurrentLine1(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">City</label>
                <input
                  type="text"
                  value={currentCity}
                  onChange={(e) => setCurrentCity(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">State</label>
                <input
                  type="text"
                  value={currentState}
                  onChange={(e) => setCurrentState(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pin Code</label>
                <input
                  type="text"
                  value={currentPincode}
                  onChange={(e) => setCurrentPincode(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={isPermanentSame}
                  onChange={(e) => setIsPermanentSame(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span>Permanent address is the same as current address</span>
              </label>
            </div>

            {!isPermanentSame && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Permanent Address</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={permLine1}
                      onChange={(e) => setPermLine1(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">City</label>
                    <input
                      type="text"
                      value={permCity}
                      onChange={(e) => setPermCity(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">State</label>
                    <input
                      type="text"
                      value={permState}
                      onChange={(e) => setPermState(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Pin Code</label>
                    <input
                      type="text"
                      value={permPincode}
                      onChange={(e) => setPermPincode(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Bank Details */}
        {activeTab === 'bank' && (
          <div className="space-y-3 animate-in fade-in-50">
            <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-indigo-600" />
              <span>Registered Bank Account</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Name as per passbook"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={candidate.account_number_masked || 'Bank Account Number'}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  placeholder="e.g. SBIN0001234"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono uppercase"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Branch Name</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Branch location"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Location & Salary */}
        {activeTab === 'salary' && (
          <div className="space-y-3 animate-in fade-in-50">
            <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
              <span>Location Allocation & Compensation</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Circle</label>
                <input
                  type="text"
                  value={circle}
                  onChange={(e) => setCircle(e.target.value)}
                  placeholder="e.g. Rajasthan"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Jaipur"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Block</label>
                <input
                  type="text"
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  placeholder="e.g. Amber"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Current Salary (₹)</label>
                <input
                  type="text"
                  value={currentSalary}
                  onChange={(e) => setCurrentSalary(e.target.value)}
                  placeholder="e.g. 25000"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Asking Salary (₹)</label>
                <input
                  type="text"
                  value={askingSalary}
                  onChange={(e) => setAskingSalary(e.target.value)}
                  placeholder="e.g. 30000"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Negotiated / Approved Salary (₹)</label>
                <input
                  type="text"
                  value={negotiatedSalary}
                  onChange={(e) => setNegotiatedSalary(e.target.value)}
                  placeholder="e.g. 28000"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Agreed Service Joining Date</span>
              </label>
              <input
                type="text"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                placeholder="DD/MM/YYYY (e.g. 15/11/2026)"
                className="w-full md:w-64 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>
          </div>
        )}

        {/* Error Notification */}
        {formError && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">
            Edits are saved directly to the database and recorded in the audit log.
          </p>
          <div className="flex items-center gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={updateMutation.isPending}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={updateMutation.isPending}
              leftIcon={
                updateMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )
              }
            >
              {updateMutation.isPending ? 'Saving Edits...' : 'Save Changes'}
            </GlassButton>
          </div>
        </div>
      </form>
    </Modal>
  );
};
