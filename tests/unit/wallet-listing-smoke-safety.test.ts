import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'scripts/smoke-wallet-listing-flow.ts'),
  'utf8',
);

describe('wallet listing smoke safety', () => {
  it('fails closed before any login or write when the target is not explicitly authorized', () => {
    expect(source).toContain('function assertSafeTarget()');
    expect(source).toContain("SMOKE_WALLET_LISTING_ALLOW_MUTATION === '1'");
    expect(source).toContain("SMOKE_WALLET_LISTING_ALLOW_PRODUCTION === '1'");
    expect(source).toContain("SMOKE_WALLET_LISTING_ALLOW_REMOTE === '1'");
    expect(source).toContain("http://127.0.0.1:3000");
    expect(source).toContain("'/api/v1/wallet/recharge'");
    expect(source).toContain("SMOKE_WALLET_LISTING_USE_EXTERNAL_PAYMENT === '1'");
    expect(source).toContain('isLoopbackTarget() && !USE_EXTERNAL_PAYMENT');
    expect(source).toContain('isLoopbackTarget');
    expect(source).not.toContain("'https://mc-u.top'");
  });

  it('cleans an auto-created listing user on both success and failure paths', () => {
    expect(source).toContain("createScriptPrismaClient");
    expect(source).toContain('async function cleanupGeneratedUser');
    expect(source).toContain('generatedListingUserId');
    expect(source).toContain('.finally(async () =>');
    expect(source).toContain('process.exitCode = 1');
    expect(source).not.toContain('process.exit(1)');
  });

  it('allows direct disposable-user setup only for loopback smoke targets', () => {
    expect(source).toContain("SMOKE_WALLET_LISTING_CREATE_USER_DIRECT === '1'");
    expect(source).toContain('createDirectListingUser');
    expect(source).toContain('isLoopbackTarget()');
    expect(source).toContain('Direct disposable listing users are allowed only for loopback targets');
  });
});
