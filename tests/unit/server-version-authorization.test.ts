import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = readFileSync(
  resolve(process.cwd(), 'server/controllers/servers/versions.ts'),
  'utf8',
);
const routes = readFileSync(
  resolve(process.cwd(), 'server/routes/servers.ts'),
  'utf8',
);

describe('server version object authorization', () => {
  it('checks exact ownership or administrator status before version access', () => {
    expect(controller).toContain('server.owner_id !== req.user.id && !isAdministrator(req)');
    expect(controller.match(/assertCanManageServer\(req, server\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('does not require global content permission from a valid owner', () => {
    expect(routes).toContain("router.post('/servers/:id/rollback', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf, validateParams(idParamSchema), validateBody(rollbackSchema), rollbackServer);");
    expect(routes).toContain("router.get('/servers/:id/versions', serversLimiter, authenticate, validateParams(idParamSchema), validateQuery(serverHistoryQuerySchema), listVersions);");
    expect(routes).toContain("router.get('/servers/:id/versions/compare', serversLimiter, authenticate, validateParams(idParamSchema), validateQuery(compareVersionsQuerySchema), compareServerVersions);");
  });

  it('uses optional authentication for pending or rejected owner-visible details', () => {
    expect(routes).toContain("router.get('/servers/:id', serversLimiter, authenticateOptional, validateParams(idParamSchema), getServer);");
  });
});
