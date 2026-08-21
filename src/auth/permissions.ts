/**
 * 前端权限服务 - 路由守卫核心
 * 优化项 13: 路由守卫 - Auth/Permission
 *
 * 功能：
 * - 权限定义与角色映射
 * - 权限检查工具函数
 * - 前端权限状态管理
 */
import type { User } from '@/types/api'

// ============================================================
// 角色与权限定义（与服务端保持一致）
// ============================================================

/** 角色枚举 */
export type UserRole = 'user' | 'normal' | 'moderator' | 'operator' | 'admin' | 'super_admin'

/** 权限常量 */
export const Permission = {
  // 用户管理
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_EDIT: 'user.edit',
  USER_DELETE: 'user.delete',
  USER_BAN: 'user.ban',
  // 订单管理
  ORDER_VIEW: 'order.view',
  ORDER_CREATE: 'order.create',
  ORDER_CANCEL: 'order.cancel',
  ORDER_REFUND: 'order.refund',
  ORDER_EXPORT: 'order.export',
  // 服务器管理
  SERVER_VIEW: 'server.view',
  SERVER_CREATE: 'server.create',
  SERVER_EDIT: 'server.edit',
  SERVER_DELETE: 'server.delete',
  SERVER_START: 'server.start',
  SERVER_STOP: 'server.stop',
  SERVER_RESTART: 'server.restart',
  SERVER_REBOOT: 'server.reboot',
  // 促销管理
  PROMO_VIEW: 'promo.view',
  PROMO_CREATE: 'promo.create',
  PROMO_EDIT: 'promo.edit',
  PROMO_DELETE: 'promo.delete',
  PROMO_ACTIVATE: 'promo.activate',
  // 系统设置
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  SETTINGS_SERVER: 'settings.server',
  SETTINGS_PAYMENT: 'settings.payment',
  SETTINGS_NOTIFICATION: 'settings.notification',
  // 统计分析
  STATS_VIEW: 'stats.view',
  STATS_EXPORT: 'stats.export',
  STATS_ANALYTICS: 'stats.analytics',
  // 客服管理
  TICKET_VIEW: 'ticket.view',
  TICKET_CREATE: 'ticket.create',
  TICKET_ASSIGN: 'ticket.assign',
  TICKET_RESOLVE: 'ticket.resolve',
  // 审计日志
  AUDIT_VIEW: 'audit.view',
  AUDIT_EXPORT: 'audit.export',
  // 管理员特权
  ADMIN_ALL: 'admin.all',
  ADMIN_USERS: 'admin.users',
  ADMIN_ROLES: 'admin.roles',
  ADMIN_PERMISSIONS: 'admin.permissions',
  ADMIN_BACKUP: 'admin.backup',
} as const

export type Permission = typeof Permission[keyof typeof Permission]

/** 角色权限映射 */
const rolePermissions: Record<UserRole, Permission[]> = {
  user: [
    Permission.ORDER_VIEW,
    Permission.ORDER_CREATE,
    Permission.TICKET_VIEW,
    Permission.TICKET_CREATE,
    Permission.STATS_VIEW,
  ],
  normal: [
    Permission.ORDER_VIEW,
    Permission.ORDER_CREATE,
    Permission.ORDER_CANCEL,
    Permission.SERVER_VIEW,
    Permission.SERVER_CREATE,
    Permission.SERVER_EDIT,
    Permission.SERVER_DELETE,
    Permission.TICKET_VIEW,
    Permission.TICKET_CREATE,
    Permission.STATS_VIEW,
  ],
  moderator: [
    Permission.USER_VIEW,
    Permission.USER_BAN,
    Permission.ORDER_VIEW,
    Permission.ORDER_CANCEL,
    Permission.TICKET_VIEW,
    Permission.TICKET_CREATE,
    Permission.TICKET_ASSIGN,
    Permission.TICKET_RESOLVE,
    Permission.STATS_VIEW,
    Permission.AUDIT_VIEW,
  ],
  operator: [
    Permission.USER_VIEW,
    Permission.USER_EDIT,
    Permission.ORDER_VIEW,
    Permission.ORDER_CREATE,
    Permission.ORDER_CANCEL,
    Permission.ORDER_REFUND,
    Permission.ORDER_EXPORT,
    Permission.SERVER_VIEW,
    Permission.SERVER_START,
    Permission.SERVER_STOP,
    Permission.SERVER_RESTART,
    Permission.PROMO_VIEW,
    Permission.PROMO_CREATE,
    Permission.PROMO_EDIT,
    Permission.PROMO_ACTIVATE,
    Permission.TICKET_VIEW,
    Permission.TICKET_CREATE,
    Permission.TICKET_ASSIGN,
    Permission.TICKET_RESOLVE,
    Permission.STATS_VIEW,
    Permission.STATS_EXPORT,
    Permission.AUDIT_VIEW,
    Permission.SETTINGS_NOTIFICATION,
  ],
  admin: [
    Permission.USER_VIEW,
    Permission.USER_CREATE,
    Permission.USER_EDIT,
    Permission.USER_DELETE,
    Permission.USER_BAN,
    Permission.ORDER_VIEW,
    Permission.ORDER_CREATE,
    Permission.ORDER_CANCEL,
    Permission.ORDER_REFUND,
    Permission.ORDER_EXPORT,
    Permission.SERVER_VIEW,
    Permission.SERVER_CREATE,
    Permission.SERVER_EDIT,
    Permission.SERVER_DELETE,
    Permission.SERVER_START,
    Permission.SERVER_STOP,
    Permission.SERVER_RESTART,
    Permission.SERVER_REBOOT,
    Permission.PROMO_VIEW,
    Permission.PROMO_CREATE,
    Permission.PROMO_EDIT,
    Permission.PROMO_DELETE,
    Permission.PROMO_ACTIVATE,
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_EDIT,
    Permission.SETTINGS_SERVER,
    Permission.SETTINGS_PAYMENT,
    Permission.SETTINGS_NOTIFICATION,
    Permission.STATS_VIEW,
    Permission.STATS_EXPORT,
    Permission.STATS_ANALYTICS,
    Permission.TICKET_VIEW,
    Permission.TICKET_CREATE,
    Permission.TICKET_ASSIGN,
    Permission.TICKET_RESOLVE,
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
    Permission.ADMIN_USERS,
    Permission.ADMIN_ROLES,
    Permission.ADMIN_BACKUP,
  ],
  super_admin: [Permission.ADMIN_ALL],
}

