/**
 * SOC2合规核心实现
 * 优化项 119: SOC2准备 - 合规准备
 */

import { Request, Response, NextFunction } from 'express';

// ============================================================
// Types - 合规状态
// ============================================================

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  IN_PROGRESS = 'in_progress',
  NOT_APPLICABLE = 'not_applicable',
  UNDER_REVIEW = 'under_review',
}

export enum ComplianceFramework {
  SOC2_TYPE1 = 'soc2_type1',
  SOC2_TYPE2 = 'soc2_type2',
  SOC2_SECURITY = 'soc2_security',
  SOC2_AVAILABILITY = 'soc2_availability',
  SOC2_CONFIDENTIALITY = 'soc2_confidentiality',
  SOC2_PRIVACY = 'soc2_privacy',
  ISO27001 = 'iso27001',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
}

export interface ControlObjective {
  id: string;
  name: string;
  description: string;
  category: string;
  framework: ComplianceFramework[];
  status: ComplianceStatus;
  lastReviewed: string;
  nextReview: string;
  evidence: string[];
  findings: string[];
  remediation: string[];
}

export interface ComplianceReport {
  generatedAt: string;
  framework: ComplianceFramework;
  period: { start: string; end: string };
  overallStatus: ComplianceStatus;
  controlCount: {
    total: number;
    compliant: number;
    nonCompliant: number;
    inProgress: number;
    notApplicable: number;
  };
  controls: ControlObjective[];
  riskScore: number;
  executiveSummary: string;
  recommendations: string[];
}

// ============================================================
// Types - 访问控制 (CC6)
// ============================================================

export enum AccessLevel {
  NONE = 'none',
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export interface AccessReviewRecord {
  userId: string;
  resourceId: string;
  accessLevel: AccessLevel;
  grantedAt: string;
  grantedBy: string;
  expiresAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: 'active' | 'revoked' | 'expired' | 'pending_review';
}

export interface AccessPolicy {
  resourceType: string;
  allowedRoles: string[];
  maxAccessLevel: AccessLevel;
  requireApproval: boolean;
  approvalRole?: string;
  accessReviewFrequencyDays: number;
}

// ============================================================
// Types - 安全事件管理 (CC7)
// ============================================================

export enum IncidentSeverity {
  CRITICAL = 'critical',   // 立即响应，影响业务
  HIGH = 'high',           // 4小时内响应
  MEDIUM = 'medium',       // 24小时内响应
  LOW = 'low',             // 72小时内响应
  INFO = 'info',           // 信息记录
}

export enum IncidentStatus {
  DETECTED = 'detected',
  REPORTED = 'reported',
  INVESTIGATING = 'investigating',
  CONTAINED = 'contained',
  ERADICATED = 'eradicated',
  RECOVERED = 'recovered',
  POST_MORTEM = 'post_mortem',
  CLOSED = 'closed',
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  category: string;
  affectedSystems: string[];
  affectedUsers?: string[];
  detectedAt: string;
  reportedAt?: string;
  resolvedAt?: string;
  reportedBy: string;
  assignedTo?: string[];
  timeline: {
    timestamp: string;
    action: string;
    performedBy: string;
    notes?: string;
  }[];
  rootCause?: string;
  impact?: string;
  lessonsLearned?: string;
  evidence: string[];
}

// ============================================================
// Types - 数据分类 (C1)
// ============================================================

export enum DataClassificationLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
}

export interface DataAsset {
  id: string;
  name: string;
  type: 'database' | 'file' | 'api' | 'service' | 'log' | 'backup';
  classification: DataClassificationLevel;
  owner: string;
  location: string;
  retentionDays: number;
  encryptionRequired: boolean;
  lastAudit: string;
  nextAudit: string;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================
// Types - 变更管理 (CC8)
// ============================================================

export enum ChangeType {
  EMERGENCY = 'emergency',
  URGENT = 'urgent',
  NORMAL = 'normal',
  STANDARD = 'standard',
}

export enum ChangeStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ROLLED_BACK = 'rolled_back',
}

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  type: ChangeType;
  status: ChangeStatus;
  requester: string;
  requestedAt: string;
  approvers: { role: string; approvedAt?: string; approved?: boolean }[];
  scheduledAt?: string;
  implementedAt?: string;
  rollbackPlan: string;
  affectedSystems: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  testPlan?: string;
  testResults?: 'passed' | 'failed' | 'partial' | 'not_tested';
  postImplementationReview?: string;
}

