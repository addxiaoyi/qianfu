import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('frontend route integrity', () => {
  it('keeps direct navigation targets registered', () => {
    const output = execFileSync(process.execPath, ['scripts/audit-frontend-routes.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toContain('FRONTEND_ROUTE_FINDINGS=0');
  }, 20_000);
});
