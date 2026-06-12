import { Router } from 'express';
import multer from 'multer';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import { listPaymentProjects, getPaymentProjectDiagnostics, getPaymentProjectXpayTenant, syncPaymentProjectXpayTenant, uploadPaymentProjectXpayTenantQr, upsertPaymentProject, deletePaymentProject, createPaymentProjectTestOrder, getPaymentProjectOrder, simulatePaymentProjectOrderSuccess, } from '../controllers/paymentProjectController.js';
const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Number.parseInt(process.env.XPAY_QR_UPLOAD_LIMIT_BYTES || String(3 * 1024 * 1024), 10),
    },
});
router.use(authenticate);
router.use(adminLimiter);
router.use(hasPermission(['system_config']));
router.get('/', listPaymentProjects);
router.get('/:projectKey/diagnostics', getPaymentProjectDiagnostics);
router.get('/:projectKey/xpay-tenant', getPaymentProjectXpayTenant);
router.get('/:projectKey/orders/:orderId', getPaymentProjectOrder);
router.post('/:projectKey/xpay-tenant/sync', csrfProtection, syncPaymentProjectXpayTenant);
router.post('/:projectKey/xpay-tenant/payment-methods/:payType/qr', csrfProtection, upload.single('file'), uploadPaymentProjectXpayTenantQr);
router.put('/:projectKey', csrfProtection, upsertPaymentProject);
router.post('/:projectKey/test-order', csrfProtection, createPaymentProjectTestOrder);
router.post('/:projectKey/orders/:orderId/simulate-success', csrfProtection, simulatePaymentProjectOrderSuccess);
router.delete('/:projectKey', csrfProtection, deletePaymentProject);
export default router;
//# sourceMappingURL=paymentProjects.js.map