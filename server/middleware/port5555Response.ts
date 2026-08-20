import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function successResponse<T>(res: Response, data?: T, message?: string, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
    message,
  });
}

export function errorResponse(res: Response, error: string, statusCode = 400): void {
  res.status(statusCode).json({
    success: false,
    error,
  });
}
