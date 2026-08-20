/**
 * 前端权限模块单元测试
 *
 * 测试覆盖：
 * - 权限枚举定义
 * - 角色权限映射
 * - 权限检查函数
 */

import { describe, it, expect } from 'vitest';
import {
  Permission,
  type UserRole,
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
} from '../../src/auth/permissions';

describe('Permission 枚举', () => {
  it('应该包含用户管理权限', () => {
    expect(Permission.USER_VIEW).toBe('user.view');
    expect(Permission.USER_CREATE).toBe('user.create');
    expect(Permission.USER_EDIT).toBe('user.edit');
    expect(Permission.USER_DELETE).toBe('user.delete');
    expect(Permission.USER_BAN).toBe('user.ban');
  });

  it('应该包含订单管理权限', () => {
    expect(Permission.ORDER_VIEW).toBe('order.view');
    expect(Permission.ORDER_CREATE).toBe('order.create');
    expect(Permission.ORDER_CANCEL).toBe('order.cancel');
    expect(Permission.ORDER_REFUND).toBe('order.refund');
    expect(Permission.ORDER_EXPORT).toBe('order.export');
  });

  it('应该包含服务器管理权限', () => {
    expect(Permission.SERVER_VIEW).toBe('server.view');
    expect(Permission.SERVER_CREATE).toBe('server.create');
    expect(Permission.SERVER_EDIT).toBe('server.edit');
    expect(Permission.SERVER_DELETE).toBe('server.delete');
    expect(Permission.SERVER_START).toBe('server.start');
    expect(Permission.SERVER_STOP).toBe('server.stop');
    expect(Permission.SERVER_RESTART).toBe('server.restart');
    expect(Permission.SERVER_REBOOT).toBe('server.reboot');
  });

  it('应该包含促销管理权限', () => {
    expect(Permission.PROMO_VIEW).toBe('promo.view');
    expect(Permission.PROMO_CREATE).toBe('promo.create');
    expect(Permission.PROMO_EDIT).toBe('promo.edit');
    expect(Permission.PROMO_DELETE).toBe('promo.delete');
    expect(Permission.PROMO_ACTIVATE).toBe('promo.activate');
  });

  it('应该包含系统设置权限', () => {
    expect(Permission.SETTINGS_VIEW).toBe('settings.view');
    expect(Permission.SETTINGS_EDIT).toBe('settings.edit');
    expect(Permission.SETTINGS_SERVER).toBe('settings.server');
    expect(Permission.SETTINGS_PAYMENT).toBe('settings.payment');
    expect(Permission.SETTINGS_NOTIFICATION).toBe('settings.notification');
  });

  it('应该包含统计分析权限', () => {
    expect(Permission.STATS_VIEW).toBe('stats.view');
    expect(Permission.STATS_EXPORT).toBe('stats.export');
    expect(Permission.STATS_ANALYTICS).toBe('stats.analytics');
  });

  it('应该包含客服管理权限', () => {
    expect(Permission.TICKET_VIEW).toBe('ticket.view');
    expect(Permission.TICKET_CREATE).toBe('ticket.create');
    expect(Permission.TICKET_ASSIGN).toBe('ticket.assign');
    expect(Permission.TICKET_RESOLVE).toBe('ticket.resolve');
  });

  it('应该包含审计日志权限', () => {
    expect(Permission.AUDIT_VIEW).toBe('audit.view');
    expect(Permission.AUDIT_EXPORT).toBe('audit.export');
  });

  it('应该包含管理员特权', () => {
    expect(Permission.ADMIN_ALL).toBe('admin.all');
    expect(Permission.ADMIN_USERS).toBe('admin.users');
    expect(Permission.ADMIN_ROLES).toBe('admin.roles');
    expect(Permission.ADMIN_PERMISSIONS).toBe('admin.permissions');
    expect(Permission.ADMIN_BACKUP).toBe('admin.backup');
  });
});

describe('UserRole 类型', () => {
  it('应该包含所有角色', () => {
    const roles: UserRole[] = ['user', 'normal', 'moderator', 'operator', 'admin', 'super_admin'];
    roles.forEach(role => {
      expect(typeof role).toBe('string');
    });
  });
});

