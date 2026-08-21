/**
 * usePermission - 按钮级权限 Hook
 * 优化项 17: 按钮级权限
 */
import { useMemo, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types/api'
import {
  Permission,
  hasPermission as checkPermission,
  hasAllPermissions as checkAll,
  hasAnyPermission as checkAny,
  getUserPermissions,
  type UserRole,
} from '@/auth/permissions'

export { Permission } from '@/auth/permissions'

interface UsePermissionOptions {
  strict?: boolean
}

/**
 * 权限检查 Hook
 *
 * @example
 * const { hasPermission, hasAll, hasAny } = usePermission()
 *
 * // 检查单个权限
 * const canDelete = hasPermission('server.delete')
 *
 * // 检查多个权限（全部满足）
 * const canManageOrders = hasAll(['order.view', 'order.edit'])
 *
 * // 检查多个权限（满足任一）
 * const canAccessStats = hasAny(['stats.view', 'admin.all'])
 */
export function usePermission(options: UsePermissionOptions = {}) {
  const { strict = true } = options
  const user = useAuthStore((state) => state.user)

  /** 当前用户角色 */
  const currentRole = useMemo<UserRole | null>(() => {
    return user?.role as UserRole || null
  }, [user?.role])

  /** 用户权限列表 */
  const permissions = useMemo<Permission[]>(() => {
    return getUserPermissions(user)
  }, [user])

  /** 检查单个权限 */
  const hasPermission = useCallback(
    (permission: Permission | string): boolean => {
      if (!user && strict) return false
      if (!user) return !strict
      const perm = typeof permission === 'string' ? (permission as unknown as Permission) : permission
      return checkPermission(user, perm)
    },
    [user, strict]
  )

  /** 检查多个权限（全部满足） */
  const hasAll = useCallback(
    (permissions: (Permission | string)[]): boolean => {
      if (!user && strict) return false
      if (!user) return !strict
      const perms = permissions.map(p => typeof p === 'string' ? (p as unknown as Permission) : p)
      return checkAll(user, perms)
    },
    [user, strict]
  )

  /** 检查多个权限（满足任一） */
  const hasAny = useCallback(
    (permissions: (Permission | string)[]): boolean => {
      if (!user && strict) return false
      if (!user) return !strict
      const perms = permissions.map(p => typeof p === 'string' ? (p as unknown as Permission) : p)
      return checkAny(user, perms)
    },
    [user, strict]
  )

  /** 是否为管理员 */
  const isAdmin = useMemo<boolean>(() => {
    return user?.role === 'admin' || user?.role === 'super_admin'
  }, [user?.role])

  /** 是否为超级管理员 */
  const isSuperAdmin = useMemo<boolean>(() => {
    return user?.role === 'super_admin'
  }, [user?.role])

  /** 是否为运营人员及以上 */
  const isOperatorOrAbove = useMemo<boolean>(() => {
    return user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'operator'
  }, [user?.role])

  return {
    role: currentRole,
    permissions,
    hasPermission,
    hasAll,
    hasAny,
    isAdmin,
    isSuperAdmin,
    isOperatorOrAbove,
    isAuthenticated: !!user,
  }
}

// ============================================================
// 权限检查组件包装器
// ============================================================

import type { ReactNode } from 'react'
import { isAdmin, hasAnyPermission } from '@/auth/permissions'

interface PermissionGuardProps {
  permission: Permission | string | (Permission | string)[]
  mode?: 'all' | 'any'
  hidden?: boolean
  disabled?: boolean
  fallback?: ReactNode
  children: ReactNode
}

/**
 * 权限守卫组件
 *
 * @example
 * <PermissionGuard permission="server.delete">
 *   <button onClick={handleDelete}>删除服务器</button>
 * </PermissionGuard>
 *
 * <PermissionGuard permission={['order.view', 'order.edit']} mode="all">
 *   <button>管理订单</button>
 * </PermissionGuard>
 *
 * <PermissionGuard permission="promo.delete" hidden>
 *   <DeleteButton />
 * </PermissionGuard>
 *
 * <PermissionGuard permission="server.start" disabled>
 *   <StartButton />
 * </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  mode = 'all',
  hidden = false,
  disabled = false,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAll, hasAny, isAuthenticated } = usePermission()

  if (!isAuthenticated) {
    if (hidden) return null
    if (disabled) return <span className="pointer-events-none opacity-50">{children}</span>
    return <>{fallback}</>
  }

  const permList = Array.isArray(permission) ? permission : [permission]
  const permEnums = permList.map(p => typeof p === 'string' ? (p as unknown as Permission) : p) as Permission[]
  const permitted = mode === 'all' ? hasAll(permEnums) : hasAny(permEnums)

  if (!permitted) {
    if (hidden) return null
    if (disabled) return <span className="pointer-events-none opacity-50">{children}</span>
    return <>{fallback}</>
  }

  return <>{children}</>
}

// ============================================================
// 便捷 Hook
// ============================================================

export function useServerPermission() {
  const { hasPermission, isAdmin, isOperatorOrAbove } = usePermission()
  return {
    canView: hasPermission(Permission.SERVER_VIEW),
    canCreate: hasPermission(Permission.SERVER_CREATE),
    canEdit: hasPermission(Permission.SERVER_EDIT),
    canDelete: hasPermission(Permission.SERVER_DELETE),
    canStart: hasPermission(Permission.SERVER_START),
    canStop: hasPermission(Permission.SERVER_STOP),
    canRestart: hasPermission(Permission.SERVER_RESTART),
    canReboot: hasPermission(Permission.SERVER_REBOOT),
    isAdmin,
    isOperatorOrAbove,
  }
}

export function useOrderPermission() {
  const { hasPermission, hasAll, isAdmin } = usePermission()
  return {
    canView: hasPermission(Permission.ORDER_VIEW),
    canCreate: hasPermission(Permission.ORDER_CREATE),
    canCancel: hasPermission(Permission.ORDER_CANCEL),
    canRefund: hasPermission(Permission.ORDER_REFUND),
    canExport: hasPermission(Permission.ORDER_EXPORT),
    canManage: hasAll([Permission.ORDER_VIEW, Permission.ORDER_CANCEL]),
    isAdmin,
  }
}

export function usePromoPermission() {
  const { hasPermission, hasAll, isAdmin } = usePermission()
  return {
    canView: hasPermission(Permission.PROMO_VIEW),
    canCreate: hasPermission(Permission.PROMO_CREATE),
    canEdit: hasPermission(Permission.PROMO_EDIT),
    canDelete: hasPermission(Permission.PROMO_DELETE),
    canActivate: hasPermission(Permission.PROMO_ACTIVATE),
    canManage: hasAll([Permission.PROMO_VIEW, Permission.PROMO_EDIT]),
    isAdmin,
  }
}

export function useSettingsPermission() {
  const { hasPermission, isAdmin, isSuperAdmin } = usePermission()
  return {
    canView: hasPermission(Permission.SETTINGS_VIEW),
    canEdit: hasPermission(Permission.SETTINGS_EDIT),
    canEditServer: hasPermission(Permission.SETTINGS_SERVER),
    canEditPayment: hasPermission(Permission.SETTINGS_PAYMENT),
    canEditNotification: hasPermission(Permission.SETTINGS_NOTIFICATION),
    canAccessAll: isAdmin,
    isSuperAdmin,
  }
}

export function useUserPermission() {
  const { hasPermission, hasAll, isAdmin } = usePermission()
  return {
    canView: hasPermission(Permission.USER_VIEW),
    canCreate: hasPermission(Permission.USER_CREATE),
    canEdit: hasPermission(Permission.USER_EDIT),
    canDelete: hasPermission(Permission.USER_DELETE),
    canBan: hasPermission(Permission.USER_BAN),
    canManage: hasAll([Permission.USER_VIEW, Permission.USER_EDIT]),
    isAdmin,
  }
}
