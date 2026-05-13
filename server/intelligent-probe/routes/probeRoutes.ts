import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getServerStatus, getMultipleServerStatusHandler } from '../controllers/probeController';
import {
  createServerStatusController,
  getServerStatusByIdController,
  getServerStatusByServerIdController,
  updateServerStatusController,
  deleteServerStatusController,
} from '../controllers/serverStatusController.js';
import {
  createServerController,
  getServerByIdController,
  getAllServersController,
  updateServerController,
  deleteServerController,
} from '../controllers/serverController.js';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Strict rate limiting to prevent DoS attacks
// Use express-rate-limit default keyGenerator (IPv6-safe) — app sets trust proxy so req.ip is correct
const statusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Reduced from 60 to 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to status API' },
});

const batchStatusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Reduced from 5 to 3 requests per minute (batch interface is very expensive)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to batch status API' },
});

/**
 * @route GET /api/intelligent-probe/status
 * @description Get Minecraft server status
 * @query {string} host - Server address
 * @query {boolean} [bedrock=false] - Whether it is a Bedrock server
 * @returns {object} Server status information
 */
router.get('/status', statusLimiter, getServerStatus);

/**
 * @route POST /api/intelligent-probe/status/batch
 * @description Batch get multiple Minecraft server status (parallel detection)
 * @body {Array<{host: string, bedrock: boolean, id?: string}>} servers - Server list
 * @body {number} [maxConcurrent=10] - Maximum concurrent number (1-20)
 * @returns {object} Batch server status results
 */
router.post('/status/batch', batchStatusLimiter, getMultipleServerStatusHandler);

/**
 * @route POST /api/intelligent-probe/server-status
 * @description Create new server status record
 */
router.post('/server-status', authenticate, createServerStatusController);

/**
 * @route GET /api/intelligent-probe/server-status/:id
 * @description Get server status record by ID
 */
router.get('/server-status/:id', authenticate, getServerStatusByIdController);

/**
 * @route GET /api/intelligent-probe/server-status/server/:serverId
 * @description Get server status record by serverId
 */
router.get('/server-status/server/:serverId', authenticate, getServerStatusByServerIdController);

/**
 * @route PUT /api/intelligent-probe/server-status/:id
 * @description Update existing server status record
 */
router.put('/server-status/:id', authenticate, updateServerStatusController);

/**
 * @route DELETE /api/intelligent-probe/server-status/:id
 * @description Delete server status record
 */
router.delete('/server-status/:id', authenticate, deleteServerStatusController);

/**
 * @route POST /api/intelligent-probe/server
 * @description Create new server record
 */
router.post('/server', authenticate, createServerController);

/**
 * @route GET /api/intelligent-probe/server/:id
 * @description Get server record by ID
 */
router.get('/server/:id', authenticate, getServerByIdController);

/**
 * @route GET /api/intelligent-probe/server
 * @description Get all server records
 */
router.get('/server', authenticate, getAllServersController);

/**
 * @route PUT /api/intelligent-probe/server/:id
 * @description Update existing server record
 */
router.put('/server/:id', authenticate, updateServerController);

/**
 * @route DELETE /api/intelligent-probe/server/:id
 * @description Delete server record
 */
router.delete('/server/:id', authenticate, deleteServerController);

export default router;
