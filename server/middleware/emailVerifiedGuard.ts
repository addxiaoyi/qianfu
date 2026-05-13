import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError, ErrorCode } from '../utils/errors';

/**
 * Require users to verify/bind email before accessing advanced actions.
 */
export const requireVerifiedEmail = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED));
  }

  if (req.user.email_verified) {
    return next();
  }

  return next(
    new AppError('请先完成邮箱验证后再解锁该功能', 403, ErrorCode.EMAIL_NOT_VERIFIED, true, {
      verifyPath: '/verify-code',
      email: req.user.email ?? null,
    }),
  );
};

