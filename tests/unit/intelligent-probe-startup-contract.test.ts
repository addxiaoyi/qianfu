import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const probeDb = readFileSync('server/intelligent-probe/db.ts', 'utf8');
const probeIndex = readFileSync('server/intelligent-probe/index.ts', 'utf8');

describe('intelligent probe database lifecycle', () => {
  it('reuses the main local Prisma client instead of constructing a second client', () => {
    expect(probeDb).toContain("from '../localDb'");
    expect(probeDb).not.toContain('resolveLocalPrismaClient');
  });

  it('does not reconnect the shared client during probe startup', () => {
    expect(probeIndex).not.toContain('await prisma.$connect()');
    expect(probeIndex).toContain('await prisma.$disconnect()');
  });
});
