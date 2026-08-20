import { Router } from 'express';
import { personalQrListenerNotify } from '../controllers/paymentXpayBridgeController';
import { paymentLimiter } from '../middleware/rateLimiter';
const router = Router();
router.post('/notify', paymentLimiter, personalQrListenerNotify);
export default router;
//# sourceMappingURL=paymentPersonalQr.js.map