import { Router } from 'express';
import { 
  getAllPermissionGroups, 
  assignPermissionGroup, 
  batchAssignPermissionGroups, 
  getPermissionHistory, 
  getPermissionStats 
} from '../controllers/permissionGroupController';
import { authenticate, hasPermission } from '../middleware/auth';
import { adminLimiter } from '../middleware/rateLimiter';
import { csrfProtection } from '../middleware/csrf';

const router = Router();

// All permission group management routes require authentication and are limited to admins or users with user management permissions
router.use(authenticate);
router.use(hasPermission(['manage_users']));
router.use(adminLimiter);

// Get all permission group info
router.get('/groups', getAllPermissionGroups);

// Assign permission group to a user
router.post('/assign/:userId', csrfProtection, assignPermissionGroup);

// Batch assign permission groups
router.post('/batch-assign', csrfProtection, batchAssignPermissionGroups);

// Get permission change history
router.get('/history', getPermissionHistory);

// Get permission stats
router.get('/stats', getPermissionStats);

export default router;