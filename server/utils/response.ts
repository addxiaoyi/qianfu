import { Response } from 'express';
import { maskEmail as maskEmailUtil, maskPhone as maskPhoneUtil, maskData } from './masking';
import { enrichUserWithLevel, userCanPublishServers } from '../services/userLevelService';
import { logger } from './logger';
import type { User } from '../db';
import {
  buildErrorEnvelope,
  buildSuccessEnvelope,
  getRequestId,
} from '../contracts/responseEnvelope';
import { type BusinessLocale } from '../constants/businessMessages';
import { buildBatchSummary, resolveResponseMessage } from '../contracts/responseSemantics';

export interface PaginatedResponse<T> {
  success: true;
  message: string;
  data: T[];
  requestId?: string;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  timestamp: string;
}

export type DeleteMode = 'soft' | 'hard';

export interface ResourceMessageOptions {
  resource?: string;
  message?: string;
  locale?: BusinessLocale;
}

export interface SendBatchResultItem<T = unknown> {
  id?: number | string;
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ResponseSendOptions {
  mask?: boolean;
}

/**
 * Standard Success Response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200,
  meta?: Record<string, unknown>,
  options?: ResponseSendOptions,
) => {
  const sanitizedData = options?.mask === false ? data : maskData(data);
  const requestId = getRequestId(res.req);
  const responseData = buildSuccessEnvelope(sanitizedData, message, requestId, meta);

  const jsonString = JSON.stringify(responseData, (_, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );

  res.setHeader('Content-Type', 'application/json');
  return res.status(statusCode).send(jsonString);
};

/**
 * Standard Error Response
 */
export const sendError = (res: Response, message: string = 'Error', statusCode: number = 400, errorCode: string = 'BAD_REQUEST', details: any = null) => {
  const isProduction = process.env.NODE_ENV === 'production';
  // 1. In production, mask all 500+ error messages and avoid leaking details for most errors.
  // 2. We only allow details for 400 VALIDATION_ERROR to help the user fix their input.
  const displayMessage = isProduction && statusCode >= 500 ? 'An unexpected server error occurred' : message;
  
  let safeDetails = details;
  if (isProduction) {
    safeDetails = (statusCode === 400 && errorCode === 'VALIDATION_ERROR') ? maskData(details) : null;
  }

  const responseBody = buildErrorEnvelope({
    message: displayMessage,
    code: errorCode,
    statusCode,
    details: safeDetails,
    requestId: getRequestId(res.req),
  });

  // Ensure no sensitive headers are leaked in the response
  res.removeHeader('X-Powered-By');
  
  return res.status(statusCode).json(responseBody);
};

/**
 * Standard Paginated Response
 */
export const sendPaginated = <T>(
  res: Response, 
  data: T[], 
  total: number, 
  page: number, 
  limit: number,
  message: string = 'Success',
  statusCode: number = 200
) => {
  const sanitizedData = maskData(data);
  const totalNum = typeof total === 'bigint' ? Number(total) : total;
  const totalPages = Math.ceil(totalNum / limit);
  const requestId = getRequestId(res.req);
  const resolvedMessage =
    message === 'Success'
      ? resolveResponseMessage(totalNum > 0 ? 'list' : 'empty')
      : message;

  const responseData = buildSuccessEnvelope(sanitizedData, resolvedMessage, requestId, {
    total: totalNum,
    page,
    limit,
    totalPages,
  });

  // Keep strongly typed `meta` shape in docs and callsites.
  (responseData as PaginatedResponse<T>).meta = {
      total: totalNum,
      page,
      limit,
      totalPages,
  };

  try {
    const jsonString = JSON.stringify(responseData, (_, value) => 
      typeof value === 'bigint' ? value.toString() : value
    );

    res.setHeader('Content-Type', 'application/json');
    return res.status(statusCode).send(jsonString);
  } catch (error) {
    logger.error('[Response] Pagination Error', { error });
    return res.status(500).json(buildErrorEnvelope({
      message: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      requestId,
    }));
  }
};

export const sendListResponse = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  options: ResourceMessageOptions & { statusCode?: number } = {},
) => {
  const statusCode = options.statusCode ?? 200;
  const hasRows = (typeof total === 'bigint' ? Number(total) : total) > 0;
  const message = resolveResponseMessage(hasRows ? 'list' : 'empty', options);
  return sendPaginated(res, data, total, page, limit, message, statusCode);
};

