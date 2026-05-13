import { sendSuccess } from '../../utils/response';
import { getMinecraftServerStatus, getMultipleServerStatus } from '../services/minecraftProbeService.js';
import { validateHost } from '../utils/validation';
/**
 * Get Minecraft server status
 * @param req Request object
 * @param res Response object
 * @param next Error passing middleware
 */
export const getServerStatus = async (req, res, next) => {
    try {
        const { host, bedrock } = req.query;
        // Parameter validation (following existing project validation.ts specification)
        if (!host || typeof host !== 'string') {
            throw new Error('Hostname is required');
        }
        const validationError = validateHost(host);
        if (validationError) {
            throw new Error(validationError.message);
        }
        // Call service layer to get server status
        const serverStatus = await getMinecraftServerStatus(host, bedrock === 'true');
        // Return standardized success response (using existing response.ts tools)
        return sendSuccess(res, serverStatus, 'Server status retrieved successfully');
    }
    catch (error) {
        // Pass error to global error handling middleware
        next(error);
    }
};
/**
 * Batch get multiple Minecraft server status (parallel detection)
 * @param req Request object
 * @param res Response object
 * @param next Error passing middleware
 */
export const getMultipleServerStatusHandler = async (req, res, next) => {
    try {
        const { servers, maxConcurrent } = req.body;
        // Parameter validation
        if (!Array.isArray(servers) || servers.length === 0) {
            throw new Error('The servers parameter must be a non-empty array');
        }
        // Security: Validate each server host in batch
        for (const server of servers) {
            if (!server.host || typeof server.host !== 'string') {
                throw new Error('Each server must have a valid host');
            }
            const err = validateHost(server.host);
            if (err)
                throw new Error(`Invalid host ${server.host}: ${err.message}`);
        }
        if (servers.length > 100) {
            throw new Error('A single detection supports a maximum of 100 servers');
        }
        const maxCon = maxConcurrent ? Math.min(Math.max(1, parseInt(maxConcurrent)), 20) : 10;
        // Call service layer to get server status in parallel
        const results = await getMultipleServerStatus(servers, maxCon);
        return sendSuccess(res, { results, total: servers.length }, 'Batch server status retrieved successfully');
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=probeController.js.map