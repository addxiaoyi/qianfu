import type { NextFunction, Response } from 'express';
import type { ZodType } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { logDataChange } from '../services/auditService';
import {
  announcementCreateSchema,
  announcementIdSchema,
  announcementUpdateSchema,
  createAnnouncement,
  deleteAnnouncement,
  getCurrentAnnouncement,
  listPublicAnnouncements,
  listAnnouncements,
  updateAnnouncement,
  type AnnouncementRecord,
} from '../services/announcementService';
import { AppError, ErrorCode } from '../utils/errors';
import { sendSuccess } from '../utils/response';

function parseInput<T>(schema: ZodType<T>, input: unknown, message: string): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(message, 400, ErrorCode.VALIDATION_ERROR, true, parsed.error.issues);
  }
  return parsed.data;
}

function requireAdminId(req: AuthRequest): number {
  const adminId = Number(req.user?.id);
  if (!Number.isInteger(adminId) || adminId <= 0) {
    throw new AppError('Administrator identity is unavailable', 403, ErrorCode.FORBIDDEN);
  }
  return adminId;
}

function toPublicAnnouncement(announcement: AnnouncementRecord | null) {
  if (!announcement) return null;
  const {
    createdBy: _createdBy,
    updatedBy: _updatedBy,
    status: _status,
    ...publicAnnouncement
  } = announcement;
  return publicAnnouncement;
}

export async function getPublicAnnouncement(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    return sendSuccess(res, toPublicAnnouncement(await getCurrentAnnouncement()), 'Current announcement retrieved');
  } catch (error) {
    return next(error);
  }
}

export async function getPublicAnnouncements(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    const announcements = await listPublicAnnouncements();
    return sendSuccess(res, announcements.map(toPublicAnnouncement), 'Public news retrieved');
  } catch (error) {
    return next(error);
  }
}

export async function getAdminAnnouncements(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await listAnnouncements(), 'Announcements retrieved');
  } catch (error) {
    return next(error);
  }
}

export async function createAdminAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = parseInput(announcementCreateSchema, req.body, 'Invalid announcement');
    const created = await createAnnouncement(input, requireAdminId(req));
    await logDataChange(req.user?.id ?? null, 'CREATE_ANNOUNCEMENT', `ANNOUNCEMENT:${created.id}`, req, null, created);
    return sendSuccess(res, created, 'Announcement created', 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInput(announcementIdSchema, req.params.id, 'Invalid announcement ID');
    const patch = parseInput(announcementUpdateSchema, req.body, 'Invalid announcement update');
    const updated = await updateAnnouncement(id, patch, requireAdminId(req));
    if (!updated) throw new AppError('Announcement not found', 404, ErrorCode.NOT_FOUND);
    await logDataChange(req.user?.id ?? null, 'UPDATE_ANNOUNCEMENT', `ANNOUNCEMENT:${id}`, req, updated.before, updated.after);
    return sendSuccess(res, updated.after, 'Announcement updated');
  } catch (error) {
    return next(error);
  }
}

export async function deleteAdminAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInput(announcementIdSchema, req.params.id, 'Invalid announcement ID');
    const deleted = await deleteAnnouncement(id);
    if (!deleted) throw new AppError('Announcement not found', 404, ErrorCode.NOT_FOUND);
    await logDataChange(req.user?.id ?? null, 'DELETE_ANNOUNCEMENT', `ANNOUNCEMENT:${id}`, req, deleted, null);
    return sendSuccess(res, { id, deleted: true }, 'Announcement deleted');
  } catch (error) {
    return next(error);
  }
}
