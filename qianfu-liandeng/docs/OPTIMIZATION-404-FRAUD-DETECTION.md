# 优化项 404: 风控模型 - 欺诈检测

## 概述

实现一个完整的欺诈检测和风控系统，用于识别和预防各种在线欺诈行为，包括账号被盗、异常交易、恶意注册等场景。

## 功能特性

### 1. 实时风险评分

- 多维度风险因子计算
- 动态权重调整
- 风险等级划分 (LOW/MEDIUM/HIGH/CRITICAL)

### 2. 速度检测 (Velocity Check)

- 基于时间窗口的请求频率检测
- 可配置的时间窗口和最大请求数
- 针对不同事件类型的独立限流

### 3. 设备指纹识别

- 设备指纹生成和追踪
- 新设备检测和告警
- 模拟器/虚拟机检测
- ROOT设备检测

### 4. IP信誉评估

- VPN/代理检测
- TOR出口节点检测
- 数据中心IP识别
- IP黑名单管理
- 地理信息追踪

### 5. 行为分析

- 异常时间检测 (深夜操作)
- 异常地点检测 (异地登录)
- 异常金额检测
- 异常行为模式识别

### 6. 规则引擎

- 可配置的风控规则
- 多种条件操作符支持
- 规则优先级和权重
- 动态启用/禁用

### 7. 机器学习风险评估

- 简单加权平均模型
- 可扩展的高级模型接口
- 置信度阈值控制

### 8. 自动处置

- 自动拦截 (block)
- 挑战验证 (challenge)
- 标记放行 (flag)
- 完整审计日志

## 技术架构

### 核心模块

```
server/
├── middleware/
│   └── security/
│       ├── fraud-detection.ts    # 欺诈检测核心引擎
│       └── index.ts              # 导出
└── routes/
    └── fraud-detection.ts        # Express路由
```

### 类结构

```
FraudDetectionEngine
├── 速度检测
│   └── performVelocityCheck()
├── 设备指纹检测
│   └── performDeviceCheck()
│       ├── detectEmulator()
│       ├── detectRooted()
│       └── detectVirtual()
├── IP信誉检测
│   └── performIpCheck()
│       ├── detectVpn()
│       ├── detectProxy()
│       ├── detectTor()
│       └── detectDatacenter()
├── 行为分析
│   └── performBehaviorCheck()
│       ├── detectUnusualPattern()
│       └── detectUnusualLocation()
├── 规则引擎
│   ├── evaluateRules()
│   └── evaluateCondition()
└── 机器学习评分
    └── calculateMlScore()
```

## 配置项

### FraudDetectionConfig

```typescript
interface FraudDetectionConfig {
  enabled: boolean;                    // 启用状态
  riskThreshold: number;                // 风险阈值 (默认70)
  retentionDays: number;               // 数据保留天数 (默认90)

  velocityCheck: {
    enabled: boolean;
    timeWindow: number;                 // 时间窗口 ms
    maxRequests: number;                // 最大请求数
  };

  deviceFingerprint: {
    enabled: boolean;
    newDeviceAlert: boolean;
    emulatorDetection: boolean;
  };

  ipReputation: {
    enabled: boolean;
    vpnProxyDetection: boolean;
    torExitNodeDetection: boolean;
    datacenterIpDetection: boolean;
  };

  behaviorAnalysis: {
    enabled: boolean;
    unusualTimeDetection: boolean;
    unusualLocationDetection: boolean;
    unusualAmountDetection: boolean;
  };

  rules: {
    enabled: boolean;
    rules: FraudRule[];
  };

  ml: {
    enabled: boolean;
    modelType: 'simple' | 'advanced';
    confidenceThreshold: number;
  };

  autoAction: {
    enabled: boolean;
    highRiskAction: 'block' | 'challenge' | 'allow';
    mediumRiskAction: 'block' | 'challenge' | 'allow';
  };
}
```

## 内置风控规则

| 规则ID | 规则名称 | 描述 | 风险权重 | 处置动作 |
|--------|----------|------|----------|----------|
| RULE-001 | 高频登录失败 | 同一账号短时间内多次登录失败 | 40 | challenge |
| RULE-002 | 大额异常交易 | 单笔交易金额超过历史平均值5倍 | 50 | challenge |
| RULE-003 | 新设备大额转账 | 新设备首次使用即进行大额转账 | 60 | block |
| RULE-004 | 高风险IP访问敏感操作 | VPN/代理/TOR IP访问敏感操作 | 45 | challenge |
| RULE-005 | 异常时间操作 | 深夜(00:00-05:00)进行敏感操作 | 20 | flag |
| RULE-006 | 异地登录 | 短时间内从不同地区登录 | 35 | challenge |
| RULE-007 | 模拟器访问 | 使用模拟器或虚拟机访问 | 55 | block |

## API接口

### POST /api/fraud/check
执行欺诈检测

```json
// Request
{
  "userId": "user123",
  "sessionId": "sess_abc",
  "eventType": "login",
  "amount": 10000,
  "ip": "1.2.3.4",
  "userAgent": "Mozilla/5.0...",
  "deviceFingerprint": "abc123...",
  "location": {
    "country": "CN",
    "region": "Beijing",
    "city": "Beijing"
  }
}

// Response
{
  "success": true,
  "data": {
    "decisionId": "FD-xxxx-xxxx",
    "riskScore": 45,
    "riskLevel": "medium",
    "riskFactors": [...],
    "recommendedAction": "challenge",
    "reason": "检测到3个风险因素: VPN连接; 新设备首次访问; 异常时间段操作",
    "details": {...},
    "timestamp": "2024-01-01T00:00:00.000Z",
    "processingTimeMs": 12
  }
}
```

