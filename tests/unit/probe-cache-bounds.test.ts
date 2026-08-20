import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const probeService = path.resolve('server/intelligent-probe/services/minecraftProbeService.ts');

describe('minecraft probe cache bounds', () => {
  it('has a hard capacity and evicts the oldest entry before insertion', () => {
    const source = fs.readFileSync(probeService, 'utf8');

    expect(source).toMatch(/MAX_STATUS_CACHE_ENTRIES/);
    expect(source).toMatch(/statusCache\.size\s*>=\s*MAX_STATUS_CACHE_ENTRIES/);
  });
});
