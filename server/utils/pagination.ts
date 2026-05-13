import { Request } from 'express';

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export const getPaginationOptions = (req: Request, defaultLimit: number = 20): PaginationOptions => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || defaultLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};
