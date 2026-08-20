import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

describe('local database production artifact', () => {
  test('uses a runtime extension for the logger import', async () => {
    const file = path.resolve('dist-server/server/localDb.js');
    const source = await readFile(file, 'utf8');

    expect(source).toContain("from './utils/logger.js'");
  });
});
