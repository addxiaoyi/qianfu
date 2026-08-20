export interface User {
  id: string;
  username: string;
  email: string;
  email_verified: boolean;
  avatar_url?: string | null;
  display_name?: string | null;
  bio_html?: string | null;
  role: 'user' | 'admin' | 'super_admin' | 'operator' | 'moderator' | 'normal';
  balance?: string;
  joinDate?: string;
  level?: number;
  experience_points?: number;
  xp_into_level?: number;
  xp_for_next_level?: number;
  level_progress?: number;
  last_checkin_at?: string;
}

export type LevelRuleKind = 'xp' | 'unlock' | 'badge' | 'permission';

export interface LevelRule {
  id: string;
  kind: LevelRuleKind;
  title: string;
  description: string;
  level?: number;
  xp?: number;
}

export interface LevelProgress {
  currentLevel: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
  isMax: boolean;
}

export interface LevelRulesResponse {
  rules: LevelRule[];
  progress?: LevelProgress | null;
  nextUnlock?: LevelRule | null;
}

export interface Order {
  orderId: string;
  paymentUrl: string;
  provider?: string;
  qrImagePath?: string;
  paymentQrContent?: string;
  tenantKey?: string;
  upstreamOrderId?: string;
  planId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  requestId: string;
  timestamp: string;
  meta: Record<string, any>;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  requestId: string;
  details: any[];
}

export interface CheckinStatus {
  checkedInToday: boolean;
  streakDays: number;
  rewardXp: number;
  recentCheckinDates?: string[];
}

export interface CheckinResult {
  ok?: boolean;
  alreadyCheckedIn?: boolean;
  gainedXp?: number;
  totalXp?: number;
  level?: number;
  xp_into_level?: number;
  xp_for_next_level?: number;
  level_progress?: number;
  checkinAt?: string | null;
}

export interface FavoriteServer {
  id: string | number;
  name: string;
  ip: string;
  version: string | null;
  category?: string | null;
  image?: string | null;
  players: number;
  online: boolean;
  favoritedAt: string;
}

export type FavoriteServersResponse = FavoriteServer[];