// ============================================================
// Types - 隐私保护 (P1-P8)
// ============================================================

export interface PrivacyRequest {
  id: string;
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'objection';
  requesterId: string;
  requestedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  completedAt?: string;
  dataProvided?: string;
  notes?: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: 'terms' | 'privacy' | 'marketing' | 'cookies' | 'data_processing';
  granted: boolean;
  grantedAt: string;
  withdrawnAt?: string;
  version: string;
  ipAddress?: string;
  userAgent?: string;
  method: 'web' | 'api' | 'mobile' | 'written';
}

// ============================================================
// Types - 备份与恢复 (A1)
// ============================================================

export interface BackupStatus {
  lastBackup: string;
  backupType: 'full' | 'incremental' | 'differential';
  size: number;
  location: string;
  status: 'success' | 'failed' | 'in_progress';
  verified: boolean;
  verifiedAt?: string;
  retentionUntil: string;
}

export interface RecoveryTest {
  id: string;
  testType: 'full' | 'partial' | 'drill';
  performedAt: string;
  performedBy: string;
  duration: number;
  success: boolean;
  dataIntegrityVerified: boolean;
  findings?: string;
  recommendations?: string;
}

// ============================================================
// SOC2合规核心类
// ============================================================

class SOC2ComplianceCore {
  private controls: Map<string, ControlObjective> = new Map();
  private accessRecords: AccessReviewRecord[] = [];
  private incidents: SecurityIncident[] = [];
  private dataAssets: DataAsset[] = [];
  private changeRequests: ChangeRequest[] = [];
  private privacyRequests: PrivacyRequest[] = [];
  private consentRecords: ConsentRecord[] = [];
  private backupHistory: BackupStatus[] = [];
  private recoveryTests: RecoveryTest[] = [];
  private accessPolicies: AccessPolicy[] = [];

  constructor() {
    this.initializeControls();
  }

