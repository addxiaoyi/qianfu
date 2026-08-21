/**
 * 权限 Hooks
 * 优化项 13: 路由守卫 - Auth/Permission
 *
 * 功能：
 * - usePermission: 权限检查 Hook
 * - useRole: 角色检查 Hook
 * - useAdmin: 管理员检查 Hook
 */
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/store/authStore';
import {
  type UserRole,
  Permission,
  hasRole,
  hasAnyRole,
  hasRoleLevel,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAdmin,
  isModerator,
  getUserPermissions,
} from './permissions';

/**
 * 权限检查 Hook
 *
 * @example
 * function MyComponent() {
 *   const { can, permissions, isAdmin } = usePermission();
 *
 *   if (can(Permission.SERVER_CREATE)) {
 *     return <CreateServerButton />;
 *   }
 *
 *   if (isAdmin) {
 *     return <AdminPanel />;
 *   }
 *
 *   return <Viewer />;
 * }
 */
export function usePermission() {
  const user = useAuthStore((state) => state.user);

  return {
    /** 当前用户 */
    user,
    /** 当前用户的权限列表 */
    permissions: getUserPermissions(user),
    /** 当前用户是否为管理员 */
    isAdmin: isAdmin(user),
    /** 当前用户是否为版主及以上 */
    isModerator: isModerator(user),
    /** 检查是否有指定权限 */
    can: (permission: Permission) => hasPermission(user, permission),
    /** 检查是否有所有指定权限 */
    canAll: (permissions: Permission[]) => hasAllPermissions(user, permissions),
    /** 检查是否有任一指定权限 */
    canAny: (permissions: Permission[]) => hasAnyPermission(user, permissions),
  };
}

/**
 * 角色检查 Hook
 *
 * @example
 * function RoleBadge() {
 *   const { role, isAtLeast, isOneOf } = useRole();
 *
 *   return (
 *     <span>
 *       {isAtLeast('moderator') && <Badge>版主</Badge>}
 *       {isOneOf(['admin', 'super_admin']) && <Badge>管理员</Badge>}
 *     </span>
 *   );
 * }
 */
export function useRole() {
  const user = useAuthStore((state) => state.user);

  return {
    /** 当前用户角色 */
    role: user?.role as UserRole | undefined,
    /** 角色名称 */
    roleName: user?.role,
    /** 检查是否有指定角色 */
    is: (role: UserRole) => hasRole(user, role),
    /** 检查是否是指定角色之一 */
    isOneOf: (roles: UserRole[]) => hasAnyRole(user, roles),
    /** 检查角色等级是否 >= 指定等级 */
    isAtLeast: (minRole: UserRole) => hasRoleLevel(user, minRole),
    /** 是否为管理员 */
    isAdmin: isAdmin(user),
    /** 是否为超级管理员 */
    isSuperAdmin: user?.role === 'super_admin',
    /** 是否为版主及以上 */
    isModerator: isModerator(user),
    /** 是否为运营及以上 */
    isOperator: hasRoleLevel(user, 'operator'),
  };
}

/**
 * 管理员检查 Hook（简化版）
 *
 * @example
 * function AdminButton({ children }) {
 *   const isAdmin = useIsAdmin();
 *
 *   if (!isAdmin) return null;
 *
 *   return <button>{children}</button>;
 * }
 */
export function useIsAdmin() {
  const user = useAuthStore((state) => state.user);
  return isAdmin(user);
}

/**
 * 认证状态 Hook
 *
 * @example
 * function AuthStatus() {
 *   const { isAuthenticated, user, isLoading } = useAuth();
 *
 *   if (isLoading) return <Spinner />;
 *   if (!isAuthenticated) return <LoginButton />;
 *   return <span>欢迎, {user.username}</span>;
 * }
 */
export function useAuth() {
  const { isAuthenticated, isLoading, user, backendReady } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      user: state.user,
      backendReady: state.backendReady,
    }))
  );

  return {
    /** 是否已认证 */
    isAuthenticated,
    /** 是否正在加载 */
    isLoading,
    /** 当前用户 */
    user,
    /** 后端是否就绪 */
    backendReady,
    /** 用户 ID */
    userId: user?.id,
    /** 用户角色 */
    role: user?.role as UserRole | undefined,
    /** 邮箱是否已验证 */
    emailVerified: user?.email_verified ?? false,
  };
}
