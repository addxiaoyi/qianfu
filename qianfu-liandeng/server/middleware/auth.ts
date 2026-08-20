/**
 * 服务端权限中间件 - 按钮级权限控制
 * 优化项 17: 按钮级权限
 */
import { Request, Response, NextFunction, RequestHandler } from 'express'

// 角色枚举
export enum Role {
  USER = 'user',
  NORMAL = 'normal',
  MODERATOR = 'moderator',
  OPERATOR = 'operator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

// 权限枚举
export enum Permission {
  USER_VIEW = 'user.view',
  USER_CREATE = 'user.create',
  USER_EDIT = 'user.edit',
  USER_DELETE = 'user.delete',
  USER_BAN = 'user.ban',
  ORDER_VIEW = 'order.view',
  ORDER_CREATE = 'order.create',
  ORDER_CANCEL = 'order.cancel',
  ORDER_REFUND = 'order.refund',
  ORDER_EXPORT = 'order.export',
  SERVER_VIEW = 'server.view',
  SERVER_CREATE = 'server.create',
  SERVER_EDIT = 'server.edit',
  SERVER_DELETE = 'server.delete',
  SERVER_START = 'server.start',
  SERVER_STOP = 'server.stop',
  SERVER_RESTART = 'server.restart',
  SERVER_REBOOT = 'server.reboot',
  PROMO_VIEW = 'promo.view',
  PROMO_CREATE = 'promo.create',
  PROMO_EDIT = 'promo.edit',
  PROMO_DELETE = 'promo.delete',
  PROMO_ACTIVATE = 'promo.activate',
  SETTINGS_VIEW = 'settings.view',
  SETTINGS_EDIT = 'settings.edit',
  SETTINGS_SERVER = 'settings.server',
  SETTINGS_PAYMENT = 'settings.payment',
  SETTINGS_NOTIFICATION = 'settings.notification',
  STATS_VIEW = 'stats.view',
  STATS_EXPORT = 'stats.export',
  STATS_ANALYTICS = 'stats.analytics',
  TICKET_VIEW = 'ticket.view',
  TICKET_CREATE = 'ticket.create',
  TICKET_ASSIGN = 'ticket.assign',
  TICKET_RESOLVE = 'ticket.resolve',
  AUDIT_VIEW = 'audit.view',
  AUDIT_EXPORT = 'audit.export',
  ADMIN_ALL = 'admin.all',
  ADMIN_USERS = 'admin.users',
  ADMIN_ROLES = 'admin.roles',
  ADMIN_PERMISSIONS = 'admin.permissions',
  ADMIN_BACKUP = 'admin.backup',
}

// 角色权限映射
const rolePermissions: Record<Role, Permission[]> = {
  [Role.USER]: [Permission.ORDER_VIEW, Permission.ORDER_CREATE, Permission.TICKET_VIEW, Permission.TICKET_CREATE, Permission.STATS_VIEW],
  [Role.NORMAL]: [Permission.ORDER_VIEW, Permission.ORDER_CREATE, Permission.ORDER_CANCEL, Permission.TICKET_VIEW, Permission.TICKET_CREATE, Permission.STATS_VIEW],
  [Role.MODERATOR]: [Permission.USER_VIEW, Permission.USER_BAN, Permission.ORDER_VIEW, Permission.ORDER_CANCEL, Permission.TICKET_VIEW, Permission.TICKET_CREATE, Permission.TICKET_ASSIGN, Permission.TICKET_RESOLVE, Permission.STATS_VIEW, Permission.AUDIT_VIEW],
  [Role.OPERATOR]: [Permission.USER_VIEW, Permission.USER_EDIT, Permission.ORDER_VIEW, Permission.ORDER_CREATE, Permission.ORDER_CANCEL, Permission.ORDER_REFUND, Permission.ORDER_EXPORT, Permission.SERVER_VIEW, Permission.SERVER_START, Permission.SERVER_STOP, Permission.SERVER_RESTART, Permission.PROMO_VIEW, Permission.PROMO_CREATE, Permission.PROMO_EDIT, Permission.PROMO_ACTIVATE, Permission.TICKET_VIEW, Permission.TICKET_CREATE, Permission.TICKET_ASSIGN, Permission.TICKET_RESOLVE, Permission.STATS_VIEW, Permission.STATS_EXPORT, Permission.AUDIT_VIEW, Permission.SETTINGS_NOTIFICATION],
  [Role.ADMIN]: [Permission.USER_VIEW, Permission.USER_CREATE, Permission.USER_EDIT, Permission.USER_DELETE, Permission.USER_BAN, Permission.ORDER_VIEW, Permission.ORDER_CREATE, Permission.ORDER_CANCEL, Permission.ORDER_REFUND, Permission.ORDER_EXPORT, Permission.SERVER_VIEW, Permission.SERVER_CREATE, Permission.SERVER_EDIT, Permission.SERVER_DELETE, Permission.SERVER_START, Permission.SERVER_STOP, Permission.SERVER_RESTART, Permission.SERVER_REBOOT, Permission.PROMO_VIEW, Permission.PROMO_CREATE, Permission.PROMO_EDIT, Permission.PROMO_DELETE, Permission.PROMO_ACTIVATE, Permission.SETTINGS_VIEW, Permission.SETTINGS_EDIT, Permission.SETTINGS_SERVER, Permission.SETTINGS_PAYMENT, Permission.SETTINGS_NOTIFICATION, Permission.STATS_VIEW, Permission.STATS_EXPORT, Permission.STATS_ANALYTICS, Permission.TICKET_VIEW, Permission.TICKET_CREATE, Permission.TICKET_ASSIGN, Permission.TICKET_RESOLVE, Permission.AUDIT_VIEW, Permission.AUDIT_EXPORT, Permission.ADMIN_USERS, Permission.ADMIN_ROLES, Permission.ADMIN_BACKUP],
  [Role.SUPER_ADMIN]: [Permission.ADMIN_ALL],
}

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: Role; permissions: Permission[] }
  userRole?: Role
  userId?: string
}

