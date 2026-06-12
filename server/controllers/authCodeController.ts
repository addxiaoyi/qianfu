import { Request, Response, NextFunction } from 'express';

import crypto from 'crypto';

import Session from 'supertokens-node/recipe/session';

import prisma from '../db';

import { sendSuccess, toSafeUser } from '../utils/response';

import { AppError, ErrorCode } from '../utils/errors';

import { logger } from '../utils/logger';

import { redisService } from '../services/redisService';

import { sendEmailLoginCode } from '../services/emailService';

import { sendPhoneLoginCode } from '../services/smsService';

import { getOrCreateSuperTokensUser } from '../services/superTokensUser';
import { getJwtSecret } from '../utils/securityConfig';
import { setLocalAuthCookie, signLocalAuthToken } from '../utils/localAuth';



const CODE_TTL_MINUTES = 10;

const MAX_VERIFY_ATTEMPTS = 5;

const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 分钟冷却期

const CODE_SEND_INTERVAL_MS = 60 * 1000; // 60 秒内不可重复发送



const USER_CACHE_PREFIX = 'user:cache:';




function normalizeEmail(email: string) {

  return email.trim().toLowerCase();

}



function normalizePhone(phone: string) {

  return phone.trim().replace(/[\s-]/g, '');

}



function isPhone(value: string): boolean {

  return /^(\+?\d{1,3}[- ]?)?\d{7,15}$/.test(value.replace(/[\s-]/g, ''));

}


function isEmail(value: string): boolean {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

}


function maskIdentifier(value: string, type: 'email' | 'phone'): string {

  if (type === 'email') {

    const [name = '', domain = ''] = value.split('@');

    const maskedName = name.length <= 2 ? `${name[0] || '*'}***` : `${name.slice(0, 2)}***`;

    return domain ? `${maskedName}@${domain}` : maskedName;

  }

  const normalized = normalizePhone(value);

  if (normalized.length <= 4) return '****';

  return `${normalized.slice(0, 3)}****${normalized.slice(-2)}`;

}



function generateCode() {

  return String(Math.floor(100000 + Math.random() * 900000));

}



function generateCodeHash(identifier: string, code: string) {

  const secret = getJwtSecret();

  return crypto.createHmac('sha256', secret).update(`${identifier}:${code}`).digest('hex');

}



/**
 * 统一标识符解析器
 * 从请求体中提取 email 或 phone，返回 { identifier, type, address }
 */

function parseIdentifier(body: Record<string, unknown>) {

  const email = typeof body?.email === 'string' ? body.email.trim() : '';

  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';



  if (email) {

    if (!isEmail(email)) {

      throw new AppError('Invalid email format', 400, ErrorCode.VALIDATION_ERROR);

    }

    return { identifier: normalizeEmail(email), type: 'email' as const, address: normalizeEmail(email) };

  }

  if (phone) {

    if (!isPhone(phone)) {

      throw new AppError('Invalid phone format', 400, ErrorCode.VALIDATION_ERROR);

    }

    return { identifier: normalizePhone(phone), type: 'phone' as const, address: normalizePhone(phone) };

  }



  throw new AppError('Email or phone is required', 400, ErrorCode.VALIDATION_ERROR);

}



/**
 * 根据标识符类型查询用户
 */

async function findUserByIdentifier(identifier: string) {

  return prisma.user.findFirst({

    where: {

      OR: [

        { email: identifier },

        { phone: identifier },

      ],

    },

  });

}



/**
 * 发送验证码
 * 支持 email 和 phone 双通道
 */

