# Elasticsearch 服务器部署指南

> 文档版本: 1.0.0
> 创建日期: 2026-07-07
> 目标: 在生产服务器上部署 ES 集群

---

## 1. 服务器要求

### 最低配置 (单节点)
- CPU: 2 核+
- 内存: 4GB+ (ES_JAVA_OPTS=-Xms2g -Xmx2g)
- 磁盘: 20GB+ SSD
- 系统: Ubuntu 20.04+ / CentOS 7+

### 推荐配置 (生产环境)
- CPU: 4 核+
- 内存: 8GB+ (ES_JAVA_OPTS=-Xms4g -Xmx4g)
- 磁盘: 50GB+ SSD
- 网络: 100Mbps+

---

## 2. 服务器部署步骤

### Step 1: 连接服务器
```bash
ssh root@your-server-ip
```

### Step 2: 安装 Docker (如果未安装)
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker

# CentOS/RHEL
sudo yum install -y docker
sudo systemctl enable docker
sudo systemctl start docker
```

### Step 3: 创建部署目录
```bash
mkdir -p /opt/qianfu-elasticsearch
cd /opt/qianfu-elasticsearch
```

### Step 4: 上传配置文件
将以下 `docker-compose.yml` 上传到服务器 `/opt/qianfu-elasticsearch/`

### Step 5: 配置环境变量
```bash
cp .env.example .env
nano .env  # 编辑密码
```

### Step 6: 启动服务
```bash
docker-compose up -d
```

### Step 7: 验证部署
```bash
# 检查容器状态
docker ps

# 检查 ES 健康状态
curl -u elastic:YOUR_PASSWORD http://localhost:9200/_cluster/health

# 检查 Kibana
curl http://localhost:5601/api/status
```

---

## 3. Docker Compose 配置 (服务器版)

```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
    container_name: qianfu-elasticsearch
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=-Xms4g -Xmx4g
      - xpack.security.enabled=true
      - xpack.security.enrollment.enabled=true
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
      - bootstrap.memory_lock=true
      - indices.memory.index_buffer_size=20%
    ports:
      - "127.0.0.1:9200:9200"  # 仅本地访问
      - "127.0.0.1:9300:9300"
    volumes:
      - es_data:/usr/share/elasticsearch/data
      - es_logs:/usr/share/elasticsearch/logs
    healthcheck:
      test: ["CMD-SHELL", "curl -s --user elastic:${ELASTIC_PASSWORD} http://localhost:9200/_cluster/health | grep -q '\"status\":\"green\"\\|\"status\":\"yellow\"'"]
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 60s
    ulimits:
      memlock:
        soft: -1
        hard: -1
    mem_limit: 6g
    restart: unless-stopped
    networks:
      - es-network

  kibana:
    image: docker.elastic.co/kibana/kibana:8.12.0
    container_name: qianfu-kibana
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - ELASTICSEARCH_USERNAME=kibana_system
      - ELASTICSEARCH_PASSWORD=${KIBANA_PASSWORD}
      - XPACK_SECURITY_ENABLED=true
    ports:
      - "127.0.0.1:5601:5601"  # 仅本地访问
    depends_on:
      elasticsearch:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:5601/api/status | grep -q '\"level\":\"available\"'"]
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 90s
    restart: unless-stopped
    networks:
      - es-network

volumes:
  es_data:
    driver: local
  es_logs:
    driver: local

networks:
  es-network:
    driver: bridge
```

---

## 4. 环境变量文件 (.env)

```bash
# Elasticsearch 配置
ELASTIC_PASSWORD=your_strong_password_here
KIBANA_PASSWORD=your_kibana_password_here

# JVM 配置 (可选)
ES_HEAP_SIZE=4g
```

---

## 5. Nginx 反向代理配置

### /etc/nginx/conf.d/es-proxy.conf

```nginx
# ES API 反向代理 (仅内部访问)
server {
    listen 9201 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # 限制 IP 访问
    allow 10.0.0.0/8;      # 内部网络
    allow 172.16.0.0/12;   # Docker 网络
    allow 192.168.0.0/16;  # 局域网
    deny all;

    location / {
        proxy_pass http://127.0.0.1:9200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # ES 特定配置
        proxy_http_version 1.1;
        proxy_set_header Connection 'Keep-Alive';
        proxy_read_timeout 300s;
    }
}

# Kibana 反向代理 (仅内部访问)
server {
    listen 5602 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # 限制 IP 访问
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;

    location / {
        proxy_pass http://127.0.0.1:5601;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

---

## 6. 应用配置更新

在 `dist-server/.env` 中添加：

```bash
# Elasticsearch
ELASTICSEARCH_NODE=http://your-server-ip:9201
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_strong_password_here
ES_INDEX_PREFIX=qianfu-servers
FEATURE_FLAG_ES_SEARCH=false
```

---

## 7. 运维命令

```bash
# 查看日志
docker logs -f qianfu-elasticsearch
docker logs -f qianfu-kibana

# 重启服务
docker-compose restart

# 更新版本
docker-compose pull
docker-compose up -d

# 备份数据
docker run --rm -v qianfu_es_data:/data -v /backup:/backup alpine tar czf /backup/es-backup-$(date +%Y%m%d).tar.gz -C /data .

# 停止服务
docker-compose down
```

---

## 8. 安全注意事项

1. **不暴露公网**: ES 9200 端口仅绑定 127.0.0.1
2. **强密码**: 使用 32 位以上随机密码
3. **定期备份**: 配置自动备份脚本
4. **监控告警**: 配置健康检查告警
5. **防火墙**: 仅允许应用服务器访问

---

## 9. 一键部署脚本

创建 `deploy-es.sh`:

```bash
#!/bin/bash
set -e

echo "=== 千服平台 ES 部署脚本 ==="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com | sh
fi

# 创建目录
mkdir -p /opt/qianfu-elasticsearch
cd /opt/qianfu-elasticsearch

# 启动服务
echo "启动 Elasticsearch..."
docker-compose up -d

# 等待健康检查
echo "等待服务就绪..."
sleep 30

# 验证
echo "验证部署..."
curl -s -u elastic:${ELASTIC_PASSWORD} http://localhost:9200/_cluster/health | jq

echo "=== 部署完成 ==="
echo "ES: http://localhost:9200"
echo "Kibana: http://localhost:5601"
```
