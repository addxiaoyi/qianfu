import { Router } from 'express';
import { getProfile, updateProfile, listBioVersions } from '../controllers/userController';
import { getCheckinStatus, postCheckin } from '../controllers/userLevelController';
import { authenticate } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { userLimiter } from '../middleware/rateLimiter';
import { validateBody, validateQuery } from '../middleware/requestValidation';
import { bioVersionQuerySchema, profileUpdateSchema } from '../utils/validation';
const router = Router();
/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 */
router.get('/profile', userLimiter, authenticate, getProfile);
/**
 * @swagger
 * /api/user/profile/versions:
 *   get:
 *     summary: List bio version history
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Bio version history
 *       401:
 *         description: Authentication required
 */
router.get('/profile/versions', userLimiter, authenticate, validateQuery(bioVersionQuerySchema), listBioVersions);
/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *               display_name:
 *                 type: string
 *                 maxLength: 50
 *               avatar_url:
 *                 type: string
 *                 format: uri
 *               bio_html:
 *                 type: string
 *                 maxLength: 2000
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error or username taken
 *       401:
 *         description: Authentication required
 */
router.put('/profile', userLimiter, authenticate, csrfProtection, validateBody(profileUpdateSchema), updateProfile);
/**
 * @swagger
 * /api/user/user/checkin/status:
 *   get:
 *     summary: Get user check-in status
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Check-in status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     checkedIn:
 *                       type: boolean
 *                     streak:
 *                       type: integer
 *                     lastCheckIn:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Authentication required
 */
router.get('/user/checkin/status', userLimiter, authenticate, getCheckinStatus);
/**
 * @swagger
 * /api/user/user/checkin:
 *   post:
 *     summary: Check-in to earn points
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Check-in successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     points:
 *                       type: integer
 *                     streak:
 *                       type: integer
 *       400:
 *         description: Already checked in today
 *       401:
 *         description: Authentication required
 */
router.post('/user/checkin', userLimiter, authenticate, csrfProtection, postCheckin);
export default router;
//# sourceMappingURL=user.js.map