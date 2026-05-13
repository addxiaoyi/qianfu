# PostgreSQL 本地安装脚本 (Windows)
# 需要管理员权限运行

param(
    [string]$Password = "",
    [switch]$SkipStart
)

$ErrorActionPreference = "Stop"

Write-Host "🔧 安装 PostgreSQL..." -ForegroundColor Cyan

# 检测是否已安装
if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Host "✅ PostgreSQL 已安装" -ForegroundColor Green
} else {
    Write-Host "📦 请下载 PostgreSQL 安装包: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "安装时勾选 pgAdmin 和 Command Line Tools" -ForegroundColor Yellow
    exit 1
}

# 检查服务状态
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    Write-Host "✅ PostgreSQL 服务正在运行" -ForegroundColor Green
} else {
    Write-Host "⚙️ 启动 PostgreSQL 服务..." -ForegroundColor Cyan
    Start-Service postgresql-x64-* -ErrorAction Stop
}

# 默认密码
if (-not $Password) {
    $Password = Read-Host "请输入 postgres 用户密码（安装时设置的）" -AsSecureString
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
}

# 创建数据库和用户
Write-Host "⚙️ 配置数据库..." -ForegroundColor Cyan

$createDbScript = @"
-- 创建用户
DO `$BODY`
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'qianfu') THEN
        CREATE USER qianfu WITH PASSWORD '$Password';
    END IF;
END
`$BODY$;

-- 创建数据库
SELECT 'CREATE DATABASE qianfu OWNER qianfu'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'qianfu')\gexec

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE qianfu TO qianfu;
"@

Write-Host $createDbScript

Write-Host ""
Write-Host "✅ PostgreSQL 配置完成!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 后续步骤:" -ForegroundColor Cyan
Write-Host "1. 复制环境配置: Copy-Item .env.postgresql .env"
Write-Host "2. 编辑 .env 填入正确的密码"
Write-Host "3. 切换到 PostgreSQL schema: npx prisma migrate dev --schema=prisma/schema.postgresql.prisma"
Write-Host "4. 生成 Prisma Client: npx prisma generate --schema=prisma/schema.postgresql.prisma"
