import type { NextFunction, Response } from 'express';
import type { ZodType } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { logDataChange } from '../services/auditService';
import {
  approveNewsSubmission,
  createNewsSubmission,
  listNewsSubmissionsForReview,
  listOwnNewsSubmissions,
  newsSubmissionCreateSchema,
  newsSubmissionIdSchema,
  rejectionReasonSchema,
  rejectNewsSubmission,
  updateOwnNewsSubmission,
} from '../services/newsSubmissionService';
import { AppError, ErrorCode } from '../utils/errors';
import { sendCreatedResponse, sendSuccess, sendUpdatedResponse } from '../utils/response';

function parseInput<T>(schema: ZodType<T>, input: unknown, message: string): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError(message, 400, ErrorCode.VALIDATION_ERROR, true, parsed.error.issues);
  return parsed.data;
}

function requireUserId(req: AuthRequest): number {
  const userId = Number(req.user?.id);
  if (!Number.isInteger(userId) || userId <= 0) throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
  return userId;
}

function requireAdminId(req: AuthRequest): number {
  const adminId = requireUserId(req);
  if (!req.isAdmin) throw new AppError('Admin access required', 403, ErrorCode.FORBIDDEN);
  return adminId;
}

export async function getOwnNewsSubmissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await listOwnNewsSubmissions(requireUserId(req)), '投稿记录已读取');
  } catch (error) { return next(error); }
}

export async function createOwnNewsSubmission(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const created = await createNewsSubmission(requireUserId(req), parseInput(newsSubmissionCreateSchema, req.body, '投稿内容无效'));
    await logDataChange(req.user?.id ?? null, 'CREATE_NEWS_SUBMISSION', `NEWS_SUBMISSION:${created.id}`, req, null, created);
    return sendCreatedResponse(res, created, { resource: 'NewsSubmission' });
  } catch (error) { return next(error); }
}

export async function updateOwnNewsSubmissionController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInput(newsSubmissionIdSchema, req.params.id, '投稿编号无效');
    const updated = await updateOwnNewsSubmission(requireUserId(req), id, parseInput(newsSubmissionCreateSchema, req.body, '投稿内容无效'));
    await logDataChange(req.user?.id ?? null, 'UPDATE_NEWS_SUBMISSION', `NEWS_SUBMISSION:${id}`, req, null, updated);
    return sendUpdatedResponse(res, updated, { resource: 'NewsSubmission' });
  } catch (error) { return next(error); }
}

export async function getNewsSubmissionsForReview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    requireAdminId(req);
    return sendSuccess(res, await listNewsSubmissionsForReview(), '待审核投稿已读取');
  } catch (error) { return next(error); }
}

export async function approveNewsSubmissionController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInput(newsSubmissionIdSchema, req.params.id, '投稿编号无效');
    const approved = await approveNewsSubmission(id, requireAdminId(req));
    await logDataChange(req.user?.id ?? null, 'APPROVE_NEWS_SUBMISSION', `NEWS_SUBMISSION:${id}`, req, null, approved);
    return sendUpdatedResponse(res, approved, { resource: 'NewsSubmission' });
  } catch (error) { return next(error); }
}

export async function rejectNewsSubmissionController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInput(newsSubmissionIdSchema, req.params.id, '投稿编号无效');
    const { reason } = parseInput(rejectionReasonSchema, req.body, '驳回原因无效');
    const rejected = await rejectNewsSubmission(id, requireAdminId(req), reason);
    await logDataChange(req.user?.id ?? null, 'REJECT_NEWS_SUBMISSION', `NEWS_SUBMISSION:${id}`, req, null, rejected);
    return sendUpdatedResponse(res, rejected, { resource: 'NewsSubmission' });
  } catch (error) { return next(error); }
}
