# 便携迁移（Windows，无容器）

本方案将运行依赖与项目一起复制到仓库内的 `portable-bundle`，用于离线迁移与快速恢复。

## 一键打包

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\make-portable-bundle.ps1
```

可选参数：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\make-portable-bundle.ps1 `
  -BundleDir portable-bundle `
  -MySqlDataDir D:\mysql84-data `
  -RedisDataDir D:\redis-data `
  -SkipNodeModules
```

## 打包内容

- `portable-bundle/runtimes/java`：本机 Java 运行时
- `portable-bundle/runtimes/node`：本机 Node 运行时
- `portable-bundle/runtimes/mysql`：本机 MySQL 运行时
- `portable-bundle/runtimes/mysql-data`：MySQL 数据目录（如果存在）
- `portable-bundle/runtimes/redis`：Redis 运行时（如果系统 PATH 可找到 `redis-server`）
- `portable-bundle/runtimes/redis-data`：Redis 数据目录（如果存在）
- `portable-bundle/project`：项目代码、配置、xpay 目录、脚本等
- `portable-bundle/project/node_modules`：默认包含（可用 `-SkipNodeModules` 关闭）
- `portable-bundle/manifest/portable-manifest.json`：环境清单
- `portable-bundle/manifest/sha256sum.txt`：关键文件哈希
- `portable-bundle/scripts/windows/start-portable.ps1`：迁移后启动脚本

## 迁移到新机器

1. 复制整个 `portable-bundle` 到目标机器
2. 进入 `portable-bundle` 目录
3. 运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-portable.ps1
```

## 验证

在 `portable-bundle/project` 下执行：

```powershell
npm run local:verify
```

通过标准：

- backend-health = OK
- backend-csrf = OK
- xpay-page = OK
- qianfu-health = OK

## 说明

- 若脚本提示未找到 Redis 运行时，请先在原机器确保 `redis-server` 可执行在 PATH 中，再重新打包。
- 若使用了 `-SkipNodeModules`，迁移后需在目标机器 `portable-bundle/project` 下执行 `npm ci`。
- `prisma/generated` 默认不提交 Git。打包脚本会在**复制项目前**尝试 `npx prisma generate`（需本机已 `npm ci`）；`start-portable.ps1` 启动后端前会再执行一次。Prisma 问题可查 `portable-bundle/manifest/prisma-portable.log`。

---

# 便携迁移（Linux，无容器）

> 重点：Windows 便携包不能直接在 Linux 使用。Linux 需要独立打包一次。

## Linux 一键打包

```bash
npm run portable:bundle:linux
```

或自定义参数：

```bash
MYSQL_DATA_DIR=/var/lib/mysql \
REDIS_DATA_DIR=/var/lib/redis \
INCLUDE_NODE_MODULES=1 \
bash scripts/linux/make-portable-bundle-linux.sh portable-bundle-linux
```

## Linux 迁移启动

在目标 Linux 服务器执行：

```bash
cd portable-bundle-linux
bash scripts/linux/start-portable.sh
```

启动后可执行一键验收：

```bash
cd portable-bundle-linux
bash scripts/linux/verify-portable.sh
```

或在源码仓库执行：

```bash
npm run portable:verify:linux
```

## Linux 注意事项

- 目标机架构需与打包机一致（如均为 `x86_64`），否则二进制不可运行。
- 建议打包机和目标机发行版尽量接近，避免 glibc/系统库版本差异。
- `prisma/generated` 默认不提交 Git。`make-portable-bundle-linux.sh` 在复制前会尝试 `npx prisma generate`；`start-portable.sh` 启动后端前会再执行一次；日志见 `manifest/prisma-portable.log`。
- 首次迁移建议先验证：
  - `http://127.0.0.1:3000/api/health`
  - `http://127.0.0.1:8888/starmc/pay`
  - `npm run local:verify`（在 `portable-bundle-linux/project` 下）

