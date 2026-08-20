import type { RequestHandler } from 'express';

import { personalFilingDisabled } from './personalFilingDisabled';

const COMMERCIAL_API_PREFIXES = [
  '/api/payment',
  '/api/v1/payment',
  '/api/wallet',
  '/api/v1/wallet',
  '/api/promo',
  '/api/v1/promo',
  '/api/qianfu',
  '/api/v1/qianfu',
  '/api/marketplace',
  '/api/v1/marketplace',
  '/api/admin/payment-projects',
  '/api/v1/admin/payment-projects',
  '/api/payment/xpay-bridge',
  '/api/v1/payment/xpay-bridge',
  '/api/payment/personal-qr',
  '/api/v1/payment/personal-qr',
] as const;

const matchesPrefix = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`);

export const commercialApiPrefixes = [...COMMERCIAL_API_PREFIXES];

export const commercialFeatureClosure: RequestHandler = (req, res, next) => {
  if (process.env.PERSONAL_FILING_MODE !== 'true') {
    next();
    return;
  }

  const requestPath = req.originalUrl.split('?', 1)[0];
  if (COMMERCIAL_API_PREFIXES.some((prefix) => matchesPrefix(requestPath, prefix))) {
    personalFilingDisabled(req, res);
    return;
  }

  next();
};
