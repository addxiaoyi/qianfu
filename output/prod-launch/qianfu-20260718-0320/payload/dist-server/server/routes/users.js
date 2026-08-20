import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, (req, res) => {
    const authReq = req;
    res.json({
        success: true,
        message: 'Users endpoint',
        data: {
            currentUser: authReq.user,
        },
    });
});
export default router;
//# sourceMappingURL=users.js.map