# 优化项 311: 用户价值 - RFM模型

## 概述

本文档描述如何在项目中实现 RFM 用户价值分析模型，通过 Recency（最近购买）、Frequency（购买频率）、Monetary（购买金额）三个维度对用户进行分群和价值评估，为精准营销和用户运营提供数据支撑。

## RFM 模型简介

RFM 模型是一种经典的客户价值分析模型，广泛应用于用户分群、精准营销和客户生命周期管理。

### 三个维度

| 维度 | 全称 | 含义 | 评分规则 |
|------|------|------|----------|
| R | Recency | 最近一次购买时间 | 越近越高 (1-5分) |
| F | Frequency | 购买频率 | 越高越高 (1-5分) |
| M | Monetary | 购买金额 | 越高越高 (1-5分) |

### 用户分群

根据 RFM 评分组合，可将用户分为 11 个等级：

```
┌─────────────────────────────────────────────────────────────────────┐
│                          RFM 用户价值矩阵                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   高价值用户                                                        │
│   ┌─────────────────┬─────────────────┬─────────────────┐        │
│   │   冠军用户      │   忠诚用户      │   重点挽留      │        │
│   │   (555-544)    │   (543-454)    │   (255-254)    │        │
│   │   VIP服务      │   忠诚计划      │   紧急干预      │        │
│   └─────────────────┴─────────────────┴─────────────────┘        │
│                                                                     │
│   中等价值用户                                                      │
│   ┌─────────────────┬─────────────────┬─────────────────┐        │
│   │   潜在忠诚     │   新用户       │   有潜力        │        │
│   │   (445-344)   │   (335-334)   │   (325-324)   │        │
│   │   升级培养     │   新客转化     │   潜力激活      │        │
│   └─────────────────┴─────────────────┴─────────────────┘        │
│                                                                     │
│   低价值用户                                                        │
│   ┌─────────────────┬─────────────────┬─────────────────┐        │
│   │   需要关注     │   流失风险      │   流失用户      │        │
│   │   (323-233)   │   (332-223)    │   (225-224)    │        │
│   │   唤醒策略     │   流失干预      │   召回尝试      │        │
│   └─────────────────┴─────────────────┴─────────────────┘        │
│                                                                     │
│   边缘用户                                                          │
│   ┌─────────────────┬─────────────────┬─────────────────┐        │
│   │   休眠用户     │   已流失        │   低价值流失    │        │
│   │   (223-214)   │   (215-211)    │   (111-155)    │        │
│   │   休眠唤醒     │   流失召回      │   价值重估      │        │
│   └─────────────────┴─────────────────┴─────────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 现有架构复用

本项目已具备以下可复用基础设施：

| 模块 | 现有能力 | 复用方式 |
|------|----------|----------|
| 分层缓存 (`server/services/cache.ts`) | L1 内存 + L2 Redis 双层缓存 | 存储 RFM 分析结果 |
| 配置管理 (`server/config/env.ts`) | 环境变量统一管理 | RFM 阈值和开关配置 |
| 日志记录 (`server/lib/logger.ts`) | 结构化日志 | 分析日志和调试 |
| API 路由模式 (`server/routes/*.ts`) | REST API 模式 | RFM API 接口 |

## 系统架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                         RFM 用户价值分析系统                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐     ┌──────────────┐     ┌────────────────────┐   │
│   │  用户数据   │────▶│  RFM 计算    │────▶│  用户分群         │   │
│   │  交易记录   │     │  核心算法    │     │  价值评估         │   │
│   └─────────────┘     └──────────────┘     └─────────┬──────────┘   │
│         │                                          │                │
│         ▼                                          ▼                │
│   ┌─────────────┐                          ┌────────────────────┐   │
│   │  数据接口   │                          │  运营策略建议      │   │
│   │  抽象层    │                          │  个性化推荐        │   │
│   └─────────────┘                          └─────────┬──────────┘   │
│                                                      │                │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      API 接口层                             │   │
│   │  /api/rfm/user/:id  /api/rfm/report  /api/rfm/segment/*  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 文件结构

```
server/
├── services/
│   └── rfmService.ts      # RFM 核心服务
└── routes/
    └── rfm.ts             # RFM API 路由
```

## 功能模块

### 1. RFM 核心计算

#### 1.1 RFM 值计算

```typescript
interface RFMValue {
  recency: number;    // 最近一次购买距今天数
  frequency: number;  // 购买次数
  monetary: number;  // 购买总金额
}
```

#### 1.2 RFM 评分 (1-5分)

评分规则：
- **R 评分**: 越近越好，7天内=5分，7-30天=4分，30-60天=3分，60-90天=2分，90天+=1分
- **F 评分**: 越高越好，10次+=5分，5-10次=4分，3-5次=3分，1-3次=2分，0次=1分
- **M 评分**: 越高越好，5000+=5分，1000-5000=4分，500-1000=3分，100-500=2分，<100=1分

#### 1.3 综合评分

三个维度评分组合成 3 位数评分（如 543、421 等），分数越高价值越高。

### 2. 用户分群

| 分群 | 评分范围 | 特征 | 运营策略 |
|------|----------|------|----------|
| 冠军用户 | 555-544 | 高价值核心 | VIP服务、专属权益 |
| 忠诚用户 | 543-454 | 稳定忠诚 | 积分计划、推荐奖励 |
| 重点挽留 | 255-254 | 高价值但活跃下降 | 紧急干预、专项优惠 |
| 潜在忠诚 | 445-344 | 有潜力 | 升级培养、个性化推荐 |
| 新用户 | 335-334 | 刚消费 | 新客转化、首单优惠 |
| 有潜力 | 325-324 | 中等潜力 | 潜力激活、促销活动 |
| 需要关注 | 323-233 | 中等价值 | 唤醒关注、定向优惠 |
| 流失风险 | 332-223 | 活跃下降 | 流失干预、专项召回 |
| 休眠用户 | 223-214 | 长期不活跃 | 休眠唤醒、大额优惠 |
| 已流失 | 215-211 | 已流失 | 流失召回、活动邀请 |
| 低价值流失 | 111-155 | 价值低已流失 | 价值重估、资源优化 |

### 3. 运营策略建议

每个分群配套具体的运营建议：

```typescript
interface RFMStrategy {
  name: string;                    // 策略名称
  description: string;             // 策略描述
  priority: 'high' | 'medium' | 'low'; // 优先级
  recommendations: string[];      // 具体建议
  expectedOutcome: string;       // 预期效果
}
```

### 4. API 接口

#### 4.1 单用户分析

```
GET /api/rfm/user/:userId

Response:
{
  "success": true,
  "data": {
    "userId": "user_123",
    "value": { "recency": 5, "frequency": 8, "monetary": 2500 },
    "score": { "r": 5, "f": 4, "m": 4 },
    "combinedScore": { "score": "544", "value": 544, "label": "champions" },
    "level": "champions",
    "levelDescription": "高价值核心用户，购买频繁、金额高、最近活跃",
    "strategy": {
      "name": "VIP 尊享服务",
      "priority": "high",
      "recommendations": ["专属VIP折扣", "新品内测邀请", "客户经理服务"]
    }
  }
}
```

#### 4.2 用户分群查询

```
GET /api/rfm/users?segment=champions&page=1&pageSize=20

Response:
{
  "success": true,
  "pagination": { "page": 1, "pageSize": 20, "total": 150 },
  "data": [...]
}
```

#### 4.3 高价值/风险用户

```
GET /api/rfm/users/high-value
GET /api/rfm/users/at-risk
```

#### 4.4 RFM 分析报告

```
GET /api/rfm/report

Response:
{
  "success": true,
  "data": {
    "generatedAt": "2024-01-15T10:30:00Z",
    "dateRange": { "start": "2023-10-17", "end": "2024-01-15" },
    "totalUsers": 10000,
    "activeUsers": 8500,
    "segments": [
      {
        "segment": "champions",
        "userCount": 1200,
        "percentage": 12.0,
        "avgRecency": 3.5,
        "avgFrequency": 15.2,
        "avgMonetary": 8500,
        "totalRevenue": 10200000,
        "revenuePercentage": 45.0
      },
      ...
    ],
    "averages": { "recency": 15, "frequency": 4.5, "monetary": 1200 }
  }
}
```

#### 4.5 批量分析

```
POST /api/rfm/users/batch
Body: { "userIds": ["user_1", "user_2", ...] }
```

## 配置项

环境变量支持自定义 RFM 阈值：

```bash
# 分析时段 (天)
RFM_ANALYSIS_PERIOD_DAYS=90

# R 评分阈值
RFM_RECENCY_THRESHOLDS=7,30,60,90

# F 评分阈值
RFM_FREQUENCY_THRESHOLDS=1,3,5,10

# M 评分阈值
RFM_MONETARY_THRESHOLDS=100,500,1000,5000

# 缓存配置
RFM_CACHE_ENABLED=true
RFM_CACHE_TTL=3600000
```

## 使用场景

### 场景 1: VIP 用户运营

```typescript
// 获取高价值用户
const highValueUsers = await rfmService.getHighValueUsers();

// 对冠军用户发送专属优惠
for (const user of highValueUsers) {
  if (user.level === RFMLevel.CHAMPIONS) {
    await sendVIPPromotion(user.userId);
  }
}
```

### 场景 2: 流失预警与召回

```typescript
// 获取流失风险用户
const atRiskUsers = await rfmService.getAtRiskUsers();

// 按风险等级排序，优先处理高风险
const sorted = atRiskUsers.sort((a, b) => a.combinedScore.value - b.combinedScore.value);

// 发送定向召回
for (const user of sorted.slice(0, 100)) {
  await triggerRecallCampaign(user.userId, user.strategy);
}
```

### 场景 3: 运营报告生成

```typescript
// 生成月度 RFM 报告
const report = await rfmService.generateReport();

// 分析各分群贡献
const highValueRevenue = report.segments
  .filter(s => ['champions', 'loyal', 'cant_lose'].includes(s.segment))
  .reduce((sum, s) => sum + s.totalRevenue, 0);

console.log(`高价值用户贡献: ${(highValueRevenue / report.totalRevenue * 100).toFixed(1)}%`);
```

## 扩展方向

1. **自动化运营**: 结合定时任务，自动触发各分群的运营动作
2. **预测模型**: 基于历史 RFM 变化，预测用户价值趋势
3. **实时更新**: 与用户行为事件流集成，实时更新 RFM 评分
4. **个性化推荐**: 结合用户 RFM 分群，生成个性化商品/内容推荐
5. **A/B 测试**: 针对不同分群测试不同运营策略效果

## 数据库集成

当前实现使用 Mock 数据，生产环境需要替换以下方法：

```typescript
// server/services/rfmService.ts

// 替换 1: 获取用户交易数据
private async getUserTransactions(userId: string): Promise<Transaction[]> {
  // TODO: 替换为数据库查询
  // SELECT * FROM transactions WHERE user_id = ? AND created_at > ?
}

// 替换 2: 获取所有用户列表
private async getAllUsers(): Promise<User[]> {
  // TODO: 替换为数据库查询
  // SELECT id, name FROM users WHERE status = 'active'
}
```

## 注意事项

1. **数据准确性**: 确保交易数据的时间戳和金额准确
2. **性能优化**: 大规模用户分析时考虑分批处理和缓存
3. **阈值调优**: 根据业务特点调整 RFM 评分阈值
4. **隐私合规**: RFM 分析涉及用户消费数据，需注意数据合规
5. **动态更新**: 定期重新计算用户 RFM，保持数据时效性

## 总结

RFM 模型是一个简单但强大的用户价值分析工具，通过三个核心维度将用户分为不同价值等级，为精准营销和用户运营提供数据基础。本实现提供了完整的计算逻辑、用户分群、运营策略建议和 API 接口，可直接集成到现有系统中使用。