describe('roleNames', () => {
  it('应该包含所有角色的中文名称', () => {
    expect(roleNames.user).toBe('用户');
    expect(roleNames.normal).toBe('普通会员');
    expect(roleNames.moderator).toBe('版主');
    expect(roleNames.operator).toBe('运营');
    expect(roleNames.admin).toBe('管理员');
    expect(roleNames.super_admin).toBe('超级管理员');
  });
});

describe('roleLevels', () => {
  it('应该包含所有角色的等级', () => {
    expect(roleLevels.user).toBe(0);
    expect(roleLevels.normal).toBe(1);
    expect(roleLevels.moderator).toBe(2);
    expect(roleLevels.operator).toBe(3);
    expect(roleLevels.admin).toBe(4);
    expect(roleLevels.super_admin).toBe(5);
  });

  it('应该按照等级递增', () => {
    expect(roleLevels.user).toBeLessThan(roleLevels.normal);
    expect(roleLevels.normal).toBeLessThan(roleLevels.moderator);
    expect(roleLevels.moderator).toBeLessThan(roleLevels.operator);
    expect(roleLevels.operator).toBeLessThan(roleLevels.admin);
    expect(roleLevels.admin).toBeLessThan(roleLevels.super_admin);
  });
});

describe('hasRole', () => {
  const mockUser = { id: '1', role: 'admin' as UserRole, permissions: [] };

  it('应该返回 true 当用户有指定角色', () => {
    expect(hasRole(mockUser, 'admin')).toBe(true);
  });

  it('应该返回 false 当用户没有指定角色', () => {
    expect(hasRole(mockUser, 'user')).toBe(false);
  });

  it('应该返回 false 当用户为 undefined', () => {
    expect(hasRole(undefined, 'admin')).toBe(false);
  });
});

describe('hasAnyRole', () => {
  const mockUser = { id: '1', role: 'admin' as UserRole, permissions: [] };

  it('应该返回 true 当用户有任一指定角色', () => {
    expect(hasAnyRole(mockUser, ['admin', 'super_admin'])).toBe(true);
    expect(hasAnyRole(mockUser, ['user', 'admin'])).toBe(true);
  });

  it('应该返回 false 当用户没有任一指定角色', () => {
    expect(hasAnyRole(mockUser, ['user', 'operator'])).toBe(false);
  });

  it('应该返回 false 当用户为 undefined', () => {
    expect(hasAnyRole(undefined, ['admin'])).toBe(false);
  });

  it('应该返回 false 当角色数组为空', () => {
    expect(hasAnyRole(mockUser, [])).toBe(false);
  });
});

describe('hasRoleLevel', () => {
  it('应该返回 true 当用户等级 >= 指定等级', () => {
    const adminUser = { id: '1', role: 'admin' as UserRole, permissions: [] };
    expect(hasRoleLevel(adminUser, 'user')).toBe(true);
    expect(hasRoleLevel(adminUser, 'normal')).toBe(true);
    expect(hasRoleLevel(adminUser, 'moderator')).toBe(true);
    expect(hasRoleLevel(adminUser, 'operator')).toBe(true);
    expect(hasRoleLevel(adminUser, 'admin')).toBe(true);
  });

  it('应该返回 false 当用户等级 < 指定等级', () => {
    const userUser = { id: '1', role: 'user' as UserRole, permissions: [] };
    expect(hasRoleLevel(userUser, 'admin')).toBe(false);
    expect(hasRoleLevel(userUser, 'operator')).toBe(false);
  });

  it('应该返回 false 当用户为 undefined', () => {
    expect(hasRoleLevel(undefined, 'admin')).toBe(false);
  });
});

