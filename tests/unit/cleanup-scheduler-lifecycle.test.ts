import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve('server/services/cleanupService.ts'), 'utf8');

describe('cleanup scheduler lifecycle', () => {
  it('exposes an idempotent stop helper for scheduler ownership', () => {
    expect(source).toContain('export function stopCleanupScheduler');
    expect(source).toContain('clearInterval(timer)');
  });

  it('normalizes invalid scheduler intervals before creating a timer', () => {
    expect(source).toContain('Number.isInteger(intervalMs)');
    expect(source).toContain('intervalMs > 0');
  });
});
