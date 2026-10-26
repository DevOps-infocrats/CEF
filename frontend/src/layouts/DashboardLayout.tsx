import React, { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileCheck,
  Shield,
  Settings,
  LogOut,
  User,
  Briefcase,
} from 'lucide-react';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/useAuth';
import { DashboardHeader } from './DashboardHeader';

export const DashboardLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const userPermissions = user?.permissions || [];
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('admin') || userPermissions.includes('users:manage');
  const canVerify =
    isAdmin ||
    userPermissions.includes('documents:verify') ||
    userPermissions.includes('candidates:approve') ||
    userPermissions.includes('candidates:reject');
  const canViewAudit =
    isAdmin ||
    userPermissions.includes('audit:read');

  const navItems = [
    { name: 'Candidate Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Candidate Applications', path: '/candidates', icon: Users, badge: 'Active' },
    ...(canVerify ? [{ name: 'Candidate Verification', path: '/documents', icon: FileCheck }] : []),
    ...(isAdmin ? [{ name: 'Manage Roles', path: '/roles', icon: Briefcase }] : []),
    ...(canViewAudit ? [{ name: 'Audit & Activity Logs', path: '/audit', icon: Shield }] : []),
    { name: 'Profile & Settings', path: '/profile', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-mesh-gradient flex flex-col md:flex-row text-slate-800">
      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen z-40 w-64 md:w-72 p-4 flex flex-col transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="glass-panel bg-white/90 border-slate-200 shadow-md flex-1 flex flex-col p-5 overflow-y-auto">
          {/* Brand */}
          <Link to="/dashboard" className="flex items-center gap-3 pb-6 border-b border-slate-100 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 p-[1.5px] shadow-sm shadow-indigo-600/30 flex-shrink-0">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-indigo-600 group-hover:rotate-6 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <span className="font-bold text-sm text-slate-900 block tracking-tight">
                CEF Portal
              </span>
              <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">
                Candidate Enrollment
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="my-6 space-y-1.5 flex-1">
            <p className="text-[10px] uppercase font-bold text-slate-400 px-3 pb-2 tracking-wider">
              Candidate Management
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-xs'
                        : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60 border border-transparent'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold border border-indigo-200">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User Profile Card & Sign Out */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-200/60">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                {user?.first_name?.charAt(0) || <User className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user?.full_name || 'System Admin'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-indigo-700 font-semibold capitalize truncate">
                    {user?.roles?.[0] || 'admin'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors border border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Redesigned Enterprise Header */}
        <DashboardHeader
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        {/* Dashboard Pages Mount Here */}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
