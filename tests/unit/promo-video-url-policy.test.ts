import { describe, expect, it } from 'vitest';

import { parsePromoVideoUrl } from '../../server/services/promoVideoUrlService';

describe('promotion video URL policy', () => {
  it('extracts stable platform video IDs', () => {
    expect(parsePromoVideoUrl('bilibili', 'https://www.bilibili.com/video/BV1xx411c7mD').videoId).toBe('BV1xx411c7mD');
    expect(parsePromoVideoUrl('douyin', 'https://www.douyin.com/video/1234567890').videoId).toBe('1234567890');
  });

  it('rejects another platform and embedded credentials', () => {
    expect(() => parsePromoVideoUrl('bilibili', 'https://example.com/video/BV1xx411c7mD')).toThrow();
    expect(() => parsePromoVideoUrl('bilibili', 'https://user:pass@www.bilibili.com/video/BV1xx411c7mD')).toThrow();
  });

  it('creates a stable URL fingerprint for allowed short links', () => {
    const first = parsePromoVideoUrl('bilibili', 'https://b23.tv/abc123');
    const second = parsePromoVideoUrl('bilibili', 'https://b23.tv/abc123#ignored');
    expect(first.videoId).toBe(second.videoId);
    expect(first.videoId).toMatch(/^url_[a-f0-9]{32}$/);
  });
});
