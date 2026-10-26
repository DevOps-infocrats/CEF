import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Briefcase } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-mesh-gradient overflow-hidden">
      {/* Dynamic Animated Ambient Blobs in Indigo Studio */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none animate-blob" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-300/15 rounded-full blur-3xl pointer-events-none animate-blob animation-delay-2000" />
      <div className="absolute top-2/3 left-1/3 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none animate-blob animation-delay-4000" />

      {/* Decorative Subtle Grid Dots */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#4F46E5 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 w-full max-w-md my-8">
        {/* Brand Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-indigo-500 p-[1.5px] shadow-md shadow-indigo-600/20">
              <div className="w-full h-full bg-white rounded-[14.5px] flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-indigo-600 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div className="text-left">
              <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                Candidate Enrollment Form
                <span className="text-[10px] bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  CEF
                </span>
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                Candidate Onboarding & Document Verification
              </p>
            </div>
          </Link>
        </div>

        {/* Content Outlet (Login / Register Card) */}
        <Outlet />
      </div>
    </div>
  );
};
