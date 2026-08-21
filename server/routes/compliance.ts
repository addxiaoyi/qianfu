/**
 * SOC2合规API路由
 * 优化项 119: SOC2准备 - 合规准备
 *
 * 提供以下API端点:
 * - GET  /api/compliance/report      - 获取合规报告
 * - GET  /api/compliance/controls    - 获取控制目标列表
 * - GET  /api/compliance/controls/:id - 获取特定控制目标
 * - POST /api/compliance/controls/:id - 更新控制目标
 * - GET  /api/compliance/incidents   - 获取安全事件列表
 * - POST /api/compliance/incidents   - 创建安全事件
 * - PUT  /api/compliance/incidents/:id - 更新安全事件
 * - GET  /api/compliance/access      - 获取访问记录
 * - POST /api/compliance/access      - 添加访问记录
 * - GET  /api/compliance/changes     - 获取变更请求
 * - POST /api/compliance/changes     - 创建变更请求
 * - PUT  /api/compliance/changes/:id - 更新变更请求
 * - GET  /api/compliance/privacy     - 获取隐私请求
 * - POST /api/compliance/privacy     - 创建隐私请求
 * - GET  /api/compliance/backup      - 获取备份状态
 * - POST /api/compliance/backup      - 记录备份状态
 * - GET  /api/compliance/recovery    - 获取恢复测试
 * - POST /api/compliance/recovery    - 记录恢复测试
 * - GET  /api/compliance/assets      - 获取数据资产
 * - POST /api/compliance/assets      - 添加数据资产
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  SOC2Compliance,
  ComplianceFramework,
  ComplianceStatus,
  accessControl,
  securityIncidentManager,
  dataClassification,
  changeManagement,
  businessContinuity,
  privacyProtection,
  generateComplianceReport,
  generateAuditEvidence,
  IncidentSeverity,
  IncidentStatus,
  ChangeType,
  ChangeStatus,
  DataClassificationLevel,
  AccessLevel,
} from '../middleware';

const router = Router();

// ============================================================
// 中间件: 管理员权限检查
// ============================================================

function requireComplianceAdmin(req: Request, res: Response, next: NextFunction) {
  const userRole = (req as any).userRole;
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden', message: '需要管理员权限', code: 'ADMIN_REQUIRED' });
    return;
  }
  next();
}

// ============================================================
// 合规报告
// ============================================================

/**
 * GET /api/compliance/report
 * 获取合规报告
 */
