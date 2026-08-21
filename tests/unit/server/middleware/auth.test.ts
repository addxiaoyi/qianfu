/**
 * 权限中间件单元测试
 *
 * 测试覆盖：
 * - 角色权限映射
 * - JWT 验证
 * - Token 提取
 * - 权限检查
 * - 角色检查
 * - 中间件函数
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Role,
  Permission,
  hasPermission,
  getPermissions,
  authenticate,
  requireRole,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireOwnership,
  permissionLogger,
  routePermission,
  routePermissionAny,
  routePermissionAll,
  adminOnly,
  superAdminOnly,
  requireAuth,
  AuthenticatedRequest,
  PermissionDeniedError,
} from '../server/middleware/auth';

describe('角色与权限枚举', () => {
  describe('Role 枚举', () => {
    it('应该包含所有预期角色', () => {
      expect(Role.USER).toBe('user');
      expect(Role.NORMAL).toBe('normal');
      expect(Role.MODERATOR).toBe('moderator');
      expect(Role.OPERATOR).toBe('operator');
      expect(Role.ADMIN).toBe('admin');
      expect(Role.SUPER_ADMIN).toBe('super_admin');
    });
  });

  describe('Permission 枚举', () => {
    it('应该包含用户权限', () => {
      expect(Permission.USER_VIEW).toBe('user.view');
      expect(Permission.USER_CREATE).toBe('user.create');
      expect(Permission.USER_EDIT).toBe('user.edit');
      expect(Permission.USER_DELETE).toBe('user.delete');
    });

    it('应该包含订单权限', () => {
      expect(Permission.ORDER_VIEW).toBe('order.view');
      expect(Permission.ORDER_CREATE).toBe('order.create');
      expect(Permission.ORDER_CANCEL).toBe('order.cancel');
      expect(Permission.ORDER_REFUND).toBe('order.refund');
    });

    it('应该包含服务器权限', () => {
      expect(Permission.SERVER_VIEW).toBe('server.view');
      expect(Permission.SERVER_CREATE).toBe('server.create');
      expect(Permission.SERVER_START).toBe('server.start');
      expect(Permission.SERVER_STOP).be('server.stop');
    });

    it('应该包含管理权限', () => {
      expect(Permission.ADMIN_ALL).toBe('admin.all');
      expect(Permission.ADMIN_USERS).toBe('admin.users');
      expect(Permission.ADMIN_ROLES).toBe('admin.roles');
    });
  });
});

describe('hasPermission 函数', () => {
  describe('USER 角色', () => {
    it('应该拥有用户查看权限', () => {
      expect(hasPermission(Role.USER, Permission.USER_VIEW)).toBe(true);
    });

    it('应该拥有订单创建权限', () => {
      expect(hasPermission(Role.USER, Permission.ORDER_CREATE)).toBe(true);
    });

    it('不应该拥有管理员权限', () => {
      expect(hasPermission(Role.USER, Permission.ADMIN_ALL)).toBe(false);
    });

    it('不应该拥有服务器管理权限', () => {
      expect(hasPermission(Role.USER, Permission.SERVER_DELETE)).toBe(false);
    });
  });

  describe('NORMAL 角色', () => {
    it('应该拥有订单取消权限', () => {
      expect(hasPermission(Role.NORMAL, Permission.ORDER_CANCEL)).toBe(true);
    });

    it('不应该拥有用户删除权限', () => {
      expect(hasPermission(Role.NORMAL, Permission.USER_DELETE)).toBe(false);
    });
  });

  describe('MODERATOR 角色', () => {
    it('应该拥有用户查看权限', () => {
      expect(hasPermission(Role.MODERATOR, Permission.USER_VIEW)).toBe(true);
    });

    it('应该拥有用户封禁权限', () => {
      expect(hasPermission(Role.MODERATOR, Permission.USER_BAN)).toBe(true);
    });

    it('应该拥有工单分配权限', () => {
      expect(hasPermission(Role.MODERATOR, Permission.TICKET_ASSIGN)).toBe(true);
    });
  });

  describe('OPERATOR 角色', () => {
    it('应该拥有服务器操作权限', () => {
      expect(hasPermission(Role.OPERATOR, Permission.SERVER_START)).toBe(true);
      expect(hasPermission(Role.OPERATOR, Permission.SERVER_STOP)).toBe(true);
      expect(hasPermission(Role.OPERATOR, Permission.SERVER_RESTART)).toBe(true);
    });

    it('应该拥有订单退款权限', () => {
      expect(hasPermission(Role.OPERATOR, Permission.ORDER_REFUND)).toBe(true);
    });

    it('不应该拥有用户删除权限', () => {
      expect(hasPermission(Role.OPERATOR, Permission.USER_DELETE)).toBe(false);
    });
  });

  describe('ADMIN 角色', () => {
    it('应该拥有几乎所有权限', () => {
      expect(hasPermission(Role.ADMIN, Permission.USER_CREATE)).toBe(true);
      expect(hasPermission(Role.ADMIN, Permission.USER_DELETE)).toBe(true);
      expect(hasPermission(Role.ADMIN, Permission.SERVER_DELETE)).toBe(true);
      expect(hasPermission(Role.ADMIN, Permission.ORDER_REFUND)).toBe(true);
    });

    it('应该拥有设置权限', () => {
      expect(hasPermission(Role.ADMIN, Permission.SETTINGS_VIEW)).toBe(true);
      expect(hasPermission(Role.ADMIN, Permission.SETTINGS_EDIT)).toBe(true);
    });
  });

  describe('SUPER_ADMIN 角色', () => {
    it('应该拥有所有权限', () => {
      expect(hasPermission(Role.SUPER_ADMIN, Permission.ADMIN_ALL)).toBe(true);
      expect(hasPermission(Role.SUPER_ADMIN, Permission.USER_DELETE)).toBe(true);
      expect(hasPermission(Role.SUPER_ADMIN, Permission.SERVER_DELETE)).toBe(true);
      expect(hasPermission(Role.SUPER_ADMIN, Permission.SETTINGS_EDIT)).toBe(true);
    });
  });

  describe('无效角色', () => {
    it('应该返回 false 对于未知角色', () => {
      expect(hasPermission('unknown' as Role, Permission.USER_VIEW)).toBe(false);
    });
  });
});

describe('getPermissions 函数', () => {
  it('应该返回 USER 角色的权限列表', () => {
    const perms = getPermissions(Role.USER);
    expect(perms).toContain(Permission.ORDER_VIEW);
    expect(perms).toContain(Permission.ORDER_CREATE);
  });

  it('应该返回 ADMIN 角色的完整权限列表', () => {
    const perms = getPermissions(Role.ADMIN);
    expect(perms).toContain(Permission.ADMIN_USERS);
    expect(perms).toContain(Permission.ADMIN_ROLES);
  });

  it('应该返回 SUPER_ADMIN 角色的所有权限', () => {
    const perms = getPermissions(Role.SUPER_ADMIN);
    expect(perms).toContain(Permission.ADMIN_ALL);
  });

  it('应该返回空数组对于未知角色', () => {
    const perms = getPermissions('unknown' as Role);
    expect(perms).toEqual([]);
  });
});

describe('authenticate 中间件', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<any>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      cookies: {},
      query: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('应该拒绝没有 token 的请求', () => {
    const middleware = authenticate();
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('应该拒绝无效的 token', () => {
    mockReq.headers = { authorization: 'Bearer invalid-token' };
    const middleware = authenticate();
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('应该接受有效的 JWT token', () => {
    // 创建一个有效的 JWT token (header.payload.signature)
    const payload = Buffer.from(JSON.stringify({ sub: 'user123', role: 'user' })).toString('base64');
    const token = `header.${payload}.signature`;
    mockReq.headers = { authorization: `Bearer ${token}` };

    const middleware = authenticate();
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toBeDefined();
    expect(mockReq.user?.id).toBe('user123');
    expect(mockReq.user?.role).toBe(Role.USER);
  });

  it('应该从 cookie 提取 token', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'user456', role: 'admin' })).toString('base64');
    const token = `header.${payload}.signature`;
    mockReq.cookies = { authToken: token };

    const middleware = authenticate();
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user?.id).toBe('user456');
  });

  it('应该从 query 参数提取 token', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'user789', role: 'operator' })).toString('base64');
    const token = `header.${payload}.signature`;
    mockReq.query = { token };

    const middleware = authenticate();
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user?.id).toBe('user789');
  });

  it('应该允许可选认证通过', () => {
    const middleware = authenticate({ required: false });
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toBeUndefined();
  });

  it('应该处理小写角色名', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'user999', role: 'ADMIN' })).toString('base64');
    const token = `header.${payload}.signature`;
    mockReq.headers = { authorization: `Bearer ${token}` };

    const middleware = authenticate();
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user?.role).toBe(Role.ADMIN);
  });
});

describe('requireRole 中间件', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<any>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('应该拒绝未认证的请求', () => {
    const middleware = requireRole(Role.ADMIN);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('应该拒绝角色不匹配的用户', () => {
    mockReq.user = { id: '1', role: Role.USER, permissions: [] };
    const middleware = requireRole(Role.ADMIN);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('应该允许匹配角色的用户', () => {
    mockReq.user = { id: '1', role: Role.ADMIN, permissions: [] };
    mockReq.userRole = Role.ADMIN;
    const middleware = requireRole(Role.ADMIN);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该支持多个允许的角色', () => {
    mockReq.user = { id: '1', role: Role.SUPER_ADMIN, permissions: [] };
    mockReq.userRole = Role.SUPER_ADMIN;
    const middleware = requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('requirePermission 中间件', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<any>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('应该拒绝未认证的请求', () => {
    const middleware = requirePermission(Permission.USER_CREATE);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('应该拒绝权限不足的用户', () => {
    mockReq.user = { id: '1', role: Role.USER, permissions: [Permission.USER_VIEW] };
    const middleware = requirePermission(Permission.USER_CREATE);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('应该允许有权限的用户', () => {
    mockReq.user = {
      id: '1',
      role: Role.ADMIN,
      permissions: getPermissions(Role.ADMIN),
    };
    const middleware = requirePermission(Permission.USER_CREATE);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该拒绝 ADMIN_ALL 权限的检查', () => {
    // USER 角色没有 ADMIN_ALL
    mockReq.user = { id: '1', role: Role.USER, permissions: [] };
    const middleware = requirePermission(Permission.ADMIN_ALL);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
  });

  it('SUPER_ADMIN 应该自动拥有 ADMIN_ALL', () => {
    mockReq.user = {
      id: '1',
      role: Role.SUPER_ADMIN,
      permissions: getPermissions(Role.SUPER_ADMIN),
    };
    const middleware = requirePermission(Permission.ADMIN_ALL);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('requireAllPermissions 中间件', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<any>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('应该要求所有权限', () => {
    mockReq.user = {
      id: '1',
      role: Role.OPERATOR,
      permissions: getPermissions(Role.OPERATOR),
    };
    const middleware = requireAllPermissions(Permission.SERVER_START, Permission.SERVER_STOP);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该拒绝缺少任一权限的用户', () => {
    mockReq.user = {
      id: '1',
      role: Role.USER,
      permissions: [Permission.USER_VIEW],
    };
    const middleware = requireAllPermissions(Permission.USER_VIEW, Permission.USER_CREATE);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
  });
});

describe('requireAnyPermission 中间件', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<any>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('应该允许拥有任一权限的用户', () => {
    mockReq.user = {
      id: '1',
      role: Role.USER,
      permissions: [Permission.USER_VIEW],
    };
    const middleware = requireAnyPermission(Permission.USER_VIEW, Permission.USER_CREATE);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该拒绝缺少所有权限的用户', () => {
    mockReq.user = {
      id: '1',
      role: Role.USER,
      permissions: [],
    };
    const middleware = requireAnyPermission(Permission.USER_CREATE, Permission.USER_DELETE);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
  });
});

describe('requireOwnership 中间件', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<any>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = {
      params: { id: 'resource123' },
      body: { ownerId: 'user1' },
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('应该允许资源所有者访问', () => {
    mockReq.user = { id: 'user1', role: Role.USER, permissions: [] };
    mockReq.userId = 'user1';
    const middleware = requireOwnership((req) => req.body.ownerId as string);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该拒绝非资源所有者', () => {
    mockReq.user = { id: 'user2', role: Role.USER, permissions: [] };
    mockReq.userId = 'user2';
    const middleware = requireOwnership((req) => req.body.ownerId as string);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
  });

  it('应该允许管理员跳过所有权检查', () => {
    mockReq.user = { id: 'admin1', role: Role.ADMIN, permissions: [] };
    mockReq.userRole = Role.ADMIN;
    const middleware = requireOwnership((req) => req.body.ownerId as string);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该允许超级管理员跳过所有权检查', () => {
    mockReq.user = { id: 'super1', role: Role.SUPER_ADMIN, permissions: [] };
    mockReq.userRole = Role.SUPER_ADMIN;
    const middleware = requireOwnership((req) => req.body.ownerId as string);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该处理资源不存在的情况', () => {
    mockReq.user = { id: 'user1', role: Role.USER, permissions: [] };
    mockReq.userId = 'user1';
    mockReq.body = {}; // 没有 ownerId
    const middleware = requireOwnership((req) => req.body.ownerId as string | null);
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });
});

describe('权限便捷函数', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<any>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('requireAuth', () => {
    it('应该返回包含 authenticate 的中间件数组', () => {
      const middlewares = requireAuth();
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBeGreaterThan(0);
    });

    it('应该返回包含 authenticate 和 requirePermission 的中间件数组', () => {
      const middlewares = requireAuth(Permission.USER_VIEW);
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBe(2);
    });
  });

  describe('routePermission', () => {
    it('应该返回认证和权限检查中间件', () => {
      const middlewares = routePermission(Permission.USER_CREATE);
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBe(2);
    });
  });

  describe('routePermissionAny', () => {
    it('应该返回认证和任一权限检查中间件', () => {
      const middlewares = routePermissionAny(Permission.USER_VIEW, Permission.USER_CREATE);
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBe(2);
    });
  });

  describe('routePermissionAll', () => {
    it('应该返回认证和所有权限检查中间件', () => {
      const middlewares = routePermissionAll(Permission.USER_VIEW, Permission.USER_CREATE);
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBe(2);
    });
  });

  describe('adminOnly', () => {
    it('应该返回管理员角色检查', () => {
      const middlewares = adminOnly();
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBe(2);
    });
  });

  describe('superAdminOnly', () => {
    it('应该返回超级管理员角色检查', () => {
      const middlewares = superAdminOnly();
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBe(2);
    });
  });
});

describe('permissionLogger 中间件', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<any>;
  let mockNext: vi.Mock;
  let consoleLogSpy: vi.Spy;
  let consoleWarnSpy: vi.Spy;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {},
    };
    mockRes = {
      statusCode: 200,
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          // 模拟 finish 事件
          setTimeout(callback, 0);
        }
      }),
    };
    mockNext = vi.fn();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('应该调用 next', () => {
    const middleware = permissionLogger();
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('应该记录请求日志', async () => {
    const middleware = permissionLogger();
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    // 触发 finish 事件
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('应该在权限被拒绝时记录警告', async () => {
    mockRes.statusCode = 403;
    mockReq.user = { id: 'user1', role: Role.USER, permissions: [] };

    const middleware = permissionLogger();
    middleware(mockReq as AuthenticatedRequest, mockRes as any, mockNext);

    // 触发 finish 事件
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(consoleWarnSpy).toHaveBeenCalled();
  });
});

describe('PermissionDeniedError', () => {
  it('应该创建带有默认消息的错误', () => {
    const error = new PermissionDeniedError();
    expect(error.message).toBe('权限不足');
    expect(error.status).toBe(403);
    expect(error.code).toBe('PERMISSION_DENIED');
  });

  it('应该创建带有自定义消息的错误', () => {
    const error = new PermissionDeniedError('需要管理员权限');
    expect(error.message).toBe('需要管理员权限');
    expect(error.status).toBe(403);
    expect(error.code).toBe('PERMISSION_DENIED');
  });
});
