import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { EmptyState } from '@/components/EmptyState';
import { FileText, ShieldAlert, Loader2 } from 'lucide-react';

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh] p-8">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <span className="text-xs uppercase tracking-widest text-slate-400 font-mono">Loading view...</span>
    </div>
  </div>
);

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const DashboardOverviewPage = lazy(() => import('@/features/dashboard/pages/DashboardOverviewPage').then(m => ({ default: m.DashboardOverviewPage })));
const CandidateApplicationPage = lazy(() => import('@/features/candidates/pages/CandidateApplicationPage').then(m => ({ default: m.CandidateApplicationPage })));
const DocumentVerificationListPage = lazy(() => import('@/features/verification/pages/DocumentVerificationListPage').then(m => ({ default: m.DocumentVerificationListPage })));
const ApplicationVerificationWorkspacePage = lazy(() => import('@/features/verification/pages/ApplicationVerificationWorkspacePage').then(m => ({ default: m.ApplicationVerificationWorkspacePage })));
const CandidateLetterReviewPage = lazy(() => import('@/features/letters/pages/CandidateLetterReviewPage').then(m => ({ default: m.CandidateLetterReviewPage })));
const ProfileSettingsPage = lazy(() => import('@/features/profile/pages/ProfileSettingsPage').then(m => ({ default: m.ProfileSettingsPage })));
const ManageRolesPage = lazy(() => import('@/features/candidates/pages/ManageRolesPage').then(m => ({ default: m.ManageRolesPage })));

const PlaceholderModule: React.FC<{ title: string; subtitle: string; icon?: React.ReactNode }> = ({
  title,
  subtitle,
  icon,
}) => (
  <EmptyState
    icon={icon || <FileText className="w-6 h-6 text-indigo-500" />}
    title={title}
    description={subtitle}
  />
);

const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-mesh-gradient flex items-center justify-center p-4">
    <EmptyState
      icon={<ShieldAlert className="w-8 h-8 text-rose-400" />}
      title="404 — Page Not Found"
      description="The requested page in the Candidate Enrollment Form Portal does not exist or has been moved."
    />
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: withSuspense(LoginPage),
      },
      {
        path: '/register',
        element: withSuspense(RegisterPage),
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: '/dashboard',
            element: withSuspense(DashboardOverviewPage),
          },
          {
            path: '/candidates',
            element: (
              <ProtectedRoute requiredPermissions={['portal:access', 'candidates:read', 'candidates:create', 'candidates:submit']}>
                {withSuspense(CandidateApplicationPage)}
              </ProtectedRoute>
            ),
          },
          {
            path: '/documents',
            element: (
              <ProtectedRoute requiredPermissions={['documents:verify', 'candidates:approve', 'candidates:reject']}>
                {withSuspense(DocumentVerificationListPage)}
              </ProtectedRoute>
            ),
          },
          {
            path: '/documents/:appId',
            element: (
              <ProtectedRoute requiredPermissions={['documents:verify', 'candidates:approve', 'candidates:reject']}>
                {withSuspense(ApplicationVerificationWorkspacePage)}
              </ProtectedRoute>
            ),
          },
          {
            path: '/documents/:appId/letters',
            element: (
              <ProtectedRoute requiredPermissions={['candidates:approve', 'documents:view', 'candidates:read']}>
                {withSuspense(CandidateLetterReviewPage)}
              </ProtectedRoute>
            ),
          },
          {
            path: '/audit',
            element: (
              <ProtectedRoute requiredPermissions={['audit:read']}>
                <PlaceholderModule
                  title="Audit & Compliance Trails"
                  subtitle="Immutable audit log of candidate verification events and user activity."
                />
              </ProtectedRoute>
            ),
          },
          {
            path: '/profile',
            element: withSuspense(ProfileSettingsPage),
          },
          {
            path: '/roles',
            element: (
              <ProtectedRoute requiredPermissions={['users:manage']}>
                {withSuspense(ManageRolesPage)}
              </ProtectedRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
