import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve('server/index.ts'), 'utf8');

describe('startup background task errors', () => {
  it('logs cleanup startup failures with context', () => {
    expect(source).toContain("cleanupExpiredUnverified().catch((error) =>");
    expect(source).toContain("logger.error('[CleanupService] Initial cleanup failed:'");
    expect(source).not.toContain('cleanupExpiredUnverified().catch(() => {})');
  });
});
