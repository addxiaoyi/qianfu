import { Router } from 'express';
import { logout, changePassword, getRegistrationStats, getSessions, revokeSession, checkUsernameAvailability, login, devLogin, devLogout, forgotPassword, resetPassword, resetPasswordWithToken, } from '../controllers/authController.js';
import { handleGitHubAuthCallback, startGitHubAuth } from '../controllers/githubAuthController.js';
import { sendLoginCode, verifyLoginCode } from '../controllers/authCodeController.js';
import { registerUser } from '../controllers/registerController.js';
import { authLimiter, csrfLimiter, authBruteForceLimiter } from '../middleware/rateLimiter.js';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { csrfProtection, generateCsrfTokens } from '../middleware/csrf.js';
import { sendSuccess } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { validateBody, validateParams } from '../middleware/requestValidation.js';
import { authCodeRequestSchema, authCodeVerifySchema, changePasswordSchema, devAuthLoginSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordCodeSchema, resetPasswordTokenSchema, sessionIdParamSchema, usernameAvailabilitySchema, } from '../utils/validation.js';
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
router.get('/auth/github/start', startGitHubAuth);
router.get('/auth/github/callback', handleGitHubAuthCallback);
router.get('/auth/callback/github', handleGitHubAuthCallback);
router.post('/auth/send-code', csrfProtection, authLimiter, validateBody(authCodeRequestSchema), sendLoginCode);
router.post('/auth/verify-code', csrfProtection, authLimiter, validateBody(authCodeVerifySchema), verifyLoginCode);
router.post('/auth/register', csrfProtection, authLimiter, validateBody(registerSchema), registerUser);
router.post('/auth/login', csrfProtection, authBruteForceLimiter, authLimiter, validateBody(loginSchema), login);
router.post('/auth/forgot-password', csrfProtection, authLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/auth/reset-password', csrfProtection, authBruteForceLimiter, authLimiter, validateBody(resetPasswordCodeSchema), resetPassword);
router.post('/auth/password-reset', csrfProtection, authBruteForceLimiter, authLimiter, validateBody(resetPasswordTokenSchema), resetPasswordWithToken);
router.post('/auth/check-username', csrfProtection, authLimiter, validateBody(usernameAvailabilitySchema), checkUsernameAvailability);
if (process.env.NODE_ENV !== 'production') {
    router.post('/auth/dev-login', csrfProtection, authLimiter, validateBody(devAuthLoginSchema), devLogin);
    router.post('/auth/dev-logout', csrfProtection, authLimiter, devLogout);
}
router.post('/logout', authenticate, csrfProtection, logout);
router.post('/change-password', authenticate, csrfProtection, authBruteForceLimiter, authLimiter, validateBody(changePasswordSchema), changePassword);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:sessionId', authenticate, csrfProtection, validateParams(sessionIdParamSchema), revokeSession);
router.get('/registration-stats', authenticate, hasPermission(['manage_users']), getRegistrationStats);
export default router;
//# sourceMappingURL=auth.js.map