# Prisma 多数据库切换脚本 (Windows PowerShell)

param(
    [ValidateSet("sqlite", "postgres", "postgresql", "dev", "prod", "migrate")]
    [string]$Schema = "default"
)

switch ($Schema) {
    "sqlite" {
        Write-Host "📦 使用 SQLite schema..." -ForegroundColor Cyan
        $env:DATABASE_URL = "file:./dev.db"
        npx prisma generate --schema=prisma/schema.prisma
    }
    "postgres" {
        Write-Host "📦 使用 PostgreSQL schema..." -ForegroundColor Cyan
        npx prisma generate --schema=prisma/schema.postgresql.prisma
    }
    "dev" {
        Write-Host "📦 开发模式 (SQLite)..." -ForegroundColor Cyan
        $env:DATABASE_URL = "file:./dev.db"
        npx prisma db push --schema=prisma/schema.prisma
    }
    "prod" {
        Write-Host "📦 生产模式 (PostgreSQL)..." -ForegroundColor Cyan
        npx prisma migrate deploy --schema=prisma/schema.postgresql.prisma
    }
    "migrate" {
        Write-Host "🔄 迁移 SQLite → PostgreSQL..." -ForegroundColor Cyan
        node scripts/migrate-sqlite-to-postgresql.ts
    }
    default {
        Write-Host "用法: .\prisma\switch-db.ps1 [-Schema sqlite|postgres|dev|prod|migrate]"
        Write-Host ""
        Write-Host "  sqlite     - 使用 SQLite schema"
        Write-Host "  postgres   - 使用 PostgreSQL schema"
        Write-Host "  dev        - 开发模式 (push SQLite)"
        Write-Host "  prod       - 生产模式 (migrate PostgreSQL)"
        Write-Host "  migrate    - 执行数据迁移"
    }
}
