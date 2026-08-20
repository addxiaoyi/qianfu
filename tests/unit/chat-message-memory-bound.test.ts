import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sseHook = path.resolve('qianfu-liandeng/src/hooks/useSSE.ts');

describe('chat SSE memory bound', () => {
  it('limits retained chat messages', () => {
    const source = fs.readFileSync(sseHook, 'utf8');

    expect(source).toMatch(/MAX_CHAT_MESSAGES/);
    expect(source).toMatch(/slice\(-MAX_CHAT_MESSAGES\)/);
  });
});
