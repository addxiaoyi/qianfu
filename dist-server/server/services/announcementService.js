import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import prisma from '../db.js';
import { logger } from '../utils/logger.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { ModerationService } from './moderationService.js';
import { getR2StorageConfig } from './r2StorageService.js';
const ANNOUNCEMENT_KEY_PREFIX = 'PUBLIC_ANNOUNCEMENT:';
const ANNOUNCEMENT_IMAGE_MARKDOWN = /!\[([^\]\r\n]{0,120})\]\(([^)\s]+)\)/g;
export const MAX_ANNOUNCEMENT_MESSAGE_LENGTH = 20_000;
const PERSONAL_FILING_COMMERCIAL_PATTERN = /支付|充值|钱包|商城|推广|返利|交易|订单|退款|账单|收费|付款/i;
const PERSONAL_FILING_DISCLAIMER_PATTERN = /(?:本站|平台|当前站点)?不提供[^。；\n]{0,120}(?:服务|功能)/g;
export const announcementToneSchema = z.enum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']);
export const announcementStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const nullableText = (max) => z.preprocess((value) => value === '' || value === undefined ? null : value, z.string().trim().max(max).nullable());
const nullableDateTime = z.preprocess((value) => value === '' || value === undefined ? null : value, z.string().datetime({ offset: true }).nullable());
const announcementFields = {
    title: z.string().trim().min(1).max(60),
    message: z.string().trim().min(1).max(MAX_ANNOUNCEMENT_MESSAGE_LENGTH),
    tone: announcementToneSchema.default('INFO'),
    status: announcementStatusSchema.default('DRAFT'),
    linkLabel: nullableText(20),
    linkPath: z.preprocess((value) => value === '' || value === undefined ? null : value, z.string().trim().regex(/^\/(?!\/)[^\s]*$/, 'Announcement links must be same-site paths').max(200).nullable()),
    startsAt: nullableDateTime,
    endsAt: nullableDateTime,
    priority: z.coerce.number().int().min(0).max(100).default(50),
    dismissible: z.boolean().default(true),
};
export function isAllowedAnnouncementImageUrl(value) {
    const config = getR2StorageConfig();
    if (!config.enabled)
        return false;
    try {
        const base = new URL(config.publicBaseUrl);
        const candidate = new URL(value);
        const basePath = base.pathname.replace(/\/+$/, '') || '/';
        const pathPrefix = basePath === '/' ? '/' : `${basePath}/`;
        return candidate.protocol === 'https:'
            && candidate.origin === base.origin
            && !candidate.username
            && !candidate.password
            && candidate.pathname.startsWith(pathPrefix);
    }
    catch {
        return false;
    }
}
function validateAnnouncementImages(message, context) {
    ANNOUNCEMENT_IMAGE_MARKDOWN.lastIndex = 0;
    for (const match of message.matchAll(ANNOUNCEMENT_IMAGE_MARKDOWN)) {
        const imageUrl = match[2];
        if (!isAllowedAnnouncementImageUrl(imageUrl)) {
            context.addIssue({
                code: 'custom',
                path: ['message'],
                message: '新闻图片必须来自已配置的 R2 公共地址',
            });
        }
    }
    ANNOUNCEMENT_IMAGE_MARKDOWN.lastIndex = 0;
}
function validateAnnouncementWindow(value, context) {
    if (value.message)
        validateAnnouncementImages(value.message, context);
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
export function isAnnouncementAllowedInPersonalFiling(announcement) {
    if (process.env.PERSONAL_FILING_MODE !== 'true')
        return true;
    const searchableText = [
        announcement.title,
        announcement.message,
        announcement.linkLabel,
        announcement.linkPath,
    ].filter(Boolean).join('\n').replace(PERSONAL_FILING_DISCLAIMER_PATTERN, '');
    return !PERSONAL_FILING_COMMERCIAL_PATTERN.test(searchableText);
}
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
    if (!isAnnouncementAllowedInPersonalFiling(announcement)) {
        throw new AppError('个人备案模式下，新闻不得宣传支付、钱包、商城、推广或其他交易服务', 422, ErrorCode.VALIDATION_ERROR);
    }
    if (announcement.status !== 'PUBLISHED')
        return;
    const moderation = await ModerationService.checkText(`${announcement.title}\n${announcement.message}`, adminId);
    if (moderation.passed)
        return;
    throw new AppError(moderation.reason || 'Announcement content did not pass moderation', 422, ErrorCode.VALIDATION_ERROR);
}
function parseStoredAnnouncement(value, key) {
    try {
        const parsed = announcementRecordSchema.safeParse((() => { try {
            return JSON.parse(value);
        }
        catch {
            return null;
        } })());
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
    return filterPublicAnnouncements(announcements, now)[0] ?? null;
}
export function filterPublicAnnouncements(announcements, now = new Date()) {
    const nowMs = now.getTime();
    return announcements
        .filter((announcement) => {
        if (!isAnnouncementAllowedInPersonalFiling(announcement))
            return false;
        if (announcement.status !== 'PUBLISHED')
            return false;
        if (announcement.startsAt && new Date(announcement.startsAt).getTime() > nowMs)
            return false;
        if (announcement.endsAt && new Date(announcement.endsAt).getTime() <= nowMs)
            return false;
        return true;
    })
        .sort((left, right) => right.priority - left.priority || right.updatedAt.localeCompare(left.updatedAt));
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
export async function listPublicAnnouncements(now = new Date()) {
    return filterPublicAnnouncements(await listAnnouncements(), now);
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