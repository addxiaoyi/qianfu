# 优化项 41: API响应压缩

## 概述

在 server/index.ts 中集成 gzip/brotli 压缩中间件，对 API 响应进行自动压缩，显著减少网络传输量，提升响应速度。

## 优化目标

1. **减少带宽消耗**: 压缩率可达 60-80%，大幅减少数据传输量
2. **提升响应速度**: 减小响应体，加快页面加载
3. **改善用户体验**: 减少等待时间，提升应用响应性
4. **智能压缩**: 自动识别可压缩内容，避免不必要的压缩开销

## 技术方案

### 1. 压缩算法选择

| 算法 | 压缩率 | 速度 | 兼容性 | 推荐场景 |
|------|--------|------|--------|----------|
| gzip | 60-70% | 快 | 通用 | 默认推荐 |
| brotli | 70-80% | 中等 | 现代浏览器 | 追求最佳压缩率 |
| deflate | 50-60% | 最快 | 良好 | 极端性能要求 |

### 2. 压缩配置

```typescript
// server/middleware/compression.ts
import compression from 'compression';
import { compressionMiddleware } from './middleware';

// 默认配置
const config = {
  level: 6,           // 压缩级别 0-9
  threshold: 1024,     // 1KB 以上才压缩
  enableBrotli: true,  // 启用 brotli
  enableGzip: true,   // 启用 gzip
};

// 排除不需压缩的内容
const excludePaths = [
  /^\/health/,        // 健康检查
  /^\/metrics/,       // 监控指标
  /\.(png|jpg|gif|ico|woff2?)$/,  // 已压缩的静态资源
];
```

### 3. 集成到 Express 应用

```typescript
// server/index.ts
import express from 'express';
import { compressionMiddleware } from './middleware';

const app = express();

// 压缩中间件应放在最前面
// 但要在日志和安全头之后
app.use(compressionMiddleware);

// 其他中间件...
app.use(securityHeaders);
app.use(requestLogger);

// 路由...
```

### 4. 使用示例

```typescript
import {
  compressionMiddleware,
  createCompressionMiddleware,
  getCompressionStats,
} from './middleware';

// 使用默认配置
app.use(compressionMiddleware);

// 自定义配置
app.use(createCompressionMiddleware({
  level: 9,                    // 最大压缩
  threshold: 512,              // 512 bytes 以上压缩
  excludePaths: [/^\/api\/upload/],  // 排除特定路径
}));

// 获取压缩统计
const stats = getCompressionStats();
console.log(`压缩率: ${(stats.savedBytes / originalSize * 100).toFixed(1)}%`);
```

## 实现细节

### 文件结构

```
server/
├── middleware/
│   ├── index.ts              # 中间件导出 (已更新)
│   └── compression.ts         # 新增: 压缩中间件
```

### CompressionConfig 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| algorithm | string | 'gzip' | 压缩算法 |
| level | number | 6 | 压缩级别 (0-9) |
| threshold | number | 1024 | 压缩阈值 (bytes) |
| enableBrotli | boolean | true | 启用 brotli |
| enableGzip | boolean | true | 启用 gzip |
| excludePaths | RegExp[] | [...] | 排除的路径 |
| excludeMimeTypes | string[] | [...] | 排除的 MIME 类型 |

### 统计功能

```typescript
interface CompressionStats {
  totalRequests: number;       // 总请求数
  compressedRequests: number;   // 压缩请求数
  compressionRatio: number;     // 压缩比
  savedBytes: number;           // 节省字节数
  compressionRate: number;      // 压缩率
}

// 获取统计
const stats = getCompressionStats();

// 响应头添加压缩信息
X-Original-Size: 1234
X-Compression-Ratio: 67.5%
```

## 性能影响

### 测试结果 (示例)

| 场景 | 原始大小 | gzip 后 | brotli 后 | 节省比例 |
|------|----------|---------|-----------|----------|
| JSON API 响应 | 50KB | 15KB | 12KB | 70-76% |
| HTML 页面 | 100KB | 25KB | 20KB | 75-80% |
| JS Bundle | 200KB | 60KB | 50KB | 70-75% |
| 图片 (不压缩) | - | - | - | 0% |

### CPU 开销

- gzip 级别 6: CPU 开销增加约 5-10%
- brotli: CPU 开销增加约 10-15%
- 对于现代服务器，这个开销可以忽略不计

## 浏览器兼容性

| 浏览器 | gzip | brotli |
|--------|------|--------|
| Chrome 50+ | ✓ | ✓ |
| Firefox 44+ | ✓ | ✓ |
| Safari 11+ | ✓ | ✓ |
| Edge 79+ | ✓ | ✓ |
| iOS Safari 11+ | ✓ | ✓ |
| Android Chrome 50+ | ✓ | ✓ |

## 注意事项

1. **不要压缩已压缩内容**: 图片、视频等已压缩文件不应再次压缩
2. **CPU vs 带宽权衡**: 根据服务器负载选择合适的压缩级别
3. **CDN 考虑**: 如果使用 CDN，压缩应在 CDN 边缘节点处理
4. **缓存策略**: 压缩后的响应应正确设置 Cache-Control

## 监控指标

```typescript
// 可添加到 /metrics 端点
- compression_requests_total
- compression_bytes_saved_total
- compression_ratio_average
```

## 相关优化项

- 优化项 42: 请求超时统一
- 优化项 119: SOC2准备 - 合规准备
- 优化项 120: 等级保护 - 等保合规

## 更新记录

- 2024-07-06: 初始版本
