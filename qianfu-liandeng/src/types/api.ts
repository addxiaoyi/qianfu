export interface User {
  id: string;
  username: string;
  email: string;
  email_verified: boolean;
  role: 'user' | 'admin' | 'operator' | 'moderator' | 'normal';
  balance?: string;
  joinDate?: string;
  level?: number;
  experience_points?: number;
  xp_into_level?: number;
  xp_for_next_level?: number;
  level_progress?: number;
  last_checkin_at?: string;
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
