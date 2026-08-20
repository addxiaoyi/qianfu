# starX 邮件服务配置
# 邮件系统名称: starX
# 服务器: 121.196.161.249 (阿里云)
# 域名: 0st.top, mail.0st.top, starx.0st.top

## 连接信息
# 千服与 starX 同机时使用回环地址；跨服务器请使用 starx.0st.top
STARX_SMTP_HOST=127.0.0.1
STARX_SMTP_PORT=587
STARX_SMTP_SECURE=false
STARX_SMTP_TLS=true

## 认证信息 (需要向管理员申请)
STARX_SMTP_USER=
STARX_SMTP_PASSWORD=
STARX_MAIL_FROM=noreply@0st.top

## 千服项目环境变量

千服后端读取 `SMTP_*`，不是 `MAIL_SMTP_*`。同机部署建议：

```dotenv
SMTP_HOST=127.0.0.1
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_user@0st.top
SMTP_PASS=<通过服务器密钥注入>
SMTP_FROM=noreply@0st.top
EMAIL_FROM=noreply@0st.top
```

在没有 Submission 账号前，可以继续使用仅限本机的 `127.0.0.1:25` 中继；不要把无认证中继开放给公网。

## API 方式 (推荐)
# 千服平台已集成 starX，通过 API 调用更方便
# POST https://mc-u.top/api/v1/auth/send-verification-code
# POST https://mc-u.top/api/v1/mail/send

## 其他服务器接入方式

### Node.js / TypeScript
```javascript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.STARX_SMTP_HOST || 'starx.0st.top',
  port: 587,
  secure: false,
  tls: {
    rejectUnauthorized: true,
  },
  auth: {
    user: process.env.STARX_SMTP_USER,
    pass: process.env.STARX_SMTP_PASSWORD,
  }
});

await transporter.sendMail({
  from: 'noreply@0st.top',
  to: 'user@example.com',
  subject: 'Test',
  html: '<p>Test content</p>'
});
```

### Python
```python
import os
import smtplib
from email.mime.text import MIMEText

msg = MIMEText('<p>Test content</p>', 'html')
msg['From'] = 'noreply@0st.top'
msg['To'] = 'user@example.com'
msg['Subject'] = 'Test'

with smtplib.SMTP('starx.0st.top', 587) as server:
    server.starttls()
    server.login(os.environ['STARX_SMTP_USER'], os.environ['STARX_SMTP_PASSWORD'])
    server.send_message(msg)
```

### Docker Compose
```yaml
services:
  app:
    environment:
      - MAIL_SMTP_HOST=starx.0st.top
      - MAIL_SMTP_PORT=587
      - MAIL_SMTP_USER=${MAIL_USER}
      - MAIL_SMTP_PASSWORD=${MAIL_PASSWORD}
```

## 端口说明
| 端口 | 协议 | 用途 |
|------|------|------|
| 25   | SMTP | 入站邮件 (需公网 IP) |
| 587  | Submission | 提交邮件 (TLS 推荐) |
| 143  | IMAP | 接收邮件 (STARTTLS) |
| 993  | IMAPS | 接收邮件 (SSL) |

## 添加新用户
```bash
ssh root@121.196.161.249
# 使用受保护的 MySQL 凭据文件或交互式输入密码，不要把密码写入命令历史。
mysql -u root -p mailserver
# 然后插入新用户到 virtual_users 表
```

## 安全要求

- 不要设置 `rejectUnauthorized=false`，除非在隔离的本地调试环境中临时排查证书问题。
- SMTP 密码只通过服务器环境变量或密钥管理器注入，不提交到 Git、文档或工单。
- 587 是提交端口；应用同机部署时优先使用 `127.0.0.1`，避免绕过本机防火墙访问公网 IP。
# 当前生产接入参数（2026-07-19）

- 邮件域名：`0st.top`
- MX：`mail.0st.top` → `121.196.161.249`
- SMTP Submission：`mc-u.top:587`，STARTTLS，SMTP AUTH
- IMAP：`mc-u.top:993`，TLS
- 管理邮箱：`admin@0st.top`
- 别名：`support@0st.top`、`contact@0st.top`、`noreply@0st.top` 均投递到管理邮箱
- 凭据仅保存在服务器 `/root/qianfu-mail-access.txt`（权限 `600`），不得提交到 Git、聊天或共享文档

> 当前源站证书是自签名证书。千服应用仅在同机 `127.0.0.1` 的 IMAP 连接中允许该证书；其他服务器不应设置 `rejectUnauthorized=false`。待 `mail.0st.top` 完成备案或提供阿里云 DNS API 凭据后，应使用 DNS-01 签发公开可信证书再开放跨机使用。

## 其他服务器示例

```env
SMTP_HOST=mc-u.top
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@0st.top
SMTP_PASS=<从服务器安全读取，不要写入仓库>
SMTP_FROM=admin@0st.top
MAIL_FROM_NAME=自定义发件人名称
MAIL_REPLY_TO=admin@0st.top

IMAP_HOST=mc-u.top
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=admin@0st.top
IMAP_PASS=<从服务器安全读取，不要写入仓库>
```

应用可自由设置 `from.name`、`replyTo`、`subject` 和 HTML 正文。HTML 必须在服务端清洗，禁止脚本、事件属性、`javascript:` 链接和远程跟踪像素。
