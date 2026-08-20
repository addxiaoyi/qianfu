/**
 * 配置中心索引文件
 *
 * 统一导出配置相关的所有模块
 */

export {
  default as config,
  config,
  env,
  getConfig,
  validateConfig,
  initConfig,
  type Config,
  type ValidationResult,
  type AppConfig,
  type ServerConfig,
  type LogConfig,
  type UploadConfig,
  type VideoConfig,
  type SecurityConfig,
  type RedisConfig,
  type DatabaseConfig,
  type CdnConfig,
  type CacheConfig,
  type AIConfig,
  type CustomerServiceConfig,
  type FaultInjectionConfig,
} from './env';