  /**
   * 初始化SOC2控制目标
   */
  private initializeControls(): void {
    const defaultControls: ControlObjective[] = [
      // CC1: 控制环境
      {
        id: 'CC1.1',
        name: '诚信与道德价值观',
        description: '组织应建立并维护诚信、道德价值观的文化',
        category: 'CC1',
        framework: [ComplianceFramework.SOC2_SECURITY],
        status: ComplianceStatus.COMPLIANT,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: [],
        findings: [],
        remediation: [],
      },
      // CC2: 沟通与信息
      {
        id: 'CC2.1',
        name: '信息与通信',
        description: '组织应内部和外部进行相关信息的沟通',
        category: 'CC2',
        framework: [ComplianceFramework.SOC2_SECURITY],
        status: ComplianceStatus.COMPLIANT,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: [],
        findings: [],
        remediation: [],
      },
      // CC6: 逻辑与物理访问控制
      {
        id: 'CC6.1',
        name: '逻辑访问控制',
        description: '应实施逻辑访问安全软件、基础设施架构和逻辑访问设计',
        category: 'CC6',
        framework: [ComplianceFramework.SOC2_SECURITY, ComplianceFramework.SOC2_CONFIDENTIALITY],
        status: ComplianceStatus.IN_PROGRESS,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: ['access_logs', 'user_roster'],
        findings: ['需要定期访问审查'],
        remediation: ['实施季度访问审查流程'],
      },
      {
        id: 'CC6.2',
        name: '用户注册与授权',
        description: '应维护用户注册、授权和撤销程序',
        category: 'CC6',
        framework: [ComplianceFramework.SOC2_SECURITY],
        status: ComplianceStatus.COMPLIANT,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: ['user_provisioning_procedure'],
        findings: [],
        remediation: [],
      },
      {
        id: 'CC6.6',
        name: '安全事件响应',
        description: '应建立安全事件响应程序和通信能力',
        category: 'CC6',
        framework: [ComplianceFramework.SOC2_SECURITY],
        status: ComplianceStatus.IN_PROGRESS,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: [],
        findings: ['事件响应计划需要更新'],
        remediation: ['完善事件分类和升级流程'],
      },
      // CC7: 系统运行
      {
        id: 'CC7.1',
        name: '系统运行检测',
        description: '应检测到基础设施中可能影响安全目标实现的组件',
        category: 'CC7',
        framework: [ComplianceFramework.SOC2_SECURITY, ComplianceFramework.SOC2_AVAILABILITY],
        status: ComplianceStatus.COMPLIANT,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: ['monitoring_dashboards', 'alert_rules'],
        findings: [],
        remediation: [],
      },
      {
        id: 'CC7.2',
        name: '漏洞管理',
        description: '应识别和评估内部及外部漏洞',
        category: 'CC7',
        framework: [ComplianceFramework.SOC2_SECURITY],
        status: ComplianceStatus.IN_PROGRESS,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: [],
        findings: ['需要实施自动化漏洞扫描'],
        remediation: ['集成CI/CD漏洞扫描'],
      },
      // CC8: 变更管理
      {
        id: 'CC8.1',
        name: '变更管理流程',
        description: '应授权、设计、开发或采购、配置、测试、审批和实施变更',
        category: 'CC8',
        framework: [ComplianceFramework.SOC2_SECURITY],
        status: ComplianceStatus.COMPLIANT,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: ['change_management_procedure', 'change_logs'],
        findings: [],
        remediation: [],
      },
      // A1: 可用性
      {
        id: 'A1.1',
        name: '可用性承诺与系统恢复',
        description: '应定义可用性承诺并实施恢复程序',
        category: 'A1',
        framework: [ComplianceFramework.SOC2_AVAILABILITY],
        status: ComplianceStatus.IN_PROGRESS,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: [],
        findings: ['需要完成灾难恢复测试'],
        remediation: ['执行年度DR演练'],
      },
      {
        id: 'A1.2',
        name: '数据备份与恢复',
        description: '应创建并维护备份并测试恢复程序',
        category: 'A1',
        framework: [ComplianceFramework.SOC2_AVAILABILITY, ComplianceFramework.SOC2_CONFIDENTIALITY],
        status: ComplianceStatus.IN_PROGRESS,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: [],
        findings: ['需要测试恢复流程'],
        remediation: ['执行季度备份恢复测试'],
      },
      // C1: 保密性
      {
        id: 'C1.1',
        name: '数据分类',
        description: '应对敏感信息进行识别和分类',
        category: 'C1',
        framework: [ComplianceFramework.SOC2_CONFIDENTIALITY],
        status: ComplianceStatus.IN_PROGRESS,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: [],
        findings: ['数据分类标准待制定'],
        remediation: ['制定数据分类矩阵'],
      },
      {
        id: 'C1.2',
        name: '加密控制',
        description: '应对敏感数据实施加密保护',
        category: 'C1',
        framework: [ComplianceFramework.SOC2_CONFIDENTIALITY],
        status: ComplianceStatus.COMPLIANT,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: ['encryption_config', 'key_rotation_logs'],
        findings: [],
        remediation: [],
      },
      // P1-P8: 隐私
      {
        id: 'P1.1',
        name: '隐私通知',
        description: '应提供清晰、易于理解的隐私通知',
        category: 'P1',
        framework: [ComplianceFramework.SOC2_PRIVACY],
        status: ComplianceStatus.COMPLIANT,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: ['privacy_policy'],
        findings: [],
        remediation: [],
      },
      {
        id: 'P2.1',
        name: '用户同意',
        description: '应获取并记录用户对数据处理的同意',
        category: 'P2',
        framework: [ComplianceFramework.SOC2_PRIVACY],
        status: ComplianceStatus.IN_PROGRESS,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        evidence: [],
        findings: ['同意记录机制待完善'],
        remediation: ['实施同意管理平台'],
      },
    ];

    defaultControls.forEach((control) => {
      this.controls.set(control.id, control);
    });
  }

