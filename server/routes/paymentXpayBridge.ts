import { Router } from 'express';
import { xpayGatewayBridgeNotify } from '../controllers/paymentXpayBridgeController';

const router = Router();

router.post('/notify', xpayGatewayBridgeNotify);

export default router;
