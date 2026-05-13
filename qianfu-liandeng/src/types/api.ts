export interface User {
  id: string;
  username: string;
  email: string;
  email_verified: boolean;
  role: 'user' | 'admin';
  balance?: string;
  joinDate?: string;
  level?: number;
  experience_points?: number;
}

export interface Order {
  orderId: string;
  paymentUrl: string;
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