export const sendLoginCode = async (req: Request, res: Response, next: NextFunction) => {

  try {

    const { identifier, type, address } = parseIdentifier(req.body);

    logger.debug(`[AuthCode] sendLoginCode: identifier=${maskIdentifier(address, type)} type=${type}`);



    const user = await findUserByIdentifier(identifier);

    if (!user) {

      return sendSuccess(res, { [type]: maskIdentifier(address, type) }, 'If the account exists, a verification code has been sent');

    }



    // 检查发送频率限制

    const now = Date.now();

    const lastSendAt = user.last_code_send_at ? new Date(user.last_code_send_at).getTime() : 0;

    if (lastSendAt > 0 && now - lastSendAt < CODE_SEND_INTERVAL_MS) {

      throw new AppError('Please wait before requesting a new code', 429, ErrorCode.RATE_LIMITED);

    }



    // 检查是否被锁定

    if (user.login_count && user.login_count >= MAX_VERIFY_ATTEMPTS) {

      if (user.login_lockout_at) {

        const lockoutExpiry = new Date(user.login_lockout_at).getTime() + LOCKOUT_DURATION_MS;

        if (now < lockoutExpiry) {

          throw new AppError('Too many failed attempts. Please try again later.', 429, ErrorCode.RATE_LIMITED);

        } else {

          await prisma.user.update({

            where: { id: user.id },

            data: { login_count: 0, login_lockout_at: null },

          });

        }

      }

    }



    const code = generateCode();

    const hashedCode = generateCodeHash(address, code);



    await prisma.user.update({

      where: { id: user.id },

      data: {

        verification_token: hashedCode,

        token_expiry: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),

        last_code_send_at: new Date(),

      },

    });



    // 根据类型选择发送渠道

    if (type === 'phone') {

      await sendPhoneLoginCode(address, code);

    } else {

      await sendEmailLoginCode(address, code);

    }



    return sendSuccess(res, { [type]: maskIdentifier(address, type) }, 'If the account exists, a verification code has been sent');

  } catch (error) {

    logger.error('[AuthCode] Failed to send login code:', error);

    next(error);

  }

};



/**

 * 验证验证码

 * 支持 email 和 phone 双通道

 */

export const verifyLoginCode = async (req: Request, res: Response, next: NextFunction) => {

  try {

    const { identifier, type, address } = parseIdentifier(req.body);

    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

    if (!code) {

      throw new AppError('Code is required', 400, ErrorCode.VALIDATION_ERROR);

    }



    logger.debug(`[AuthCode] verifyLoginCode: identifier=${maskIdentifier(address, type)} type=${type}`);



    const user = await findUserByIdentifier(identifier);

    if (!user) {

      throw new AppError('Invalid code', 400, ErrorCode.BAD_REQUEST);

    }



    // 检查是否被锁定

    if (user.login_count && user.login_count >= MAX_VERIFY_ATTEMPTS) {

      if (user.login_lockout_at) {

        const now = Date.now();

        const lockoutExpiry = new Date(user.login_lockout_at).getTime() + LOCKOUT_DURATION_MS;

        if (now < lockoutExpiry) {

          throw new AppError('Too many failed attempts. Please try again later.', 429, ErrorCode.RATE_LIMITED);

        } else {

          await prisma.user.update({

            where: { id: user.id },

            data: { login_count: 0, login_lockout_at: null },

          });

        }

      }

    }



    if (!user.verification_token || !user.token_expiry || user.token_expiry < new Date()) {

      throw new AppError('Code expired', 400, ErrorCode.BAD_REQUEST);

    }



    if (user.verification_token !== generateCodeHash(address, code)) {

      const nextCount = (user.login_count || 0) + 1;

      const updateData: Record<string, unknown> = { login_count: nextCount };

      if (nextCount >= MAX_VERIFY_ATTEMPTS) {

        updateData.login_lockout_at = new Date();

      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });

      throw new AppError('Invalid code', 400, ErrorCode.BAD_REQUEST);

    }



    // 验证成功：更新用户状态

    const updatedUser = await prisma.user.update({

      where: { id: user.id },

      data: {

        email_verified: true,

        verification_token: null,

        token_expiry: null,

        login_count: 0,

        login_lockout_at: null,

        last_login_at: new Date(),

      },

    });



    // 获取 identifier 对应的邮箱（SuperTokens 需要 email）

    const userEmail = user.email || user.phone;



    // 创建 SuperTokens 会话

    let stUserId = user.supertokens_user_id;

    if (!stUserId) {

      stUserId = await getOrCreateSuperTokensUser(userEmail!);

      if (stUserId) {

        await prisma.user.update({

          where: { id: user.id },

          data: { supertokens_user_id: stUserId },

        });

      }

    }



    if (stUserId) {

      try {

        await Session.createNewSession(req, res, process.env.NEXT_PUBLIC_SUPER_TOKENS_TENANT_ID || '1', stUserId as any);

        await redisService.del(`${USER_CACHE_PREFIX}${user.id}`);

      } catch (stError) {

        logger.warn('[AuthCode] Failed to create SuperTokens session after code verification:', stError);

      }

    }



    const token = signLocalAuthToken(user.id);
    setLocalAuthCookie(res, token);

    return sendSuccess(res, {
      [type]: address,
      token,
      user: toSafeUser({ ...updatedUser, supertokens_user_id: stUserId || updatedUser.supertokens_user_id }, { mask: false }),
      mode: 'code-auth',
    }, 'Code verified and logged in', 200, undefined, { mask: false });

  } catch (error) {

    next(error);

  }

};
