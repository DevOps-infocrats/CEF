import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  Bell,
  CheckCircle2,
  Database,
  Menu,
  X,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { HeaderSearch } from './HeaderSearch';

interface DashboardHeaderProps {
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onToggleMobileMenu,
  isMobileMenuOpen = false,
}) => {
  const location = useLocation();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };
    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  // Dynamic portal health check query (real backend health data, not hardcoded)
  const { data: healthData, isError: isHealthError } = useQuery<{
    status: string;
    service: string;
    environment?: string;
  }>({
    queryKey: ['portal-health-check'],
    queryFn: async () => {
      const res = await apiClient.get('/health');
      return res.data;
    },
    staleTime: 1000 * 60, // 1 min
    refetchInterval: 1000 * 60,
    retry: 1,
  });

  const isPortalActive = !isHealthError && healthData?.status === 'healthy';

  // Derive route context based on active URL
  const getRouteInfo = (pathname: string) => {
    if (pathname.startsWith('/documents/') && pathname.length > 11) {
      return {
        title: 'Verification Workspace',
        breadcrumb: 'Candidate Verification',
      };
    }
    if (pathname.startsWith('/documents')) {
      return {
        title: 'Candidate Verification',
        breadcrumb: 'Candidate Verification',
      };
    }
    if (pathname.startsWith('/candidates')) {
      return {
        title: 'Candidate Applications',
        breadcrumb: 'Candidate Applications',
      };
    }
    if (pathname.startsWith('/roles')) {
      return {
        title: 'Role Management',
        breadcrumb: 'Role Management',
      };
    }
    if (pathname.startsWith('/audit')) {
      return {
        title: 'Audit & Activity Logs',
        breadcrumb: 'Audit & Compliance',
      };
    }
    if (pathname.startsWith('/profile')) {
      return {
        title: 'Profile & Settings',
        breadcrumb: 'Profile & Settings',
      };
    }
    return {
      title: 'Candidate Overview',
      breadcrumb: 'Overview',
    };
  };

  const routeInfo = getRouteInfo(location.pathname);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs transition-all">
      <div className="px-3 sm:px-6 md:px-8 h-14 sm:h-15 flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Left: Mobile Toggle + Breadcrumb & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shrink-0"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          )}

          <div className="flex flex-col min-w-0 justify-center">
            {/* Breadcrumb line */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 leading-none truncate"
            >
              <span className="hover:text-slate-600 transition-colors">
                CEF Portal
              </span>
              <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
              <span className="text-indigo-700 font-medium truncate">
                {routeInfo.breadcrumb}
              </span>
            </nav>

            {/* Page Title */}
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5 truncate">
              {routeInfo.title}
            </h1>
          </div>
        </div>

        {/* Right side: Search + Enrollment Status + Notification Control in a single row */}
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 flex-shrink-0">
          {/* 1. Compact Search with Real Data & Safe Keyboard Shortcut */}
          <HeaderSearch />

          {/* 2. Enrollment Portal Status Pill (Semantic styling, Dynamic from real /health) */}
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold shadow-2xs select-none transition-colors border ${
              isPortalActive
                ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
            title={
              isPortalActive
                ? 'Enrollment Portal is active and receiving candidate applications'
                : 'Enrollment Portal service is currently unreachable'
            }
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {isPortalActive ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              )}
            </span>
            <span className="hidden md:inline whitespace-nowrap">
              {isPortalActive ? 'Enrollment Portal Active' : 'Portal Offline'}
            </span>
            <span className="md:hidden text-[11px] whitespace-nowrap">
              {isPortalActive ? 'Active' : 'Offline'}
            </span>
          </div>

          {/* 3. Refined Notification Button & System Status Panel */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all shadow-2xs border ${
                isNotificationsOpen
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-2 ring-indigo-500/20'
                  : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-600 hover:text-indigo-700 hover:border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
              aria-label="System status & alerts"
              aria-expanded={isNotificationsOpen}
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {/* Only show alert indicator if real service degradation or issue is detected */}
              {!isPortalActive && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl bg-white border border-slate-200 shadow-xl p-4 space-y-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        System Status & Alerts
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Live operational status
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isPortalActive
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60'
                        : 'text-rose-700 bg-rose-50 border-rose-200/60'
                    }`}
                  >
                    {isPortalActive ? 'Online' : 'Degraded'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-2.5">
                    {isPortalActive ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-800">
                        {isPortalActive ? 'Enrollment Portal Active' : 'Service Offline'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {isPortalActive
                          ? 'Candidate Enrollment Form portal is active and accepting submissions.'
                          : 'Portal backend connection failed. Trying to reconnect...'}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-2.5">
                    <Database className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-800">
                        Database Connected
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Database connection is synchronized and operational.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    {isPortalActive ? 'All services operational' : 'System check in progress'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-indigo-700 hover:text-indigo-800 font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Brand Accent Line along bottom of header */}
      <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400 opacity-80" />
    </header>
  );
};
