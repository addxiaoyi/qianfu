import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import prisma from '../db';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import { ModerationService } from './moderationService';
const ANNOUNCEMENT_KEY_PREFIX = 'PUBLIC_ANNOUNCEMENT:';
export const announcementToneSchema = z.enum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']);
export const announcementStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const nullableText = (max) => z.preprocess((value) => value === '' || value === undefined ? null : value, z.string().trim().max(max).nullable());
const nullableDateTime = z.preprocess((value) => value === '' || value === undefined ? null : value, z.string().datetime({ offset: true }).nullable());
const announcementFields = {
    title: z.string().trim().min(1).max(60),
    message: z.string().trim().min(1).max(300),
    tone: announcementToneSchema.default('INFO'),
    status: announcementStatusSchema.default('DRAFT'),
    linkLabel: nullableText(20),
    linkPath: z.preprocess((value) => value === '' || value === undefined ? null : value, z.string().trim().regex(/^\/(?!\/)[^\s]*$/, 'Announcement links must be same-site paths').max(200).nullable()),
    startsAt: nullableDateTime,
    endsAt: nullableDateTime,
    priority: z.coerce.number().int().min(0).max(100).default(50),
    dismissible: z.boolean().default(true),
};
function validateAnnouncementWindow(value, context) {
    if (value.linkPath && !value.linkLabel) {
        context.addIssue({
            code: 'custom',
            path: ['linkLabel'],
            message: 'Link label is required when a link path is provided',
        });
    }
    if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
        context.addIssue({
            code: 'custom',
            path: ['endsAt'],
            message: 'End time must be later than start time',
        });
    }
}
export const announcementCreateSchema = z.object(announcementFields).strict().superRefine(validateAnnouncementWindow);
export const announcementUpdateSchema = z.object(announcementFields)
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
export const announcementIdSchema = z.string().uuid();
const announcementRecordSchema = announcementCreateSchema.and(z.object({
    id: announcementIdSchema,
    version: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    createdBy: z.number().int().positive(),
    updatedBy: z.number().int().positive(),
}));
function configKey(id) {
    return `${ANNOUNCEMENT_KEY_PREFIX}${id}`;
}
async function assertPublishable(announcement, adminId) {
    if (announcement.status !== 'PUBLISHED')
        return;
    const moderation = await ModerationService.checkText(`${announcement.title}\n${announcement.message}`, adminId);
    if (moderation.passed)
        return;
    throw new AppError(moderation.reason || 'Announcement content did not pass moderation', 422, ErrorCode.VALIDATION_ERROR);
}
function parseStoredAnnouncement(value, key) {
    try {
        const parsed = announcementRecordSchema.safeParse(JSON.parse(value));
        if (parsed.success)
            return parsed.data;
        logger.warn('[Announcement] Ignoring invalid stored announcement', { key });
    }
    catch (error) {
        logger.warn('[Announcement] Ignoring unreadable stored announcement', {
            key,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    return null;
}
export function pickActiveAnnouncement(announcements, now = new Date()) {
    const nowMs = now.getTime();
    return announcements
        .filter((announcement) => {
        if (announcement.status !== 'PUBLISHED')
            return false;
        if (announcement.startsAt && new Date(announcement.startsAt).getTime() > nowMs)
            return false;
        if (announcement.endsAt && new Date(announcement.endsAt).getTime() <= nowMs)
            return false;
        return true;
    })
        .sort((left, right) => right.priority - left.priority || right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}
export async function listAnnouncements() {
    const rows = await prisma.systemConfig.findMany({
        where: { key: { startsWith: ANNOUNCEMENT_KEY_PREFIX } },
        orderBy: { updated_at: 'desc' },
    });
    return rows
        .map((row) => parseStoredAnnouncement(row.value, row.key))
        .filter((row) => row !== null);
}
export async function getAnnouncement(id) {
    const row = await prisma.systemConfig.findUnique({ where: { key: configKey(id) } });
    return row ? parseStoredAnnouncement(row.value, row.key) : null;
}
export async function getCurrentAnnouncement(now = new Date()) {
    return pickActiveAnnouncement(await listAnnouncements(), now);
}
export async function createAnnouncement(input, adminId) {
    await assertPublishable(input, adminId);
    const now = new Date().toISOString();
    const announcement = {
        id: randomUUID(),
        ...input,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: adminId,
        updatedBy: adminId,
    };
    await prisma.systemConfig.create({
        data: {
            key: configKey(announcement.id),
            value: JSON.stringify(announcement),
            is_secret: false,
            description: `Public announcement: ${announcement.title}`,
        },
    });
    return announcement;
}
export async function updateAnnouncement(id, patch, adminId) {
    const before = await getAnnouncement(id);
    if (!before)
        return null;
    const { id: _id, version: _version, createdAt: _createdAt, updatedAt: _updatedAt, createdBy: _createdBy, updatedBy: _updatedBy, ...editable } = before;
    const merged = announcementCreateSchema.parse({ ...editable, ...patch });
    await assertPublishable(merged, adminId);
    const after = {
        ...before,
        ...merged,
        version: before.version + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: adminId,
    };
    await prisma.systemConfig.update({
        where: { key: configKey(id) },
        data: {
            value: JSON.stringify(after),
            description: `Public announcement: ${after.title}`,
        },
    });
    return { before, after };
}
export async function deleteAnnouncement(id) {
    const before = await getAnnouncement(id);
    if (!before)
        return null;
    await prisma.systemConfig.delete({ where: { key: configKey(id) } });
    return before;
}
//# sourceMappingURL=announcementService.js.map