/**
 * 等保合规安全中间件模块
 * 优化项 120: 等级保护 - 等保合规
 * 优化项 119: SOC2准备 - 合规准备
 * 优化项 204: 安全测试 - SQL注入/XSS测试
 *
 * 等保2.0 (GB/T 22239-2019) 合规要求覆盖:
 * - 安全通信网络: HTTPS、HSTS、安全传输
 * - 安全区域边界: CORS、XSS、CSRF、请求限流、入侵检测
 * - 安全计算环境: 安全审计、敏感数据保护
 * - 安全管理中心: 安全事件记录、集中日志
 *
 * SOC2 Trust Service Criteria:
 * - Security (CC): 访问控制、安全审计、变更管理
 * - Availability (A): SLA监控、灾备、故障恢复
 * - Processing Integrity (PI): 数据校验、事务完整性
 * - Confidentiality (C): 数据加密、访问限制
 * - Privacy (P): 个人信息保护、同意管理
 *
 * 安全测试文件: security.test.ts
 */

export {
  // 安全HTTP头
  securityHeaders,
  helmetConfig,

  // CORS配置
  corsConfig,
  getCorsMiddleware,

  // CSRF防护
  csrfProtection,
  generateCsrfToken,
  validateCsrfToken,

  // 请求限流
  rateLimiter,
  RateLimitStore,
  createRateLimiter,

  // 安全审计
  securityAudit,
  AuditEventType,
  AuditResult,

  // 敏感数据保护
  sensitiveDataProtection,
  DataMaskType,
  maskSensitiveData,
  encryptField,
  decryptField,

  // 暴力破解防护
  bruteForceProtection,
  BruteForceConfig,

  // IP黑名单
  ipBlacklist,
  ipWhitelist,
  addToBlacklist,
  removeFromBlacklist,

  // 安全配置
  SecurityConfig,
  defaultSecurityConfig,
  mergeSecurityConfig,
  applySecurityConfig,

  // 输入验证
  inputValidation,
  ValidationRule,

  // 安全日志
  SecurityLogger,
  getSecurityLogger,

  // 完整安全中间件
  createSecurityMiddleware,

  // ============ SOC2合规模块 ============

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

  // SOC2审计中间件
  soc2AuditMiddleware,
} from './compliance-core'
export {
  // SQL注入防护
  sqlInjectionProtection,

  // XSS防护
  xssProtection,

  // ============ DNS预解析 (优化项 35) ============

  // DNS预解析配置
  DnsPrefetchConfig,
  PreloadResource,
  PrefetchResource,

  // DNS预解析中间件
  dnsPrefetchMiddleware,
  dnsPrefetchMiddlewareSimple,
  dnsPrefetchMiddlewareOptimized,
  dynamicPrefetchMiddleware,

  // DNS预解析工具
  clearDnsHeaderCache,
  getDnsHeaderCacheSize,
} from './security-center'

// ============ 风控模型 - 欺诈检测 (优化项 404) ============

export {
  // 欺诈检测引擎
  FraudDetectionEngine,
  FraudEngine,
  getFraudDetectionEngine,
  initializeFraudDetection,

  // 欺诈检测配置
  FraudDetectionConfig,
  defaultFraudDetectionConfig,

  // 欺诈检测请求/结果
  FraudCheckRequest,
  FraudCheckResult,
  RiskFactor,
  FraudDetails,
  VelocityCheckResult,
  DeviceCheckResult,
  IpCheckResult,
  BehaviorCheckResult,

  // 欺诈事件类型
  FraudEventType,

  // 风险等级
  RiskLevel,

  // 欺诈规则
  FraudRule,
  FraudCondition,

  // 欺诈记录
  FraudRecord,
  DeviceProfile,
  IpProfile,

  // 统计数据
  FraudStatistics,
} from './fraud-detection'

export {
  // 欺诈检测中间件
  fraudDetectionMiddleware,
  loginFraudDetectionMiddleware,
  registerFraudDetectionMiddleware,
  transactionFraudDetectionMiddleware,

  // 欺诈检测路由
  fraudRoutes,
} from '../../routes/fraud-detection'
