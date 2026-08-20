import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('marketplace smoke delivery contract', () => {
  it('validates secure download issuance instead of exposing a raw order URL', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/smoke-marketplace-closure.ts'), 'utf8');

    expect(source).toContain("'buyer-can-download-paid-order'");
    expect(source).toContain('`/api/v1/qianfu/marketplace/orders/${created.orderId}/download`');
    expect(source).toContain('downloadUrl');
    expect(source).not.toContain("Boolean(paidOrder?.deliveryUrl)");
  });
});
