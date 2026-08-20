import { Router } from 'express';

import { getPublicAnnouncement, getPublicAnnouncements } from '../controllers/announcementController';

const router = Router();

router.get('/current', getPublicAnnouncement);
router.get('/', getPublicAnnouncements);

export default router;