describe('hasPermission', () => {
  const adminUser = {
    id: '1',
    role: 'admin' as UserRole,
    permissions: ['admin.all', 'user.view', 'user.edit'],
  };

  it('应该返回 true 当用户有指定权限', () => {
    expect(hasPermission(adminUser, 'user.view')).toBe(true);
    expect(hasPermission(adminUser, 'user.edit')).toBe(true);
  });

  it('应该返回 false 当用户没有指定权限', () => {
    expect(hasPermission(adminUser, 'user.delete')).toBe(false);
  });

  it('ADMIN_ALL 应该匹配所有权限', () => {
    const superAdmin = { id: '1', role: 'super_admin' as UserRole, permissions: ['admin.all'] };
    expect(hasPermission(superAdmin, 'user.view')).toBe(true);
    expect(hasPermission(superAdmin, 'user.delete')).toBe(true);
    expect(hasPermission(superAdmin, 'settings.edit')).toBe(true);
  });

  it('应该返回 false 当用户为 undefined', () => {
    expect(hasPermission(undefined, 'user.view')).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  const user = {
    id: '1',
    role: 'operator' as UserRole,
    permissions: ['server.view', 'server.start', 'server.stop'],
  };

  it('应该返回 true 当用户有所有指定权限', () => {
    expect(hasAllPermissions(user, ['server.view', 'server.start'])).toBe(true);
  });

  it('应该返回 false 当用户缺少任一权限', () => {
    expect(hasAllPermissions(user, ['server.view', 'server.create'])).toBe(false);
  });

  it('应该返回 true 当权限数组为空', () => {
    expect(hasAllPermissions(user, [])).toBe(true);
  });
});

describe('hasAnyPermission', () => {
  const user = {
    id: '1',
    role: 'operator' as UserRole,
    permissions: ['server.view', 'server.start'],
  };

  it('应该返回 true 当用户有任一指定权限', () => {
    expect(hasAnyPermission(user, ['server.view', 'server.create'])).toBe(true);
  });

  it('应该返回 false 当用户没有任何指定权限', () => {
    expect(hasAnyPermission(user, ['server.create', 'server.delete'])).toBe(false);
  });

  it('应该返回 false 当权限数组为空', () => {
    expect(hasAnyPermission(user, [])).toBe(false);
  });
});

describe('getUserPermissions', () => {
  it('应该返回用户角色对应的权限列表', () => {
    const user = { id: '1', role: 'user' as UserRole };
    const perms = getUserPermissions(user);
    expect(perms).toContain(Permission.ORDER_VIEW);
    expect(perms).toContain(Permission.ORDER_CREATE);
  });

  it('应该合并用户直接权限和角色权限', () => {
    const user = {
      id: '1',
      role: 'user' as UserRole,
      permissions: ['server.view'],
    };
    const perms = getUserPermissions(user);
    expect(perms).toContain(Permission.ORDER_VIEW);
    expect(perms).toContain('server.view');
  });

  it('应该返回空数组当用户为 undefined', () => {
    expect(getUserPermissions(undefined)).toEqual([]);
  });
});

describe('isAdmin', () => {
  it('应该返回 true 对于管理员用户', () => {
    const admin = { id: '1', role: 'admin' as UserRole };
    expect(isAdmin(admin)).toBe(true);
  });

  it('应该返回 true 对于超级管理员用户', () => {
    const superAdmin = { id: '1', role: 'super_admin' as UserRole };
    expect(isAdmin(superAdmin)).toBe(true);
  });

  it('应该返回 false 对于普通用户', () => {
    const user = { id: '1', role: 'user' as UserRole };
    expect(isAdmin(user)).toBe(false);
  });

  it('应该返回 false 对于 undefined', () => {
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe('isModerator', () => {
  it('应该返回 true 对于版主', () => {
    const mod = { id: '1', role: 'moderator' as UserRole };
    expect(isModerator(mod)).toBe(true);
  });

  it('应该返回 true 对于运营', () => {
    const op = { id: '1', role: 'operator' as UserRole };
    expect(isModerator(op)).toBe(true);
  });

  it('应该返回 true 对于管理员', () => {
    const admin = { id: '1', role: 'admin' as UserRole };
    expect(isModerator(admin)).toBe(true);
  });

  it('应该返回 false 对于普通用户', () => {
    const user = { id: '1', role: 'user' as UserRole };
    expect(isModerator(user)).toBe(false);
  });

  it('应该返回 false 对于 undefined', () => {
    expect(isModerator(undefined)).toBe(false);
  });
});

describe('checkRouteAccess', () => {
  it('应该允许有权限的用户访问', () => {
    const user = { id: '1', role: 'admin' as UserRole, permissions: [] };
    const result = checkRouteAccess(user, 'user.view');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('应该拒绝无权限的用户访问', () => {
    const user = { id: '1', role: 'user' as UserRole, permissions: [] };
    const result = checkRouteAccess(user, 'user.delete');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('PERMISSION_DENIED');
  });

  it('应该拒绝未登录用户访问受保护路由', () => {
    const result = checkRouteAccess(undefined, 'user.view');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('UNAUTHENTICATED');
  });

  it('应该返回缺失的权限列表', () => {
    const user = { id: '1', role: 'user' as UserRole, permissions: [] };
    const result = checkRouteAccess(user, 'user.delete');
    expect(result.missingPermissions).toContain(Permission.USER_DELETE);
  });
});

describe('PermissionCheckResult 类型', () => {
  it('应该正确表示允许的结果', () => {
    const result: PermissionCheckResult = {
      allowed: true,
      user: { id: '1', role: 'admin' as UserRole, permissions: [] },
    };
    expect(result.allowed).toBe(true);
  });

  it('应该正确表示拒绝的结果', () => {
    const result: PermissionCheckResult = {
      allowed: false,
      reason: 'PERMISSION_DENIED',
      requiredPermission: Permission.USER_DELETE,
      missingPermissions: [Permission.USER_DELETE],
    };
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('PERMISSION_DENIED');
  });
});

describe('权限继承关系', () => {
  it('SUPER_ADMIN 应该拥有所有权限', () => {
    const superAdmin = { id: '1', role: 'super_admin' as UserRole, permissions: ['admin.all'] };
    const allPerms = Object.values(Permission);

    allPerms.forEach(perm => {
      expect(hasPermission(superAdmin, perm)).toBe(true);
    });
  });

  it('ADMIN 应该拥有大部分权限', () => {
    const admin = { id: '1', role: 'admin' as UserRole, permissions: [] };
    expect(hasPermission(admin, Permission.USER_DELETE)).toBe(true);
    expect(hasPermission(admin, Permission.SERVER_DELETE)).toBe(true);
    expect(hasPermission(admin, Permission.SETTINGS_EDIT)).toBe(true);
  });

  it('OPERATOR 应该拥有服务器操作权限', () => {
    const op = { id: '1', role: 'operator' as UserRole, permissions: [] };
    expect(hasPermission(op, Permission.SERVER_START)).toBe(true);
    expect(hasPermission(op, Permission.SERVER_STOP)).toBe(true);
    expect(hasPermission(op, Permission.SERVER_RESTART)).toBe(true);
  });

  it('MODERATOR 应该拥有人群管理权限', () => {
    const mod = { id: '1', role: 'moderator' as UserRole, permissions: [] };
    expect(hasPermission(mod, Permission.USER_BAN)).toBe(true);
    expect(hasPermission(mod, Permission.TICKET_ASSIGN)).toBe(true);
    expect(hasPermission(mod, Permission.TICKET_RESOLVE)).toBe(true);
  });

  it('USER 应该只有基础权限', () => {
    const user = { id: '1', role: 'user' as UserRole, permissions: [] };
    expect(hasPermission(user, Permission.ORDER_VIEW)).toBe(true);
    expect(hasPermission(user, Permission.ORDER_CREATE)).toBe(true);
    expect(hasPermission(user, Permission.USER_DELETE)).toBe(false);
  });
});

describe('角色等级比较', () => {
  it('超级管理员 >= 管理员', () => {
    const superAdmin = { id: '1', role: 'super_admin' as UserRole, permissions: [] };
    expect(hasRoleLevel(superAdmin, 'admin')).toBe(true);
  });

  it('管理员 >= 运营', () => {
    const admin = { id: '1', role: 'admin' as UserRole, permissions: [] };
    expect(hasRoleLevel(admin, 'operator')).toBe(true);
  });

  it('运营 >= 版主', () => {
    const op = { id: '1', role: 'operator' as UserRole, permissions: [] };
    expect(hasRoleLevel(op, 'moderator')).toBe(true);
  });

  it('版主 >= 普通会员', () => {
    const mod = { id: '1', role: 'moderator' as UserRole, permissions: [] };
    expect(hasRoleLevel(mod, 'normal')).toBe(true);
  });

  it('普通会员 >= 用户', () => {
    const normal = { id: '1', role: 'normal' as UserRole, permissions: [] };
    expect(hasRoleLevel(normal, 'user')).toBe(true);
  });
});