router.get('/report', requireComplianceAdmin, (req: Request, res: Response) => {
  const framework = (req.query.framework as ComplianceFramework) || ComplianceFramework.SOC2_SECURITY;
  const periodStart = req.query.start as string || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = req.query.end as string || new Date().toISOString();

  try {
    const report = generateComplianceReport(framework, periodStart, periodEnd);
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'REPORT_GENERATION_FAILED',
      message: '报告生成失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/compliance/audit-evidence
 * 生成审计证据
 */
router.get('/audit-evidence', requireComplianceAdmin, (req: Request, res: Response) => {
  const controlIds = req.query.controls as string;
  if (!controlIds) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '请提供controlIds参数',
    });
    return;
  }

  try {
    const ids = controlIds.split(',').map((id) => id.trim());
    const evidence = generateAuditEvidence(ids);
    res.json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'EVIDENCE_GENERATION_FAILED',
      message: '证据生成失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================
// 控制目标管理
// ============================================================

/**
 * GET /api/compliance/controls
 * 获取所有控制目标
 */
router.get('/controls', (req: Request, res: Response) => {
  const framework = req.query.framework as ComplianceFramework;
  const status = req.query.status as ComplianceStatus;

  let controls = SOC2Compliance.getControls();

  if (framework) {
    controls = controls.filter((c) => c.framework.includes(framework));
  }
  if (status) {
    controls = controls.filter((c) => c.status === status);
  }

  res.json({
    success: true,
    data: {
      total: controls.length,
      controls,
    },
  });
});

/**
 * GET /api/compliance/controls/:id
 * 获取特定控制目标
 */
router.get('/controls/:id', (req: Request, res: Response) => {
  const control = SOC2Compliance.getControl(req.params.id);
  if (!control) {
    res.status(404).json({
      success: false,
      error: 'CONTROL_NOT_FOUND',
      message: '控制目标不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: control,
  });
});

/**
 * PUT /api/compliance/controls/:id
 * 更新控制目标
 */
router.put('/controls/:id', requireComplianceAdmin, (req: Request, res: Response) => {
  const { status, findings, remediation, evidence } = req.body;

  const updates: any = {};
  if (status) updates.status = status;
  if (findings) updates.findings = findings;
  if (remediation) updates.remediation = remediation;
  if (evidence) updates.evidence = evidence;

  const success = SOC2Compliance.updateControl(req.params.id, updates);
  if (!success) {
    res.status(404).json({
      success: false,
      error: 'CONTROL_NOT_FOUND',
      message: '控制目标不存在',
    });
    return;
  }

  const control = SOC2Compliance.getControl(req.params.id);
  res.json({
    success: true,
    data: control,
    message: '控制目标已更新',
  });
});

// ============================================================
// 安全事件管理
// ============================================================

/**
 * GET /api/compliance/incidents
 * 获取安全事件列表
 */
router.get('/incidents', (req: Request, res: Response) => {
  const severity = req.query.severity as IncidentSeverity;
  const status = req.query.status as IncidentStatus;

  const incidents = securityIncidentManager.getAll({
    severity: severity as any,
    status: status as any,
  });

  res.json({
    success: true,
    data: {
      total: incidents.length,
      incidents,
    },
  });
});

/**
 * POST /api/compliance/incidents
 * 创建安全事件
 */
router.post('/incidents', (req: Request, res: Response) => {
  const { title, description, severity, category, affectedSystems, reportedBy } = req.body;

  if (!title || !description || !severity || !reportedBy) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必填字段',
    });
    return;
  }

  const incident = securityIncidentManager.create({
    title,
    description,
    severity,
    category: category || 'general',
    affectedSystems: affectedSystems || [],
    reportedBy,
  });

  res.status(201).json({
    success: true,
    data: incident,
    message: '安全事件已创建',
  });
});

/**
 * PUT /api/compliance/incidents/:id
 * 更新安全事件
 */
router.put('/incidents/:id', (req: Request, res: Response) => {
  const updates = req.body;
  const incident = securityIncidentManager.update(req.params.id, updates);

  if (!incident) {
    res.status(404).json({
      success: false,
      error: 'INCIDENT_NOT_FOUND',
      message: '安全事件不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: incident,
    message: '安全事件已更新',
  });
});

// ============================================================
// 访问控制记录
// ============================================================

/**
 * GET /api/compliance/access
 * 获取访问记录
 */
router.get('/access', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const status = req.query.status as string;

  const records = accessControl.getRecords({ userId, status });

  res.json({
    success: true,
    data: {
      total: records.length,
      records,
    },
  });
});

/**
 * POST /api/compliance/access
 * 添加访问记录
 */
router.post('/access', requireComplianceAdmin, (req: Request, res: Response) => {
  const { userId, resourceId, accessLevel, grantedBy, expiresAt } = req.body;

  if (!userId || !resourceId || !accessLevel || !grantedBy) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必填字段',
    });
    return;
  }

  accessControl.addRecord({
    userId,
    resourceId,
    accessLevel: accessLevel as AccessLevel,
    grantedAt: new Date().toISOString(),
    grantedBy,
    expiresAt,
  });

  res.status(201).json({
    success: true,
    message: '访问记录已添加',
  });
});

// ============================================================
// 变更管理
// ============================================================

/**
 * GET /api/compliance/changes
 * 获取变更请求列表
 */
router.get('/changes', (req: Request, res: Response) => {
  const status = req.query.status as ChangeStatus;
  const type = req.query.type as ChangeType;

  // TODO: 添加过滤功能
  res.json({
    success: true,
    data: {
      total: 0,
      changes: [],
    },
  });
});

/**
 * POST /api/compliance/changes
 * 创建变更请求
 */
router.post('/changes', (req: Request, res: Response) => {
  const { title, description, type, requester, rollbackPlan, affectedSystems, riskLevel, testPlan } = req.body;

  if (!title || !description || !type || !requester || !rollbackPlan) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必填字段',
    });
    return;
  }

  const change = changeManagement.create({
    title,
    description,
    type: type as ChangeType,
    requester,
    rollbackPlan,
    affectedSystems: affectedSystems || [],
    riskLevel: riskLevel || 'medium',
    testPlan,
  });

  res.status(201).json({
    success: true,
    data: change,
    message: '变更请求已创建',
  });
});

/**
 * PUT /api/compliance/changes/:id
 * 更新变更请求
 */
router.put('/changes/:id', (req: Request, res: Response) => {
  const updates = req.body;
  const change = changeManagement.update(req.params.id, updates);

  if (!change) {
    res.status(404).json({
      success: false,
      error: 'CHANGE_NOT_FOUND',
      message: '变更请求不存在',
    });
    return;
  }

  res.json({
    success: true,
    data: change,
    message: '变更请求已更新',
  });
});

// ============================================================
// 隐私保护
// ============================================================

/**
 * GET /api/compliance/privacy
 * 获取隐私请求列表
 */
