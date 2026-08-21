/**
 * 服务端中间件导出
 * 优化项 17: 按钮级权限
 * 优化项 41: API响应压缩
 * 优化项 42: 请求超时统一
 * 优化项 119: SOC2准备 - 合规准备
 * 优化项 120: 等级保护 - 等保合规
 * 优化项 404: 风控模型 - 欺诈检测
 * 优化项 496: 故障注入 - Fault Injection
 */
export {
  Role,
  Permission,
  AuthenticatedRequest,
  PermissionDeniedError,
  authenticate,
  requireRole,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireAuth,
  routePermission,
  routePermissionAny,
  routePermissionAll,
  adminOnly,
  superAdminOnly,
  requireOwnership,
  permissionLogger,
  hasPermission,
  getPermissions,
} from './auth'

// 故障注入 (优化项 496: Fault Injection)
export {
  // 配置
  FaultInjectionConfig,
  RouteFaultConfig,
  FaultType,
  FaultConfig,
  defaultFaultInjectionConfig,

  // 中间件
  createFaultInjection,
  createFaultInjectionWithStats,
  FaultInjectionResult,

  // API
  enableFaultInjection,
  disableFaultInjection,
  addFaultRoute,
  removeFaultRoute,
  getFaultInjectionConfig,
  updateFaultInjectionConfig,
  getFaultInjectionStats,

  // 预定义场景
  FaultScenarios,
} from './fault-injection'

// 等保合规 + 安全中间件
export {
  // 安全配置
  SecurityConfig,
  defaultSecurityConfig,
  mergeSecurityConfig,
  applySecurityConfig,

  // 安全HTTP头
  securityHeaders,
  helmetConfig,

  // DNS预解析 (优化项 35: DNS预解析 - 域名解析)
  DnsPrefetchConfig,
  dnsPrefetchMiddleware,
  dnsPrefetchMiddlewareSimple,
  dnsPrefetchMiddlewareOptimized,
  clearDnsHeaderCache,
  getDnsHeaderCacheSize,

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
  bruteForceConfig,
  BruteForceConfig,

  // IP黑白名单
  ipBlacklist,
  ipWhitelist,
  addToBlacklist,
  removeFromBlacklist,

  // SQL注入防护
  sqlInjectionProtection,

  // 输入验证
  inputValidation,
  ValidationRule,

  // 安全日志
  SecurityLogger,
  getSecurityLogger,

  // 完整安全中间件
  createSecurityMiddleware,
} from './security/security-center'

// SOC2合规
export {
  SOC2Compliance,
  getSOC2Compliance,
  ComplianceStatus,
  ComplianceFramework,
  ComplianceReport,
  ControlObjective,
  accessControl,
  AccessLevel,
  AccessReviewRecord,
  securityIncidentManager,
  SecurityIncident,
  IncidentSeverity,
  IncidentStatus,
  dataClassification,
  DataClassificationLevel,
  DataAsset,
  changeManagement,
  ChangeRequest,
  ChangeType,
  ChangeStatus,
  businessContinuity,
  BackupStatus,
  RecoveryTest,
  privacyProtection,
  PrivacyRequest,
  ConsentRecord,
  generateComplianceReport,
  generateAuditEvidence,
  soc2AuditMiddleware,
} from './security/compliance-core'

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

  // 欺诈检测中间件
  fraudDetectionMiddleware,
  loginFraudDetectionMiddleware,
  registerFraudDetectionMiddleware,
  transactionFraudDetectionMiddleware,

  // 欺诈检测路由
  fraudRoutes,
} from './security/fraud-detection'

// 请求超时统一 (优化项 42)
export {
  // 配置
  TimeoutConfig,
  RouteTimeoutConfig,
  defaultTimeoutConfig,

  // 中间件
  createTimeoutMiddleware,
  timeoutMiddleware,

  // 便捷函数
  createRouteTimeout,
  getTimeoutStore,
  getActiveRequestCount,
  getActiveRequests,

  // 配置管理
  getTimeoutConfig,
  updateTimeoutConfig,
  addRouteTimeout,
  removeRouteTimeout,

  // 预设配置
  TimeoutPresets,

  // 错误类
  TimeoutError,
} from './timeout'

// API响应压缩 (优化项 41)
export {
  // 配置
  CompressionConfig,
  defaultCompressionConfig,

  // 中间件
  compressionMiddleware,
  compressionMiddlewareWithStats,
  createCompressionMiddleware,
  createCompressionMiddlewareWithStats,

  // 过滤器
  defaultFilter,
  clientSupportsCompression,
  getBestAlgorithm,

  // 统计
  getCompressionStats,
  recordCompressionStats,
  resetCompressionStats,

  // 文档
  compressionLevelDocs,
} from './compression'
