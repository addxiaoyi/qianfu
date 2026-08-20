import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const policyPaths = ['/terms', '/privacy', '/refund-policy'];

describe('public legal policy discovery', () => {
  it('keeps the policy links visible without JavaScript', () => {
    const html = readFileSync('qianfu-liandeng/index.html', 'utf8');
    const noScript = html.match(/<noscript[\s\S]*?<\/noscript>/i)?.[0] ?? '';

    expect(noScript).not.toBe('');
    for (const path of policyPaths) {
      expect(noScript).toContain(`href="${path}"`);
    }
  });
});
