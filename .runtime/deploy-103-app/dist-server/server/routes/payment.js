import { Router } from 'express';
import { createPayment, getUserPayments, xpayNotify, xpayTenantNotify, payProNotify, tpayNotify, hupijiaoNotify, getPaymentStatus, cancelPayment, manualCompletePayment, getPaymentStats, getAllPayments } from '../controllers/paymentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/emailVerifiedGuard.js';
import { csrfProtection } from '../middleware/csrf.js';
import { paymentLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { verifySignature } from '../middleware/signature.js';
import { validateBody, validateParams, validateQuery } from '../middleware/requestValidation.js';
import { createDuplicateRequestGuard } from '../middleware/idempotency.js';
import { manualPaymentSchema, paymentCreateSchema, paymentQuerySchema, paymentCancelParamSchema, paymentStatsQuerySchema, paymentStatusParamSchema, payProNotifySchema, tpayNotifySchema, hupijiaoNotifySchema, xpayNotifySchema, } from '../utils/validation.js';
const router = Router();
// POST /api/payment/create
router.post('/create', authenticate, requireVerifiedEmail, paymentLimiter, csrfProtection, verifySignature, validateBody(paymentCreateSchema), createPayment);
// GET /api/payment/my
router.get('/my', authenticate, paymentLimiter, validateQuery(paymentQuerySchema), getUserPayments);
// GET /api/payment/status/:orderId
router.get('/status/:orderId', authenticate, paymentLimiter, validateParams(paymentStatusParamSchema), getPaymentStatus);
// POST /api/payment/:orderId/cancel
router.post('/:orderId/cancel', authenticate, paymentLimiter, csrfProtection, createDuplicateRequestGuard({ ttlSeconds: 10 }), validateParams(paymentCancelParamSchema), cancelPayment);
// POST /api/payment/xpay/notify (External callback, NO CSRF)
router.post('/xpay/notify', validateBody(xpayNotifySchema), xpayNotify);
// POST /api/payment/xpay/tenant-notify (External tenant callback, NO CSRF)
router.post('/xpay/tenant-notify', xpayTenantNotify);
// POST /api/payment/paypro/notify (External callback, NO CSRF)
router.post('/paypro/notify', validateBody(payProNotifySchema), payProNotify);
// POST /api/payment/tpay/notify (External callback, NO CSRF)
router.post('/tpay/notify', validateBody(tpayNotifySchema), tpayNotify);
// POST /api/payment/hupijiao/notify (External callback, NO CSRF)
router.post('/hupijiao/notify', validateBody(hupijiaoNotifySchema), hupijiaoNotify);
// Admin only routes
router.get('/admin/list', authenticate, adminLimiter, authorize(['ADMIN']), validateQuery(paymentQuerySchema), getAllPayments);
router.post('/admin/complete-order', authenticate, adminLimiter, authorize(['ADMIN']), csrfProtection, createDuplicateRequestGuard({ ttlSeconds: 10 }), validateBody(manualPaymentSchema), manualCompletePayment);
router.get('/admin/stats', authenticate, adminLimiter, authorize(['ADMIN']), validateQuery(paymentStatsQuerySchema), getPaymentStats);
export default router;
//# sourceMappingURL=payment.js.map