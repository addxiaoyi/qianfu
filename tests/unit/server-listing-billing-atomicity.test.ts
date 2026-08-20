import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const crud = readFileSync(
  resolve(process.cwd(), 'server/controllers/servers/crud.ts'),
  'utf8',
);
describe('server listing billing closure', () => {
  it('publishes through the caller transaction without a wallet debit', () => {
    expect(crud).not.toContain('payInTransaction(');
    expect(crud).not.toContain('InsufficientWalletBalanceError');
    expect(crud).toContain('localPrisma.$transaction(async (tx: Prisma.TransactionClient) =>');
    expect(crud).toContain('const createdServer = await tx.server.create({');
    expect(crud).toContain('await replaceServerFacets(tx, createdServer.id');
    expect(crud).toContain('return createdServer;');
  });

  it('rejects legacy paid listing plans even when a stale client submits them', () => {
    expect(crud).toContain("const listingPlan = 'free-monthly';");
    expect(crud).toContain("listing_plan !== 'free-monthly'");
    expect(crud).not.toContain("'basic-monthly': 700");
    expect(crud).not.toContain("'pro-quarterly': 2000");
    expect(crud).not.toContain("'vip-yearly': 9000");
  });

  it('skips redundant cross-database sync when local and primary storage are the same', () => {
    expect(crud).toContain('if (shouldSynchronizePrimaryAndLocalDatabase()) {');
    expect(crud).toContain('await syncServerToMainDB(server.id);');
  });
});
