import { Router } from 'express';
import { getPublicAnnouncement } from '../controllers/announcementController';
const router = Router();
router.get('/current', getPublicAnnouncement);
export default router;
//# sourceMappingURL=announcements.js.map