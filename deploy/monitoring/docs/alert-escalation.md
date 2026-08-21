# Alert Escalation Service - 用户配置指南

## 概述

告警升级服务（Alert Escalation Service）是一个用于自动管理 Prometheus 告警升级的解决方案。它实现了基于时间梯度的告警升级机制，支持多级接收者配置、告警聚合和静默窗口功能。

## 功能特性

- **时间梯度升级**: 支持 5min → 15min → 30min → 60min → 120min 的自动升级
- **多级接收者**: 值班工程师 → 技术组长 → 部门经理 → 值班主管 → 紧急响应
- **告警聚合**: 在指定时间窗口内聚合相似告警，减少通知噪音
- **静默窗口**: 支持维护窗口和工作时间静默配置
- **多渠道通知**: 支持邮件、Webhook、短信、电话（通过 PagerDuty）
- **手动升级**: 支持通过 API 手动升级指定告警
- **Prometheus 指标**: 暴露 Prometheus 格式的监控指标

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Alert Escalation Service                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐│
│  │   Alert     │  │  Escalation │  │      Silence            ││
│  │   State     │  │   Engine    │  │      Manager            ││
│  └─────────────┘  └─────────────┘  └─────────────────────────┘│
│         │                │                     │                 │
│         └────────────────┼─────────────────────┘                 │
│                          │                                         │
│  ┌──────────────────────▼──────────────────────────────────────┐│
│  │                  AlertManager API Client                      ││
│  └──────────────────────┬──────────────────────────────────────┘│
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Alertmanager │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Prometheus   │
                    └─────────────┘
```

## 升级级别

| 级别 | 名称 | 触发时间 | 通知渠道 | 接收人 |
|------|------|----------|----------|--------|
| L1 | 值班工程师 | 0分钟（初始） | 邮件 + Webhook | 值班工程师 |
| L2 | 技术组长 | 5分钟后 | 邮件 + Webhook | 技术组长 |
| L3 | 部门经理 | 15分钟后 | 邮件 + Webhook + 钉钉 | 部门经理 |
| L4 | 值班主管 | 30分钟后 | 邮件 + Webhook + 企业微信 | 值班主管 |
| L5 | 紧急响应 | 60分钟后 | 电话 + 短信 + 邮件 + 企业微信 | 紧急响应团队 |

## 配置

### 环境变量

#### Alertmanager 连接
```bash
ALERTMANAGER_URL=http://alertmanager:9093
ALERTMANAGER_USER=
ALERTMANAGER_PASSWORD=
```

#### 通知 Webhook
```bash
# 各级别 Webhook（钉钉、飞书等）
ONCALL_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
LEAD_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
MANAGER_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
DUTY_HEAD_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
EMERGENCY_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
```

#### 邮件通知
```bash
ALERT_EMAIL_TO=alerts@example.com
ONCALL_EMAIL=oncall@example.com
LEAD_EMAIL=lead@example.com
MANAGER_EMAIL=manager@example.com
DUTY_HEAD_EMAIL=dutyhead@example.com
EMERGENCY_EMAIL=emergency@example.com
```

#### 短信/电话通知
```bash
SMS_ENABLED=false
PHONE_ENABLED=false
# 如果启用，需要配置 PagerDuty
PAGERDUTY_SERVICE_KEY=
PAGERDUTY_ROUTING_KEY=
```

#### 静默窗口
```bash
# 启用维护窗口静默（周日 2:00-4:00）
ENABLE_MAINTENANCE_WINDOW=false

# 启用工作时间静默（周一至周五 9:00-18:00，仅 info 级别）
ENABLE_BUSINESS_HOURS=false
```

### 服务配置

```yaml
# docker-compose.monitoring.yml
escalation-service:
  environment:
    - ALERTMANAGER_URL=http://alertmanager:9093
    - CHECK_INTERVAL=30000  # 30秒检查一次
    - LOG_LEVEL=info
```

## Prometheus 告警规则配置

在告警规则中添加 `escalation: auto` 和 `escalation_level` 标签：

```yaml
groups:
  - name: example_alerts
    rules:
      - alert: HighCPUCritical
        expr: cpu_usage > 95
        for: 2m
        labels:
          severity: critical
          category: resource
          team: ops
          escalation: auto        # 启用自动升级
          escalation_level: '1'    # 从 L1 开始
        annotations:
          summary: "CPU 使用率严重过高"
          description: "实例 {{ $labels.instance }} 的 CPU 使用率超过 95%"
          action: "立即处理"
