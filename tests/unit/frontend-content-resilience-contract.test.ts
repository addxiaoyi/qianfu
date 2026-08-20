import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('frontend content resilience', () => {
  it('hardens announcements against malformed runtime data and storage failures', () => {
    const source = read('qianfu-liandeng', 'src', 'components', 'business', 'AnnouncementBanner.tsx');
    expect(source).toContain("const DEFAULT_TONE: AnnouncementTone = 'INFO'");
    expect(source).toContain('normalizeAnnouncementTone(announcement.tone)');
    expect(source).toContain('Object.prototype.hasOwnProperty.call(toneStyles, value)');
    expect(source).toContain('function readDismissal');
    expect(source).toContain('function persistDismissal');
  });

  it('exposes resource search, category, and sort state', () => {
    const source = read('qianfu-liandeng', 'src', 'pages', 'ResourceCenter.tsx');
    expect(source).toContain('aria-describedby="resource-search-status"');
    expect(source).toContain('id="resource-search-status"');
    expect(source).toContain('aria-pressed={activeCat === cat.id}');
    expect(source).toContain('const filtered = RESOURCES.filter');
    expect(source).not.toContain('marketSort');
    expect(source).not.toContain('sortKey');
    expect(source).toContain('清除搜索条件');
    expect(source).toContain('sanitizeUrl(res.url');
    expect(source).toContain('资源概览');
    expect(source).not.toContain('AI READY SUMMARY');
  });

  it('distinguishes missing servers from retryable failures and remains mobile safe', () => {
    const source = read('qianfu-liandeng', 'src', 'pages', 'ServerDetail.tsx');
    expect(source).toContain('error instanceof ApiError && error.status === 404');
    expect(source).toContain('const isValidServerId = isServerRouteId(id)');
    expect(source).toContain('enabled: isValidServerId');
    expect(source).toContain('isEmpty={isInvalidServerId || isMissingServer}');
    expect(source).toContain("emptyTitle={isInvalidServerId ? '服务器链接格式无效' : '服务器不存在'}");
    expect(source).toContain('onRetry={isValidServerId ? () => { void refetch(); } : undefined}');
    expect(source).toContain('disabled={useRustV2 || likeMutation.isPending}');
    expect(source).toContain('break-words text-sm leading-7');
    expect(source).toContain('break-all text-lg sm:text-2xl');
  });

  it('keeps mobile overflow checks in the durable production audit', () => {
    const source = read('scripts', 'public-live-browser-audit.cjs');
    expect(source).toContain("label: 'home-mobile'");
    expect(source).toContain("label: 'servers-mobile'");
    expect(source).toContain("label: 'resources-mobile'");
    expect(source).toContain('checkHorizontalOverflow: true');
    expect(source).toContain('horizontal_overflow=');
  });
});
