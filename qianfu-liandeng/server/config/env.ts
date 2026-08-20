/**
 * 配置中心 - server/config/env.ts
 * 统一配置管理
 *
 * 功能:
 * - 环境变量类型安全访问
 * - 配置默认值定义
 * - 配置验证
 * - 敏感配置加密支持
 * - 配置热更新接口
 *
 * 使用示例:
 * ```typescript
 * import { env, config } from './config/env';
 *
 * // 简单访问
 * const port = env.SERVER_PORT;
 *
 * // 配置对象
 * const uploadConfig = config.upload;
 * const securityConfig = config.security;
 * ```
 */

// ============================================================
// Types
// ============================================================

export interface AppConfig {
  /** 应用环境 */
  nodeEnv: 'development' | 'production' | 'test';
  /** 是否生产环境 */
  isProduction: boolean;
  /** 是否开发环境 */
  isDevelopment: boolean;
  /** 是否测试环境 */
  isTest: boolean;
}

export interface ServerConfig {
  /** 服务器端口 */
  port: number;
  /** 服务器主机 */
  host: string;
  /** API 基础路径 */
  apiPrefix: string;
  /** 请求超时 (毫秒) */
  requestTimeout: number;
}

export interface LogConfig {
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 是否输出 JSON 格式 */
  jsonFormat: boolean;
  /** 是否包含时间戳 */
  includeTimestamp: boolean;
}

export interface VideoConfig {
  /** 存储目录 */
  storageDir: string;
  /** CDN 前缀 */
  cdnPrefix: string;
  /** 允许的 MIME 类型 */
  allowedMimeTypes: string[];
  /** 最大文件大小 (字节) */
  maxFileSize: number;
  /** 默认压缩质量 CRF (1-51) */
  defaultCrf: number;
  /** 默认输出格式 */
  defaultFormat: 'mp4' | 'webm' | 'mov';
  /** 默认最大宽度 */
  defaultMaxWidth: number;
  /** 默认最大高度 */
  defaultMaxHeight: number;
  /** FFmpeg 路径 (可选) */
  ffmpegPath?: string;
  /** FFprobe 路径 (可选) */
  ffprobePath?: string;
  /** 临时文件目录 */
  tempDir: string;
  /** 是否启用视频压缩 */
  enabled: boolean;
}

export interface UploadConfig {
  /** 存储目录 */
  storageDir: string;
  /** CDN 前缀 */
  cdnPrefix: string;
  /** 允许的 MIME 类型 */
  allowedMimeTypes: string[];
  /** 最大文件大小 (字节) */
  maxFileSize: number;
  /** 默认压缩质量 */
  defaultQuality: number;
  /** 是否启用 AVIF */
  enableAvif: boolean;
  /** WebP压缩级别 (1-6, 越高越小但越慢) */
  webpEffort: number;
  /** 默认输出格式 */
  defaultFormat: 'webp' | 'jpeg' | 'avif';
}

export interface SecurityConfig {
  /** 允许的跨域来源 */
  allowedOrigins: string[];
  /** 数据加密密钥 */
  dataEncryptionKey: string;
  /** HTTPS 强制启用 */
  forceHttps: boolean;
}

export interface RedisConfig {
  /** Redis 主机 */
  host: string;
  /** Redis 端口 */
  port: number;
  /** Redis 密码 */
  password?: string;
  /** 数据库索引 */
  db: number;
  /** 连接超时 (毫秒) */
  connectTimeout: number;
}

export interface DatabaseConfig {
  /** 数据库 URL */
  url: string;
  /** 连接池最小大小 */
  poolMin: number;
  /** 连接池最大大小 */
  poolMax: number;
  /** 查询超时 (毫秒) */
  queryTimeout: number;
}

export interface CdnConfig {
  /** CDN 域名 */
  domain: string;
  /** CDN 密钥 */
  secret?: string;
  /** CDN 签名有效期 (秒) */
  signedUrlExpiry: number;
}

