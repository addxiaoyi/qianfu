/**
 * Server 类型定义
 */

export interface Server {
  id: string | number;
  name: string;
  ip: string;
  host?: string;
  port?: number;
  version?: string;
  edition?: 'java' | 'bedrock';
  category?: string;
  thumbnail?: string;
  cover_url?: string | null;
  description?: string;
  name_en?: string | null;
  summary?: string | null;
  summary_en?: string | null;
  tags?: unknown;
  supported_versions?: unknown;
  activity?: number | null;
  platform?: string | null;
  qq_group?: string | null;
  network_env?: string | null;
  online_mode?: boolean | null;
  listing_plan?: string | null;
  listing_started_at?: string | null;
  listing_expires_at?: string | null;
  listing_price_paid?: string | number | null;
  like_count?: number | null;
  comment_count?: number | null;
  status?: ServerStatus;
  review_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at?: string;
  updated_at?: string;
  probe_reachable?: boolean | null;
  probe_edition?: string | null;
  probe_checked_at?: string | null;
}

export interface ServerStatus {
  online: boolean;
  playersOnline: number;
  playersMax: number;
  versionNameRaw?: string;
  lastUpdated?: string;
}

export interface ServerListItem extends Server {
  liked?: boolean;
  likes?: number;
  comments?: number;
}
