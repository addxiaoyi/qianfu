# API 版本化指南

> 千服 (QianFu) API 版本化策略、迁移说明和开发规范

## 1. 版本化策略

### 1.1 版本方案

千服采用 **URL 前缀版本化**，格式为 `/api/{version}/...`。

| 版本 | 前缀 | 状态 | 说明 |
|------|------|------|------|
| v1 | `/api/v1` | ✅ 活跃 | 当前默认版本 |

### 1.2 版本协商优先级

客户端可通过以下方式指定 API 版本（优先级从高到低）：

1. **URL 前缀**（最高优先级）：`/api/v1/servers`
2. **请求头**：`X-API-Version: v1`
3. **查询参数**：`?api-version=v1`
4. **默认版本**：v1

### 1.3 响应头

所有 API 响应都会包含以下版本相关头：

| 响应头 | 说明 | 示例 |
|--------|------|------|
| `X-API-Version` | 当前请求使用的版本 | `v1` |
| `Deprecation` | 版本已弃用标记 | `true` |
| `Sunset` | 版本下线日期 (RFC 8594) | `2027-01-01` |
| `Link` | 继任版本链接 | `</api/v2/...>; rel="successor-version"` |

### 1.4 版本生命周期

```
active → deprecated → sunset
```

- **active**：正常维护，接受新功能
- **deprecated**：仍可使用，但响应中包含弃用警告头；建议迁移到新版本
- **sunset**：到达 Sunset 日期后，服务端返回 `410 Gone`

## 2. 向后兼容

### 2.1 自动重定向

过渡期内，未带版本前缀的旧路径会自动重写：

```
/api/servers     → /api/v1/servers
/api/auth/login  → /api/v1/auth/login
```

通过 `backwardCompatRedirect` 中间件实现，可通过环境变量控制：

```bash
# 关闭向后兼容（生产环境稳定后建议关闭）
BACKWARD_COMPAT_ENABLED=false
```

### 2.2 前端 API 客户端

前端 `src/lib/api-client.ts` 已内置版本前缀自动注入：

```typescript
// 自动将 /api/xxx → /api/v1/xxx
// 已有版本前缀的路径不会被重复处理
// 绝对 URL 不受影响
```

**开发者无需手动修改现有调用**，`apiClient` 函数会自动处理版本化。

## 3. 迁移指南

### 3.1 从无版本化迁移到 v1

#### 前端代码

前端通过 `apiClient` 发起的请求会自动注入版本前缀，无需手动修改。

直接使用 `fetch` 的地方需要手动更新：

```diff
- fetch('/api/servers')
+ fetch('/api/v1/servers')
```

#### 外部客户端（第三方集成）

```diff
- GET https://api.qianfu.example/api/servers
+ GET https://api.qianfu.example/api/v1/servers
```

或通过请求头协商：

```http
GET /api/servers HTTP/1.1
X-API-Version: v1
```

#### Nginx 反向代理

如果 Nginx 配置中有 `/api/` 的代理规则，需要确保同时处理版本化路径：

```nginx
# 旧配置
location /api/ {
    proxy_pass http://backend:3000;
}

# 新配置（兼容新旧路径）
location /api/ {
    proxy_pass http://backend:3000;
}
# 版本化路径自动匹配，无需额外配置
```

### 3.2 从 v1 迁移到 v2（未来）

当 v2 发布时，按以下步骤迁移：

1. **阅读变更日志**：查看 v1 → v2 的 Breaking Changes
2. **更新 URL 前缀**：`/api/v1/` → `/api/v2/`
3. **更新 API 客户端版本常量**：`API_VERSION_PREFIX = '/api/v2'`
4. **测试**：确认所有功能在新版本下正常工作
5. **关注弃用头**：在 v1 返回 `Deprecation: true` 后，尽快完成迁移

## 4. 开发规范

### 4.1 新增 API 端点

新端点必须注册在当前活跃版本的路径下：

```typescript
// server/routes/index.ts
app.use(`${V1}/new-feature`, newFeatureRoutes);
```

### 4.2 新增版本

1. 在 `server/middleware/apiVersioning.ts` 的 `versionConfigs` 中注册新版本
2. 在 `SUPPORTED_VERSIONS` 常量中添加
3. 在 `server/routes/index.ts` 中注册新版本路由
4. 更新 Swagger 配置中的服务器列表
5. 更新本文档的版本表

### 4.3 弃用版本

1. 将版本配置的 `status` 改为 `deprecated`
2. 设置 `deprecationDate` 和 `sunsetDate`
3. 设置 `successorVersion`
4. 通知所有已知的 API 消费者
5. 在变更日志中记录

### 4.4 下线版本

到达 `sunsetDate` 后，版本配置的 `status` 改为 `sunset`，服务端将自动返回 410 Gone。

## 5. 修改的文件清单

| 文件 | 变更说明 |
|------|----------|
| `server/middleware/apiVersioning.ts` | 新增：API 版本化中间件 |
| `server/routes/index.ts` | 修改：路由注册从 `/api` → `/api/v1` |
| `server/bootstrap/middlewareLayers.ts` | 修改：添加 apiVersioningMiddleware |
| `server/config/swagger.ts` | 修改：服务器路径 + 版本化参数 |
| `src/lib/api-client.ts` | 修改：添加 versionizeUrl 自动注入版本前缀 |

## 6. 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `BACKWARD_COMPAT_ENABLED` | `true` | 是否启用 /api/* → /api/v1/* 自动重写 |

## 7. 参考

- [RFC 8594 - The Sunset HTTP Header Field](https://datatracker.ietf.org/doc/html/rfc8594)
- [HTTP Deprecation Header](https://datatracker.ietf.org/doc/html/draft-dalal-deprecation-header)
- [REST API Versioning Best Practices](https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/)