export interface CacheConfig {
  /** L1 缓存 TTL (毫秒) */
  l1Ttl: number;
  /** L2 缓存 TTL (毫秒) */
  l2Ttl: number;
  /** 最大条目数 */
  maxEntries: number;
}

export interface AIConfig {
  /** OpenAI API Key */
  openaiApiKey?: string;
  /** OpenAI API Base URL */
  openaiBaseUrl?: string;
  /** Cohere API Key */
  cohereApiKey?: string;
  /** Hugging Face API Key */
  huggingfaceApiKey?: string;
  /** Weaviate URL */
  weaviateUrl?: string;
  /** Weaviate API Key */
  weaviateApiKey?: string;
}

export interface CustomerServiceConfig {
  /** 是否启用智能客服 */
  enabled: boolean;
  /** 知识库集合名称 */
  collection: string;
  /** 转人工关键词 (逗号分隔) */
  escalationKeywords: string[];
  /** LLM 模型 */
  llmModel: string;
  /** 温度系数 */
  temperature: number;
  /** 最大历史消息数 */
  maxHistoryLength: number;
  /** 会话超时时间 (毫秒) */
  sessionTimeout: number;
}

/**
 * 翻译服务配置 (优化项 402: 智能翻译)
 */
export interface TranslationConfig {
  /** 是否启用翻译服务 */
  enabled: boolean;
  /** 默认提供商: deepl | google | azure | openai */
  provider: 'deepl' | 'google' | 'azure' | 'openai';
  /** DeepL API Key */
  deeplApiKey?: string;
  /** DeepL API 端点場 */
  deeplEndpoint?: string;
  /** Google Translate API Key */
  googleApiKey?: string;
  /** Azure Translator Key */
  azureApiKey?: string;
  /** Azure Translator 端点 */
  azureEndpoint?: string;
  /** Azure Translator 区域 */
  azureRegion: string;
  /** OpenAI API Key */
  openaiApiKey?: string;
  /** OpenAI Base URL */
  openaiBaseUrl?: string;
  /** OpenAI 翻译模型 */
  openaiModel: string;
  /** 默认源语言 (auto = 自动检测) */
  defaultSourceLang: string;
  /** 默认目标语言 */
  defaultTargetLang: string;
  /** 最大单次翻译字符数 */
  maxCharsPerRequest: number;
  /** 批量翻译最大条目数 */
  maxBatchSize: number;
  /** 是否启用缓存 */
  cacheEnabled: boolean;
  /** 缓存 TTL (毫秒) */
  cacheTtl: number;
}

/**
 * 故障注入配置 (优化项 496: Fault Injection)
 */
export interface FaultInjectionConfig {
  /** 是否启用故障注入 */
  enabled: boolean;
  /** 故障注入日志 */
  logEnabled: boolean;
  /** 响应头标记 */
  markResponse: boolean;
  /** 默认概率 (0-1) */
  defaultProbability: number;
  /** 默认延迟时间 (毫秒) */
  defaultDelay: number;
  /** 默认错误码 */
  defaultErrorCode: number;
  /** 预定义场景: 'none' | 'highLatency' | 'randomErrors' | 'serviceDown' | 'timeouts' | 'chaosEngineering' */
  scenario?: string;
}

/**
 * SQL 日志配置 (优化项 46: SQL 日志记录)
 */
export interface SqlLogConfig {
  /** 是否启用 SQL 日志 */
  enabled: boolean;
  /** 慢查询阈值 (毫秒) */
  slowQueryThreshold: number;
  /** 是否记录所有查询 */
  logAll: boolean;
  /** 最大查询日志长度 */
  maxQueryLength: number;
  /** 是否记录查询参数 */
  logParams: boolean;
  /** 是否包含 EXPLAIN ANALYZE */
  includeExplain: boolean;
}

