import { Router } from 'express';
import { getPublicAnnouncement, getPublicAnnouncements } from '../controllers/announcementController.js';
const router = Router();
router.get('/current', getPublicAnnouncement);
router.get('/', getPublicAnnouncements);
export default router;
//# sourceMappingURL=announcements.js.map