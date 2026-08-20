import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'server/controllers/preferencesController.ts'), 'utf8');

describe('preferences resilience contract', () => {
  it('uses the tolerant preferences parser for reads', () => {
    const getPreferences = source.slice(source.indexOf('export const getPreferences'));

    expect(getPreferences).toContain('readPreferences(user.preferences)');
    expect(getPreferences).not.toContain('JSON.parse(user.preferences)');
  });
});
