import { safeJsonParse } from '@/utils/json';
import { isImageUrlSafe } from './urlValidator';

const MAX_DISPLAY_LIST_ITEMS = 12;
const LABEL_KEYS = ['label', 'name', 'title', 'value', 'tag'] as const;

const readListLabel = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || null;
  }
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  for (const key of LABEL_KEYS) {
    const label = readListLabel(record[key]);
    if (label) return label;
  }
  return null;
};

const normalizeList = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const label = readListLabel(value);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    normalized.push(label);
    if (normalized.length >= MAX_DISPLAY_LIST_ITEMS) break;
  }
  return normalized;
};

export const parseListField = (value: unknown): string[] => {
  if (Array.isArray(value)) return normalizeList(value);
  if (value && typeof value === 'object') return normalizeList([value]);
  if (typeof value !== 'string' || !value.trim()) return [];

  const parsed = safeJsonParse<unknown>(value, null);
  if (parsed === null) return normalizeList(value.split(/[,，\s]+/));
  return Array.isArray(parsed) ? normalizeList(parsed) : normalizeList([parsed]);
};

export const formatDateTime = (value: unknown, fallback = '暂无记录') => {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('zh-CN', { hour12: false });
};

export const formatListingPlanLabel = (value: unknown) => {
  const plan = String(value || '').trim();
  return plan === 'free-monthly' || !plan ? '免费入驻' : '历史数据';
};

export const getListingStatus = (server: any) => {
  const raw = server?.listing_expires_at;
  if (!raw) {
    return { expired: false, label: '免费展示，长期有效' };
  }
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    return { expired: false, label: '时间异常' };
  }
  if (date.getTime() <= Date.now()) {
    return { expired: true, label: '历史周期已结束，仍会展示' };
  }
  return { expired: false, label: `展示有效至 ${formatDateTime(raw, '有效中')}` };
};

export const getServerName = (server: any) =>
  server?.name || server?.name_en || '未命名服务器';

const plainText = (value: unknown) => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const getServerSummary = (server: any) => {
  const name = plainText(getServerName(server));
  const summary = plainText(server?.summary || server?.description || server?.summary_en);
  if (summary && summary !== name) return summary;

  const content = plainText(server?.content_html);
  return content || '该服务器暂未填写公开介绍。';
};

export const getServerDescription = (server: any) =>
  server?.content_html || server?.description || server?.summary || server?.summary_en || '';

export const getServerThumbnail = (server: any) => {
  const candidate = server?.thumbnail || server?.image || server?.coverUrl || server?.cover_url || '';
  return typeof candidate === 'string' && isImageUrlSafe(candidate) ? candidate : '';
};

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

export type ServerAvailability = 'online' | 'offline' | 'unknown';

export const getServerAvailability = (server: any): ServerAvailability => {
  const online = server?.status?.online ?? server?.online;
  if (online === true) return 'online';
  if (online === false) return 'offline';
  return 'unknown';
};

export const getServerPlayerLabel = (server: any) => {
  const online = getServerPlayersOnline(server);
  const max = getServerPlayersMax(server);
  return max ? `${online} / ${max}` : String(online);
};

export const getServerPlatformLabel = (server: any) => {
  const platform = String(server?.platform || server?.edition || '').trim().toLowerCase();
  if (platform === 'bedrock') return '基岩版';
  if (platform === 'java') return 'Java版';
  return '平台未知';
};

export const getServerVersionLabels = (server: any) => {
  const versions = parseListField(server?.supported_versions);
  if (versions.length > 0) return versions;

  const fallback = String(
    server?.version
      || server?.version_name
      || server?.versionName
      || server?.probe_version
      || server?.probe_version_name
      || server?.status?.versionNameRaw
      || server?.status?.version
      || server?.probe_edition
      || '',
  ).trim();
  return fallback ? [fallback] : [];
};

export const getServerFreshnessLabel = (server: any) => {
  const raw = server?.status?.lastUpdated ?? server?.lastUpdated ?? server?.updated_at;
  if (!raw) return '状态时间未知';

  const timestamp = new Date(String(raw)).getTime();
  if (!Number.isFinite(timestamp)) return '状态时间未知';

  const elapsedMinutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
  if (elapsedMinutes < 1) return '刚刚更新';
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前更新`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} 小时前更新`;

  return `${Math.floor(elapsedHours / 24)} 天前更新`;
};

export const getServerVersionLabel = (server: any) => {
  return getServerVersionLabels(server)[0] || '版本未填';
};
