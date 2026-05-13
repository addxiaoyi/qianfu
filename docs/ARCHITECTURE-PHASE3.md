# Phase 3: 高可用强化设计

> 目标：实现 99.9% SLA，支持多区域部署
> 预计工期：4-8 周

---

## 1. 高可用架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Global Layer                                     │
│  ┌─────────────────┐                    ┌─────────────────┐                 │
│  │   Cloudflare    │                    │     AWS/GCP     │                 │
│  │   DNS + CDN     │                    │   Route 53      │                 │
│  └────────┬────────┘                    └────────┬────────┘                 │
│           │                                      │                          │
│           └──────────┬───────────────────────────┘                          │
│                      │                                                       │
└──────────────────────┼──────────────────────────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────────────────────────┐
│                      │         Region: China (Primary)                      │
│  ┌───────────────────┼──────────────────────────────────────────────────┐  │
│  │                   ▼                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐     │  │
│  │  │                    Load Balancer (HAProxy/Nginx)             │     │  │
│  │  │  • Health Checks    • SSL Termination    • Rate Limiting     │     │  │
│  │  └─────────────────────────────────────────────────────────────┘     │  │
│  │                              │                                          │  │
│  │        ┌─────────────────────┼─────────────────────┐                  │  │
│  │        │                     │                     │                  │  │
│  │        ▼                     ▼                     ▼                  │  │
│  │  ┌──────────┐         ┌──────────┐         ┌──────────┐              │  │
│  │  │Instance 1│         │Instance 2│         │Instance 3│              │  │
│  │  │(Primary) │◄───────►│(Standby) │◄───────►│(Standby) │              │  │
│  │  └──────────┘         └──────────┘         └──────────┘              │  │
│  │        │                     │                     │                   │  │
│  │        └─────────────────────┼─────────────────────┘                   │  │
│  │                              │                                          │  │
│  │                              ▼                                          │  │
│  │  ┌─────────────────────────────────────────────────────────────┐     │  │
│  │  │                    Service Mesh (Optional)                    │     │  │
│  │  │    • mTLS           • Circuit Breaker    • Observability     │     │  │
│  │  └─────────────────────────────────────────────────────────────┘     │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 多实例部署策略

### 2.1 服务发现

```yaml
# Kubernetes Deployment 示例
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
        - name: user-service
          image: qianfu/user-service:latest
          ports:
            - containerPort: 3001
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /live
              port: 3001
            initialDelaySeconds: 15
            periodSeconds: 20
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: qianfu-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                configMapKeyRef:
                  name: qianfu-config
                  key: redis-url
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
    - port: 80
      targetPort: 3001
  type: ClusterIP
```

### 2.2 健康检查配置

```typescript
// 健康检查端点配置
const healthCheckConfig = {
  // 存活探针 - 服务是否还在运行
  liveness: {
    path: '/health/live',
    interval: 20,  // 每 20 秒检查
    timeout: 5,
    failureThreshold: 3,  // 3 次失败后重启
  },
  
  // 就绪探针 - 服务是否可以接收流量
  readiness: {
    path: '/health/ready',
    interval: 10,
    timeout: 3,
    failureThreshold: 3,  // 3 次失败后从负载均衡移除
    successThreshold: 1,
  },
  
  // 启动探针 - 给服务时间初始化
  startup: {
    path: '/health',
    interval: 10,
    timeout: 5,
    failureThreshold: 30,  // 最多等 5 分钟启动
  },
};
```

## 3. 灾难恢复设计

### 3.1 数据库备份策略

```sql
-- PostgreSQL 备份配置

-- 1. 每日全量备份 (凌晨 3 点)
0 3 * * * pg_dump -Fc qianfu > /backups/full_$(date +\%Y\%m\%d).dump

-- 2. 每小时 WAL 归档
0 * * * * pg_archiver -d qianfu

-- 3. 保留策略 (保留 30 天全量 + 7 天增量)
-- 清理旧备份
0 4 * * * find /backups -name "*.dump" -mtime +30 -delete

-- 4. 跨区域复制备份
-- 使用 pgBackRest
[global]
repo1-host=backup-server-2
repo1-host-user=postgres
log-level-console=info
log-level-file=debug

[backup]
db-path=/var/lib/postgresql/data
backup-type=full

[archive]
db-path=/var/lib/postgresql/data
archive-type=push
```

### 3.2 RTO/RPO 目标

