import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'interactive' | 'glow';
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'glass-panel p-6 bg-white text-[#111827] border-slate-200/90 shadow-xs',
    subtle: 'glass-panel-subtle p-5 bg-white/80 text-[#111827] border-slate-200/80',
    interactive: 'glass-panel-interactive p-6 bg-white text-[#111827] border-slate-200/90 cursor-pointer shadow-xs hover:shadow-md hover:border-indigo-300',
    glow: 'glass-panel p-6 bg-white text-[#111827] border-indigo-200 shadow-md shadow-indigo-500/5',
  };

  return (
    <div
      className={`${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
