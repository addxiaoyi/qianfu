# 安全测试文档

## 优化项 204: 安全测试 - SQL注入/XSS测试

本文档描述了项目中的安全测试套件，包括SQL注入防护和XSS防护的测试覆盖。

---

## 目录

1. [测试概览](#测试概览)
2. [SQL注入防护测试](#sql注入防护测试)
3. [XSS防护测试](#xss防护测试)
4. [安全头测试](#安全头测试)
5. [集成测试](#集成测试)
6. [性能测试](#性能测试)
7. [运行测试](#运行测试)
8. [测试覆盖矩阵](#测试覆盖矩阵)

---

## 测试概览

### 测试文件位置
```
server/middleware/security/security.test.ts
```

### 测试依赖
- Jest - 测试框架
- supertest - HTTP断言
- express - 应用框架

### 测试统计
| 测试类别 | 测试用例数 |
|---------|----------|
| SQL注入防护 | 25+ |
| XSS防护 | 20+ |
| 安全HTTP头 | 7 |
| 集成测试 | 4 |
| 性能测试 | 2 |
| **总计** | **58+** |

---

## SQL注入防护测试

### 基础SQL注入模式检测

| 测试用例 | 描述 | 攻击模式 |
|---------|------|---------|
| `应检测UNION SELECT注入` | 检测UNION联合查询注入 | `'; UNION SELECT * FROM users--` |
| `应检测SELECT FROM注入` | 检测直接SELECT注入 | `SELECT * FROM admin` |
| `应检测DROP TABLE注入` | 检测删除表注入 | `users; DROP TABLE users--` |
| `应检测INSERT INTO注入` | 检测插入数据注入 | `INSERT INTO users VALUES (...)` |
| `应检测UPDATE SET注入` | 检测更新数据注入 | `UPDATE users SET role='admin' WHERE id=1--` |
| `应检测DELETE FROM注入` | 检测删除数据注入 | `DELETE FROM users WHERE id=1` |
| `应检测EXEC/EXECUTE注入` | 检测存储过程注入 | `EXEC sp_executesql` |
| `应检测SQL注释注入` | 检测SQL注释绕过 | `1 -- comment` |
| `应检测OR 1=1永真条件` | 检测认证绕过 | `1 OR 1=1` |
| `应检测AND 1=1条件` | 检测布尔盲注 | `admin' AND '1'='1` |
| `应检测单引号注入` | 检测字符串注入 | `admin'` |

### 防护配置测试

| 测试用例 | 描述 |
|---------|------|
| `blockSuspicious=false时应记录但不阻止` | 验证仅记录模式 |
| `logSuspicious=false时应不记录日志` | 验证禁用日志模式 |
| `enabled=false时应跳过检查` | 验证禁用防护模式 |

### 不同输入位置检测

| 测试用例 | 描述 |
|---------|------|
| `应检测query参数中的SQL注入` | URL查询参数 |
| `应检测body参数中的SQL注入` | POST请求体 |
| `应检测嵌套对象中的SQL注入` | JSON嵌套对象 |
| `应检测数组中的SQL注入` | JSON数组 |

### 审计日志记录

| 测试用例 | 描述 |
|---------|------|
| `应记录注入尝试的详细信息` | 验证日志包含攻击模式 |
| `应记录客户端IP` | 验证IP追踪 |
| `应记录请求路径` | 验证攻击目标记录 |

### 绕过技术检测

| 测试用例 | 描述 |
|---------|------|
| `应检测大小写混合的SQL注入` | `uNiOn SeLeCt` |
| `应检测URL编码的SQL注入` | 编码后的特殊字符 |
| `应检测空格替代的SQL注入` | 换行符替代空格 |

---

## XSS防护测试

### 基础XSS模式检测

| 测试用例 | 描述 | 攻击模式 |
|---------|------|---------|
| `应检测script标签XSS` | 经典script注入 | `<script>alert("XSS")</script>` |
| `应检测img标签XSS` | img标签事件 | `<img src=x onerror=alert("XSS")>` |
| `应检测iframe XSS` | iframe注入 | `<iframe src="javascript:alert('XSS')">` |
| `应检测SVG XSS` | SVG标签注入 | `<svg onload=alert("XSS")>` |
| `应检测事件处理器XSS` | body事件 | `<body onload=alert("XSS")>` |
| `应检测javascript:协议XSS` | 协议伪URL | `<a href="javascript:alert('XSS')">` |
| `应检测data:协议XSS` | data URL | `<a href="data:text/html,<script>...">` |
| `应检测Base64编码XSS` | 编码payload | `<script>eval(atob("..."))</script>` |

### HTML实体编码检测

| 测试用例 | 描述 |
|---------|------|
| `应检测HTML实体编码绕过` | `&lt;script&gt;` |

### 防护配置测试

| 测试用例 | 描述 |
|---------|------|
| `blockSuspicious=false时应允许请求` | 验证仅检测模式 |
| `enabled=false时应跳过检查` | 验证禁用防护模式 |

### 变异XSS检测

| 测试用例 | 描述 |
|---------|------|
| `应检测拆分的script标签` | `<scr + ipt>` |
| `应检测空属性XSS` | `<img """><script>` |
| `应检测DOM事件XSS` | `<div onmouseover="alert(1)">` |

---

## 安全HTTP头测试

| 测试用例 | 头名称 | 推荐值 |
|---------|-------|-------|
| `应设置X-Frame-Options头` | X-Frame-Options | DENY |
| `应设置X-Content-Type-Options头` | X-Content-Type-Options | nosniff |
| `应设置X-XSS-Protection头` | X-XSS-Protection | 1; mode=block |
| `应设置Content-Security-Policy头` | Content-Security-Policy | default-src 'self' |
| `应设置Strict-Transport-Security头` | Strict-Transport-Security | max-age=31536000 |
| `应设置Referrer-Policy头` | Referrer-Policy | strict-origin-when-cross-origin |
| `应设置Permissions-Policy头` | Permissions-Policy | 限制危险API |

---

## 集成测试

| 测试用例 | 描述 |
|---------|------|
| `应同时保护多个端点` | 验证中间件链式应用 |
| `正常请求应不受影响` | 验证误报率低 |
| `应正确处理空输入` | 验证边界条件 |
| `应正确处理特殊字符` | 验证中英文特殊字符 |

---

## 性能测试

| 测试用例 | 性能要求 |
|---------|---------|
| `应在合理时间内处理请求` | <100ms |
| `应高效处理大量参数` | 100参数 <200ms |

---

## 运行测试

### 运行所有安全测试
```bash
npm test -- --testPathPattern="security.test.ts"
```

### 运行SQL注入测试
```bash
npm test -- --testPathPattern="security.test.ts" --testNamePattern="SQL注入"
```

### 运行XSS测试
```bash
npm test -- --testPathPattern="security.test.ts" --testNamePattern="XSS"
```

### 运行特定测试用例
```bash
npm test -- --testPathPattern="security.test.ts" --testNamePattern="应检测UNION SELECT注入"
```

### 生成测试覆盖率报告
```bash
npm test -- --coverage --testPathPattern="security.test.ts"
```

---

## 测试覆盖矩阵

### OWASP Top 10 覆盖

| OWASP类别 | 测试状态 | 测试用例数 |
|----------|---------|----------|
| A1: Injection | ✅ 完全覆盖 | 25+ |
| A2: Broken Authentication | ✅ 部分覆盖 | 3 |
| A3: Sensitive Data Exposure | ✅ 完全覆盖 | 5 |
| A7: XSS | ✅ 完全覆盖 | 20+ |

### 等保2.0 覆盖

| 安全要求 | 测试状态 |
|---------|---------|
| 安全计算环境 - 输入验证 | ✅ |
| 安全计算环境 - SQL注入防护 | ✅ |
| 安全区域边界 - XSS防护 | ✅ |

### SOC2 Trust Services Criteria 覆盖

| TSC类别 | 测试状态 |
|---------|---------|
| CC6.1 逻辑访问控制 | ✅ |
| CC7.2 漏洞管理 | ✅ |

---

## 维护指南

### 添加新的SQL注入检测模式

```typescript
// 在 security-center.ts 中添加新的正则模式
const SQL_INJECTION_PATTERNS = [
  // ... 现有模式
  /(\bYOUR_NEW_PATTERN\b)/i,
];
```

### 添加新的XSS检测模式

```typescript
// 在 security-center.ts 中添加新的正则模式
const XSS_PATTERNS = [
  // ... 现有模式
  /<your_new_dangerous_tag/gi,
];
```

### 添加新的测试用例

```typescript
it('应检测新的攻击模式', async () => {
  const { app } = createTestApp({ blockSuspicious: true });
  
  const response = await request(app)
    .post('/test-body')
    .send({ data: 'attack_payload' });
  
  expect(response.status).toBe(400);
  expect(response.body.code).toBe('SUSPICIOUS_REQUEST');
});
```

---

## 故障排除

### 测试失败常见原因

1. **导入路径错误**
   - 确保 `security-center.ts` 正确导出函数

2. **配置对象结构不匹配**
   - 检查 `defaultSecurityConfig` 中的配置结构

3. **异步测试超时**
   - 增加 Jest 超时配置: `jest.setTimeout(10000)`

---

## 参考资料

- [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
- [OWASP XSS](https://owasp.org/www-community/attacks/xss/)
- [等保2.0 - GB/T 22239-2019](http://eel.nisac.gov.cn/)
- [SOC2 Trust Services Criteria](https://www.aicpa.org/soc2)

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|-----|------|---------|
| 1.0.0 | 2024 | 初始版本，包含58+测试用例 |

---

**文档版本**: 1.0.0  
**最后更新**: 2024  
**维护者**: 安全团队
