export const parseListField = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map(String).map((item) => item.trim()).filter(Boolean)
      : [];
  } catch {
    return value.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean);
  }
};

export const formatDateTime = (value: unknown, fallback = '暂无记录') => {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('zh-CN', { hour12: false });
};

export const formatListingPlanLabel = (value: unknown) => {
  const plan = String(value || '').trim();
  switch (plan) {
    case 'basic-monthly':
      return '月租方案';
    case 'pro-quarterly':
      return '季度方案';
    case 'vip-yearly':
      return '年付方案';
    default:
      return '未绑定套餐';
  }
};

export const getListingStatus = (server: any) => {
  const raw = server?.listing_expires_at;
  if (!raw) {
    return { expired: false, label: '未限制' };
  }
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    return { expired: false, label: '时间异常' };
  }
  if (date.getTime() <= Date.now()) {
    return { expired: true, label: '已到期' };
  }
  return { expired: false, label: formatDateTime(raw, '有效中') };
};

export const getServerName = (server: any) =>
  server?.name || server?.name_en || '未命名服务器';

export const getServerSummary = (server: any) =>
  server?.summary || server?.description || server?.summary_en || '该服务器暂未填写公开介绍。';

export const getServerThumbnail = (server: any) =>
  server?.thumbnail || server?.image || server?.coverUrl || '';

export const getServerPlayersOnline = (server: any) => {
  const raw = server?.status?.playersOnline ?? server?.playersOnline ?? server?.players ?? server?.currentPlayers ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

export const getServerPlayersMax = (server: any) => {
  const raw = server?.status?.playersMax ?? server?.maxPlayers ?? server?.max_players;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const getServerVersionLabel = (server: any) => {
  const versions = parseListField(server?.supported_versions);
  return versions[0] || server?.status?.versionNameRaw || server?.version || '版本未填';
};
