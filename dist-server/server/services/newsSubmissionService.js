import { z } from 'zod';
import prisma from '../db.js';
import { announcementCreateSchema, createAnnouncement, isAnnouncementAllowedInPersonalFiling, MAX_ANNOUNCEMENT_MESSAGE_LENGTH, } from './announcementService.js';
import { AppError, ErrorCode } from '../utils/errors.js';
export const newsSubmissionStatusSchema = z.enum(['PENDING', 'REJECTED', 'APPROVED']);
export const newsSubmissionCreateSchema = z.object({
    title: z.string().trim().min(1, '标题不能为空').max(60, '标题不能超过 60 个字'),
    message: z.string().trim().min(1, '正文不能为空').max(MAX_ANNOUNCEMENT_MESSAGE_LENGTH, '正文不能超过 20000 个字'),
}).strict().superRefine((input, context) => {
    const candidate = announcementCreateSchema.safeParse({
        ...input,
        tone: 'INFO',
        status: 'DRAFT',
        linkLabel: null,
        linkPath: null,
        startsAt: null,
        endsAt: null,
        priority: 50,
        dismissible: true,
    });
    if (!candidate.success) {
        for (const issue of candidate.error.issues) {
            context.addIssue({
                code: 'custom',
                path: issue.path,
                message: issue.message,
            });
        }
    }
    if (!isAnnouncementAllowedInPersonalFiling({ ...input, linkLabel: null, linkPath: null })) {
        context.addIssue({
            code: 'custom',
            path: ['message'],
            message: '个人备案模式下，投稿不得宣传支付、钱包、商城、推广或其他交易服务',
        });
    }
});
export const rejectionReasonSchema = z.object({
    reason: z.string().trim().min(2, '驳回原因至少需要 2 个字').max(500, '驳回原因不能超过 500 个字'),
}).strict();
export const newsSubmissionIdSchema = z.string().uuid();
function toView(row) {
    const status = newsSubmissionStatusSchema.parse(row.status);
    return {
        id: row.id,
        userId: row.user_id,
        authorName: row.author?.display_name || row.author?.username || null,
        title: row.title,
        message: row.message,
        status,
        rejectionReason: row.rejection_reason,
        announcementId: row.announcement_id,
        reviewedAt: row.reviewed_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}
async function getSubmission(id) {
    return prisma.newsSubmission.findUnique({
        where: { id },
        include: { author: { select: { username: true, display_name: true } } },
    });
}
export async function listOwnNewsSubmissions(userId) {
    const rows = await prisma.newsSubmission.findMany({
        where: { user_id: userId },
        include: { author: { select: { username: true, display_name: true } } },
        orderBy: { updated_at: 'desc' },
    });
    return rows.map(toView);
}
export async function createNewsSubmission(userId, input) {
    const row = await prisma.newsSubmission.create({
        data: {
            user_id: userId,
            title: input.title,
            message: input.message,
            status: 'PENDING',
        },
        include: { author: { select: { username: true, display_name: true } } },
    });
    return toView(row);
}
export async function updateOwnNewsSubmission(userId, id, input) {
    const current = await getSubmission(id);
    if (!current || current.user_id !== userId) {
        throw new AppError('投稿不存在或无权访问', 404, ErrorCode.NOT_FOUND);
    }
    if (current.status !== 'PENDING' && current.status !== 'REJECTED') {
        throw new AppError('Only pending or rejected submissions can be edited', 409, ErrorCode.CONFLICT);
    }
    const row = await prisma.newsSubmission.update({
        where: { id },
        data: {
            title: input.title,
            message: input.message,
            status: 'PENDING',
            rejection_reason: null,
            reviewed_by: null,
            reviewed_at: null,
        },
        include: { author: { select: { username: true, display_name: true } } },
    });
    return toView(row);
}
export async function listNewsSubmissionsForReview() {
    const rows = await prisma.newsSubmission.findMany({
        where: { status: 'PENDING' },
        include: { author: { select: { username: true, display_name: true } } },
        orderBy: { created_at: 'asc' },
    });
    return rows.map(toView);
}
export async function approveNewsSubmission(id, adminId) {
    const current = await getSubmission(id);
    if (!current)
        throw new AppError('投稿不存在', 404, ErrorCode.NOT_FOUND);
    if (current.status === 'APPROVED')
        return toView(current);
    if (current.status !== 'PENDING') {
        throw new AppError('只有待审核投稿可以通过', 409, ErrorCode.CONFLICT);
    }
    const announcement = await createAnnouncement({
        title: current.title,
        message: current.message,
        tone: 'INFO',
        status: 'PUBLISHED',
        linkLabel: null,
        linkPath: null,
        startsAt: null,
        endsAt: null,
        priority: 50,
        dismissible: true,
    }, adminId);
    const row = await prisma.newsSubmission.update({
        where: { id },
        data: {
            status: 'APPROVED',
            announcement_id: announcement.id,
            reviewed_by: adminId,
            reviewed_at: new Date(),
            rejection_reason: null,
        },
        include: { author: { select: { username: true, display_name: true } } },
    });
    return toView(row);
}
export async function rejectNewsSubmission(id, adminId, rejectionReason) {
    const current = await getSubmission(id);
    if (!current)
        throw new AppError('投稿不存在', 404, ErrorCode.NOT_FOUND);
    if (current.status !== 'PENDING') {
        throw new AppError('只有待审核投稿可以驳回', 409, ErrorCode.CONFLICT);
    }
    const reason = rejectionReason.trim();
    if (!reason)
        throw new AppError('驳回原因不能为空', 400, ErrorCode.VALIDATION_ERROR);
    const row = await prisma.newsSubmission.update({
        where: { id },
        data: {
            status: 'REJECTED',
            rejection_reason: reason,
            reviewed_by: adminId,
            reviewed_at: new Date(),
        },
        include: { author: { select: { username: true, display_name: true } } },
    });
    return toView(row);
}
//# sourceMappingURL=newsSubmissionService.js.map