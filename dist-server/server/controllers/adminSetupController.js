import prisma from '../db';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { AppError, ErrorCode } from '../utils/errors';
import { PERMISSION_GROUPS } from '../config/permissionGroups';
import { logDataChange } from '../services/auditService';
import { setupSoleAdminSchema } from '../utils/validation';
const ALLOWED_SETUP_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
// Initialize system administrator
// Special administrative function requiring system-level privileges
export const setupSoleAdmin = async (req, res, next) => {
    try {
        // Enforce IP restrictions (local or whitelisted IPs only)
        const clientIp = req.ip || req.socket.remoteAddress || '';
        const configuredIps = process.env.ADMIN_SETUP_ALLOW_IPS ? process.env.ADMIN_SETUP_ALLOW_IPS.split(',') : [];
        const allowedIps = [...ALLOWED_SETUP_IPS, ...configuredIps];
        if (!allowedIps.includes(clientIp) && process.env.NODE_ENV === 'production') {
            logger.warn(`[Security] Blocked setup-sole-admin attempt from IP ${clientIp}`);
            throw new AppError('Forbidden: Access denied from this IP', 403, ErrorCode.FORBIDDEN);
        }
        // Verify caller authentication
        const callerUser = req.user;
        if (!callerUser && !req.isAdmin) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        // Validate system setup token to prevent unauthorized access
        const setupToken = req.headers['x-system-setup-token'];
        const expectedToken = process.env.SYSTEM_SETUP_TOKEN;
        if (!expectedToken || !setupToken || setupToken !== expectedToken) {
            logger.warn(`[Security] Unauthorized setup-sole-admin attempt by user ${callerUser?.username || 'SystemToken'} from IP ${req.ip}`);
            throw new AppError('Forbidden: Invalid system setup token', 403, ErrorCode.FORBIDDEN);
        }
        const validation = setupSoleAdminSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: validation.error.issues,
            });
        }
        const { targetUsername, targetEmail } = validation.data;
        // Locate target user
        const targetUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: targetUsername },
                    { email: targetEmail }
                ]
            }
        });
        if (!targetUser) {
            throw new AppError('Target user not found', 404, ErrorCode.NOT_FOUND);
        }
        logger.info(`[AdminSetup] Starting sole admin setup for: ${targetUser.username} (${logger.maskData(targetUser.email)})`);
        // Revoke administrative privileges from other users
        const demoteResult = await prisma.user.updateMany({
            where: {
                role: 'ADMIN',
                id: { not: targetUser.id }
            },
            data: {
                role: 'NORMAL',
                permissions: JSON.stringify([])
            }
        });
        logger.info(`[AdminSetup] Removed ${demoteResult.count} other admins`);
        // Assign administrative privileges to target user
        const adminPermissions = PERMISSION_GROUPS['ADMIN'].permissions;
        const updatedUser = await prisma.user.update({
            where: { id: targetUser.id },
            data: {
                role: 'ADMIN',
                permissions: JSON.stringify(adminPermissions)
            }
        });
        logger.info(`[AdminSetup] ${targetUser.username} is now the sole admin`);
        await logDataChange(callerUser?.id || null, 'SETUP_SOLE_ADMIN', 'user_setup', req, {
            demotedCount: demoteResult.count,
            targetUser: { id: targetUser.id, username: targetUser.username }
        }, updatedUser);
        // Verify setup results
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { id: true, username: true, email: true, role: true },
            take: 100
        });
        const result = {
            success: admins.length === 1 && admins[0].id === targetUser.id,
            targetUser: {
                id: targetUser.id,
                username: targetUser.username,
                email: targetUser.email,
                role: 'ADMIN'
            },
            demotedUsers: demoteResult.count,
            currentAdmins: admins
        };
        if (result.success) {
            logger.info('[AdminSetup] Setup successful');
            return sendSuccess(res, result, 'Admin setup successful');
        }
        else {
            logger.error('[AdminSetup] Setup failed, multiple admins detected');
            throw new AppError('Admin setup partially failed', 500, ErrorCode.INTERNAL_ERROR);
        }
    }
    catch (error) {
        logger.error('[AdminSetup] Error:', {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
};
// Get current administrator status
export const getAdminStatus = async (req, res, next) => {
    try {
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                created_at: true,
                last_login_at: true
            },
            take: 100
        });
        const result = {
            totalAdmins: admins.length,
            admins: admins,
            isSoleAdmin: admins.length === 1
        };
        return sendSuccess(res, result, 'Admin status retrieved successfully');
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=adminSetupController.js.map