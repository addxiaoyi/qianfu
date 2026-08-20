import { Router } from 'express';
import { personalQrListenerNotify } from '../controllers/paymentXpayBridgeController.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
const router = Router();
router.post('/notify', paymentLimiter, personalQrListenerNotify);
export default router;
//# sourceMappingURL=paymentPersonalQr.js.map