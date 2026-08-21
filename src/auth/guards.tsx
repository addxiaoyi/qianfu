/**
 * 路由守卫组件
 * 优化项 13: 路由守卫 - Auth/Permission
 */
import type React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/store/authStore';
import {
  type UserRole,
  Permission,
  hasAnyRole,
  hasRoleLevel,
  hasPermission,
} from './permissions';

export function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">
          LOADING...
        </p>
      </div>
    </div>
  );
}

export interface AuthGuardProps {
  requireBackend?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthGuard({
  requireBackend = true,
  fallback,
  children,
}: AuthGuardProps) {
  const location = useLocation();
  const { isAuthenticated, isLoading, backendReady } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      backendReady: state.backendReady,
    }))
  );

  if (isLoading) {
    return <>{fallback || <LoadingFallback />}</>;
  }

  if (requireBackend && !backendReady && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

export interface RoleGuardProps {
  roles: UserRole[];
  fallback?: React.ReactNode;
  unauthorized?: React.ReactNode;
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function RoleGuard({
  roles,
  fallback,
  unauthorized,
  children,
  requireAuth = true,
}: RoleGuardProps) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user, backendReady } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      user: state.user,
      backendReady: state.backendReady,
    }))
  );

  if (isLoading) {
    return <>{fallback || <LoadingFallback />}</>;
  }

  if (requireAuth) {
    if (!backendReady && !isAuthenticated) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
    if (!isAuthenticated) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
  }

  if (!hasAnyRole(user, roles)) {
    if (unauthorized) {
      return <>{unauthorized}</>;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export interface PermissionGuardProps {
  permissions?: Permission[];
  oneOfPermissions?: Permission[];
  minRoleLevel?: UserRole;
  fallback?: React.ReactNode;
  unauthorized?: React.ReactNode;
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function PermissionGuard({
  permissions,
  oneOfPermissions,
  minRoleLevel,
  fallback,
  unauthorized,
  children,
  requireAuth = true,
}: PermissionGuardProps) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user, backendReady } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      user: state.user,
      backendReady: state.backendReady,
    }))
  );

  if (isLoading) {
    return <>{fallback || <LoadingFallback />}</>;
  }

  if (requireAuth) {
    if (!backendReady && !isAuthenticated) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
    if (!isAuthenticated) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  let allowed = true;

  if (minRoleLevel) {
    allowed = hasRoleLevel(user, minRoleLevel);
  }

  if (allowed && permissions && permissions.length > 0) {
    allowed = permissions.every((p) => hasPermission(user, p));
  }

  if (allowed && oneOfPermissions && oneOfPermissions.length > 0) {
    allowed = oneOfPermissions.some((p) => hasPermission(user, p));
  }

  if (!allowed) {
    if (unauthorized) {
      return <>{unauthorized}</>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">权限不足</h1>
          <p className="text-gray-600">您没有权限访问此页面</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export interface EmailVerifiedGuardProps {
  fallback?: React.ReactNode;
  unverified?: React.ReactNode;
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function EmailVerifiedGuard({
  fallback,
  unverified,
  children,
  requireAuth = true,
}: EmailVerifiedGuardProps) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user, backendReady } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      user: state.user,
      backendReady: state.backendReady,
    }))
  );

  if (isLoading) {
    return <>{fallback || <LoadingFallback />}</>;
  }

  if (requireAuth) {
    if (!backendReady && !isAuthenticated) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
    if (!isAuthenticated) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
  }

  const email = user?.email ?? '';
  if (!user?.email_verified) {
    if (unverified) {
      return <>{unverified}</>;
    }
    return (
      <Navigate
        to={`/verify-code?email=${encodeURIComponent(email)}`}
        replace
        state={{ from: location }}
      />
    );
  }

  return <>{children}</>;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard roles={['admin', 'super_admin']}>
      {children}
    </RoleGuard>
  );
}

export function ModeratorGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard roles={['moderator', 'operator', 'admin', 'super_admin']}>
      {children}
    </RoleGuard>
  );
}

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      user: state.user,
    }))
  );

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (isAuthenticated && !user?.email_verified) {
    const email = user?.email ?? '';
    return (
      <Navigate
        to={`/verify-code?email=${encodeURIComponent(email)}`}
        replace
      />
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
