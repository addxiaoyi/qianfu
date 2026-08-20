import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { normalizeUser } from '../../qianfu-liandeng/src/utils/user';

const user = {
  id: 1,
  username: 'owner',
  email: 'owner@example.com',
  email_verified: true,
};

describe('frontend user normalization', () => {
  it('maps database administrator roles to frontend administrator roles', () => {
    expect(normalizeUser({ ...user, role: 'ADMIN' as any })?.role).toBe('admin');
    expect(normalizeUser({ ...user, role: 'OWNER' as any })?.role).toBe('super_admin');
  });

  it('does not elevate unknown roles', () => {
    expect(normalizeUser({ ...user, role: 'UNKNOWN' as any })?.role).toBe('user');
  });

  it('uses Rust v2 display names when a username is not returned', () => {
    const normalized = normalizeUser({
      id: 42,
      email: 'rust@example.com',
      display_name: 'Rust 玩家',
      email_verified: true,
      role: 'USER' as any,
    });

    expect(normalized?.username).toBe('Rust 玩家');
    expect(normalized?.id).toBe('42');
  });

  it('allows normalized owners through the administrator route guard', () => {
    const app = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/App.tsx'), 'utf8');

    expect(app).toContain("const role = String(user?.role || '').toUpperCase();");
    expect(app).toContain("!['ADMIN', 'SUPER_ADMIN'].includes(role)");
  });
});
