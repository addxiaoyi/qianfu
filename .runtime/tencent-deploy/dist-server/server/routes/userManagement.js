import { Router } from 'express';
import { authenticate, hasPermission } from '../middleware/auth.js';
import { listUsers, updateUserRole, getUserStats, getAvailableRoles } from '../controllers/userManagementController.js';
import { setupSoleAdmin } from '../controllers/adminSetupController.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateBody, validateParams, validateQuery } from '../middleware/requestValidation.js';
import { setupSoleAdminSchema, userIdParamSchema, userQuerySchema, userRoleUpdateSchema } from '../utils/validation.js';
const router = Router();
router.use(authenticate);
router.use(adminLimiter);
// Only users with user management permissions (ADMIN, OPERATOR) can access
router.get('/users', hasPermission(['manage_users']), validateQuery(userQuerySchema), listUsers);
router.get('/stats', hasPermission(['manage_users']), getUserStats);
router.get('/roles', hasPermission(['manage_users']), getAvailableRoles);
router.patch('/users/:userId/role', csrfProtection, hasPermission(['manage_users']), validateParams(userIdParamSchema), validateBody(userRoleUpdateSchema), updateUserRole);
// System setup functionality still requires strict admin permissions and is protected by setupToken
router.post('/setup-sole-admin', csrfProtection, hasPermission(['admin']), validateBody(setupSoleAdminSchema), setupSoleAdmin);
export default router;
//# sourceMappingURL=userManagement.js.map