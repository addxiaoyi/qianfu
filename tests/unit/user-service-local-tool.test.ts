import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('user-service local tool runner', () => {
  it('runs Windows package shims through the Node executable', () => {
    const runner = readFileSync(
      resolve(process.cwd(), 'services/user-service/scripts/run-local-tool.mjs'),
      'utf8',
    );

    expect(runner).toContain('process.execPath');
    expect(runner).toContain('resolveWindowsShimTarget');
    expect(runner).not.toContain("process.platform === 'win32' ? `${tool}.cmd` : tool");
  });
});