/** 角色显示名称映射 */
export const roleNames: Record<UserRole, string> = {
  user: '普通用户',
  normal: '正式用户',
  moderator: '版主',
  operator: '运营',
  admin: '管理员',
  super_admin: '超级管理员',
}

/** 角色层级（用于比较） */
export const roleLevels: Record<UserRole, number> = {
  user: 0,
  normal: 1,
  moderator: 2,
  operator: 3,
  admin: 4,
  super_admin: 5,
}

// ============================================================
// 权限检查函数
// ============================================================

/**
 * 检查用户是否拥有指定角色
 */
export function hasRole(user: User | null, role: UserRole): boolean {
  if (!user) return false;
  return user.role === role;
}

/**
 * 检查用户是否拥有任一指定角色
 */
export function hasAnyRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role as UserRole);
}

/**
 * 检查用户角色等级是否 >= 指定等级
 */
export function hasRoleLevel(user: User | null, minLevel: UserRole): boolean {
  if (!user) return false;
  const userLevel = roleLevels[user.role as UserRole] ?? 0;
  const requiredLevel = roleLevels[minLevel];
  return userLevel >= requiredLevel;
}

/**
 * 检查用户是否拥有指定权限
 */
export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;

  // 超级管理员拥有所有权限
  if (user.role === 'super_admin') return true;

  // 管理员拥有所有权限
  if (user.role === 'admin') return true;

  const permissions = rolePermissions[user.role as UserRole] || [];
  return permissions.includes(permission) || permissions.includes(Permission.ADMIN_ALL);
}

/**
 * 检查用户是否拥有所有指定权限
 */
export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false;
  return permissions.every((p) => hasPermission(user, p));
}

/**
 * 检查用户是否拥有任一指定权限
 */
export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false;
  return permissions.some((p) => hasPermission(user, p));
}

/**
 * 获取用户的所有权限
 */
export function getUserPermissions(user: User | null): Permission[] {
  if (!user) return [];

  // 超级管理员拥有所有权限
  if (user.role === 'super_admin') return Object.values(Permission);

  return rolePermissions[user.role as UserRole] || [];
}

/**
 * 检查是否为管理员（admin 或 super_admin）
 */
export function isAdmin(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'super_admin';
}

/**
 * 检查是否为版主及以上权限
 */
export function isModerator(user: User | null): boolean {
  if (!user) return false;
  return hasRoleLevel(user, 'moderator');
}

// ============================================================
// 权限检查结果类型
// ============================================================

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 检查路由访问权限
 */
export function checkRouteAccess(
  user: User | null,
  route: string
): PermissionCheckResult {
  // 未登录
  if (!user) {
    return {
      allowed: false,
      reason: '请先登录',
    };
  }

  // 管理员路由检查
  if (route.startsWith('/admin')) {
    if (!isAdmin(user)) {
      return {
        allowed: false,
        reason: '需要管理员权限',
      };
    }
  }

  // 仪表盘需要登录
  if (route.startsWith('/dashboard') || route.startsWith('/me')) {
    return { allowed: true };
  }

  // 默认允许
  return { allowed: true };
}

// ============================================================
// 导出
// ============================================================

export default {
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
};
