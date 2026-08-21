/**
 * SOC2合规准备模块
 * 优化项 119: SOC2准备 - 合规准备
 *
 * SOC2 (Service Organization Control 2) 合规要求覆盖:
 *
 * Trust Service Criteria (信任服务标准):
 * - Security (CC): 访问控制、安全审计、变更管理
 * - Availability (A):  SLA监控、灾备、故障恢复
 * - Processing Integrity (PI): 数据校验、事务完整性
 * - Confidentiality (C): 数据加密、访问限制
 * - Privacy (P): 个人信息保护、同意管理
 *
 * 五类控制措施:
 * - CC1: 控制环境
 * - CC2: 沟通与信息
 * - CC3: 风险评估
 * - CC4: 监控控制
 * - CC5: 控制活动
 * - CC6: 逻辑与物理访问控制
 * - CC7: 系统运行
 * - CC8: 变更管理
 * - CC9: 风险缓解
 * - A1: 可用性处理
 * - PI1: 处理完整性
 * - C1: 保密性
 * - P1: 隐私通知
 * - P2: 隐私选择与同意
 * - P3: 个人信息收集
 * - P4: 个人信息使用与保留
 * - P5: 个人信息访问与更正
 * - P6: 个人信息披露控制
 * - P7: 个人信息质量
 * - P8: 隐私合规监控
 */

export {
  // SOC2合规核心
  SOC2Compliance,
  getSOC2Compliance,

  // 合规状态
  ComplianceStatus,
  ComplianceFramework,
  ComplianceReport,
  ControlObjective,

  // 访问控制 (CC6)
  accessControl,
  AccessLevel,
  AccessReviewRecord,

  // 安全事件管理 (CC7)
  securityIncidentManager,
  SecurityIncident,
  IncidentSeverity,
  IncidentStatus,

  // 数据分类 (C1)
  dataClassification,
  DataClassificationLevel,
  DataAsset,

  // 变更管理 (CC8)
  changeManagement,
  ChangeRequest,
  ChangeType,
  ChangeStatus,

  // 连续性计划 (A1)
  businessContinuity,
  BackupStatus,
  RecoveryTest,

  // 隐私保护 (P1-P8)
  privacyProtection,
  PrivacyRequest,
  ConsentRecord,

  // 合规报告生成
  generateComplianceReport,
  generateAuditEvidence,
} from './compliance-core'