  /**
   * 获取所有控制目标
   */
  getControls(): ControlObjective[] {
    return Array.from(this.controls.values());
  }

  /**
   * 获取特定控制目标
   */
  getControl(id: string): ControlObjective | undefined {
    return this.controls.get(id);
  }

  /**
   * 更新控制状态
   */
  updateControl(id: string, updates: Partial<ControlObjective>): boolean {
    const control = this.controls.get(id);
    if (!control) return false;
    this.controls.set(id, { ...control, ...updates, lastReviewed: new Date().toISOString() });
    return true;
  }

  /**
   * 添加访问记录
   */
  addAccessRecord(record: Omit<AccessReviewRecord, 'status'>): void {
    this.accessRecords.push({
      ...record,
      status: record.expiresAt && new Date(record.expiresAt) < new Date() ? 'expired' : 'active',
    });
  }

  /**
   * 获取访问记录
   */
  getAccessRecords(filters?: { userId?: string; status?: string }): AccessReviewRecord[] {
    let records = this.accessRecords;
    if (filters?.userId) {
      records = records.filter((r) => r.userId === filters.userId);
    }
    if (filters?.status) {
      records = records.filter((r) => r.status === filters.status);
    }
    return records;
  }

  /**
   * 创建安全事件
   */
  createIncident(incident: Omit<SecurityIncident, 'id' | 'status' | 'timeline'>): SecurityIncident {
    const newIncident: SecurityIncident = {
      ...incident,
      id: `INC-${Date.now().toString(36).toUpperCase()}`,
      status: IncidentStatus.DETECTED,
      timeline: [
        {
          timestamp: new Date().toISOString(),
          action: '事件创建',
          performedBy: incident.reportedBy,
        },
      ],
    };
    this.incidents.push(newIncident);
    return newIncident;
  }

  /**
   * 更新安全事件
   */
  updateIncident(id: string, updates: Partial<SecurityIncident>): SecurityIncident | null {
    const index = this.incidents.findIndex((i) => i.id === id);
    if (index === -1) return null;

    this.incidents[index] = {
      ...this.incidents[index],
      ...updates,
    };

    if (updates.status) {
      this.incidents[index].timeline.push({
        timestamp: new Date().toISOString(),
        action: `状态更新: ${updates.status}`,
        performedBy: 'system',
      });
    }

    return this.incidents[index];
  }

  /**
   * 获取安全事件
   */
  getIncidents(filters?: { severity?: IncidentSeverity; status?: IncidentStatus }): SecurityIncident[] {
    let result = this.incidents;
    if (filters?.severity) {
      result = result.filter((i) => i.severity === filters.severity);
    }
    if (filters?.status) {
      result = result.filter((i) => i.status === filters.status);
    }
    return result;
  }

  /**
   * 添加数据资产
   */
  addDataAsset(asset: DataAsset): void {
    this.dataAssets.push(asset);
  }

  /**
   * 获取数据资产
   */
  getDataAssets(classification?: DataClassificationLevel): DataAsset[] {
    if (classification) {
      return this.dataAssets.filter((a) => a.classification === classification);
    }
    return this.dataAssets;
  }

  /**
   * 创建变更请求
   */
  createChangeRequest(request: Omit<ChangeRequest, 'id' | 'status' | 'requestedAt'>): ChangeRequest {
    const newRequest: ChangeRequest = {
      ...request,
      id: `CR-${Date.now().toString(36).toUpperCase()}`,
      status: ChangeStatus.REQUESTED,
      requestedAt: new Date().toISOString(),
    };
    this.changeRequests.push(newRequest);
    return newRequest;
  }

  /**
   * 更新变更请求
   */
  updateChangeRequest(id: string, updates: Partial<ChangeRequest>): ChangeRequest | null {
    const index = this.changeRequests.findIndex((c) => c.id === id);
    if (index === -1) return null;
    this.changeRequests[index] = { ...this.changeRequests[index], ...updates };
    return this.changeRequests[index];
  }

