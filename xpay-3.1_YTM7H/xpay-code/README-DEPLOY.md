# StarMC Payment System v3.1 - 智能部署指南

> 本文档供AI阅读执行，请严格按照步骤操作

与本仓库 **Node 千服** 的关系：千服根目录旁即为本支付系统源码；启动本服务（默认 `8888`）后，在千服 `.env` 中配置 `QIANFU_API_URL=http://<主机>:8888/qianfu-api`，回调地址指向千服 `QIANFU_CALLBACK_URL`（见仓库根目录 `.env.example`）。勿把本目录当作可删除的第三方拷贝。

**不用 Docker、与本仓库一起本机跑：** 先保证本机 MySQL / Redis 与下方 `application.properties` 一致，然后在千服根目录执行 `npm run xpay:dev`（仅 XPay），或一条命令同时起前端 + Node API + XPay：`npm run dev:stack:xpay`（可选 `dev:stack:xpay:open` 自动打开浏览器）。无需容器即可与千服融为一体。

---

## 一、环境要求

| 组件 | 版本 | 最小内存 | 说明 |
|------|------|---------|------|
| JDK | 17+ | 1GB | OpenJDK 17 or Oracle JDK 17 |
| MySQL | 8.0+ | 1GB | 需要root权限创建数据库 |
| Redis | 6.0+ | 512MB | 用于会话和缓存 |
| 系统 | Linux | 2GB | CentOS 7+ / Ubuntu 20.04+ |

---

## 二、快速部署 (一键)

```bash
# 1. 上传项目到服务器后，进入含 start.sh 的项目根目录（以下命令均假定当前工作目录即为该目录）

# 2. SSH 登录后执行:
chmod +x start.sh
sudo ./start.sh

# 3. 访问: http://服务器IP:8888
```

---

## 三、start.sh 智能功能

脚本自动完成以下操作 **无需人工干预**：

### 3.1 环境检测
- [x] 检测JDK 17，如未安装自动下载安装
- [x] 检测Maven，如未安装自动下载安装
- [x] 检测MySQL 8，如未运行自动启动
- [x] 检测Redis，如未运行自动启动
- [x] 检测端口8888占用，智能清理

### 3.2 数据库初始化
- [x] 自动创建数据库 `xpay`
- [x] 自动创建所有表结构
- [x] 无需手动执行SQL

### 3.3 配置更新
- [x] 自动检测服务器IP
- [x] 自动更新 `server.url`
- [x] 自动处理微信回调URL
- [x] 支持环境变量覆盖配置

### 3.4 编译打包
- [x] 自动执行 `mvn clean package`
- [x] 跳过测试加速构建
- [x] 生成可执行JAR包

### 3.5 启动服务
- [x] 后台运行应用
- [x] 输出启动日志
- [x] 健康检查确认启动成功

---

## 四、配置文件说明

### 4.1 主要配置 `src/main/resources/application.properties`

```properties
# ===== 数据库配置 =====
spring.datasource.url=jdbc:mysql://127.0.0.1:3306/xpay
spring.datasource.username=root
spring.datasource.password=YOUR_PASSWORD    # 请修改

# ===== Redis配置 =====
spring.redis.host=127.0.0.1
spring.redis.password=YOUR_REDIS_PASSWORD   # 如有密码请修改

# ===== 服务器配置 =====
server.port=8888
server.url=http://YOUR_DOMAIN:8888          # 请修改为你的域名

# ===== 千服支付配置 =====
qianfu.enabled=true
qianfu.app-id=xpay-starmc-2024
qianfu.secret-key=YOUR_SECRET_KEY
qianfu.api-url=http://121.196.161.249:8888/qianfu-api
```

### 4.2 微信配置 `src/main/resources/application-wechat.yml`

```yaml
wechat:
  mp:
    app-id: wx273345387c8a39f0           # 已配置AppID
    app-secret: YOUR_APP_SECRET           # 已配置AppSecret
    token: StarMC2024WechatToken         # 已配置Token
    aes-key: ${WECHAT_AES_KEY:}          # 如启用消息加密请填写
```

