import { Router } from 'express';
import { getAllTeamMembers, getAllAllianceGroups, getAllResourceLinks, } from '../controllers/staticDataController.js';
import { staticDataLimiter } from '../middleware/rateLimiter.js';
const router = Router();
router.get('/team-members', staticDataLimiter, getAllTeamMembers);
router.get('/alliance-groups', staticDataLimiter, getAllAllianceGroups);
router.get('/resource-links', staticDataLimiter, getAllResourceLinks);
export default router;
//# sourceMappingURL=staticDataRoutes.js.map