import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve('server/bootstrap/healthRoutes.ts'), 'utf8');

describe('detailed health route', () => {
  it('does not target the obsolete localhost:3000 production endpoint', () => {
    expect(source).not.toContain("http://localhost:3000");
    expect(source).toContain("req.protocol");
    expect(source).toContain("req.get('host')");
  });

  it('returns a JSON dependency failure when the internal health probe cannot complete', () => {
    expect(source).toContain("status: 'dependency check failed'");
    expect(source).toContain("res.status(503).json");
  });
});
