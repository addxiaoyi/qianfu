import type { Request, Response } from 'express';
import { sendError } from '../utils/response';

export const personalFilingDisabled = (_req: Request, res: Response) =>
  sendError(res, '该功能在个人备案模式下不可用', 403, 'PERSONAL_FILING_DISABLED');
