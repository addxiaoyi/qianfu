import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('frontend query error integrity', () => {
  it('requires an explicit error state for every page query', () => {
    const output = execFileSync(process.execPath, ['scripts/audit-frontend-query-errors.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 12_000,
    });

    expect(output).toContain('FRONTEND_QUERY_ERROR_FINDINGS=0');
  }, 15_000);
});
