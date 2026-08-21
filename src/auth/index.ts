/**
 * 权限模块统一导出
 * 优化项 13: 路由守卫 - Auth/Permission
 */

// 权限定义与检查函数
export {
  type UserRole,
  Permission,
  roleNames,
  roleLevels,
  hasRole,
  hasAnyRole,
  hasRoleLevel,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getUserPermissions,
  isAdmin,
  isModerator,
  checkRouteAccess,
  type PermissionCheckResult,
} from './permissions';

// 路由守卫组件
export {
  AuthGuard,
  RoleGuard,
  PermissionGuard,
  EmailVerifiedGuard,
  AdminGuard,
  ModeratorGuard,
  GuestGuard,
  LoadingFallback,
  type AuthGuardProps,
  type RoleGuardProps,
  type PermissionGuardProps,
  type EmailVerifiedGuardProps,
} from './guards';

// 权限检查 Hooks
export {
  usePermission,
  useRole,
  useIsAdmin,
  useAuth,
} from './hooks';

// 权限按钮组件
export {
  HasPermission,
  HasRole,
  AdminOnly,
  AdminButton,
  type HasPermissionProps,
  type HasRoleProps,
  type AdminOnlyProps,
} from './buttons';
