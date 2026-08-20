import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = readFileSync(resolve(process.cwd(), 'server/routes/ai.ts'), 'utf8');

describe('AI route access policy', () => {
  it('requires an authenticated session before applying the AI rate limit', () => {
    expect(routes).toContain("import { authenticate } from '../middleware/auth';");
    expect(routes).toContain("router.post('/chat', authenticate, aiLimiter, csrfProtection, validateBody(aiChatSchema), chat);");
  });
});
