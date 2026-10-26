import React, { useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { CandidateVerificationItem } from '../types';
import { VerificationStatusBadge } from './VerificationStatusBadge';
import {
  Check,
  RotateCcw,
  User,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface VerificationItemCardProps {
  item: CandidateVerificationItem;
  contentNode?: React.ReactNode;
  onMarkDone: (itemKey: string, remarks?: string) => Promise<void>;
  onReset: (itemKey: string, remarks?: string) => Promise<void>;
  isUpdating: boolean;
  canVerify: boolean;
  documentAction?: React.ReactNode;
}

export const VerificationItemCard: React.FC<VerificationItemCardProps> = ({
  item,
  contentNode,
  onMarkDone,
  onReset,
  isUpdating,
  canVerify,
  documentAction,
}) => {
  const [showRemarksInput, setShowRemarksInput] = useState(false);
  const [remarks, setRemarks] = useState(item.remarks || '');
  const isDone = item.status === 'DONE';

  const handleDoneClick = async () => {
    await onMarkDone(item.item_key, remarks.trim() || undefined);
    setShowRemarksInput(false);
  };

  const handleResetClick = async () => {
    await onReset(item.item_key, remarks.trim() || undefined);
    setShowRemarksInput(false);
  };

  const formattedDate = item.verified_at
    ? new Date(item.verified_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <GlassCard
      variant="default"
      className={`p-3.5 transition-all duration-200 ${
        isDone
          ? 'border-emerald-300 bg-emerald-50/25 shadow-2xs'
          : 'border-slate-200 bg-white/95 hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Left Info Column */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header Row: Title, Mandatory Tag, Status */}
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-bold text-slate-900 tracking-tight">
              {item.item_label}
            </h4>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                item.is_mandatory
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {item.is_mandatory ? 'Mandatory' : 'Optional'}
            </span>
            <VerificationStatusBadge status={item.status} size="sm" />
          </div>

          {/* Submitted Content Display */}
          {contentNode && (
            <div className="p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-lg text-xs text-slate-700 leading-relaxed break-words">
              {contentNode}
            </div>
          )}

          {/* Document Inspection Action */}
          {documentAction && <div className="pt-0.5">{documentAction}</div>}

          {/* Verifier Audit Stamp if Verified */}
          {isDone && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-0.5">
              {item.verified_by_name && (
                <div className="flex items-center gap-1 font-medium text-emerald-800">
                  <User className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Verified by: {item.verified_by_name}</span>
                </div>
              )}
              {formattedDate && (
                <div className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{formattedDate}</span>
                </div>
              )}
            </div>
          )}

          {/* Existing Remarks Display */}
          {item.remarks && (
            <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-amber-50/70 border border-amber-200 p-2 rounded-lg">
              <MessageSquare className="w-3 h-3 text-amber-700 shrink-0 mt-0.5" />
              <span className="break-words">
                <strong className="text-slate-800">Remarks:</strong> {item.remarks}
              </span>
            </div>
          )}

          {/* Expandable Remarks Input */}
          {showRemarksInput && canVerify && (
            <div className="pt-1">
              <input
                type="text"
                placeholder="Add verification notes or remarks (optional)..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={500}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
              />
            </div>
          )}
        </div>

        {/* Right Actions Column */}
        {canVerify && (
          <div className="flex items-center gap-1.5 sm:self-start shrink-0 pt-0.5">
            <button
              type="button"
              onClick={() => setShowRemarksInput(!showRemarksInput)}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              title="Add or edit verification remarks"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {showRemarksInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {isDone ? (
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={handleResetClick}
                disabled={isUpdating}
                leftIcon={<RotateCcw className="w-3 h-3 text-slate-500" />}
                className="text-xs py-1 px-2.5"
              >
                {isUpdating ? 'Resetting...' : 'Reset'}
              </GlassButton>
            ) : (
              <GlassButton
                variant="primary"
                size="sm"
                onClick={handleDoneClick}
                disabled={isUpdating}
                leftIcon={<Check className="w-3 h-3" />}
                className="text-xs py-1 px-2.5"
              >
                {isUpdating ? 'Saving...' : 'Mark as Done'}
              </GlassButton>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
};
