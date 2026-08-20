import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = readFileSync(resolve(process.cwd(), 'server/routes/servers.ts'), 'utf8');

describe('server route CSRF policy', () => {
  it.each([
    "router.post('/servers', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf,",
    "router.put('/servers/:id', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf,",
    "router.post('/servers/:id/rollback', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf,",
    "router.delete('/servers/:id', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf,",
    "router.post('/servers/:id/comments', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf,",
    "router.delete('/servers/:id/comments/:commentId', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf,",
    "router.post('/servers/:id/like', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf,",
    "router.post('/servers/:id/favorite', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf,",
  ])('protects state-changing route %s', (declaration) => {
    expect(routes).toContain(declaration);
  });
});
