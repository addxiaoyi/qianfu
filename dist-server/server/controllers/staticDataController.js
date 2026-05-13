import prisma from '../db';
import { sendPaginated } from '../utils/response';
import { staticDataQuerySchema } from '../utils/validation';
import { AppError, ErrorCode } from '../utils/errors';
export const getAllTeamMembers = async (req, res, next) => {
    try {
        const validation = staticDataQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR);
        }
        const { page, limit } = validation.data;
        const skip = (page - 1) * limit;
        const [members, total] = await Promise.all([
            prisma.teamMember.findMany({
                orderBy: { created_at: 'asc' },
                skip,
                take: limit
            }),
            prisma.teamMember.count()
        ]);
        return sendPaginated(res, members, total, page, limit);
    }
    catch (error) {
        next(error);
    }
};
export const getAllAllianceGroups = async (req, res, next) => {
    try {
        const validation = staticDataQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR);
        }
        const { page, limit } = validation.data;
        const skip = (page - 1) * limit;
        const [groups, total] = await Promise.all([
            prisma.allianceGroup.findMany({
                orderBy: { created_at: 'asc' },
                skip,
                take: limit
            }),
            prisma.allianceGroup.count()
        ]);
        return sendPaginated(res, groups, total, page, limit);
    }
    catch (error) {
        next(error);
    }
};
export const getAllResourceLinks = async (req, res, next) => {
    try {
        const validation = staticDataQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR);
        }
        const { page, limit } = validation.data;
        const skip = (page - 1) * limit;
        const [links, total] = await Promise.all([
            prisma.resourceLink.findMany({
                orderBy: { category: 'asc', title: 'asc' },
                skip,
                take: limit
            }),
            prisma.resourceLink.count()
        ]);
        return sendPaginated(res, links, total, page, limit);
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=staticDataController.js.map