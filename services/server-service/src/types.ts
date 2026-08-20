import { Request } from 'express';
import { ErrorCode } from '@qianfu/shared';

export interface AuthRequest extends Request {
  userId?: string;
  sessionId?: string;
}

export interface AppErrorInstance extends Error {
  statusCode: number;
  code: ErrorCode;
  isOperational?: boolean;
  details?: Record<string, unknown>;
}