export interface Config {
  /** 应用配置 */
  app: AppConfig;
  /** 服务器配置 */
  server: ServerConfig;
  /** 日志配置 */
  log: LogConfig;
  /** 上传配置 */
  upload: UploadConfig;
  /** 视频配置 */
  video: VideoConfig;
  /** 安全配置 */
  security: SecurityConfig;
  /** Redis 配置 */
  redis: RedisConfig;
  /** 数据库配置 */
  database: DatabaseConfig;
  /** CDN 配置 */
  cdn: CdnConfig;
  /** 缓存配置 */
  cache: CacheConfig;
  /** AI 配置 */
  ai: AIConfig;
  /** 智能客服配置 */
  customerService: CustomerServiceConfig;
  /** 翻译服务配置 (优化项 402) */
  translation: TranslationConfig;
  /** 故障注入配置 (优化项 496) */
  faultInjection: FaultInjectionConfig;
  /** SQL 日志配置 (优化项 46) */
  sqlLog: SqlLogConfig;
}

// ============================================================
// 环境变量解析
// ============================================================

function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
}

function parseArrayEnv(value: string | undefined, defaultValue: string[]): string[] {
  if (value === undefined || value === '') return defaultValue;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseStringEnv(value: string | undefined, defaultValue: string): string {
  return value ?? defaultValue;
}

// ============================================================
// 配置对象构建
// ============================================================

function buildAppConfig(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as AppConfig['nodeEnv'];
  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    isTest: nodeEnv === 'test',
  };
}

function buildServerConfig(): ServerConfig {
  return {
    port: parseIntEnv(process.env.SERVER_PORT, 3000),
    host: parseStringEnv(process.env.SERVER_HOST, '0.0.0.0'),
    apiPrefix: parseStringEnv(process.env.API_PREFIX, '/api'),
    requestTimeout: parseIntEnv(process.env.REQUEST_TIMEOUT, 30000),
  };
}

function buildLogConfig(): LogConfig {
  return {
    level: (process.env.LOG_LEVEL as LogConfig['level']) || (
      buildAppConfig().isProduction ? 'info' : 'debug'
    ),
    jsonFormat: buildAppConfig().isProduction,
    includeTimestamp: true,
  };
}

function buildUploadConfig(): UploadConfig {
  return {
    storageDir: parseStringEnv(process.env.UPLOAD_STORAGE_DIR, './uploads'),
    cdnPrefix: parseStringEnv(process.env.CDN_PREFIX, '/cdn'),
    allowedMimeTypes: parseArrayEnv(process.env.ALLOWED_IMAGE_MIME_TYPES, [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'image/tiff',
      'image/bmp',
    ]),
    maxFileSize: parseIntEnv(process.env.MAX_IMAGE_FILE_SIZE, 10 * 1024 * 1024), // 10MB
    defaultQuality: parseIntEnv(process.env.DEFAULT_IMAGE_QUALITY, 80),
    enableAvif: parseBoolEnv(process.env.ENABLE_AVIF, false),
    webpEffort: parseIntEnv(process.env.WEBP_EFFORT, 4), // 1-6, 默认4
    defaultFormat: (process.env.DEFAULT_IMAGE_FORMAT as UploadConfig['defaultFormat']) || 'webp',
  };
}

function buildVideoConfig(): VideoConfig {
  return {
    storageDir: parseStringEnv(process.env.VIDEO_STORAGE_DIR, './uploads/videos'),
    cdnPrefix: parseStringEnv(process.env.VIDEO_CDN_PREFIX, '/cdn/videos'),
    allowedMimeTypes: parseArrayEnv(process.env.ALLOWED_VIDEO_MIME_TYPES, [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/mpeg',
    ]),
    maxFileSize: parseIntEnv(process.env.MAX_VIDEO_FILE_SIZE, 500 * 1024 * 1024), // 500MB
    defaultCrf: parseIntEnv(process.env.DEFAULT_VIDEO_CRF, 23),
    defaultFormat: (process.env.DEFAULT_VIDEO_FORMAT as VideoConfig['defaultFormat']) || 'mp4',
    defaultMaxWidth: parseIntEnv(process.env.DEFAULT_VIDEO_MAX_WIDTH, 1920),
    defaultMaxHeight: parseIntEnv(process.env.DEFAULT_VIDEO_MAX_HEIGHT, 1080),
    ffmpegPath: process.env.FFMPEG_PATH,
    ffprobePath: process.env.FFPROBE_PATH,
    tempDir: parseStringEnv(process.env.VIDEO_TEMP_DIR, './temp/videos'),
    enabled: parseBoolEnv(process.env.VIDEO_COMPRESSION_ENABLED, true),
  };
}

