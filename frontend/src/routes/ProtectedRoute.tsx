import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  requiredPermissions?: string[];
  requiredRoles?: string[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermissions,
  requiredRoles,
  children,
}) => {
  const { data: user, isLoading } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs text-slate-400 tracking-wider uppercase font-medium">
          Verifying security session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRoles = user.roles || [];
  const userPermissions = user.permissions || [];
  const isAdmin = userRoles.includes('admin') || userPermissions.includes('users:manage');

  if (!isAdmin) {
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((r) => userRoles.includes(r));
      if (!hasRole) {
        return <Navigate to="/dashboard" replace />;
      }
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.some((p) => userPermissions.includes(p));
      if (!hasPermission) {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
