import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { GlassButton } from '@/components/GlassButton';
import { VerificationApplication } from '../types';
import { useUpdateJoiningStatus } from '../hooks/useVerification';
import { UserCheck, Calendar, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface MarkJoinedModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: VerificationApplication | null;
  onSuccess?: () => void;
}

export const MarkJoinedModal: React.FC<MarkJoinedModalProps> = ({
  isOpen,
  onClose,
  candidate,
  onSuccess,
}) => {
  const updateJoiningMutation = useUpdateJoiningStatus();

  const [status, setStatus] = useState<'JOINED' | 'NOT_JOINED'>('JOINED');
  const [joiningDate, setJoiningDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (candidate) {
      setStatus(candidate.site_joining_status === 'JOINED' ? 'JOINED' : 'JOINED');
      // Default to existing site_joining_date or candidate joining_date, or today in DD/MM/YYYY
      const existingDate = candidate.site_joining_date || candidate.joining_date;
      if (existingDate) {
        setJoiningDate(existingDate);
      } else {
        const today = new Date();
        const d = String(today.getDate()).padStart(2, '0');
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const y = today.getFullYear();
        setJoiningDate(`${d}/${m}/${y}`);
      }
      setNotes(candidate.site_joining_notes || '');
      setError(null);
    }
  }, [candidate, isOpen]);

  if (!candidate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (status === 'JOINED' && !joiningDate.trim()) {
      setError('Please provide a valid joining date when marking candidate as Joined.');
      return;
    }

    try {
      await updateJoiningMutation.mutateAsync({
        applicationId: candidate.id,
        status,
        joining_date: joiningDate.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to update site joining status. Please try again.'
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Site Joining Status"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Candidate Summary Pill */}
        <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">{candidate.full_name}</span>
              <span className="font-mono text-[11px] text-indigo-700 font-semibold bg-indigo-100/70 px-2 py-0.5 rounded">
                {candidate.application_number}
              </span>
            </div>
            <p className="text-slate-500 text-[11px]">
              {candidate.hero_category} • {candidate.role_applied}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
            candidate.site_joining_status === 'JOINED'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            Current: {candidate.site_joining_status === 'JOINED' ? 'Joined On Site' : 'Not Joined'}
          </span>
        </div>

        {/* Status Selection */}
        <div className="space-y-1.5">
          <label className="font-bold text-slate-700 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Site Joining Status *</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatus('JOINED')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                status === 'JOINED'
                  ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 mt-0.5 ${status === 'JOINED' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div>
                <div className="font-bold">Joined On Site</div>
                <div className="text-[11px] font-normal text-slate-500 mt-0.5">Candidate physically reported</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatus('NOT_JOINED')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                status === 'NOT_JOINED'
                  ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-500/20 text-amber-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 mt-0.5 ${status === 'NOT_JOINED' ? 'text-amber-600' : 'text-slate-400'}`} />
              <div>
                <div className="font-bold">Not Joined / Pending</div>
                <div className="text-[11px] font-normal text-slate-500 mt-0.5">Not yet reported on site</div>
              </div>
            </button>
          </div>
        </div>

        {/* Joining Date Field */}
        <div className="space-y-1">
          <label className="font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Joining Date {status === 'JOINED' ? '*' : '(Optional)'}</span>
          </label>
          <input
            type="text"
            placeholder="DD/MM/YYYY (e.g. 15/11/2026)"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
          />
          <p className="text-[11px] text-slate-400">
            Commencement date of candidate services on site.
          </p>
        </div>

        {/* Remarks / Notes */}
        <div className="space-y-1">
          <label className="font-bold text-slate-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Site Joining Notes / Station Remarks (Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Candidate reported at Jaipur Tech hub, identity verified on site."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 resize-none"
          />
        </div>

        {/* Confirmation Info Box */}
        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Enrollment Completion Rule</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            Marking a candidate as <strong>Joined On Site</strong> records their official commencement date and establishes their enrollment as <strong>100% completed</strong>. This decision is preserved across sessions and audit logs.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <GlassButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={updateJoiningMutation.isPending}
          >
            Cancel
          </GlassButton>

          <GlassButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={updateJoiningMutation.isPending}
            leftIcon={
              updateJoiningMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )
            }
          >
            {updateJoiningMutation.isPending ? 'Saving Status...' : 'Confirm & Save Status'}
          </GlassButton>
        </div>
      </form>
    </Modal>
  );
};

