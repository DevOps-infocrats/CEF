import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ShieldAlert, XCircle } from 'lucide-react';
import { ApplicationOverallStatus, VerificationItemStatus } from '../types';

interface VerificationStatusBadgeProps {
  status: ApplicationOverallStatus | VerificationItemStatus;
  size?: 'sm' | 'md';
}

export const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const normStatus = (status || '').toUpperCase();

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5';

  switch (normStatus) {
    case 'APPROVED':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-400 shadow-2xs ${sizeClasses}`}
        >
          <CheckCircle2 className={size === 'sm' ? 'w-3 h-3 text-emerald-700' : 'w-3.5 h-3.5 text-emerald-700'} />
          <span>Approved</span>
        </span>
      );

    case 'VERIFICATION_COMPLETE':
    case 'DONE':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs ${sizeClasses}`}
        >
          <CheckCircle2 className={size === 'sm' ? 'w-3 h-3 text-emerald-600' : 'w-3.5 h-3.5 text-emerald-600'} />
          <span>{normStatus === 'DONE' ? 'Verified' : 'Verification Complete'}</span>
        </span>
      );

    case 'IN_PROGRESS':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs ${sizeClasses}`}
        >
          <Clock className={size === 'sm' ? 'w-3 h-3 text-sky-600 animate-spin-slow' : 'w-3.5 h-3.5 text-sky-600 animate-spin-slow'} />
          <span>In Progress</span>
        </span>
      );

    case 'REJECTED':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs ${sizeClasses}`}
        >
          <XCircle className={size === 'sm' ? 'w-3 h-3 text-rose-600' : 'w-3.5 h-3.5 text-rose-600'} />
          <span>Rejected</span>
        </span>
      );

    case 'NEEDS_CORRECTION':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-orange-50 text-orange-700 border border-orange-300 shadow-2xs ${sizeClasses}`}
        >
          <ShieldAlert className={size === 'sm' ? 'w-3 h-3 text-orange-600' : 'w-3.5 h-3.5 text-orange-600'} />
          <span>Needs Correction</span>
        </span>
      );

    case 'PENDING_VERIFICATION':
    case 'PENDING':
    case 'SUBMITTED':
    default:
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-300 shadow-2xs ${sizeClasses}`}
        >
          <AlertTriangle className={size === 'sm' ? 'w-3 h-3 text-amber-600' : 'w-3.5 h-3.5 text-amber-600'} />
          <span>{normStatus === 'PENDING' ? 'Pending' : 'Pending Verification'}</span>
        </span>
      );
  }
};
