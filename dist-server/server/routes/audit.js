import { Router } from 'express';
import { getAuditLogs, getAuditStats, getAuditTimeSeries, generateAuditReport, cleanupAuditLogs, exportAuditLogs, } from '../controllers/auditController';
import { authenticate, hasPermission } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { adminLimiter } from '../middleware/rateLimiter';
import { validateBody, validateQuery } from '../middleware/requestValidation';
import { auditCleanupSchema, auditExportSchema, auditLogQuerySchema, auditReportSchema, auditStatsQuerySchema, auditTimeSeriesQuerySchema, } from '../utils/validation';
const router = Router();
// All audit routes require authentication and are limited to admins or users with system_config permission
router.use(authenticate);
router.use(hasPermission(['admin', 'system_config']));
router.use(adminLimiter);
// Get audit logs
router.get('/logs', validateQuery(auditLogQuerySchema), getAuditLogs);
// Get audit stats
router.get('/stats', validateQuery(auditStatsQuerySchema), getAuditStats);
// Get audit time series
router.get('/timeseries', validateQuery(auditTimeSeriesQuerySchema), getAuditTimeSeries);
// Generate audit report
router.post('/report', csrfProtection, validateBody(auditReportSchema), generateAuditReport);
// Cleanup old audit logs
router.delete('/cleanup', csrfProtection, validateQuery(auditCleanupSchema), cleanupAuditLogs);
// Export audit logs
router.get('/export', validateQuery(auditExportSchema), exportAuditLogs);
export default router;
//# sourceMappingURL=audit.js.map