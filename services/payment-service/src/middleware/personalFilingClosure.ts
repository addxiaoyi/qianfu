import type { NextFunction, Request, Response } from 'express';

const PERSONAL_FILING_DISABLED = {
  success: false,
  error: {
    message: '该功能在个人备案模式下不可用',
    code: 'PERSONAL_FILING_DISABLED',
  },
};

export function personalFilingClosure(req: Request, res: Response, next: NextFunction): void {
  if (process.env.PERSONAL_FILING_MODE !== 'true') {
    next();
    return;
  }

  res.status(403).json(PERSONAL_FILING_DISABLED);
}
