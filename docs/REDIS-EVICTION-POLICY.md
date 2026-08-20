# Redis 淘汰策略配置指南

## 概述

为防止 Redis 内存无限增长，需要配置合适的淘汰策略（Eviction Policy）。

## 推荐配置

### 1. Docker Compose 配置

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --appendonly yes
    volumes:
      - redis-data:/data
    deploy:
      resources:
        limits:
          memory: 512M

volumes:
  redis-data:
```

### 2. 环境变量配置 (推荐)

在 `.env` 或部署配置中添加：

```bash
# Redis 淘汰策略配置
REDIS_MAXMEMORY=256mb
REDIS_MAXMEMORY_POLICY=allkeys-lru
```

### 3. Redis 配置文件

创建 `redis.conf`：

```conf
# 内存限制
maxmemory 256mb

# 淘汰策略：当内存达到限制时，删除所有键
maxmemory-policy allkeys-lru

# AOF 持久化
appendonly yes
appendfsync everysec
```

## 淘汰策略说明

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| `noeviction` | 不淘汰，返回错误 | 不推荐，可能导致服务不可用 |
| `allkeys-lru` | 删除最近最少使用的键 | **推荐**，适合缓存场景 |
| `allkeys-random` | 随机删除任意键 | 不推荐，数据不确定性高 |
| `volatile-lru` | 只删除设置了过期时间的 LRU 键 | 适合有明确过期时间的缓存 |
| `volatile-ttl` | 删除即将过期的键 | 适合定时清理场景 |
| `volatile-random` | 随机删除设置了过期时间的键 | 不推荐 |

## 当前系统状态

### 已实现的内存回退机制

`redisService.js` 已实现内存缓存回退：

```javascript
class MemoryCache {
    cache = new Map();
    // 固定容量，按插入顺序淘汰最旧条目
    // 最大条目数: 1000 (默认，可由 REDIS_MEMORY_MAX_ENTRIES 调整)
    // 定时清理: 60秒 (可由 REDIS_MEMORY_CLEANUP_MS 调整)
}

class RedisService {
    memoryFallback = new MemoryCache();
    
    // Redis 正常时只写 Redis；不可用或写失败时才使用有界回退
    async get(key) {
        if (!this.isConnected || !this.client) {
            return this.memoryFallback.get(key);
        }
        // ...
    }
}
```

### 内存缓存配置

位置：`server/services/redisService.ts`

```bash
REDIS_MEMORY_MAX_ENTRIES=1000
REDIS_MEMORY_CLEANUP_MS=60000
```

## 实施建议

### 高优先级

1. **Docker Compose 环境** - 添加 `--maxmemory` 和 `--maxmemory-policy` 启动参数
2. **云服务 (如阿里云/腾讯云)** - 在控制台配置内存限制和淘汰策略
3. **自建服务器** - 添加 `redis.conf` 配置文件

### 监控告警

添加 Redis 内存使用率监控：

```javascript
// 在健康检查中添加
async checkRedisMemory() {
    const info = await redisService.info('memory');
    const used = info.used_memory;
    const maxmemory = info.maxmemory;
    const usagePercent = (used / maxmemory) * 100;
    
    if (usagePercent > 80) {
        logger.warn(`Redis memory usage high: ${usagePercent.toFixed(2)}%`);
        // 触发告警
    }
}
```

## 验证命令

```bash
# 检查当前配置
redis-cli CONFIG GET maxmemory
redis-cli CONFIG GET maxmemory-policy

# 监控内存使用
redis-cli INFO memory | grep used_memory
redis-cli INFO memory | grep maxmemory

# 测试淘汰
redis-cli DEBUG SLEEP 1
redis-cli INFO stats | grep evicted_keys
```

## 相关文件

- `dist-server/server/services/redisService.js` - Redis 服务实现
- `dist-server/server/services/multiLevelCache.js` - 多级缓存实现
- `docker-compose.yml` - Docker 编排配置
