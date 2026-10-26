import React from 'react';
import { VerificationProgress } from '../types';

interface VerificationProgressBarProps {
  progress?: VerificationProgress;
  className?: string;
  showLabels?: boolean;
}

export const VerificationProgressBar: React.FC<VerificationProgressBarProps> = ({
  progress,
  className = '',
  showLabels = true,
}) => {
  const percentage = progress?.percentage || 0;
  const completed = progress?.completed_items || 0;
  const total = progress?.total_items || 0;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showLabels && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">
            {completed} of {total} items verified
          </span>
          <span className={`font-bold ${percentage === 100 ? 'text-emerald-700' : 'text-indigo-700'}`}>
            {percentage}%
          </span>
        </div>
      )}
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${
            percentage === 100
              ? 'bg-gradient-to-r from-emerald-500 to-green-600'
              : percentage > 0
              ? 'bg-gradient-to-r from-indigo-500 to-indigo-600'
              : 'bg-slate-300'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
};