export const sendDetailResponse = <T>(
  res: Response,
  data: T,
  options: ResourceMessageOptions & { statusCode?: number; meta?: Record<string, unknown> } = {},
) => {
  return sendSuccess(
    res,
    data,
    resolveResponseMessage('detail', options),
    options.statusCode ?? 200,
    options.meta,
  );
};

export const sendCreatedResponse = <T>(
  res: Response,
  data: T,
  options: ResourceMessageOptions & {
    statusCode?: number;
    location?: string;
    meta?: Record<string, unknown>;
  } = {},
) => {
  if (options.location) {
    res.setHeader('Location', options.location);
  }

  return sendSuccess(
    res,
    data,
    resolveResponseMessage('create', options),
    options.statusCode ?? 201,
    options.meta,
  );
};

export const sendUpdatedResponse = <T>(
  res: Response,
  data: T,
  options: ResourceMessageOptions & { statusCode?: number; meta?: Record<string, unknown> } = {},
) => {
  return sendSuccess(
    res,
    data,
    resolveResponseMessage('update', options),
    options.statusCode ?? 200,
    options.meta,
  );
};

export const sendDeletedResponse = (
  res: Response,
  options: ResourceMessageOptions & {
    statusCode?: number;
    mode?: DeleteMode;
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  } = {},
) => {
  const mode = options.mode ?? 'soft';
  return sendSuccess(
    res,
    {
      deleted: true,
      mode,
      ...(options.data ?? {}),
    },
    resolveResponseMessage(mode === 'hard' ? 'delete_hard' : 'delete', options),
    options.statusCode ?? 200,
    options.meta,
  );
};

export const sendBatchResponse = <T>(
  res: Response,
  results: Array<SendBatchResultItem<T>>,
  options: ResourceMessageOptions & { statusCode?: number; meta?: Record<string, unknown> } = {},
) => {
  const summary = buildBatchSummary(results);

  return sendSuccess(
    res,
    {
      summary,
      results,
    },
    resolveResponseMessage('batch', options),
    options.statusCode ?? 200,
    {
      ...summary,
      ...(options.meta ?? {}),
    },
  );
};

export const sendEmptyResponse = <T>(
  res: Response,
  data: T,
  options: ResourceMessageOptions & { statusCode?: number; meta?: Record<string, unknown> } = {},
) => {
  return sendSuccess(
    res,
    data,
    resolveResponseMessage('empty', options),
    options.statusCode ?? 200,
    {
      empty: true,
      ...(options.meta ?? {}),
    },
  );
};

export const maskEmail = maskEmailUtil;
export const maskPhone = maskPhoneUtil;


export const toSafeUser = (user: any, options: { mask?: boolean; isAdmin?: boolean } = {}) => {
  const mask = options.mask ?? true;
  const isAdmin = options.isAdmin ?? false;
  if (!user) return null;
  
  const { 
    password_hash: _password_hash, 
    verification_token: _verification_token, 
    token_expiry: _token_expiry, 
    email_cipher: _email_cipher,
    supabase_id: _supabase_id,
    salt: _salt,
    secret_key: _secret_key,
    reset_token: _reset_token,
    reset_token_expiry: _reset_token_expiry,
    password_changed_at: _password_changed_at,
    user_ip: _user_ip,
    ...baseSafeUser 
  } = user;
  
  const userObj = { ...baseSafeUser } as Record<string, any>;
  
  if (!options.isAdmin) {
    delete userObj.last_ip;
    delete userObj.login_count;
    delete userObj.internal_notes;
    delete userObj.risk_score;
  }
  
  if (typeof userObj.preferences === 'string') {
    try {
      userObj.preferences = JSON.parse(userObj.preferences);
    } catch (e) {
      logger.warn('[Response] Failed to parse user preferences', { error: String(e) });
      userObj.preferences = {};
    }
  }
  
  if (typeof userObj.permissions === 'string') {
    try {
      userObj.permissions = JSON.parse(userObj.permissions);
    } catch (e) {
      logger.warn('[Response] Failed to parse user permissions', { error: String(e) });
      userObj.permissions = [];
    }
  }
  
  if (mask && !isAdmin) {
    if (userObj.email) userObj.email = maskEmail(userObj.email);
    if (userObj.phone) userObj.phone = maskPhone(userObj.phone);
  }

  if (typeof userObj.experience_points === 'number') {
    return enrichUserWithLevel(userObj);
  }

  return { ...userObj, can_publish: userCanPublishServers(userObj as User) };
};