```

### 按严重程度配置

#### Critical 级别
- 自动升级: L1 → L2 → L3 → L4 → L5
- 初始通知: L1 (值班工程师)
- 自动解决: 启用
- 重复通知间隔: 15分钟

#### Warning 级别
- 自动升级: L2 → L3
- 初始通知: L2 (值班工程师)
- 自动解决: 禁用
- 重复通知间隔: 60分钟

#### Info 级别
- 自动升级: 禁用
- 默认静默到工作时间

## API 接口

### 健康检查
```bash
GET /health
```

### Prometheus 指标
```bash
GET /metrics
```

### 服务状态
```bash
GET /api/status
```

响应示例:
```json
{
  "success": true,
  "data": {
    "running": true,
    "totalAlerts": 5,
    "silencedAlerts": 1,
    "lastCheck": "2024-01-15T10:30:00.000Z",
    "escalationTimelines": [...],
    "severityEscalation": {...}
  }
}
```

### 手动升级
```bash
POST /api/alerts/{alertId}/escalate
Content-Type: application/json

{
  "level": 3,
  "reason": "需要立即处理"
}
```

### 静默管理
```bash
# 创建静默
POST /api/silences
{
  "matchers": [
    { "name": "alertname", "value": "HighCPUCritical", "regex": false },
    { "name": "instance", "value": "server-01", "regex": false }
  ],
  "duration": 60,
  "comment": "维护期间静默"
}

# 查询静默
GET /api/silences

# 删除静默
DELETE /api/silences/{silenceId}
```

### 更新配置
```bash
PUT /api/config
{
  "checkInterval": 60000,
  "escalationTimelines": [
    { "minutes": 10, "level": 1, "action": "notify_oncall" },
    ...
  ]
}
```

## 静默窗口配置

### 维护窗口
在周日 2:00-4:00 自动静默可用性和资源类告警：

```yaml
silenceWindows:
  maintenance:
    enabled: true
    cron: '0 2 * * 0'  # 每周日 2:00
    duration: 120      # 持续 120 分钟
    matchers:
      - name: category
        value: availability
        regex: false
      - name: category
        value: resource
        regex: false
```

### 工作时间静默
在工作时间（周一至周五 9:00-18:00）静默 info 级别告警：

```yaml
silenceWindows:
  businessHours:
    enabled: true
    startHour: 9
    endHour: 18
    workDays: [1, 2, 3, 4, 5]  # 周一到周五
    severityFilter:
      - info
```

## 告警聚合

在指定时间窗口内聚合相似的告警，减少通知噪音：

```yaml
aggregation:
  enabled: true
  windowSeconds: 300  # 5分钟聚合窗口
  maxAlertsPerGroup: 10
```

聚合规则基于以下标签：
- alertname
- severity
- category
- team

## 部署

### Docker Compose 部署
```bash
# 启动监控栈（包括升级服务）
docker-compose -f docker-compose.monitoring.yml up -d

# 查看日志
docker logs -f qianfu-escalation-service

# 查看服务状态
curl http://localhost:9094/health
```

### 单独启动升级服务
```bash
# 构建镜像
cd docker/escalation
npm install
npm run build

# 运行
npm start
```

## 故障排除

### 服务无法启动
1. 检查 Alertmanager 连接: `curl http://localhost:9093/-/healthy`
2. 检查环境变量配置
3. 查看日志: `docker logs qianfu-escalation-service`

### 告警未触发升级
1. 确认告警标签包含 `escalation: auto`
2. 确认 `escalation_level` 标签正确设置
3. 检查升级服务日志中的升级记录

### 通知未发送
1. 确认 Webhook URL 正确配置
2. 检查 Webhook 是否有访问限制
3. 验证邮件配置（SMTP）

## 最佳实践

1. **合理设置升级时间**: 根据团队响应能力调整升级间隔
2. **配置值班表**: 确保值班工程师信息及时更新
3. **设置静默窗口**: 在维护期间提前设置静默
4. **监控升级服务**: 将升级服务本身纳入监控
5. **定期回顾**: 定期检查升级统计数据，优化升级策略
6. **多渠道通知**: 为关键告警配置多种通知渠道
7. **告警分级**: 合理划分 Critical/Warning/Info 级别

## 监控升级服务自身

```yaml
# Prometheus 告警
- alert: EscalationServiceDown
  expr: escalation_service_running == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "告警升级服务离线"
    action: "立即检查升级服务状态"
```
