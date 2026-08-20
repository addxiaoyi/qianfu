import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  hasAuthorizedPermission,
  isAdministrativeRole,
  parseAuthorizedPermissions,
} from '../../server/utils/userPermissions';
import { adminOnly, hasPermission, type AuthRequest } from '../../server/middleware/auth';
import { PERMISSION_GROUPS } from '../../server/config/permissionGroups';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const response = {} as Response;

function makeRequest(role: string, permissions: string, isAdmin = false): AuthRequest {
  return {
    user: { role, permissions } as AuthRequest['user'],
    isAdmin,
  } as AuthRequest;
}

describe('user permission boundary hardening', () => {
  it('ignores stored privilege and group escalation for a known normal role', () => {
    const permissions = parseAuthorizedPermissions(
      JSON.stringify(['admin', 'manage_content', 'publish_servers', 'comment_servers', 'sponsor_badge', 'unknown']),
      'NORMAL',
    );

    expect(permissions).toEqual(expect.arrayContaining(['view_servers', 'view_server_details', 'search_servers', 'sponsor_badge']));
    expect(permissions).not.toContain('admin');
    expect(permissions).not.toContain('manage_content');
    expect(permissions).toEqual(expect.arrayContaining([
      'publish_servers',
      'edit_own_servers',
      'delete_own_servers',
    ]));
    expect(permissions).not.toContain('comment_servers');
    expect(permissions).not.toContain('unknown');
  });

  it('derives administrator capabilities from trusted roles', () => {
    expect(isAdministrativeRole('OWNER')).toBe(true);
    expect(isAdministrativeRole('ADMIN')).toBe(true);
    expect(isAdministrativeRole('OPERATOR')).toBe(true);
    expect(isAdministrativeRole('SUPER_ADMIN')).toBe(true);
    expect(isAdministrativeRole('admin')).toBe(true);
    expect(isAdministrativeRole('super_admin')).toBe(true);
    expect(isAdministrativeRole('NORMAL')).toBe(false);

    expect(parseAuthorizedPermissions('[]', 'OPERATOR')).toEqual(
      expect.arrayContaining(['admin', 'manage_users', 'manage_content']),
    );
    expect(parseAuthorizedPermissions('[]', 'admin')).toEqual(
      expect.arrayContaining(['admin', 'manage_users', 'manage_content']),
    );
  });

  it('allows legacy reviewer and VIP permissions without accepting administrative injection', () => {
    expect(parseAuthorizedPermissions('["review_servers","admin","manage_content"]', 'REVIEWER')).toEqual([
      'review_servers',
    ]);
    expect(parseAuthorizedPermissions('["rate_servers","comment_servers","sponsor_badge","admin"]', 'VIP')).toEqual([
      'rate_servers',
      'comment_servers',
      'sponsor_badge',
    ]);
  });

  it('rejects unknown permission names and role-incompatible privileged permissions', () => {
    expect(hasAuthorizedPermission('NORMAL', '["manage_stats"]', 'manage_stats')).toBe(false);
    expect(hasAuthorizedPermission('NORMAL', '["port5555_access"]', 'port5555_access')).toBe(false);
    expect(hasAuthorizedPermission('ADMIN', '["manage_stats"]', 'manage_stats')).toBe(true);
    expect(hasAuthorizedPermission('ADMIN', '[]', 'not_a_permission')).toBe(false);
  });

  it('does not let an injected admin permission cross middleware boundaries', () => {
    const req = makeRequest('NORMAL', '["admin","manage_content"]');
    const permissionNext = vi.fn();
    const adminNext = vi.fn();

    hasPermission(['manage_content'])(req, response, permissionNext);
    adminOnly(req, response, adminNext);

    expect(permissionNext).toHaveBeenCalledOnce();
    expect(permissionNext.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    expect(adminNext).toHaveBeenCalledOnce();
    expect(adminNext.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it('allows an operator through canonical role permissions without stored JSON grants', () => {
    const req = makeRequest('OPERATOR', '[]');
    const permissionNext = vi.fn();
    const adminNext = vi.fn();

    hasPermission(['manage_content'])(req, response, permissionNext);
    adminOnly(req, response, adminNext);

    expect(permissionNext).toHaveBeenCalledWith();
    expect(adminNext).toHaveBeenCalledWith();
  });

  it('gives normal users self-service server permissions without content management', () => {
    expect(PERMISSION_GROUPS.NORMAL.permissions).toEqual(expect.arrayContaining([
      'publish_servers',
      'edit_own_servers',
      'delete_own_servers',
    ]));
    expect(PERMISSION_GROUPS.NORMAL.permissions).not.toContain('manage_content');
    expect(PERMISSION_GROUPS.NORMAL.server_limit).toBe(1);
    expect(PERMISSION_GROUPS.NORMAL.can_publish).toBe(true);
  });

  it('does not put an administrator-only gate before owned server deletion', () => {
    const route = readFileSync(resolve(process.cwd(), 'server/routes/servers.ts'), 'utf8');
    expect(route).toContain("router.delete('/servers/:id'");
    expect(route).toContain("hasPermission(['delete_own_servers', 'manage_content'])");
    expect(route).not.toContain("validateParams(idParamSchema), hasPermission(['manage_content']), deleteServer");
  });
});