  /**
   * 创建隐私请求
   */
  createPrivacyRequest(request: Omit<PrivacyRequest, 'id' | 'requestedAt' | 'status'>): PrivacyRequest {
    const newRequest: PrivacyRequest = {
      ...request,
      id: `PR-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    this.privacyRequests.push(newRequest);
    return newRequest;
  }

  /**
   * 记录同意
   */
  recordConsent(record: ConsentRecord): void {
    this.consentRecords.push(record);
  }

  /**
   * 获取同意记录
   */
  getConsentRecords(userId?: string): ConsentRecord[] {
    if (userId) {
      return this.consentRecords.filter((c) => c.userId === userId);
    }
    return this.consentRecords;
  }

  /**
   * 记录备份状态
   */
  recordBackup(status: BackupStatus): void {
    this.backupHistory.push(status);
    // 只保留最近30条记录
    if (this.backupHistory.length > 30) {
      this.backupHistory = this.backupHistory.slice(-30);
    }
  }

  /**
   * 获取备份状态
   */
  getBackupHistory(): BackupStatus[] {
    return this.backupHistory;
  }

  /**
   * 记录恢复测试
   */
  recordRecoveryTest(test: RecoveryTest): void {
    this.recoveryTests.push(test);
  }

  /**
   * 获取恢复测试历史
   */
  getRecoveryTests(): RecoveryTest[] {
    return this.recoveryTests;
  }

  /**
   * 生成合规报告
   */
  generateReport(framework: ComplianceFramework, periodStart: string, periodEnd: string): ComplianceReport {
    const controls = Array.from(this.controls.values()).filter((c) =>
      c.framework.includes(framework)
    );

    const statusCounts = {
      total: controls.length,
      compliant: controls.filter((c) => c.status === ComplianceStatus.COMPLIANT).length,
      nonCompliant: controls.filter((c) => c.status === ComplianceStatus.NON_COMPLIANT).length,
      inProgress: controls.filter((c) => c.status === ComplianceStatus.IN_PROGRESS).length,
      notApplicable: controls.filter((c) => c.status === ComplianceStatus.NOT_APPLICABLE).length,
    };

    const riskScore = Math.round(
      (statusCounts.nonCompliant * 10 + statusCounts.inProgress * 3) / Math.max(statusCounts.total, 1)
    );

    const recommendations: string[] = [];
    controls.forEach((c) => {
      if (c.status !== ComplianceStatus.COMPLIANT) {
        c.remediation.forEach((r) => {
          if (!recommendations.includes(r)) {
            recommendations.push(r);
          }
        });
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      framework,
      period: { start: periodStart, end: periodEnd },
      overallStatus: statusCounts.nonCompliant > 0
        ? ComplianceStatus.NON_COMPLIANT
        : statusCounts.inProgress > 0
          ? ComplianceStatus.IN_PROGRESS
          : ComplianceStatus.COMPLIANT,
      controlCount: statusCounts,
      controls,
      riskScore,
      executiveSummary: this.generateExecutiveSummary(statusCounts, riskScore),
      recommendations,
    };
  }

  /**
   * 生成执行摘要
   */
  private generateExecutiveSummary(counts: typeof this.controls extends Map<string, infer V> ? Record<string, number> : never, riskScore: number): string {
    if (counts.nonCompliant > 0) {
      return `合规评估显示存在 ${counts.nonCompliant} 项不符合项，风险评分为 ${riskScore}/10。建议优先处理高风险项，并在下次审计前完成所有整改措施。`;
    } else if (counts.inProgress > 0) {
      return `合规评估显示 ${counts.inProgress} 项控制正在整改中，风险评分为 ${riskScore}/10。建议加快整改进度，确保在计划时间内完成所有整改措施。`;
    }
    return `合规评估显示所有 ${counts.total} 项控制目标均符合要求，风险评分为 ${riskScore}/10。建议持续监控并定期审查控制有效性。`;
  }
}

// ============================================================
// 导出单例
// ============================================================

export const SOC2Compliance = new SOC2ComplianceCore();

export function getSOC2Compliance(): SOC2ComplianceCore {
  return SOC2Compliance;
}

// ============================================================
// 便捷访问函数
// ============================================================

export const accessControl = {
  addRecord: (record: Omit<AccessReviewRecord, 'status'>) => SOC2Compliance.addAccessRecord(record),
  getRecords: (filters?: { userId?: string; status?: string }) => SOC2Compliance.getAccessRecords(filters),
};

export const securityIncidentManager = {
  create: (incident: Omit<SecurityIncident, 'id' | 'status' | 'timeline'>) =>
    SOC2Compliance.createIncident(incident),
  update: (id: string, updates: Partial<SecurityIncident>) =>
    SOC2Compliance.updateIncident(id, updates),
  getAll: (filters?: { severity?: IncidentSeverity; status?: IncidentStatus }) =>
    SOC2Compliance.getIncidents(filters),
};

export const dataClassification = {
  add: (asset: DataAsset) => SOC2Compliance.addDataAsset(asset),
  getAll: (classification?: DataClassificationLevel) => SOC2Compliance.getDataAssets(classification),
};

export const changeManagement = {
  create: (request: Omit<ChangeRequest, 'id' | 'status' | 'requestedAt'>) =>
    SOC2Compliance.createChangeRequest(request),
  update: (id: string, updates: Partial<ChangeRequest>) =>
    SOC2Compliance.updateChangeRequest(id, updates),
};

export const businessContinuity = {
  recordBackup: (status: BackupStatus) => SOC2Compliance.recordBackup(status),
  getBackupHistory: () => SOC2Compliance.getBackupHistory(),
  recordRecoveryTest: (test: RecoveryTest) => SOC2Compliance.recordRecoveryTest(test),
  getRecoveryTests: () => SOC2Compliance.getRecoveryTests(),
};

export const privacyProtection = {
  createRequest: (request: Omit<PrivacyRequest, 'id' | 'requestedAt' | 'status'>) =>
    SOC2Compliance.createPrivacyRequest(request),
  recordConsent: (record: ConsentRecord) => SOC2Compliance.recordConsent(record),
  getConsentRecords: (userId?: string) => SOC2Compliance.getConsentRecords(userId),
};

export function generateComplianceReport(
  framework: ComplianceFramework,
  periodStart: string,
  periodEnd: string
): ComplianceReport {
  return SOC2Compliance.generateReport(framework, periodStart, periodEnd);
}

export function generateAuditEvidence(
  controlIds: string[]
): { controlId: string; evidence: string[]; generatedAt: string }[] {
  return controlIds.map((id) => {
    const control = SOC2Compliance.getControl(id);
    return {
      controlId: id,
      evidence: control?.evidence || [],
      generatedAt: new Date().toISOString(),
    };
  });
}

// ============================================================
// Express中间件
// ============================================================

/**
 * SOC2合规审计中间件
 * 记录所有管理操作的审计日志
 */
export function soc2AuditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const auditData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      userId: (req as any).userId,
      userRole: (req as any).userRole,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      action: req.body?.action || req.query?.action,
      resourceType: extractResourceType(req.path),
      resourceId: extractResourceId(req.path, req.body),
    };

    // 记录敏感操作
    if (isSensitiveAction(req.method, req.path)) {
      console.log(`[SOC2-AUDIT] ${JSON.stringify(auditData)}`);
    }

    // 添加审计追踪头
    res.setHeader('X-Audit-Id', `AUD-${Date.now().toString(36)}`);
    res.setHeader('X-Compliance-Framework', 'SOC2');

    next();
  };
}

function extractResourceType(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[0] || 'unknown';
}

function extractResourceId(path: string, body: any): string | undefined {
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 1 && parts[1] && parts[1] !== '') {
    return parts[1];
  }
  return body?.id;
}

function isSensitiveAction(method: string, path: string): boolean {
  const sensitiveMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const sensitivePaths = [
    '/user', '/role', '/permission', '/settings', '/config',
    '/admin', '/backup', '/restore', '/api-key', '/password',
  ];

  if (!sensitiveMethods.includes(method)) return false;

  return sensitivePaths.some((p) => path.toLowerCase().includes(p.toLowerCase()));
}