export class PermissionDeniedError extends Error {
  status = 403
  code = 'PERMISSION_DENIED'
  constructor(message = '权限不足') { super(message); this.name = 'PermissionDeniedError' }
}

function verifyJWT(token: string): { userId: string; role: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    return { userId: payload.sub || payload.userId, role: payload.role }
  } catch { return null }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  if (req.cookies?.authToken) return req.cookies.authToken
  if (req.query?.token) return req.query.token as string
  return null
}

export function hasPermission(userRole: Role, permission: Permission): boolean {
  const permissions = rolePermissions[userRole] || []
  return permissions.includes(permission) || permissions.includes(Permission.ADMIN_ALL)
}

export function getPermissions(role: Role): Permission[] {
  return rolePermissions[role] || []
}

export function authenticate(options: { required?: boolean } = {}): RequestHandler {
  const { required = true } = options
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = extractToken(req)
    if (!token) {
      if (required) { res.status(401).json({ error: 'Unauthorized', message: '请先登录', code: 'AUTH_REQUIRED' }); return }
      next(); return
    }
    const payload = verifyJWT(token)
    if (!payload) { res.status(401).json({ error: 'Unauthorized', message: '无效的认证凭证', code: 'INVALID_TOKEN' }); return }
    const role = (payload.role?.toLowerCase() as Role) || Role.USER
    const permissions = getPermissions(role)
    req.user = { id: payload.userId, role, permissions }
    req.userRole = role
    req.userId = payload.userId
    next()
  }
}

export function requireRole(...allowedRoles: Role[]): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized', message: '请先登录', code: 'AUTH_REQUIRED' }); return }
    if (!req.userRole || !allowedRoles.includes(req.userRole)) { res.status(403).json({ error: 'Forbidden', message: '您的角色无权访问此资源', code: 'ROLE_NOT_ALLOWED' }); return }
    next()
  }
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized', message: '请先登录', code: 'AUTH_REQUIRED' }); return }
    if (!hasPermission(req.user.role, permission)) { res.status(403).json({ error: 'Forbidden', message: `权限不足，需要: ${permission}`, code: 'PERMISSION_DENIED', required: permission }); return }
    next()
  }
}

export function requireAllPermissions(...permissions: Permission[]): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized', message: '请先登录', code: 'AUTH_REQUIRED' }); return }
    const missing = permissions.filter((p) => !hasPermission(req.user!.role, p))
    if (missing.length > 0) { res.status(403).json({ error: 'Forbidden', message: '权限不足', code: 'PERMISSION_DENIED', required: missing }); return }
    next()
  }
}

export function requireAnyPermission(...permissions: Permission[]): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized', message: '请先登录', code: 'AUTH_REQUIRED' }); return }
    const hasAny = permissions.some((p) => hasPermission(req.user!.role, p))
    if (!hasAny) { res.status(403).json({ error: 'Forbidden', message: '权限不足', code: 'PERMISSION_DENIED', required: permissions }); return }
    next()
  }
}

export function requireAuth(permission?: Permission): RequestHandler[] {
  const middlewares: RequestHandler[] = [authenticate()]
  if (permission) middlewares.push(requirePermission(permission))
  return middlewares
}

export function routePermission(permission: Permission): RequestHandler[] {
  return [authenticate(), requirePermission(permission)]
}

export function routePermissionAny(...permissions: Permission[]): RequestHandler[] {
  return [authenticate(), requireAnyPermission(...permissions)]
}

export function routePermissionAll(...permissions: Permission[]): RequestHandler[] {
  return [authenticate(), requireAllPermissions(...permissions)]
}

export function adminOnly(): RequestHandler[] {
  return [authenticate(), requireRole(Role.ADMIN, Role.SUPER_ADMIN)]
}

export function superAdminOnly(): RequestHandler[] {
  return [authenticate(), requireRole(Role.SUPER_ADMIN)]
}

export function requireOwnership(getResourceOwnerId: (req: Request) => string | null): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized', message: '请先登录', code: 'AUTH_REQUIRED' }); return }
    if (req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN) { next(); return }
    const ownerId = getResourceOwnerId(req)
    if (!ownerId) { res.status(404).json({ error: 'Not Found', message: '资源不存在', code: 'RESOURCE_NOT_FOUND' }); return }
    if (ownerId !== req.userId) { res.status(403).json({ error: 'Forbidden', message: '您无权操作此资源', code: 'NOT_RESOURCE_OWNER' }); return }
    next()
  }
}

export function permissionLogger(): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      const isAuth = req.user ? 'authenticated' : 'anonymous'
      const role = req.user?.role || 'none'
      console.log(`[Permission] ${req.method} ${req.path} - ${res.statusCode} - ${isAuth} (${role}) - ${duration}ms`)
      if (res.statusCode === 403) console.warn(`[Permission Denied] ${req.method} ${req.path} by user ${req.userId} (${role})`)
    })
    next()
  }
}