### GET /api/fraud/records
获取欺诈记录

```
GET /api/fraud/records?userId=user123&riskLevel=high&page=1&pageSize=20
```

### GET /api/fraud/statistics
获取统计数据

```json
{
  "success": true,
  "data": {
    "totalRecords": 1234,
    "recordsLastHour": 56,
    "recordsLastDay": 890,
    "highRiskCount": 45,
    "criticalRiskCount": 12,
    "blockedCount": 78,
    "challengedCount": 234,
    "uniqueUsersMonitored": 5678,
    "uniqueIpsMonitored": 3456,
    "uniqueDevicesMonitored": 7890
  }
}
```

### GET /api/fraud/rules
获取风控规则列表

### PUT /api/fraud/rules/:ruleId
更新风控规则

### POST /api/fraud/ip/:ip/blacklist
将IP加入黑名单

### DELETE /api/fraud/ip/:ip/blacklist
将IP从黑名单移除

### GET /api/fraud/config
获取风控配置

### PUT /api/fraud/config
更新风控配置

## Express中间件

### fraudDetectionMiddleware

```typescript
import { fraudDetectionMiddleware } from './middleware';

// 全局应用
app.use('/api', fraudDetectionMiddleware({
  eventType: FraudEventType.API_REQUEST,
  skipPaths: ['/health', '/metrics'],
  collectDeviceFingerprint: true
}));

// 针对特定路由
app.post('/login', loginFraudDetectionMiddleware(), loginHandler);
app.post('/register', registerFraudDetectionMiddleware(), registerHandler);
app.post('/transaction', transactionFraudDetectionMiddleware(), transactionHandler);
```

### 中间件行为

- **block**: 返回403，禁止访问
- **challenge**: 在响应头添加风险信息，要求进一步验证
- **allow**: 添加风险评分头，正常处理

### 响应头

```
X-Risk-Score: 45
X-Risk-Level: medium
X-Decision-Id: FD-xxxx-xxxx
X-Fraud-Challenge: required
```

## 使用示例

### 1. 基本使用

```typescript
import {
  initializeFraudDetection,
  getFraudDetectionEngine,
  fraudDetectionMiddleware
} from './middleware';

// 初始化引擎
const engine = initializeFraudDetection({
  riskThreshold: 70,
  velocityCheck: {
    enabled: true,
    timeWindow: 60000,
    maxRequests: 30
  }
});

// 在Express中使用
app.use('/api', fraudDetectionMiddleware());

// 或直接调用检测
const result = await engine.check({
  userId: 'user123',
  sessionId: 'sess_abc',
  eventType: FraudEventType.LOGIN,
  ip: req.ip,
  userAgent: req.headers['user-agent']
});
```

### 2. 自定义规则

```typescript
const engine = getFraudDetectionEngine();
const config = engine.getConfig();

config.rules.rules.push({
  id: 'CUSTOM-001',
  name: '自定义规则',
  description: '自定义风险检测规则',
  type: 'custom',
  conditions: [
    { field: 'amount', operator: 'gt', value: 50000 }
  ],
  riskWeight: 70,
  action: 'block',
  enabled: true
});

engine.updateConfig(config);
```

### 3. 手动IP管理

```typescript
// 封禁可疑IP
engine.blacklistIp('1.2.3.4');

// 解除封禁
engine.unblacklistIp('1.2.3.4');

// 查询IP档案
const ipProfile = engine.getIpProfile('1.2.3.4');
```

## 风险评分算法

### 计算公式

```
总风险评分 = Σ(风险因子分数 × 风险因子权重) / Σ权重
```

### 风险因子权重

| 因子类型 | 默认权重 | 说明 |
|----------|----------|------|
| velocity | 30 | 速度异常 |
| device | 25 | 设备指纹异常 |
| ip | 35 | IP信誉异常 |
| behavior | 20 | 行为分析异常 |
| ml | 40 | 机器学习模型 |
| rule | 规则权重 | 规则引擎触发 |

### 风险等级阈值

| 等级 | 分数范围 | 建议处置 |
|------|----------|----------|
| LOW | 0-29 | allow |
| MEDIUM | 30-59 | challenge |
| HIGH | 60-79 | highRiskAction |
| CRITICAL | 80-100 | highRiskAction |

## 扩展建议

### 1. 集成外部服务

- GeoIP服务 (MaxMind, IPinfo)
- VPN/代理检测API (IPQualityScore, FraudLabs Pro)
- 设备指纹服务 (FingerprintJS)

### 2. 机器学习模型

```typescript
// 高级模型接口
class AdvancedMlModel {
  predict(request: FraudCheckRequest): number {
    // 实现自定义ML模型
    // 支持TensorFlow.js, PyTorch等
  }
}
```

### 3. 实时告警

```typescript
// WebSocket实时推送
fraudDetection.on('highRisk', (result) => {
  // 发送告警通知
  notifySecurityTeam(result);
});
```

## 性能考虑

1. **缓存优化**: 设备指纹和IP档案使用内存缓存
2. **异步处理**: 检测可异步执行，不阻塞请求
3. **数据清理**: 自动清理过期数据，控制内存占用
4. **批量处理**: 支持批量检测接口

## 合规性

本模块满足以下合规要求:

- **等保2.0**: 安全计算环境、安全管理中心
- **SOC2**: CC7 系统运行、CC6 逻辑访问控制
- **PCI-DSS**: 欺诈检测、异常检测

## 相关文档

- [优化项 120: 等保合规](OPTIMIZATION-120-DENGBAO-COMPLIANCE.md)
- [优化项 119: SOC2合规准备](OPTIMIZATION-119-SOC2-COMPLIANCE.md)
- [安全中心](server/middleware/security/security-center.ts)