### 4.3 管理员配置 `src/main/resources/application-admin.yml`

```yaml
admin:
  super-admin-openid: ""                   # 首个审批人的OpenID
  require-approval: true                   # 开启管理员审批流程
```

---

## 五、环境变量覆盖

支持通过环境变量覆盖配置：

```bash
# 示例：使用环境变量启动
export DB_PASSWORD=mysecret123
export REDIS_PASSWORD=redis123
export SERVER_URL=http://example.com:8888
export WECHAT_APP_ID=wx1234567890
export WECHAT_APP_SECRET=abcdef123456

./start.sh
```

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| DB_PASSWORD | MySQL密码 | 123456 |
| DB_HOST | MySQL地址 | 127.0.0.1 |
| DB_NAME | 数据库名 | xpay |
| REDIS_PASSWORD | Redis密码 | (空) |
| SERVER_URL | 服务器URL | http://IP:8888 |
| WECHAT_APP_ID | 微信AppID | wx273345387c8a39f0 |
| WECHAT_APP_SECRET | 微信AppSecret | e667a37b07ebb3b836bb257852bd793b |
| WECHAT_TOKEN | 微信Token | StarMC2024WechatToken |
| APP_PORT | 应用端口 | 8888 |

---

## 六、数据库表结构

脚本自动创建以下表：

| 表名 | 说明 |
|------|------|
| t_admin_user | 管理员用户表 |
| t_qr_code_login | 二维码登录记录表 |
| t_admin_login_log | 登录日志表 |
| t_pay | 支付订单表 |
| t_qianfu_recharge | 千服充值记录表 |
| t_qianfu_order | 千服订单表 |

---

## 七、微信公众平台配置

### 7.1 登录微信公众平台
访问: https://mp.weixin.qq.com

### 7.2 配置服务器URL
1. 进入「设置与开发」→「基本配置」
2. 填写服务器地址(URL)：`http://你的域名/wechat/callback`
3. 填写Token：`StarMC2024WechatToken`
4. 选择消息加密方式（建议兼容模式）
5. 点击提交

### 7.3 配置网页授权
1. 进入「设置与开发」→「公众号设置」→「功能设置」
2. 设置JS接口安全域名
3. 设置网页授权域名

---

## 八、常用操作

### 8.1 查看日志
```bash
# 在项目根目录下执行（与 start.sh 同级）
tail -f logs/start_*.log
```

### 8.2 重启服务
```bash
# 在项目根目录下执行
./stop.sh
./start.sh
```

### 8.3 检查状态
```bash
curl http://localhost:8888/actuator/health
```

### 8.4 卸载服务
```bash
# 在项目根目录下执行
./stop.sh
# 删除数据库
mysql -u root -p -e "DROP DATABASE IF EXISTS xpay;"
```

---

## 九、故障排查

### 9.1 端口被占用
```bash
# 查看端口占用
sudo lsof -i:8888
# 或使用脚本清理
./portclean.sh 8888
```

### 9.2 数据库连接失败
```bash
# 检查MySQL状态
sudo systemctl status mysql
# 检查MySQL日志
sudo tail -f /var/log/mysql/error.log
```

### 9.3 Redis连接失败
```bash
# 检查Redis状态
sudo systemctl status redis
# 测试Redis连接
redis-cli ping
```

### 9.4 编译失败
```bash
# 清理Maven缓存
mvn clean
# 重新编译
mvn clean package -DskipTests
```

---

## 十、安全建议

1. **修改默认密码**：MySQL root密码、Redis密码
2. **配置防火墙**：仅开放必要端口 80, 443, 8888
3. **启用HTTPS**：使用Nginx配置SSL证书
4. **定期备份**：数据库和配置文件
5. **日志监控**：关注异常登录和错误日志

---

## 十一、Nginx HTTPS配置 (可选)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 十二、联系支持

如遇问题请检查：
1. 日志文件 `logs/` 目录
2. MySQL错误日志
3. Redis错误日志
4. Java进程状态 `jps -l`

---

**文档版本**: 3.1.0
**更新日期**: 2026-03-21
**适用版本**: StarMC Payment System v3.1
