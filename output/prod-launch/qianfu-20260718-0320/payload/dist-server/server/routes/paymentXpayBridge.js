import { Router } from 'express';
import { xpayGatewayBridgeNotify } from '../controllers/paymentXpayBridgeController.js';
const router = Router();
router.post('/notify', xpayGatewayBridgeNotify);
export default router;
//# sourceMappingURL=paymentXpayBridge.js.map