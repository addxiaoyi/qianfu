import { Router } from 'express';
import { logout, changePassword, getRegistrationStats, getSessions, revokeSession, checkUsernameAvailability, login, devLogin, devLogout, } from '../controllers/authController.js';
import { sendLoginCode, verifyLoginCode } from '../controllers/authCodeController.js';
import { registerUser } from '../controllers/registerController.js';
import { authLimiter, csrfLimiter, authBruteForceLimiter } from '../middleware/rateLimiter.js';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { csrfProtection, generateCsrfTokens } from '../middleware/csrf.js';
import { sendSuccess } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { validateBody, validateParams } from '../middleware/requestValidation.js';
import { changePasswordSchema, devAuthLoginSchema, sessionIdParamSchema, usernameAvailabilitySchema, } from '../utils/validation.js';
const router = Router();
router.get('/csrf-token', csrfLimiter, generateCsrfTokens, (req, res) => {
    try {
        const token = req.csrfToken;
        if (!token) {
            logger.error('[CSRF] Token generation failed: token is empty');
            return res.status(503).json({
                success: false,
                error: {
                    message: 'CSRF token service unavailable',
                    code: 'CSRF_TOKEN_GENERATION_FAILED'
                }
            });
        }
        logger.debug('[CSRF] Token generated successfully');
        sendSuccess(res, { csrfToken: token });
    }
    catch (err) {
        logger.error('[CSRF] Error generating token:', { error: err });
        res.status(503).json({
            success: false,
            error: {
                message: 'CSRF token service unavailable',
                code: 'CSRF_INTERNAL_ERROR'
            },
        });
    }
});
router.post('/auth/send-code', csrfProtection, authLimiter, sendLoginCode);
router.post('/auth/verify-code', csrfProtection, authLimiter, verifyLoginCode);
router.post('/auth/register', csrfProtection, authLimiter, registerUser);
router.post('/auth/login', authBruteForceLimiter, authLimiter, login);
router.post('/auth/check-username', csrfProtection, authLimiter, validateBody(usernameAvailabilitySchema), checkUsernameAvailability);
router.post('/auth/dev-login', csrfProtection, authLimiter, validateBody(devAuthLoginSchema), devLogin);
router.post('/auth/dev-logout', csrfProtection, authLimiter, devLogout);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, authBruteForceLimiter, authLimiter, validateBody(changePasswordSchema), changePassword);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:sessionId', authenticate, validateParams(sessionIdParamSchema), revokeSession);
router.get('/registration-stats', authenticate, hasPermission(['manage_users']), getRegistrationStats);
export default router;
//# sourceMappingURL=auth.js.map