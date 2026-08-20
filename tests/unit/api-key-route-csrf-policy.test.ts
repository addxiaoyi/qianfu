import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = readFileSync(resolve(process.cwd(), 'server/routes/apiKey.ts'), 'utf8');

describe('API key route CSRF policy', () => {
  it.each([
    "router.post('/', writeCsrf, createApiKey);",
    "router.post('/rotate', writeCsrf, rotateApiKey);",
    "router.delete('/:id', writeCsrf, deleteApiKey);",
  ])('protects state-changing route %s', (declaration) => {
    expect(routes).toContain(declaration);
  });
});
