import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('GitHub OAuth security contract', () => {
  it('builds a BrowserRouter-compatible frontend callback path', () => {
    const controller = read('server/controllers/githubAuthController.ts');
    expect(controller).toContain("callback.pathname = '/oauth/callback/github';");
    expect(controller).toContain('callback.search = query;');
    expect(controller).not.toContain('callback.hash = hash;');
  });
  it('persists a unique GitHub provider identity in every deployment schema', () => {
    for (const schema of ['prisma/schema.prisma', 'prisma/schema.postgresql.prisma', 'prisma/schema.mysql.prisma']) {
      expect(read(schema)).toMatch(/github_user_id\s+String\?\s+@unique/);
    }
  });

  it('requires authentication and CSRF protection for local unlink', () => {
    const routes = read('server/routes/auth.ts');
    expect(routes).toMatch(/router\.delete\(['"]\/auth\/github\/link['"],\s*authenticate,\s*csrfProtection/);
  });

  it('makes the OAuth state cookie secure in production', () => {
    const controller = read('server/controllers/githubAuthController.ts');
    expect(controller).toMatch(/NODE_ENV\s*===\s*['"]production['"].*FORCE_HTTPS/s);
  });
  it('requires S256 PKCE and forwards the verifier to GitHub token exchange', () => {
    const controller = read('server/controllers/githubAuthController.ts');
    expect(controller).toContain("code_challenge_method', 'S256'");
    expect(controller).toContain("params.set('code_verifier', codeVerifier)");
    expect(controller).toContain('!code || !codeVerifier || !matchesGitHubOAuthState');
  });

  it('accepts only verified email API results', () => {
    const controller = read('server/controllers/githubAuthController.ts');
    expect(controller).not.toMatch(/emails\.find\([\s\S]*?profile\.email\s*\|\|/);
    expect(controller).toContain('emailsResponse.ok');
  });

  it('documents OAuth secrets without embedding real credentials', () => {
    const template = read('.env.example');
    expect(template).toContain('GITHUB_CLIENT_ID=');
    expect(template).toContain('GITHUB_CLIENT_SECRET=');
    expect(template).toContain('GITHUB_CALLBACK_URL=https://example.com/api/v1/auth/github/callback');
    expect(template).toContain('切勿把真实 Client Secret');
    expect(template).not.toMatch(/GITHUB_CLIENT_SECRET=[A-Za-z0-9_-]{20,}/);
  });

  it('requires complete production OAuth configuration with an HTTPS callback', () => {
    const schema = read('server/config/env.ts');
    const validator = read('scripts/validate-runtime-env.ts');
    expect(schema).toContain('GITHUB_CALLBACK_URL: optionalEnv(z.string().url())');
    expect(schema).toContain("import { optionalEnv } from './envParsing'");
    expect(validator).toContain('must be configured together');
    expect(validator).toContain('must use HTTPS in production');
    expect(validator).toContain('same origin as API_PUBLIC_URL');
  });
});
