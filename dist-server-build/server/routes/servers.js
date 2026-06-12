import { Router } from 'express';
import { getMe, listMyServers, listAllServers, createServer, updateServer, getServer, listVersions, compareServerVersions, rollbackServer, checkServerStatus, deleteServer, } from '../controllers/servers/index.js';
import { getPlayerHistory, listServerComments, postServerComment, deleteServerComment, toggleServerLike, getServerLikeState, } from '../controllers/serverSocialController.js';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/emailVerifiedGuard.js';
import { csrfProtection } from '../middleware/csrf.js';
import { serversLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateParams, validateQuery } from '../middleware/requestValidation.js';
import { checkStatusQuerySchema, compareVersionsQuerySchema, idParamSchema, myServersQuerySchema, paginationQuerySchema, playerHistoryQuerySchema, rollbackSchema, serverCommentBodySchema, serverCommentDeleteParamSchema, serverHistoryQuerySchema, serverSchema, } from '../utils/validation.js';
const router = Router();
const useCsrf = process.env.NODE_ENV !== 'test';
const noopCsrf = (_req, _res, next) => next();
const writeCsrf = useCsrf ? csrfProtection : noopCsrf;
/**
 * @swagger
 * /api/servers/me:
 *   get:
 *     summary: Get current user's server management info
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User server stats
 *       401:
 *         description: Authentication required
 */
router.get('/me', serversLimiter, authenticate, getMe);
/**
 * @swagger
 * /api/servers/servers:
 *   get:
 *     summary: List user's own servers
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of user's servers
 *       401:
 *         description: Authentication required
 */
router.get('/servers', serversLimiter, authenticate, validateQuery(myServersQuerySchema), listMyServers);
/**
 * @swagger
 * /api/servers/public/servers/status:
 *   get:
 *     summary: Check multiple servers status (batch)
 *     tags: [Servers]
 *     parameters:
 *       - in: query
 *         name: hosts
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated server hosts
 *     responses:
 *       200:
 *         description: Server status results
 */
router.get('/public/servers/status', serversLimiter, validateQuery(checkStatusQuerySchema), checkServerStatus);
/**
 * @swagger
 * /api/servers/public/servers:
 *   get:
 *     summary: List all public servers (paginated)
 *     tags: [Servers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [likes, players, createdAt]
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Paginated server list
 */
router.get('/public/servers', serversLimiter, validateQuery(paginationQuerySchema), listAllServers);
/**
 * @swagger
 * /api/servers/public/servers/{id}/player-history:
 *   get:
 *     summary: Get server player history
 *     tags: [Servers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Player history data
 */
router.get('/public/servers/:id/player-history', serversLimiter, validateParams(idParamSchema), validateQuery(playerHistoryQuerySchema), getPlayerHistory);
/**
 * @swagger
 * /api/servers/public/servers/{id}/comments:
 *   get:
 *     summary: List server comments
 *     tags: [Servers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server comments
 */
router.get('/public/servers/:id/comments', serversLimiter, validateParams(idParamSchema), validateQuery(paginationQuerySchema), listServerComments);
/**
 * @swagger
 * /api/servers/public/servers/{id}/like-state:
 *   get:
 *     summary: Get current user's like state for a server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Like state
 */
router.get('/public/servers/:id/like-state', serversLimiter, validateParams(idParamSchema), getServerLikeState);
/**
 * @swagger
 * /api/servers/servers:
 *   post:
 *     summary: Create a new server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - host
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *                 default: 25565
 *               version:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Server created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.post('/servers', serversLimiter, authenticate, requireVerifiedEmail, validateBody(serverSchema), createServer);
/**
 * @swagger
 * /api/servers/servers/{id}:
 *   get:
 *     summary: Get server details
 *     tags: [Servers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server details
 *       404:
 *         description: Server not found
 */
router.get('/servers/:id', serversLimiter, validateParams(idParamSchema), getServer);
/**
 * @swagger
 * /api/servers/servers/{id}:
 *   put:
 *     summary: Update server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               version:
 *                 type: string
 *     responses:
 *       200:
 *         description: Server updated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Server not found
 */
router.put('/servers/:id', serversLimiter, authenticate, requireVerifiedEmail, validateParams(idParamSchema), validateBody(serverSchema), updateServer);
/**
 * @swagger
 * /api/servers/servers/{id}/rollback:
 *   post:
 *     summary: Rollback server to previous version
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - versionId
 *             properties:
 *               versionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rollback successful
 *       403:
 *         description: Not authorized
 */
router.post('/servers/:id/rollback', serversLimiter, authenticate, requireVerifiedEmail, validateParams(idParamSchema), validateBody(rollbackSchema), hasPermission(['manage_content']), rollbackServer);
/**
 * @swagger
 * /api/servers/servers/{id}:
 *   delete:
 *     summary: Delete server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server deleted
 *       403:
 *         description: Not authorized
 */
router.delete('/servers/:id', serversLimiter, authenticate, requireVerifiedEmail, writeCsrf, validateParams(idParamSchema), hasPermission(['manage_content']), deleteServer);
/**
 * @swagger
 * /api/servers/servers/{id}/comments:
 *   post:
 *     summary: Post a comment on server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Comment posted
 *       400:
 *         description: Validation error
 */
router.post('/servers/:id/comments', serversLimiter, authenticate, requireVerifiedEmail, validateParams(idParamSchema), validateBody(serverCommentBodySchema), hasPermission(['comment_servers']), postServerComment);
/**
 * @swagger
 * /api/servers/servers/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 *       403:
 *         description: Not authorized
 */
router.delete('/servers/:id/comments/:commentId', serversLimiter, authenticate, requireVerifiedEmail, validateParams(serverCommentDeleteParamSchema), deleteServerComment);
/**
 * @swagger
 * /api/servers/servers/{id}/like:
 *   post:
 *     summary: Toggle server like
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Like toggled
 *       401:
 *         description: Authentication required
 */
router.post('/servers/:id/like', serversLimiter, authenticate, requireVerifiedEmail, validateParams(idParamSchema), toggleServerLike);
/**
 * @swagger
 * /api/servers/servers/{id}/versions:
 *   get:
 *     summary: List server version history
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Version history
 *       401:
 *         description: Authentication required
 */
router.get('/servers/:id/versions', serversLimiter, authenticate, validateParams(idParamSchema), validateQuery(serverHistoryQuerySchema), hasPermission(['manage_content']), listVersions);
/**
 * @swagger
 * /api/servers/servers/{id}/versions/compare:
 *   get:
 *     summary: Compare two saved versions
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: v1
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: v2
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Version comparison
 */
router.get('/servers/:id/versions/compare', serversLimiter, authenticate, validateParams(idParamSchema), validateQuery(compareVersionsQuerySchema), hasPermission(['manage_content']), compareServerVersions);
export default router;
//# sourceMappingURL=servers.js.map