router.get('/privacy', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      total: 0,
      requests: [],
    },
  });
});

/**
 * POST /api/compliance/privacy
 * 创建隐私请求
 */
router.post('/privacy', (req: Request, res: Response) => {
  const { type, requesterId } = req.body;

  if (!type || !requesterId) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必填字段',
    });
    return;
  }

  const request = privacyProtection.createRequest({
    type,
    requesterId,
  });

  res.status(201).json({
    success: true,
    data: request,
    message: '隐私请求已创建',
  });
});

/**
 * GET /api/compliance/consent
 * 获取同意记录
 */
router.get('/consent', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const records = privacyProtection.getConsentRecords(userId);

  res.json({
    success: true,
    data: {
      total: records.length,
      records,
    },
  });
});

/**
 * POST /api/compliance/consent
 * 记录用户同意
 */
router.post('/consent', (req: Request, res: Response) => {
  const { userId, consentType, granted, version, method } = req.body;

  if (!userId || !consentType || granted === undefined || !version) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必填字段',
    });
    return;
  }

  privacyProtection.recordConsent({
    id: `CONSENT-${Date.now().toString(36)}`,
    userId,
    consentType,
    granted,
    grantedAt: new Date().toISOString(),
    version,
    method: method || 'web',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({
    success: true,
    message: '同意记录已创建',
  });
});

// ============================================================
// 备份与恢复
// ============================================================

/**
 * GET /api/compliance/backup
 * 获取备份历史
 */
router.get('/backup', (req: Request, res: Response) => {
  const history = businessContinuity.getBackupHistory();

  res.json({
    success: true,
    data: {
      total: history.length,
      backups: history,
    },
  });
});

/**
 * POST /api/compliance/backup
 * 记录备份状态
 */
router.post('/backup', requireComplianceAdmin, (req: Request, res: Response) => {
  const { backupType, size, location, status, verified, retentionUntil } = req.body;

  if (!backupType || !status) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必填字段',
    });
    return;
  }

  businessContinuity.recordBackup({
    lastBackup: new Date().toISOString(),
    backupType,
    size: size || 0,
    location: location || 'unknown',
    status,
    verified: verified || false,
    verifiedAt: verified ? new Date().toISOString() : undefined,
    retentionUntil: retentionUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  res.status(201).json({
    success: true,
    message: '备份状态已记录',
  });
});

/**
 * GET /api/compliance/recovery
 * 获取恢复测试历史
 */
router.get('/recovery', (req: Request, res: Response) => {
  const tests = businessContinuity.getRecoveryTests();

  res.json({
    success: true,
    data: {
      total: tests.length,
      tests,
    },
  });
});

/**
 * POST /api/compliance/recovery
 * 记录恢复测试
 */
router.post('/recovery', requireComplianceAdmin, (req: Request, res: Response) => {
  const { testType, duration, success, dataIntegrityVerified, findings, recommendations } = req.body;

  if (!testType || success === undefined) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必填字段',
    });
    return;
  }

  businessContinuity.recordRecoveryTest({
    id: `TEST-${Date.now().toString(36)}`,
    testType,
    performedAt: new Date().toISOString(),
    performedBy: (req as any).userId || 'system',
    duration: duration || 0,
    success,
    dataIntegrityVerified: dataIntegrityVerified || false,
    findings,
    recommendations,
  });

  res.status(201).json({
    success: true,
    message: '恢复测试已记录',
  });
});

// ============================================================
// 数据资产
// ============================================================

/**
 * GET /api/compliance/assets
 * 获取数据资产列表
 */
router.get('/assets', (req: Request, res: Response) => {
  const classification = req.query.classification as DataClassificationLevel;
  const assets = dataClassification.getAll(classification as any);

  res.json({
    success: true,
    data: {
      total: assets.length,
      assets,
    },
  });
});

/**
 * POST /api/compliance/assets
 * 添加数据资产
 */
router.post('/assets', requireComplianceAdmin, (req: Request, res: Response) => {
  const { name, type, classification, owner, location, retentionDays, encryptionRequired, sensitivity } = req.body;

  if (!name || !type || !classification || !owner) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: '缺少必填字段',
    });
    return;
  }

  dataClassification.add({
    id: `ASSET-${Date.now().toString(36)}`,
    name,
    type,
    classification,
    owner,
    location: location || 'unknown',
    retentionDays: retentionDays || 365,
    encryptionRequired: encryptionRequired || false,
    lastAudit: new Date().toISOString(),
    nextAudit: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    sensitivity: sensitivity || 'medium',
  });

  res.status(201).json({
    success: true,
    message: '数据资产已添加',
  });
});

// ============================================================
// 导出路由
// ============================================================

export default router;
