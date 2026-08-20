import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('wallet listing local smoke bootstrap contract', () => {
  it('supports a disposable administrator only for loopback smoke targets', () => {
    const script = read('scripts/smoke-wallet-listing-flow.ts');

    expect(script).toContain('SMOKE_WALLET_LISTING_CREATE_ADMIN');
    expect(script).toContain('createDisposableAdmin');
    expect(script).toContain('Disposable smoke administrators are allowed only for loopback targets');
  });
});
