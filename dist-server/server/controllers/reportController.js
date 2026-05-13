import prisma from '../db';
import { logAction } from '../services/auditService';
import { AppError, ErrorCode } from '../utils/errors';
import { sendBatchResponse, sendCreatedResponse, sendDetailResponse, sendListResponse, sendUpdatedResponse, } from '../utils/response';
import { getPaginationOptions } from '../utils/pagination';
import { z } from 'zod';
// Validation schemas
const createReportSchema = z.object({
    target_type: z.enum(['SERVER', 'USER']), // NOTE: Add REVIEW and COMMENT when models are implemented
    target_id: z.number().int().positive(),
    reason: z.string().min(5).max(100),
    description: z.string().max(1000).optional(),
});
const updateReportStatusSchema = z.object({
    status: z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED']),
    resolution_notes: z.string().max(1000).optional(),
});
const batchUpdateReportStatusSchema = z.object({
    ids: z.array(z.number().int().positive()),
    status: z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED']),
    resolution_notes: z.string().max(1000).optional(),
});
export const createReport = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const validation = createReportSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, validation.error.format());
        }
        const { target_type, target_id, reason, description } = validation.data;
        // Verify target exists
        let targetExists = false;
        if (target_type === 'SERVER') {
            const server = await prisma.server.findUnique({ where: { id: target_id } });
            if (server)
                targetExists = true;
        }
        else if (target_type === 'USER') {
            const targetUser = await prisma.user.findUnique({ where: { id: target_id } });
            if (targetUser)
                targetExists = true;
        }
        if (!targetExists) {
            throw new AppError(`${target_type} not found`, 404, ErrorCode.NOT_FOUND);
        }
        const report = await prisma.report.create({
            data: {
                reporter_id: user.id,
                target_type,
                target_id,
                reason,
                description,
                status: 'PENDING'
            }
        });
        return sendCreatedResponse(res, report, {
            resource: 'Report',
            location: `/api/v1/reports/${report.id}`,
        });
    }
    catch (error) {
        next(error);
    }
};
export const getReports = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        // Only Admin or Moderator can list all reports.
        const isAdmin = req.isAdmin || user.role === 'ADMIN' || user.role === 'MODERATOR';
        const { page, limit, skip } = getPaginationOptions(req);
        const { status, target_type, reporter_id } = req.query;
        const where = {};
        if (!isAdmin) {
            // Regular user can only see their own reports
            where.reporter_id = user.id;
        }
        else if (reporter_id) {
            // Admin filters
            where.reporter_id = Number(reporter_id);
        }
        if (status)
            where.status = String(status);
        if (target_type)
            where.target_type = String(target_type);
        const [reports, total] = await Promise.all([
            prisma.report.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    reporter: {
                        select: { id: true, username: true, display_name: true, avatar_url: true }
                    },
                    handler: {
                        select: { id: true, username: true, display_name: true }
                    }
                }
            }),
            prisma.report.count({ where })
        ]);
        return sendListResponse(res, reports, total, page, limit, { resource: 'Report' });
    }
    catch (error) {
        next(error);
    }
};
export const getReport = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const report = await prisma.report.findUnique({
            where: { id },
            include: {
                reporter: {
                    select: { id: true, username: true, display_name: true, avatar_url: true }
                },
                handler: {
                    select: { id: true, username: true, display_name: true }
                }
            }
        });
        if (!report)
            throw new AppError('Report not found', 404, ErrorCode.NOT_FOUND);
        const isAdmin = req.isAdmin || user.role === 'ADMIN' || user.role === 'MODERATOR';
        if (!isAdmin && report.reporter_id !== user.id) {
            throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
        }
        return sendDetailResponse(res, report, { resource: 'Report' });
    }
    catch (error) {
        next(error);
    }
};
export const updateReportStatus = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const isAdmin = req.isAdmin || user.role === 'ADMIN' || user.role === 'MODERATOR';
        if (!isAdmin) {
            throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
        }
        const validation = updateReportStatusSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, validation.error.format());
        }
        const { status, resolution_notes } = validation.data;
        const updatedReport = await prisma.report.update({
            where: { id: Number(id) },
            data: {
                status,
                resolution_notes,
                handler_id: user.id
            },
            include: {
                reporter: {
                    select: { id: true, username: true, display_name: true }
                },
                handler: {
                    select: { id: true, username: true, display_name: true }
                }
            }
        });
        // Add Audit Log
        await logAction(user.id, 'UPDATE_REPORT_STATUS', `Report:${id}`, req, {
            new_status: status,
            resolution_notes,
            target_type: updatedReport.target_type,
            target_id: updatedReport.target_id
        });
        // Notify reporter
        if (updatedReport.reporter_id !== user.id) { // Don't notify if admin resolved their own report (rare but possible)
            const notePart = resolution_notes ? ` Note: ${resolution_notes}` : '';
            await prisma.notification.create({
                data: {
                    user_id: updatedReport.reporter_id,
                    title: 'Report Update',
                    content: `Your report about ${updatedReport.target_type} #${updatedReport.target_id} has been updated to ${status}.${notePart}`,
                    type: status === 'RESOLVED' ? 'SUCCESS' : (status === 'REJECTED' ? 'WARNING' : 'INFO')
                }
            });
        }
        return sendUpdatedResponse(res, updatedReport, { resource: 'Report' });
    }
    catch (error) {
        next(error);
    }
};
export const batchUpdateReportStatus = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const isAdmin = req.isAdmin || user.role === 'ADMIN' || user.role === 'MODERATOR';
        if (!isAdmin) {
            throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
        }
        const validation = batchUpdateReportStatusSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, validation.error.format());
        }
        const { ids, status, resolution_notes } = validation.data;
        // Use a transaction to update all reports and log audits - optimized for N+1
        const results = await prisma.$transaction(async (tx) => {
            // 1. Batch update all reports in parallel
            const updatePromises = ids.map(id => tx.report.update({
                where: { id },
                data: {
                    status,
                    resolution_notes,
                    handler_id: user.id
                }
            }));
            const updatedReports = await Promise.all(updatePromises);
            // 2. Identify reporters who need notifications (exclude self)
            const reportersToNotify = updatedReports
                .filter(report => report.reporter_id !== user.id)
                .map(report => ({
                user_id: report.reporter_id,
                report
            }));
            // 3. Batch create notifications if any
            if (reportersToNotify.length > 0) {
                const notePart = resolution_notes ? ` Note: ${resolution_notes}` : '';
                const notificationData = reportersToNotify.map(({ user_id, report }) => ({
                    user_id,
                    title: 'Report Update',
                    content: `Your report about ${report.target_type} #${report.target_id} has been updated to ${status}.${notePart}`,
                    type: status === 'RESOLVED' ? 'SUCCESS' : (status === 'REJECTED' ? 'WARNING' : 'INFO')
                }));
                await tx.notification.createMany({ data: notificationData });
            }
            return updatedReports;
        });
        // Log batch action
        await logAction(user.id, 'BATCH_UPDATE_REPORT_STATUS', `Reports:${ids.join(',')}`, req, {
            new_status: status,
            resolution_notes,
            count: results.length
        });
        return sendBatchResponse(res, results.map((updatedReport) => ({
            id: updatedReport.id,
            success: true,
            data: { status: updatedReport.status },
        })), {
            resource: 'Report',
            meta: { status },
        });
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=reportController.js.map