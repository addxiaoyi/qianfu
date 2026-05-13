import { promisify } from 'util';
import dns from 'dns';
import { checkStatusQuerySchema, validateHost, isPrivateIP } from '../../utils/validation';
import { AppError, ErrorCode, handleError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import { getMinecraftServerStatus } from '../../intelligent-probe/services/minecraftProbeService';
import { tryRecordServerStatusHistory } from '../../services/serverStatusHistoryService';
import localPrisma from '../../localDb';
const lookup = promisify(dns.lookup);
/**
 * Normalize host key for comparison
 */
function normalizeHostKey(h) {
    return h.trim().toLowerCase().replace(/^https?:\/\//, '');
}
/**
 * Check Minecraft server status with SSRF protection
 */
export const checkServerStatus = async (req, res, next) => {
    try {
        const validation = checkStatusQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { host, bedrock, serverId } = validation.data;
        // 1. Basic format validation
        const validationError = validateHost(host);
        if (validationError) {
            throw new AppError(validationError.message, 400, ErrorCode.VALIDATION_ERROR);
        }
        // Extract hostname without port for DNS lookup
        const hostname = host.split(':')[0];
        // 2. Resolve DNS and check for private IPs (SSRF protection)
        try {
            const result = await lookup(hostname);
            const address = typeof result === 'string' ? result : result.address;
            if (isPrivateIP(address)) {
                throw new AppError('Access to internal network addresses is forbidden', 403, ErrorCode.FORBIDDEN);
            }
        }
        catch (dnsError) {
            const err = dnsError;
            if (err.code === 'ENOTFOUND') {
                throw new AppError('Hostname could not be resolved', 400, ErrorCode.VALIDATION_ERROR);
            }
            throw dnsError;
        }
        // 3. Call intelligent probe service
        const status = await getMinecraftServerStatus(host, bedrock);
        if (serverId) {
            const srv = await localPrisma.server.findFirst({
                where: { id: serverId, review_status: 'APPROVED' },
                select: { id: true, ip: true },
            });
            if (srv?.ip && srv.ip !== 'Hidden') {
                const probeKey = normalizeHostKey(host);
                const serverKey = normalizeHostKey(srv.ip.split(',')[0].trim());
                if (probeKey === serverKey) {
                    void tryRecordServerStatusHistory(srv.id, status);
                }
            }
        }
        return sendSuccess(res, status, 'Server status retrieved successfully');
    }
    catch (error) {
        next(handleError(error));
    }
};
//# sourceMappingURL=status.js.map