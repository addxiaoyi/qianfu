import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as promoController from '../../server/controllers/promoController';

const root = process.cwd();
const promotionPage = readFileSync(
  resolve(root, 'qianfu-liandeng/src/pages/PromotionLanding.tsx'),
  'utf8',
);

describe('promotion URL policy', () => {
  it('rejects non-HTTPS task targets before they are persisted', () => {
    const validateTaskPayload = (promoController as {
      validateTaskPayload?: (value: Record<string, unknown>) => unknown;
    }).validateTaskPayload;

    expect(validateTaskPayload).toBeTypeOf('function');
    if (!validateTaskPayload) return;

    const input = {
      title: 'Follow the official account',
      platform: 'bilibili',
      targetId: 'video-1',
      targetUrl: 'https://example.com/video-1',
      rewardAmount: 100,
    };

    expect(() => validateTaskPayload(input)).not.toThrow();
    expect(() => validateTaskPayload({ ...input, targetUrl: 'javascript:alert(1)' })).toThrow('HTTPS');
    expect(() => validateTaskPayload({ ...input, targetUrl: 'http://example.com/video-1' })).toThrow('HTTPS');
  });

  it('does not render legacy unsafe task URLs as links', () => {
    expect(promotionPage).toContain('const safeTargetUrl = getSafeTaskTargetUrl(task.target_url);');
    expect(promotionPage).toContain('{safeTargetUrl && <a href={safeTargetUrl}');
  });
});
