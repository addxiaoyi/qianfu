import { logDataChange } from '../services/auditService';
import { announcementCreateSchema, announcementIdSchema, announcementUpdateSchema, createAnnouncement, deleteAnnouncement, getCurrentAnnouncement, listAnnouncements, updateAnnouncement, } from '../services/announcementService';
import { AppError, ErrorCode } from '../utils/errors';
import { sendSuccess } from '../utils/response';
function parseInput(schema, input, message) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        throw new AppError(message, 400, ErrorCode.VALIDATION_ERROR, true, parsed.error.issues);
    }
    return parsed.data;
}
function requireAdminId(req) {
    const adminId = Number(req.user?.id);
    if (!Number.isInteger(adminId) || adminId <= 0) {
        throw new AppError('Administrator identity is unavailable', 403, ErrorCode.FORBIDDEN);
    }
    return adminId;
}
function toPublicAnnouncement(announcement) {
    if (!announcement)
        return null;
    const { createdBy: _createdBy, updatedBy: _updatedBy, status: _status, ...publicAnnouncement } = announcement;
    return publicAnnouncement;
}
export async function getPublicAnnouncement(_req, res, next) {
    try {
        res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
        return sendSuccess(res, toPublicAnnouncement(await getCurrentAnnouncement()), 'Current announcement retrieved');
    }
    catch (error) {
        return next(error);
    }
}
export async function getAdminAnnouncements(_req, res, next) {
    try {
        return sendSuccess(res, await listAnnouncements(), 'Announcements retrieved');
    }
    catch (error) {
        return next(error);
    }
}
export async function createAdminAnnouncement(req, res, next) {
    try {
        const input = parseInput(announcementCreateSchema, req.body, 'Invalid announcement');
        const created = await createAnnouncement(input, requireAdminId(req));
        await logDataChange(req.user?.id ?? null, 'CREATE_ANNOUNCEMENT', `ANNOUNCEMENT:${created.id}`, req, null, created);
        return sendSuccess(res, created, 'Announcement created', 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function updateAdminAnnouncement(req, res, next) {
    try {
        const id = parseInput(announcementIdSchema, req.params.id, 'Invalid announcement ID');
        const patch = parseInput(announcementUpdateSchema, req.body, 'Invalid announcement update');
        const updated = await updateAnnouncement(id, patch, requireAdminId(req));
        if (!updated)
            throw new AppError('Announcement not found', 404, ErrorCode.NOT_FOUND);
        await logDataChange(req.user?.id ?? null, 'UPDATE_ANNOUNCEMENT', `ANNOUNCEMENT:${id}`, req, updated.before, updated.after);
        return sendSuccess(res, updated.after, 'Announcement updated');
    }
    catch (error) {
        return next(error);
    }
}
export async function deleteAdminAnnouncement(req, res, next) {
    try {
        const id = parseInput(announcementIdSchema, req.params.id, 'Invalid announcement ID');
        const deleted = await deleteAnnouncement(id);
        if (!deleted)
            throw new AppError('Announcement not found', 404, ErrorCode.NOT_FOUND);
        await logDataChange(req.user?.id ?? null, 'DELETE_ANNOUNCEMENT', `ANNOUNCEMENT:${id}`, req, deleted, null);
        return sendSuccess(res, { id, deleted: true }, 'Announcement deleted');
    }
    catch (error) {
        return next(error);
    }
}
//# sourceMappingURL=announcementController.js.map