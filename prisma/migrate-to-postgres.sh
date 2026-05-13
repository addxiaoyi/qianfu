#!/bin/bash
# Prisma 多数据库切换脚本

SCHEMA="${1:-default}"

case "$SCHEMA" in
  "sqlite")
    echo "📦 使用 SQLite schema..."
    export DATABASE_URL="file:./dev.db"
    npx prisma generate --schema=prisma/schema.prisma
    ;;
  "postgres"|"postgresql")
    echo "📦 使用 PostgreSQL schema..."
    export DATABASE_URL="$DATABASE_URL"  # 从环境变量读取
    npx prisma generate --schema=prisma/schema.postgresql.prisma
    ;;
  "dev")
    echo "📦 开发模式 (SQLite)..."
    export DATABASE_URL="file:./dev.db"
    npx prisma db push --schema=prisma/schema.prisma
    ;;
  "prod")
    echo "📦 生产模式 (PostgreSQL)..."
    export DATABASE_URL="$DATABASE_URL"
    npx prisma migrate deploy --schema=prisma/schema.postgresql.prisma
    ;;
  "migrate")
    echo "🔄 迁移 SQLite → PostgreSQL..."
    node scripts/migrate-sqlite-to-postgresql.ts
    ;;
  *)
    echo "用法: ./scripts/switch-db.sh [sqlite|postgres|dev|prod|migrate]"
    echo ""
    echo "  sqlite     - 使用 SQLite schema"
    echo "  postgres   - 使用 PostgreSQL schema"
    echo "  dev        - 开发模式 (push SQLite)"
    echo "  prod       - 生产模式 (migrate PostgreSQL)"
    echo "  migrate    - 执行数据迁移"
    exit 1
    ;;
esac
