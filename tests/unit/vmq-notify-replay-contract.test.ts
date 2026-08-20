import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'server/controllers/paymentController.ts'), 'utf8');
const notify = source.slice(source.indexOf('export const qiuPayNotify'), source.indexOf('export const payProNotify'));
const vmqBranch = notify.slice(notify.indexOf('if (vmqPayId)'), notify.indexOf('const outTradeNo'));

describe('V免签 callback replay contract', () => {
  it('keeps the VMQ replay key in the handler scope', () => {
    expect(vmqBranch).toContain('replayKey = buildQiuPayNotifyReplayKey');
    expect(vmqBranch).not.toContain('const replayKey = buildQiuPayNotifyReplayKey');
  });

  it('removes the replay key when completion rejects the callback', () => {
    expect(vmqBranch).toContain('if (replayKey)');
    expect(vmqBranch).toContain('await redisService.del(replayKey)');
  });
});
