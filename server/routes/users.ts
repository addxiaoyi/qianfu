import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({
    success: true,
    message: 'Users endpoint',
    data: {
      currentUser: authReq.user,
    },
  });
});

export default router;
