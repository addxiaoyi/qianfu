import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('my servers ownership boundary', () => {
  it('always scopes the personal server list to the authenticated user', () => {
    const controller = read('server/controllers/servers/user.ts');
    const route = read('server/routes/servers.ts');

    expect(route).toContain("router.get('/servers', serversLimiter, authenticate");
    expect(controller).toContain('where: { owner_id: user.id }');
    expect(controller).not.toContain('const where = canManageAll ? {} : { owner_id: user.id };');
    expect(controller).not.toContain('isAdministrativeRole(user.role)');
    expect(controller).not.toContain("'manage_content'");
  });
});
