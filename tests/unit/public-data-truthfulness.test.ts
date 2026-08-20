import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const search = readFileSync('qianfu-liandeng/src/pages/Search.tsx', 'utf8');
const serverList = readFileSync('qianfu-liandeng/src/pages/ServerList.tsx', 'utf8');
const serverShared = readFileSync('server/controllers/servers/shared.ts', 'utf8');
const serverListController = readFileSync('server/controllers/servers/list.ts', 'utf8');
const serverDetail = readFileSync('qianfu-liandeng/src/pages/ServerDetail.tsx', 'utf8');
const mobileServerDetail = readFileSync('qianfu-liandeng/src/components/mobile/MobileServerDetail.tsx', 'utf8');
const serverEditor = readFileSync('qianfu-liandeng/src/pages/ServerEditor.tsx', 'utf8');
const mobileHome = readFileSync('qianfu-liandeng/src/pages/MobileHome.tsx', 'utf8');
const userRoutes = readFileSync('server/routes/user.ts', 'utf8');
const userController = readFileSync('server/controllers/userController.ts', 'utf8');
const stats = readFileSync('server/routes/stats.ts', 'utf8');
const shop = readFileSync('qianfu-liandeng/src/pages/MarketplaceShop.tsx', 'utf8');

describe('public data truthfulness', () => {
  it('does not present fabricated search metrics or servers', () => {
    expect(search).not.toContain('12,000+');
    expect(search).not.toContain('12ms 延迟');
    expect(search).not.toContain('4.2k 日活跃');
    expect(search).not.toContain('服务器节点 #');
    expect(search).toContain("request<ServerListItem[]>('/public/servers'");
    expect(search).toContain('getServerThumbnail(server)');
    expect(search).toContain('getServerPlayersOnline(server)');
    expect(search).toContain('getServerName(server)');
    expect(search).toContain('getServerSummary(server)');
    expect(search).toContain('to={`/server/${server.id}`}');
    expect(search).not.toContain('server.image');
    expect(search).not.toContain('server.online');
    expect(search).not.toContain('server.description');
    expect(serverList).toContain('parseListField(server.tags)');
    expect(serverList).toContain("request<ServerListItem[]>('/public/servers'");
    expect(serverList).toContain('getServerSummary(server)');
    expect(serverDetail).toContain('getServerThumbnail(server)');
    expect(serverDetail).toContain('const submittedSummary =');
    expect(serverDetail).toContain('submittedDescriptionHtml');
    expect(serverDetail).toContain("label: '交流群'");
    expect(mobileServerDetail).toContain('发布QQ群');
    expect(serverEditor).toContain("platform: values.platform");
    expect(serverEditor).toContain("group_number: values.groupNumber.trim()");
    expect(serverEditor).toContain("summary: values.description.replace");
    expect(serverEditor).toContain("/servers/public/servers/status");
    expect(serverEditor).toContain("bedrock: formData.platform === 'bedrock' ? 'true' : 'false'");
    expect(serverDetail).not.toContain('server?.image');
    expect(mobileServerDetail).toContain("/servers/${id}/favorite-state");
    expect(mobileServerDetail).toContain("/servers/${id}/favorite");
    expect(mobileServerDetail).not.toContain("api.post(`/servers/${id}/like`");
    expect(userRoutes).toContain("router.get('/public/users/:id'");
    expect(userController).toContain('getPublicUserProfile');
    expect(userController).toContain("review_status: 'APPROVED'");
    expect(userController).toContain('SERVER_SELECTION');
    expect(search).toContain("category: selectedTags.join(',') || undefined");
    expect(search).toContain("params.set('category', selectedTags.join(','))");
    expect(serverListController).toContain("category.split(',')");
    expect(mobileHome).toContain('getServerThumbnail(server)');
    expect(mobileHome).toContain('getServerPlayersOnline(server)');
    expect(mobileHome).not.toContain('server.status?.playersOnline');
    expect(mobileHome).not.toContain('server.thumbnail');
  });

  it('derives landing metrics from observed data and timing', () => {
    expect(stats).not.toContain("syncLatency: '<1s'");
    expect(stats).not.toContain("avgResponseTime: '18ms'");
    expect(stats).toContain('_max: { lastUpdated: true }');
    expect(stats).toContain('performance.now() - startedAt');
    expect(stats).toContain('totalUsers: stats.totalUsers');
    expect(stats).toContain('totalServers: stats.totalServers');
    expect(stats).toContain('totalPlayers: stats.totalPlayers');
  });

  it('keeps public server pagination stable when sort values tie', () => {
    const stableIdTieBreakers = [serverShared, serverListController]
      .join('\n')
      .match(/\{ id: 'asc' \}/g) || [];

    expect(stableIdTieBreakers.length).toBeGreaterThanOrEqual(6);
  });

  it('does not invent shop announcements, discounts, or update claims', () => {
    expect(shop).not.toContain('每周上新资源');
    expect(shop).not.toContain('关注店铺可第一时间获取折扣');
    expect(shop).toContain('店主尚未发布店铺公告');
  });

  it('renders server details from submitted or observed fields only', () => {
    expect(serverDetail).toContain('const submittedDetails =');
    expect(serverDetail).toContain("label: '网络环境'");
    expect(serverDetail).toContain("label: '在线模式'");
    expect(serverDetail).toContain("label: '支持版本'");
    expect(serverDetail).toContain('data-testid="server-detail-published-details"');
    expect(serverDetail).toContain('发布者填写的详细资料');
    expect(serverDetail).not.toContain('getServerAvailability');
    expect(serverDetail).not.toContain('getServerPlayerLabel');
    expect(serverDetail).not.toContain('getServerPlayersOnline');
    expect(serverDetail).not.toContain('server?.status?.');
    expect(serverDetail).not.toContain('服务器发布者');
    expect(serverDetail).not.toContain("t('detail.nav.ref')");
    expect(serverDetail).not.toContain("t('detail.overview.mission')");
    expect(serverDetail).not.toContain("t('detail.overview.feat_latency')");
    expect(serverDetail).not.toContain("t('detail.overview.feat_dist')");
    expect(serverDetail).not.toContain("t('detail.tech.log_buffer')");
    expect(serverDetail).not.toContain("t('detail.side.integrity_guaranteed')");
    expect(serverDetail).not.toContain("formatServerMetric(playersOnline, '0')");
    expect(mobileServerDetail).not.toContain('getServerPlayersOnline');
    expect(mobileServerDetail).not.toContain('server?.status?.online');
    expect(mobileServerDetail).not.toContain('收藏热度');
    expect(mobileServerDetail).not.toContain('审核状态');
    expect(mobileServerDetail).not.toContain('更新时间');
  });

  it('keeps the submitted rich-text introduction available to public cards', () => {
    expect(serverShared).toContain('content_html: true');
  });
});