| 场景 | RTO | RPO | 方案 |
|------|-----|-----|------|
| 单实例故障 | 5 分钟 | 0 | 自动重启 + 多副本 |
| 数据库故障 | 30 分钟 | 1 小时 | 读副本提升 + 备份恢复 |
| 区域故障 | 2 小时 | 1 小时 | 多区域部署 + 数据同步 |
| 数据损坏 | 4 小时 | 最近备份 | 备份恢复 + 人工验证 |

### 3.3 故障切换流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Automatic Failover Flow                   │
└─────────────────────────────────────────────────────────────┘

1. 监控检测到故障
   │
   ▼
2. 触发告警 (PagerDuty)
   │
   ▼
3. 自动/人工确认
   │
   ├──► 自动恢复 ──► 验证服务正常 ──► 关闭告警
   │
   └──► 人工介入
        │
        ├──► 数据库故障
        │    │
        │    ├──► 检查主库状态
        │    ├──► 提升读副本为主库
        │    ├──► 更新连接字符串
        │    └──► 验证数据一致性
        │
        ├──► 服务故障
        │    │
        │    ├──► 重启服务实例
        │    ├──► 如果不行，从备份恢复
        │    └──► 验证数据完整性
        │
        └──► 网络故障
             │
             ├──► 检查 DNS 配置
             ├──► 更新路由
             └──► 验证全球访问
```

## 4. 负载均衡配置

### 4.1 Nginx 负载均衡

```nginx
# upstream 配置 - 最小连接数算法
upstream user_service {
    least_conn;  # 最少连接优先
    
    # 权重配置
    server user-service-1:3001 weight=5;
    server user-service-2:3001 weight=5;
    server user-service-3:3001 weight=3 backup;  # 备用
    
    # 健康检查
    keepalive 32;
}

# 健康检查路由
server {
    listen 8080;
    
    location /health {
        proxy_pass http://user_service;
        proxy_connect_timeout 1s;
        proxy_next_upstream error timeout;
        proxy_next_upstream_tries 3;
    }
}
```

### 4.2 灰度发布

```yaml
# Argo Rollouts 灰度配置
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: user-service
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: {duration: 10m}
        - setWeight: 30
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100
      canaryMetadata:
        labels:
          role: canary
      stableMetadata:
        labels:
          role: stable
      trafficRouting:
        nginx:
          stableIngress: user-service-stable
          additionalIngressAnnotations:
            canary-by-header: X-Canary
      analysis:
        templates:
          - templateName: success-rate
        startingStep: 1
        args:
          - name: service-name
            value: user-service-canary
```

## 5. 监控与告警

### 5.1 核心指标

```yaml
# Prometheus 告警规则
groups:
  - name: service-health
    interval: 30s
    rules:
      # 实例宕机
      - alert: ServiceDown
        expr: up{job="user-service"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.instance }} is down"
          
      # 高错误率
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) 
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Error rate above 5%"
          
      # 高延迟
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, 
            sum(rate(http_request_duration_seconds_bucket[5m])) 
            by (le)) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency above 2s"
          
      # 数据库连接池耗尽
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          pg_pool_available_connections / pg_pool_total_connections < 0.1
        for: 5m
        labels:
          severity: critical
          
      # 内存使用率高
      - alert: HighMemoryUsage
        expr: |
          container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.85
        for: 10m
        labels:
          severity: warning
```

### 5.2 日志聚合

```yaml
# Loki 配置
server:
  http_listen_port: 3100

storage_config:
  aws:
    bucketnames: qianfu-logs
    region: cn-north-1
    
schema_config:
  configs:
    - from: 2024-01-01
      store: aws
      object_store: aws
      schema: v11
      index:
        prefix: index_
        
limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
```

## 6. 容量规划

### 6.1 资源估算

| 组件 | 基础规格 | 峰值规格 | 最大并发 |
|------|----------|----------|----------|
| User Service | 0.5 CPU, 512MB | 2 CPU, 2GB | 10,000 RPS |
| Server Service | 1 CPU, 1GB | 4 CPU, 4GB | 5,000 RPS |
| Payment Service | 0.5 CPU, 512MB | 1 CPU, 1GB | 1,000 RPS |
| PostgreSQL | 2 CPU, 4GB | 8 CPU, 32GB | 500 连接 |
| Redis | 1 CPU, 2GB | 4 CPU, 8GB | 100,000 操作/秒 |
| RabbitMQ | 1 CPU, 1GB | 4 CPU, 8GB | 10,000 消息/秒 |

### 6.2 自动扩缩容

```yaml
# Kubernetes HPA 配置
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
```

---

## 下一步

- [Phase 1](./ARCHITECTURE-PHASE1.md) - 基础设施准备
- [Phase 2](./ARCHITECTURE-PHASE2.md) - 服务拆分
