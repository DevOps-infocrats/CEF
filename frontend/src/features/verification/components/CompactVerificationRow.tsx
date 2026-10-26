import React, { useState } from 'react';
import { CandidateVerificationItem } from '../types';
import { VerificationStatusBadge } from './VerificationStatusBadge';
import {
  Check,
  RotateCcw,
  User,
  Clock,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';

export interface CompactVerificationRowProps {
  item?: CandidateVerificationItem;
  itemKey: string;
  itemLabel: string;
  isMandatory: boolean;
  categoryIcon?: React.ReactNode;
  status: 'PENDING' | 'DONE' | 'REJECTED' | string;
  summary: React.ReactNode;
  detailsContent: React.ReactNode;
  onMarkDone: (itemKey: string, remarks?: string) => Promise<void>;
  onReset: (itemKey: string, remarks?: string) => Promise<void>;
  isUpdating: boolean;
  canVerify: boolean;
  documentAction?: React.ReactNode;
  initialExpanded?: boolean;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  remarks?: string | null;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export const CompactVerificationRow: React.FC<CompactVerificationRowProps> = ({
  item,
  itemKey,
  itemLabel,
  isMandatory,
  categoryIcon,
  status,
  summary,
  detailsContent,
  onMarkDone,
  onReset,
  isUpdating,
  canVerify,
  documentAction,
  initialExpanded = false,
  verifiedByName,
  verifiedAt,
  remarks: initialRemarks,
  selectable = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [showRemarksInput, setShowRemarksInput] = useState(false);
  const existingRemarks = item?.remarks || initialRemarks || '';
  const [remarks, setRemarks] = useState(existingRemarks);

  const isDone = status === 'DONE';

  const handleDoneClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onMarkDone(itemKey, remarks.trim() || undefined);
    setShowRemarksInput(false);
  };

  const handleResetClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onReset(itemKey, remarks.trim() || undefined);
    setShowRemarksInput(false);
  };

  const formattedDate = (item?.verified_at || verifiedAt)
    ? new Date(item?.verified_at || verifiedAt || '').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const verifierName = item?.verified_by_name || verifiedByName;

  return (
    <div
      className={`border rounded-xl transition-all duration-150 overflow-hidden ${
        isDone
          ? 'border-emerald-200/90 bg-emerald-50/15'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {/* Dense Row Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-2.5 sm:p-3 cursor-pointer select-none gap-2 hover:bg-slate-50/70 transition-colors"
      >
        {/* Left: Checkbox + Chevron + Icon + Title + Mandatory Tag + Summary */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          {selectable && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect?.();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0"
              aria-label={`Select ${itemLabel}`}
            />
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-transform"
            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isExpanded ? 'rotate-90 text-indigo-600' : ''
              }`}
            />
          </button>

          {categoryIcon && (
            <div className="text-indigo-600 shrink-0 hidden xs:block">
              {categoryIcon}
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-semibold text-xs text-slate-900 tracking-tight">
              {itemLabel}
            </span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                isMandatory
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              {isMandatory ? 'Mandatory' : 'Optional'}
            </span>
          </div>

          {/* Quick Summary Pill / Text */}
          <div className="text-xs text-slate-500 truncate hidden md:block border-l border-slate-200 pl-2 ml-1">
            {summary}
          </div>
        </div>

        {/* Right: Badge, Document Inspect, Remarks, Action Button */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <VerificationStatusBadge status={status} size="sm" />

          {documentAction && (
            <div className="shrink-0">{documentAction}</div>
          )}

          {canVerify && (
            <button
              type="button"
              onClick={() => {
                setShowRemarksInput(!showRemarksInput);
                if (!isExpanded) setIsExpanded(true);
              }}
              className={`p-1.5 rounded-lg text-xs transition-colors relative ${
                existingRemarks
                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title={existingRemarks ? `Remarks: ${existingRemarks}` : 'Add note/remarks'}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {existingRemarks && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
              )}
            </button>
          )}

          {canVerify && (
            <>
              {isDone ? (
                <button
                  type="button"
                  onClick={handleResetClick}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50"
                  title="Revert to Pending"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span className="hidden sm:inline">{isUpdating ? 'Resetting...' : 'Reset'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDoneClick}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-50 shadow-2xs"
                  title="Mark as Done"
                >
                  <Check className="w-3 h-3" />
                  <span>{isUpdating ? 'Saving...' : 'Mark as Done'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expandable Details Drawer */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-3 bg-slate-50/70 space-y-2.5 text-xs">
          {/* Mobile Summary if hidden above */}
          <div className="md:hidden p-2 bg-white rounded-lg border border-slate-200 text-slate-600">
            {summary}
          </div>

          {/* Detailed Content */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-slate-800">
            {detailsContent}
          </div>

          {/* Verifier Audit Stamp */}
          {isDone && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-emerald-800 font-medium px-1">
              {verifierName && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Verified by: <strong>{verifierName}</strong></span>
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

          {/* Existing Remarks Banner */}
          {existingRemarks && !showRemarksInput && (
            <div className="flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-amber-950">Reviewer Notes: </span>
                <span>{existingRemarks}</span>
              </div>
            </div>
          )}

          {/* Remarks Input Form */}
          {showRemarksInput && canVerify && (
            <div className="p-2.5 bg-white border border-indigo-200 rounded-lg space-y-2 shadow-2xs">
              <label className="block text-[11px] font-semibold text-slate-700">
                Verification Remarks / Reviewer Notes
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter remarks or correction notes (optional)..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  maxLength={500}
                  className="flex-1 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowRemarksInput(false)}
                  className="px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
