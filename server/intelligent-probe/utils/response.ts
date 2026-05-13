import { Response } from 'express';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export const successResponse = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 500,
  errorDetails?: any
): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  const displayMessage = isProduction && statusCode >= 500
    ? 'An unexpected error occurred'
    : message;

  const response: ApiResponse<null> = {
    success: false,
    message: displayMessage,
    error: isProduction 
      ? (statusCode >= 500 ? undefined : (errorDetails ? JSON.stringify(errorDetails) : message)) 
      : (errorDetails ? JSON.stringify(errorDetails) : message),
  };
  res.status(statusCode).json(response);
};
