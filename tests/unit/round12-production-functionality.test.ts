import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPostgresAuditTimeSeriesQuery } from '../../server/utils/auditTimeSeries';
import { isPort5555Request } from '../../server/utils/port5555Request';
import {
  getMinotarAvatarUrl,
  isMinecraftUsername,
} from '../../qianfu-liandeng/src/utils/minecraftAvatar';

const root = process.cwd();

describe('round 12 production functionality regressions', () => {
  it('recognizes port5555 requests after Express router mounting', () => {
    expect(isPort5555Request({
      headers: {},
      path: '/stats',
      baseUrl: '/api/v1/port5555',
      originalUrl: '/api/v1/port5555/stats',
    } as any)).toBe(true);

    expect(isPort5555Request({
      headers: {},
      path: '/health',
      baseUrl: '/api/v1',
      originalUrl: '/api/v1/health',
    } as any)).toBe(false);
  });

  it('builds valid PostgreSQL audit time-series SQL', () => {
    const query = buildPostgresAuditTimeSeriesQuery('hour');
    expect(query).toContain("TO_CHAR(created_at, 'YYYY-MM-DD HH24:00')");
    expect(query).toContain('created_at >= $1');
    expect(query).toContain("GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD HH24:00')");
    expect(query).not.toContain('created_at >= ?');
    expect(query).not.toContain('TO_CHAR(created_at, ?)');
  });

  it('keeps third-party Minecraft avatars opt-in and validates names', () => {
    expect(isMinecraftUsername('Steve')).toBe(true);
    expect(isMinecraftUsername('Player_123')).toBe(true);
    expect(isMinecraftUsername('round12_admin_123456')).toBe(false);
    expect(getMinotarAvatarUrl('Steve', false)).toBeNull();
    expect(getMinotarAvatarUrl('round12_admin_123456', true)).toBeNull();
    expect(getMinotarAvatarUrl('Steve', true)).toBe('https://minotar.net/helm/Steve/160.png');
  });

  it('keeps deep-browser assertions aligned with current production copy', () => {
    const smoke = fs.readFileSync(
      path.join(root, 'scripts/browser-nonpay-auth-validation.cjs'),
      'utf8',
    );
    expect(smoke).toContain("texts: ['个人中心', '我的服务器', '未结工单', '账户设置']");
    expect(smoke).toContain("texts: ['推广投稿 / 审核与结算', '审核结算面板已就绪', '投稿审核']");
  });
});
