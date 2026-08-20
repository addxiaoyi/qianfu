/**
 * 权限按钮组件
 * 优化项 13: 路由守卫 - Auth/Permission
 */
import type React from 'react';
import { useAuthStore } from '@/store/authStore';
import type { UserRole, Permission } from './permissions';
import { hasPermission, hasAnyRole, isAdmin } from './permissions';

export interface HasPermissionProps {
  permission?: Permission;
  oneOfPermissions?: Permission[];
  minRoleLevel?: UserRole;
  hideIfNoPermission?: boolean;
  disableIfNoPermission?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export function HasPermission({
  permission,
  oneOfPermissions,
  minRoleLevel,
  hideIfNoPermission = true,
  disableIfNoPermission = false,
  fallback,
  children,
  className,
  onClick,
  type = 'button',
  disabled = false,
}: HasPermissionProps) {
  const user = useAuthStore((state) => state.user);

  let allowed = true;

  if (minRoleLevel) {
    const roleHierarchy: Record<UserRole, number> = {
      user: 0, normal: 1, moderator: 2, operator: 3, admin: 4, super_admin: 5,
    };
    const userLevel = roleHierarchy[user?.role as UserRole] ?? -1;
    const requiredLevel = roleHierarchy[minRoleLevel];
    allowed = userLevel >= requiredLevel;
  }

  if (allowed && permission) {
    allowed = hasPermission(user, permission);
  }

  if (allowed && oneOfPermissions && oneOfPermissions.length > 0) {
    allowed = oneOfPermissions.some((p) => hasPermission(user, p));
  }

  if (!allowed && hideIfNoPermission) {
    if (fallback) return <>{fallback}</>;
    return null;
  }

  if (!allowed && disableIfNoPermission) {
    const disabledClass = className ? `${className} opacity-50 cursor-not-allowed` : 'opacity-50 cursor-not-allowed';
    return (
      <button
        type={type}
        disabled
        onClick={onClick}
        className={disabledClass}
        title="您没有权限执行此操作"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}

export interface HasRoleProps {
  roles: UserRole[];
  hideIfNoRole?: boolean;
  disableIfNoRole?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export function HasRole({
  roles,
  hideIfNoRole = true,
  disableIfNoRole = false,
  fallback,
  children,
  className,
  onClick,
  type = 'button',
  disabled = false,
}: HasRoleProps) {
  const user = useAuthStore((state) => state.user);
  const hasTheRole = hasAnyRole(user, roles);

  if (!hasTheRole && hideIfNoRole) {
    if (fallback) return <>{fallback}</>;
    return null;
  }

  if (!hasTheRole && disableIfNoRole) {
    const disabledClass = className ? `${className} opacity-50 cursor-not-allowed` : 'opacity-50 cursor-not-allowed';
    return (
      <button
        type={type}
        disabled
        onClick={onClick}
        className={disabledClass}
        title="您没有权限执行此操作"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}

export interface AdminOnlyProps {
  children: React.ReactNode;
  hideIfNoPermission?: boolean;
  disableIfNoPermission?: boolean;
  className?: string;
}

export function AdminOnly({
  children,
  hideIfNoPermission = true,
  disableIfNoPermission = false,
  className,
}: AdminOnlyProps) {
  const user = useAuthStore((state) => state.user);
  const isAdminUser = isAdmin(user);

  if (!isAdminUser && hideIfNoPermission) {
    return null;
  }

  if (!isAdminUser && disableIfNoPermission) {
    const disabledClass = className ? `${className} opacity-50 cursor-not-allowed` : 'opacity-50 cursor-not-allowed';
    return (
      <span className={disabledClass} title="管理员专属功能">
        {children}
      </span>
    );
  }

  return <>{children}</>;
}

export function AdminButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  return (
    <AdminOnly>
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    </AdminOnly>
  );
}
