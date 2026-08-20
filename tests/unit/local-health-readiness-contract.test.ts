import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('local closed-loop health readiness contract', () => {
  it('accepts a ready degraded backend while keeping the diagnostic status', () => {
    const verifier = read('scripts/verify-local-closed-loop.ts');

    expect(verifier).toContain('const healthy = ready === true');
    expect(verifier).toContain('status === \'degraded\'');
  });
});
