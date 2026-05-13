import { Request, Response, NextFunction } from 'express';
import { buildSuccessEnvelope, getRequestId } from '../contracts/responseEnvelope';

/**
 * API response interceptor
 * Standardizes API response format
 */
export const unifiedResponseHandler = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;

  res.json = function(data: any): Response {
    if (data && (data.success !== undefined || !req.path.startsWith('/api'))) {
      return originalJson.call(this, data);
    }

    return originalJson.call(this, buildSuccessEnvelope(data, 'Success', getRequestId(req)));
  };

  next();
};

