#!/bin/bash
# PostgreSQL 本地安装脚本 (Linux/macOS)

set -e

echo "🔧 安装 PostgreSQL..."

# macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  if ! command -v psql &> /dev/null; then
    echo "📦 使用 Homebrew 安装 PostgreSQL..."
    brew install postgresql@15
    brew services start postgresql@15
  fi
fi

# Ubuntu/Debian
if [[ -f /etc/debian_version ]]; then
  sudo apt update
  sudo apt install -y postgresql postgresql-contrib
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
fi

# CentOS/RHEL
if [[ -f /etc/redhat-release ]]; then
  sudo yum install -y postgresql-server postgresql-contrib
  sudo postgresql-setup --initdb
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
fi

echo "⚙️ 配置数据库..."

# 创建数据库和用户
sudo -u postgres psql << EOF
-- 创建用户
CREATE USER qianfu WITH PASSWORD 'your_secure_password';

-- 创建数据库
CREATE DATABASE qianfu OWNER qianfu;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE qianfu TO qianfu;

-- 连接数据库并创建扩展
\\c qianfu
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF

echo "✅ PostgreSQL 安装完成!"
echo ""
echo "📋 后续步骤:"
echo "1. 复制环境配置: cp .env.postgresql .env"
echo "2. 编辑 .env 填入正确的密码"
echo "3. 生成 Prisma Client: npx prisma generate"
echo "4. 运行迁移: npx prisma migrate deploy"