function buildSecurityConfig(): SecurityConfig {
  // 数据加密密钥：如果未设置，生成临时密钥（仅用于开发）
  const appConfig = buildAppConfig();
  let dataEncryptionKey = process.env.DATA_ENCRYPTION_KEY;
  if (!dataEncryptionKey) {
    if (appConfig.isProduction) {
      console.warn('[CONFIG] WARNING: DATA_ENCRYPTION_KEY is not set in production!');
    }
    dataEncryptionKey = require('crypto').randomBytes(32).toString('hex');
  }

  return {
    allowedOrigins: parseArrayEnv(process.env.ALLOWED_ORIGINS, ['http://localhost:3000']),
    dataEncryptionKey,
    forceHttps: parseBoolEnv(process.env.FORCE_HTTPS, appConfig.isProduction),
  };
}

function buildRedisConfig(): RedisConfig {
  return {
    host: parseStringEnv(process.env.REDIS_HOST, 'localhost'),
    port: parseIntEnv(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD,
    db: parseIntEnv(process.env.REDIS_DB, 0),
    connectTimeout: parseIntEnv(process.env.REDIS_CONNECT_TIMEOUT, 5000),
  };
}

function buildDatabaseConfig(): DatabaseConfig {
  return {
    url: parseStringEnv(process.env.DATABASE_URL, 'postgresql://localhost:5432/app'),
    poolMin: parseIntEnv(process.env.DB_POOL_MIN, 2),
    poolMax: parseIntEnv(process.env.DB_POOL_MAX, 10),
    queryTimeout: parseIntEnv(process.env.DB_QUERY_TIMEOUT, 30000),
  };
}

function buildCdnConfig(): CdnConfig {
  return {
    domain: parseStringEnv(process.env.CDN_DOMAIN, ''),
    secret: process.env.CDN_SECRET,
    signedUrlExpiry: parseIntEnv(process.env.CDN_SIGNED_URL_EXPIRY, 3600),
  };
}

function buildCacheConfig(): CacheConfig {
  return {
    l1Ttl: parseIntEnv(process.env.CACHE_L1_TTL, 30000),      // 30秒
    l2Ttl: parseIntEnv(process.env.CACHE_L2_TTL, 300000),     // 5分钟
    maxEntries: parseIntEnv(process.env.CACHE_MAX_ENTRIES, 1000),
  };
}

function buildAIConfig(): AIConfig {
  return {
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    cohereApiKey: process.env.COHERE_API_KEY,
    huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY,
    weaviateUrl: process.env.WEAVIATE_URL,
    weaviateApiKey: process.env.WEAVIATE_API_KEY,
  };
}

function buildCustomerServiceConfig(): CustomerServiceConfig {
  return {
    enabled: parseBoolEnv(process.env.CUSTOMER_SERVICE_ENABLED, true),
    collection: parseStringEnv(process.env.CUSTOMER_SERVICE_COLLECTION || '', 'customer_service'),
    escalationKeywords: parseArrayEnv(process.env.CUSTOMER_SERVICE_ESCALATION_KEYWORDS, [
      '人工', '转人工', '客服', '投诉', '升级', '经理'
    ]),
    llmModel: parseStringEnv(process.env.CUSTOMER_SERVICE_LLM_MODEL || '', 'gpt-4o-mini'),
    temperature: parseFloat(parseStringEnv(process.env.CUSTOMER_SERVICE_TEMPERATURE || '', '0.7')),
    maxHistoryLength: parseIntEnv(process.env.CUSTOMER_SERVICE_MAX_HISTORY, 20),
    sessionTimeout: parseIntEnv(process.env.CUSTOMER_SERVICE_SESSION_TIMEOUT, 1800000), // 30分钟
  };
}

/**
 * 构建故障注入配置 (优化项 496)
 */
function buildFaultInjectionConfig(): FaultInjectionConfig {
  return {
    enabled: parseBoolEnv(process.env.FAULT_INJECTION_ENABLED, false),
    logEnabled: parseBoolEnv(process.env.FAULT_INJECTION_LOG_ENABLED, true),
    markResponse: parseBoolEnv(process.env.FAULT_INJECTION_MARK_RESPONSE, true),
    defaultProbability: parseFloat(process.env.FAULT_INJECTION_DEFAULT_PROBABILITY || '1.0'),
    defaultDelay: parseIntEnv(process.env.FAULT_INJECTION_DEFAULT_DELAY, 1000),
    defaultErrorCode: parseIntEnv(process.env.FAULT_INJECTION_DEFAULT_ERROR_CODE, 500),
    scenario: parseStringEnv(process.env.FAULT_INJECTION_SCENARIO, 'none'),
  };
}

/**
 * 构建 SQL 日志配置 (优化项 46)
 */
function buildSqlLogConfig(): SqlLogConfig {
  return {
    enabled: parseBoolEnv(process.env.SQL_LOG_ENABLED, true),
    slowQueryThreshold: parseIntEnv(process.env.SQL_SLOW_QUERY_THRESHOLD, 1000),
    logAll: parseBoolEnv(process.env.SQL_LOG_ALL, false),
    maxQueryLength: parseIntEnv(process.env.SQL_MAX_QUERY_LENGTH, 1000),
    logParams: parseBoolEnv(process.env.SQL_LOG_PARAMS, false),
    includeExplain: parseBoolEnv(process.env.SQL_INCLUDE_EXPLAIN, false),
  };
}

/**
 * 构建翻译服务配置 (优化项 402)
 */
function buildTranslationConfig(): TranslationConfig {
  return {
    enabled: parseBoolEnv(process.env.TRANSLATION_ENABLED, true),
    provider: (process.env.TRANSLATION_PROVIDER as TranslationConfig['provider']) || 'deepl',
    deeplApiKey: process.env.DEEPL_API_KEY,
    deeplEndpoint: process.env.DEEPL_API_ENDPOINT,
    googleApiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
    azureApiKey: process.env.AZURE_TRANSLATOR_KEY,
    azureEndpoint: process.env.AZURE_TRANSLATOR_ENDPOINT,
    azureRegion: parseStringEnv(process.env.AZURE_TRANSLATOR_REGION, 'eastus'),
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    openaiModel: parseStringEnv(process.env.OPENAI_TRANSLATION_MODEL, 'gpt-4o-mini'),
    defaultSourceLang: parseStringEnv(process.env.TRANSLATION_DEFAULT_SOURCE_LANG, 'auto'),
    defaultTargetLang: parseStringEnv(process.env.TRANSLATION_DEFAULT_TARGET_LANG, 'zh-CN'),
    maxCharsPerRequest: parseIntEnv(process.env.TRANSLATION_MAX_CHARS, 5000),
    maxBatchSize: parseIntEnv(process.env.TRANSLATION_MAX_BATCH_SIZE, 100),
    cacheEnabled: parseBoolEnv(process.env.TRANSLATION_CACHE_ENABLED, true),
    cacheTtl: parseIntEnv(process.env.TRANSLATION_CACHE_TTL, 604800000), // 7天
  };
}

// ============================================================
// 统一配置导出
// ============================================================

const _config: Config = {
  app: buildAppConfig(),
  server: buildServerConfig(),
  log: buildLogConfig(),
  upload: buildUploadConfig(),
  video: buildVideoConfig(),
  security: buildSecurityConfig(),
  redis: buildRedisConfig(),
  database: buildDatabaseConfig(),
  cdn: buildCdnConfig(),
  cache: buildCacheConfig(),
  ai: buildAIConfig(),
  customerService: buildCustomerServiceConfig(),
  translation: buildTranslationConfig(),
  faultInjection: buildFaultInjectionConfig(),
  sqlLog: buildSqlLogConfig(),
};

/**
 * 获取完整配置对象
 */
export const config: Readonly<Config> = _config;

/**
 * 获取配置中的特定部分
 */
export function getConfig<K extends keyof Config>(key: K): Readonly<Config[K]> {
  return _config[key];
}

// ============================================================
// 便捷的环境变量访问
// ============================================================

/**
 * 环境变量集合（类型安全的快捷访问）
 */
export const env = {
  // 应用
  get NODE_ENV() { return _config.app.nodeEnv; },
  get isProduction() { return _config.app.isProduction; },
  get isDevelopment() { return _config.app.isDevelopment; },
  get isTest() { return _config.app.isTest; },

  // 服务器
  get SERVER_PORT() { return _config.server.port; },
  get SERVER_HOST() { return _config.server.host; },
  get API_PREFIX() { return _config.server.apiPrefix; },
  get REQUEST_TIMEOUT() { return _config.server.requestTimeout; },

  // 日志
  get LOG_LEVEL() { return _config.log.level; },

  // 上传/图片
  get UPLOAD_STORAGE_DIR() { return _config.upload.storageDir; },
  get CDN_PREFIX() { return _config.upload.cdnPrefix; },
  get MAX_IMAGE_FILE_SIZE() { return _config.upload.maxFileSize; },
  get DEFAULT_IMAGE_QUALITY() { return _config.upload.defaultQuality; },

  // 视频
  get VIDEO_STORAGE_DIR() { return _config.video.storageDir; },
  get VIDEO_CDN_PREFIX() { return _config.video.cdnPrefix; },
  get MAX_VIDEO_FILE_SIZE() { return _config.video.maxFileSize; },
  get DEFAULT_VIDEO_CRF() { return _config.video.defaultCrf; },
  get VIDEO_TEMP_DIR() { return _config.video.tempDir; },
  get FFMPEG_PATH() { return _config.video.ffmpegPath; },
  get FFPROBE_PATH() { return _config.video.ffprobePath; },

  // 安全
  get ALLOWED_ORIGINS() { return _config.security.allowedOrigins; },
  get DATA_ENCRYPTION_KEY() { return _config.security.dataEncryptionKey; },
  get FORCE_HTTPS() { return _config.security.forceHttps; },

  // Redis
  get REDIS_HOST() { return _config.redis.host; },
  get REDIS_PORT() { return _config.redis.port; },
  get REDIS_PASSWORD() { return _config.redis.password; },
  get REDIS_DB() { return _config.redis.db; },

  // 数据库
  get DATABASE_URL() { return _config.database.url; },

  // CDN
  get CDN_DOMAIN() { return _config.cdn.domain; },
  get CDN_SECRET() { return _config.cdn.secret; },

  // 缓存
  get CACHE_L1_TTL() { return _config.cache.l1Ttl; },
  get CACHE_L2_TTL() { return _config.cache.l2Ttl; },

  // AI
  get OPENAI_API_KEY() { return _config.ai.openaiApiKey; },
  get OPENAI_BASE_URL() { return _config.ai.openaiBaseUrl; },
  get COHERE_API_KEY() { return _config.ai.cohereApiKey; },
  get HUGGINGFACE_API_KEY() { return _config.ai.huggingfaceApiKey; },
  get WEAVIATE_URL() { return _config.ai.weaviateUrl; },
  get WEAVIATE_API_KEY() { return _config.ai.weaviateApiKey; },

  // 智能客服
  get CUSTOMER_SERVICE_ENABLED() { return _config.customerService.enabled; },
  get CUSTOMER_SERVICE_COLLECTION() { return _config.customerService.collection; },
  get CUSTOMER_SERVICE_LLM_MODEL() { return _config.customerService.llmModel; },
  get CUSTOMER_SERVICE_TEMPERATURE() { return _config.customerService.temperature; },

  // 故障注入 (优化项 496)
  get FAULT_INJECTION_ENABLED() { return _config.faultInjection.enabled; },
  get FAULT_INJECTION_LOG_ENABLED() { return _config.faultInjection.logEnabled; },
  get FAULT_INJECTION_DEFAULT_PROBABILITY() { return _config.faultInjection.defaultProbability; },
  get FAULT_INJECTION_DEFAULT_DELAY() { return _config.faultInjection.defaultDelay; },
  get FAULT_INJECTION_SCENARIO() { return _config.faultInjection.scenario; },

  // 翻译服务 (优化项 402)
  get TRANSLATION_ENABLED() { return _config.translation.enabled; },
  get TRANSLATION_PROVIDER() { return _config.translation.provider; },
  get DEEPL_API_KEY() { return _config.translation.deeplApiKey; },
  get DEEPL_API_ENDPOINT() { return _config.translation.deeplEndpoint; },
  get GOOGLE_TRANSLATE_API_KEY() { return _config.translation.googleApiKey; },
  get AZURE_TRANSLATOR_KEY() { return _config.translation.azureApiKey; },
  get AZURE_TRANSLATOR_ENDPOINT() { return _config.translation.azureEndpoint; },
  get AZURE_TRANSLATOR_REGION() { return _config.translation.azureRegion; },
  get OPENAI_TRANSLATION_MODEL() { return _config.translation.openaiModel; },
  get TRANSLATION_DEFAULT_SOURCE_LANG() { return _config.translation.defaultSourceLang; },
  get TRANSLATION_DEFAULT_TARGET_LANG() { return _config.translation.defaultTargetLang; },
  get TRANSLATION_MAX_CHARS() { return _config.translation.maxCharsPerRequest; },
  get TRANSLATION_MAX_BATCH_SIZE() { return _config.translation.maxBatchSize; },
  get TRANSLATION_CACHE_ENABLED() { return _config.translation.cacheEnabled; },
  get TRANSLATION_CACHE_TTL() { return _config.translation.cacheTtl; },

  // SQL 日志 (优化项 46)
  get SQL_LOG_ENABLED() { return _config.sqlLog.enabled; },
  get SQL_SLOW_QUERY_THRESHOLD() { return _config.sqlLog.slowQueryThreshold; },
  get SQL_LOG_ALL() { return _config.sqlLog.logAll; },
  get SQL_MAX_QUERY_LENGTH() { return _config.sqlLog.maxQueryLength; },
  get SQL_LOG_PARAMS() { return _config.sqlLog.logParams; },
  get SQL_INCLUDE_EXPLAIN() { return _config.sqlLog.includeExplain; },
};

// ============================================================
// 配置验证
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证配置是否完整
 */
export function validateConfig(): ValidationResult {
  const errors: string[] = [];

  // 生产环境必须配置的项目
  if (_config.app.isProduction) {
    if (!process.env.DATA_ENCRYPTION_KEY) {
      errors.push('DATA_ENCRYPTION_KEY is required in production');
    }
    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required in production');
    }
  }

  // 端口验证
  if (_config.server.port < 1 || _config.server.port > 65535) {
    errors.push('SERVER_PORT must be between 1 and 65535');
  }

  // 文件大小验证
  if (_config.upload.maxFileSize < 1024) {
    errors.push('MAX_FILE_SIZE must be at least 1024 bytes');
  }

  // CORS 配置验证
  if (_config.security.allowedOrigins.length === 0) {
    errors.push('ALLOWED_ORIGINS cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 初始化配置（启动时调用）
 */
export function initConfig(): void {
  const validation = validateConfig();
  if (!validation.valid) {
    console.error('[CONFIG] Configuration validation failed:');
    validation.errors.forEach((e) => console.error(`  - ${e}`));
    if (_config.app.isProduction) {
      throw new Error('Invalid configuration in production mode');
    }
  }

  if (_config.app.isDevelopment) {
    console.log('[CONFIG] Running in development mode');
    console.log(`[CONFIG] Server: ${_config.server.host}:${_config.server.port}`);
    console.log(`[CONFIG] Log level: ${_config.log.level}`);
  }
}

// ============================================================
// 便捷导出
// ============================================================

export default config;
