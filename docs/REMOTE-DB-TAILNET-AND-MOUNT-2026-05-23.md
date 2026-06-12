# 远程数据库与挂载排查记录 2026-05-23

## 目标

- 接入远程 MySQL：`wb.ddns.s3.fan:3306`
- 按要求通过 Headscale/Tailscale 入网后，改走内网地址 `192.168.1.3:3306`
- 检查是否具备新建数据库权限
- 检查远程磁盘挂载当前可落地状态

## 本轮执行结果

### 1) Tailnet 入网

在 `103.236.92.10` 上完成：

- 安装 `tailscale`（版本 `1.98.3`）
- 启动并设置 `tailscaled` 开机自启
- 执行 `tailscale up --login-server=... --authkey=... --accept-routes`
- 当前分配到的 tailnet IPv4：`100.64.1.18`

### 2) 数据库连通性

- 入网前：`192.168.1.3` 不可达，`3306` 超时
- 入网后：
  - `ping 192.168.1.3` 成功
  - `tcp/3306` 连通成功
  - `steve` 可成功登录 MariaDB

### 3) `steve` 权限结论

初始探测时：

- 可以连接并查询授权
- `SHOW DATABASES` 当前可见：
  - `cubex`
  - `stardust`
  - `information_schema`
- **不能新建数据库**（实际报错）：
  - `ERROR 1044 (42000): Access denied for user 'steve'@'%' to database 'qianfu_probe_xxx'`

收到 root 凭据后，已由 root 完成：

- 创建数据库：`qianfu_public`
- 授权：`GRANT ALL PRIVILEGES ON qianfu_public.* TO 'steve'@'%'`
- 验证：`steve` 可在 `qianfu_public` 建表/删表

## 已落地的远程库动作

已在远端库执行：

```sql
CREATE DATABASE IF NOT EXISTS qianfu_public CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON qianfu_public.* TO 'steve'@'%';
FLUSH PRIVILEGES;
```

## 若后续需要重建/补权限

由数据库管理员执行（示例）：

```sql
CREATE DATABASE qianfu_public CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON qianfu_public.* TO 'steve'@'%';
FLUSH PRIVILEGES;
```

如果不希望 `ALL PRIVILEGES`，至少需要覆盖应用迁移与运行所需权限（`CREATE/ALTER/INDEX/INSERT/UPDATE/DELETE/SELECT` 等）。

## 非隐私数据同步（已执行）

本次已把非隐私白名单表从本机业务库同步到远程 `qianfu_public`，使用表：

- `Server`
- `ServerStatus`
- `ServerVersion`
- `TeamMember`
- `AllianceGroup`
- `ResourceLink`
- `IntroPage`
- `IntroPageVersion`

同步结果：脚本成功执行；当前源库这些表行数均为 `0`，目标库对账也为 `0`（结构已同步完毕）。

新增可复跑脚本：

- `scripts/linux/sync-nonprivate-to-remote-mysql.sh`

执行示例（在服务器）：

```bash
TARGET_PASSWORD='***' TARGET_ROOT_PASSWORD='***' TARGET_DB='qianfu_public' bash scripts/linux/sync-nonprivate-to-remote-mysql.sh
```

## 非隐私数据迁移建议

建议只迁移白名单业务表，避免把敏感配置原样迁移到新库。可在迁移前先导出/筛选非隐私数据再导入。

仓库已有可用检查脚本：

- `scripts/linux/check-remote-mysql-access.sh`
- `scripts/linux/sync-nonprivate-to-remote-mysql.sh`

示例（含建库权限探测）：

```bash
DB_USER=steve DB_PASSWORD='***' PROBE_CREATE_DB=1 bash scripts/linux/check-remote-mysql-access.sh
TARGET_PASSWORD='***' TARGET_ROOT_PASSWORD='***' TARGET_DB='qianfu_public' bash scripts/linux/sync-nonprivate-to-remote-mysql.sh
```

## 远程磁盘挂载现状

在 `103.236.92.10` 上当前状态：

- `rclone` 已安装
- 已完成 Google OAuth 授权并写入 `/root/.config/rclone/rclone.conf`
- `rclone listremotes` 返回：`gdrive:`
- `rclone-gdrive-mount.service` 已写入 `/etc/systemd/system/`
- 为防止假启动误判，当前保持 `disabled/inactive`

本轮关键阻塞（已复核）：

- 服务器到 Google API 的 TLS 连接失败，`rclone` 操作持续超时
- 典型报错：
  - `OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.googleapis.com:443`
  - `rclone ... RC=124`（timeout）
- 因此目前不能在该服务器上完成真实挂载（会出现进程在跑但未真正挂载到 `/proc/mounts`）

可沿用仓库现有模板：

- `deploy/systemd/rclone-gdrive-mount.service.example`
- `scripts/linux/rclone-gdrive.sh`
- `docs/GOOGLE-DRIVE-RCLONE-2026-05-20.md`

后续可行路径：

1. 放通服务器到 Google 相关域名（`*.googleapis.com` / `accounts.google.com`）的 443 出口
2. 或提供服务器可达的 HTTPS/SOCKS 代理，并在 systemd unit 中增加：
   - `Environment=HTTP_PROXY=http://<proxy-host>:<port>`
   - `Environment=HTTPS_PROXY=http://<proxy-host>:<port>`
3. 连通后再执行：

```bash
systemctl enable --now rclone-gdrive-mount.service
findmnt -T /mnt/gdrive-qianfu
rclone lsd gdrive:qianfu
```

## 2026-05-24 在线授权补充

- 已通过本机浏览器完成 Google OAuth 回调，并将 token 写入服务器 `rclone.conf`
- 远端确认 `rclone listremotes` 可见 `gdrive:`
- 但服务器仍无法与 Google API 建立 TLS：
  - `timeout 15 rclone lsd gdrive:qianfu` -> `RC=124`
  - `curl -I https://www.googleapis.com/drive/v3/about` -> `curl: (35) SSL_ERROR_SYSCALL`
- 因为上游网络阻塞，挂载服务保持 `disabled/inactive`（避免误以为已挂载）

## 2026-05-24 出口修复与最终落地

### 根因确认

- 服务器直连 Google API 失败（`curl` 到 `googleapis` 为 `SSL_ERROR_SYSCALL`）
- 服务器访问其他站点（如 `api.github.com`）正常
- 属于到 Google 的上游出口路径问题，不是 `rclone.conf` 或 OAuth token 问题

### 修复动作（已执行）

在 `103.236.92.10` 上：

1. 安装并启动 `cloudflare-warp`
2. 配置 WARP 为本地代理模式（端口 `14080`）
3. 为 `rclone-gdrive-mount.service` 增加 drop-in 环境变量：
   - `HTTP_PROXY=socks5://127.0.0.1:14080`
   - `HTTPS_PROXY=socks5://127.0.0.1:14080`
   - `ALL_PROXY=socks5://127.0.0.1:14080`
   - `NO_PROXY=`
4. 启动并开机自启：
   - `warp-svc`
   - `rclone-gdrive-mount.service`

### 验证结果（已通过）

- `warp-cli status`：`Connected`
- `rclone` 通过代理可访问 Google Drive
- 已创建远端目录：`gdrive:qianfu`
- 挂载状态：
  - `systemctl is-active rclone-gdrive-mount.service` -> `active`
  - `findmnt -T /mnt/gdrive-qianfu` 显示 `fuse.rclone`
  - `/proc/mounts` 可见 `gdrive:qianfu /mnt/gdrive-qianfu fuse.rclone`

### 当前有效状态

- 远端库：`qianfu_public` 可用（`steve` 有权限）
- 非隐私白名单表结构已同步
- Google Drive 挂载已真实生效（不再是“进程在跑但未挂载”）

## 2026-05-24 非重要数据冷迁移与空间回收

### 本轮目标

- 把非重要历史数据迁移到 `gdrive:qianfu/cold-storage/2026-05-24`
- 释放服务器本地磁盘空间（系统盘 `/`）

### 已迁移内容

- `/mnt/qianfu-data/backups`（打包后迁移）
- `/mnt/qianfu-data/cutover-backups`（打包后迁移）
- `/www/wwwroot/qianfu-app/qianfu-liandeng/dist.__bak_*`（全部打包后迁移）
- `/www/wwwroot/qianfu-app/qianfu-liandeng/dist.__prev`
- `/www/wwwroot/qianfu-app/qianfu-liandeng/dist.old-security`
- `/www/wwwroot/qianfu-app/dist-server.__bak_*`
- `/tmp` 下历史部署包与阶段目录（`*.tar.gz`/`*.tgz`/`*.zip`、`starmc-*`、`qianfu-*stage*`、`starx-public-backup-*` 等）

迁移后对应远端目录：

- `gdrive:qianfu/cold-storage/2026-05-24/backups`
- `gdrive:qianfu/cold-storage/2026-05-24/cutover-backups`
- `gdrive:qianfu/cold-storage/2026-05-24/app-dist-baks`
- `gdrive:qianfu/cold-storage/2026-05-24/server-dist-baks`
- `gdrive:qianfu/cold-storage/2026-05-24/tmp-stage-dirs`
- `gdrive:qianfu/cold-storage/2026-05-24/tmp-archives`

### 空间回收结果

执行前（首轮盘点）：

- `/` 可用空间约 `5.5G`（`82%` 已用）
- `/www/wwwroot/qianfu-app`：约 `1.2G`
- `/tmp`：约 `1.6G`
- `/var/log`：约 `938M`
- `/mnt/qianfu-data`：约 `53M`

执行后：

- `/` 可用空间约 `7.7G`（`74%` 已用）
- `/www/wwwroot/qianfu-app`：约 `656M`
- `/tmp`：约 `217M`
- `/var/log`：约 `498M`
- `/mnt/qianfu-data`：约 `15M`

结论：本轮累计释放本地空间约 `2.2G`（按系统盘可用空间变化估算）。

## 2026-05-24 二轮冷迁移（1/2 盘 -> 3 盘）进行中

### 目标

- 把磁盘 1（`/`）和磁盘 2（`/mnt`）中的非业务热数据迁移到磁盘 3（`/mnt/gdrive-qianfu` 对应 `gdrive:qianfu`）
- 保证原路径不丢失，避免其他程序因路径不存在报错

### 本轮采用的安全策略

- 使用低速率、可重试的流式打包迁移，避免 Google Drive API 限流导致整体中断
- 脚本：
  - `/root/safe_migrate_quota_friendly_20260524.sh`
- 运行方式（后台）：

```bash
nohup bash /root/safe_migrate_quota_friendly_20260524.sh >/root/safe_migrate_quota_friendly_20260524.nohup 2>&1 &
```

- 日志与映射文件：
  - `/root/safe_migrate_quota_friendly_20260524.log`
  - `/root/safe_migrate_quota_friendly_20260524.tsv`

### 路径兼容设计（重点）

- 对已迁移目录，不直接删除路径，而是保留同名目录并写入 `MIGRATION_NOTE.txt`
- 这样依赖“路径存在性”的程序不会因为 `ENOENT` 直接失败
- 说明：这些目录是冷数据占位，不再包含原始业务文件；确需回滚时按 note 中 restore 命令恢复

`MIGRATION_NOTE.txt` 示例关键字段：

- `original_path`
- `remote_archive`
- `migrated_at`
- `restore_hint`

### 已确认完成（快照）

- `ok /root/backups`
  - 远端对象：
    - `gdrive:qianfu/cold-storage/safe-migration-2026-05-24/tar-archives/whole/root/backups-20260524-130314.tar.gz`
  - 本地状态：
    - `/root/backups` 已变为占位目录，含 `MIGRATION_NOTE.txt`
- `ok /root/starmc-backups`
  - 远端对象：
    - `gdrive:qianfu/cold-storage/safe-migration-2026-05-24/tar-archives-v2/whole/root/starmc-backups-20260524-131612-c16M-t3.tar.gz`
- `ok /root/starmc-backup`
  - 远端对象：
    - `gdrive:qianfu/cold-storage/safe-migration-2026-05-24/tar-archives-v2/whole/root/starmc-backup-20260524-132701-c64M-t1.tar.gz`
- `ok /www/backup`
  - 远端对象：
    - `gdrive:qianfu/cold-storage/safe-migration-2026-05-24/tar-archives-v3/whole/www/backup-20260524-133010-c32M-t2.tar.gz`
- `ok /srv/starmc-backups`
  - 远端对象：
    - `gdrive:qianfu/cold-storage/safe-migration-2026-05-24/tar-archives-v3/whole/srv/starmc-backups-20260524-134013-c64M-t1.tar.gz`
- `ok /opt/starbot.prev-20260524-040138`
  - 远端对象：
    - `gdrive:qianfu/cold-storage/safe-migration-2026-05-24/tar-archives-v3/whole/opt/starbot.prev-20260524-040138-20260524-134236-c64M-t1.tar.gz`

### 当前运行状态（快照）

- 脚本已结束
- 已进入下一项：无
- 磁盘：
  - `/`：可用空间约 `11G`
  - `/mnt`：可用空间约 `19G`

### 记录修正

- 早期 `v2` 脚本把日志混进了返回值，已改成只写 stderr + log file，避免 `MIGRATION_NOTE.txt` 和 `tsv` 被污染
- 已把 `/root/backups`、`/root/starmc-backups`、`/root/starmc-backup` 的 note 重写为单行可恢复格式

### 最终完成

- `/opt/starbot.prev-*` 已全部完成占位迁移
- `/mnt/starbot-root-backups` 与 `/mnt/starbot-archive` 下的第一层子目录已全部写入 `MIGRATION_NOTE.txt`
- 这两个父目录保留为兼容容器，不做 `bind mount`
- 结论：本轮冷迁移已完成，后续只需要按 note 做恢复即可
- 服务器恢复工具：
  - `/root/restore_cold_migration.sh`
- 父目录索引：
  - `/mnt/starbot-root-backups/MIGRATION_INDEX.txt`
  - `/mnt/starbot-archive/MIGRATION_INDEX.txt`

### 监控命令（可直接复用）

```bash
ps -eo pid,etime,cmd | grep safe_migrate_quota_friendly_20260524 | grep -v grep
tail -n 120 /root/safe_migrate_quota_friendly_20260524.log
sed -n '1,120p' /root/safe_migrate_quota_friendly_20260524.tsv
df -h / /mnt /mnt/gdrive-qianfu
du -sh /mnt/starbot-archive /mnt/starbot-root-backups /root/backups /root/starmc-backups /root/starmc-backup /www/backup /srv/starmc-backups
```

### 单路径恢复指引（如需）

假设需要恢复 `/root/backups`：

```bash
mkdir -p /root
rclone cat "gdrive:qianfu/cold-storage/safe-migration-2026-05-24/tar-archives/whole/root/backups-20260524-130314.tar.gz" | tar -xzf - -C /root
```

## 2026-05-24 恢复演练（隔离路径）与最终验收

### 演练目的

- 在不影响生产目录的前提下，验证 `restore_cold_migration.sh` 可恢复归档并可回收临时目录。

### 演练方式与结果

- 演练包：`/mnt/gdrive-qianfu/cold-storage/safe-migration-2026-05-24/tar-archives-v3/children/mnt/starbot-archive/starbot.new-20260518-134444-20260524-141859-c32M-t2.tar.gz`（约 `4.3M`）
- 演练 1（路径不匹配）：
  - `original_path=/tmp/restore-drill-local-...`，但归档内根目录名是 `starbot.new-20260518-134444`
  - 结果：恢复会解到父目录下的归档原名目录（这是 tar 结构行为，不是脚本故障）
- 演练 2（路径匹配）：
  - `original_path=/tmp/starbot.new-20260518-134444`
  - 结果：恢复成功，目录体积约 `21M`，抽样文件可读，随后已清理演练目录

结论：恢复脚本可用；生产恢复时应优先使用原始 note 中的 `original_path`，不要随意改名。

### 当前最终状态复核

- 盘面：
  - `/`：`11G` 可用（`64%` 已用）
  - `/mnt`：`19G` 可用（`1%` 已用）
  - `/mnt/gdrive-qianfu`：挂载正常（`gdrive:qianfu`）
- 兼容占位计数：
  - `/mnt/starbot-root-backups`：`11` 个子目录含 `MIGRATION_NOTE.txt`
  - `/mnt/starbot-archive`：`25` 个子目录含 `MIGRATION_NOTE.txt`
- 迁移日志体积很小（合计约数百 KB），无需额外清理。

### 标准恢复手册（可直接执行）

1. 列出可恢复条目（建议先看）：

```bash
bash /root/restore_cold_migration.sh list /mnt/starbot-root-backups
bash /root/restore_cold_migration.sh list /mnt/starbot-archive
```

2. 恢复单个路径（示例）：

```bash
bash /root/restore_cold_migration.sh restore /mnt/starbot-archive/starbot.new-20260518-134444
```

3. 恢复后核验：

```bash
du -sh /mnt/starbot-archive/starbot.new-20260518-134444
find /mnt/starbot-archive/starbot.new-20260518-134444 -maxdepth 2 -type f | head
```

4. 挂载/FUSE 诊断建议（避免命令卡住）：

```bash
timeout 10 df -h /mnt/gdrive-qianfu || echo "[WARN] gdrive df timeout"
```

## 2026-05-24 真实路径恢复闭环演练（已回滚）

### 演练对象

- `target`: `/mnt/starbot-archive/starbot.new-20260518-134444`
- `remote_archive`: `gdrive:qianfu/cold-storage/safe-migration-2026-05-24/tar-archives-v3/children/mnt/starbot-archive/starbot.new-20260518-134444-20260524-141859-c32M-t2.tar.gz`

### 闭环步骤（实际执行）

1. 备份占位 note：

```bash
cp /mnt/starbot-archive/starbot.new-20260518-134444/MIGRATION_NOTE.txt /tmp/starbot.new-20260518-134444.MIGRATION_NOTE.bak
```

2. 按原路径执行恢复：

```bash
bash /root/restore_cold_migration.sh restore /mnt/starbot-archive/starbot.new-20260518-134444
```

3. 恢复后核验：

- `MIGRATION_NOTE.txt` 已消失（说明不再是占位态）
- 目录体积约 `21M`
- 抽样文件可读（`ecosystem.longrun.config.js`、`docs/*` 等）

4. 恢复后回到占位态（演练回滚）：

```bash
rm -rf /mnt/starbot-archive/starbot.new-20260518-134444
mkdir -p /mnt/starbot-archive/starbot.new-20260518-134444
cp /tmp/starbot.new-20260518-134444.MIGRATION_NOTE.bak /mnt/starbot-archive/starbot.new-20260518-134444/MIGRATION_NOTE.txt
rm -f /tmp/starbot.new-20260518-134444.MIGRATION_NOTE.bak
```

### 演练结论

- 恢复流程在“真实目标路径”上可执行。
- 回滚到占位态可执行且快速。
- 演练后复核计数保持不变：
  - `/mnt/starbot-root-backups`：`11`
  - `/mnt/starbot-archive`：`25`

## 冷迁移巡检脚本（仓库）

已新增：

- `scripts/linux/check-cold-migration-status.sh`

用途：

- 一次性检查盘面、挂载、恢复工具、占位目录 note 完整性，并抽样输出可恢复条目。

使用示例：

```bash
bash scripts/linux/check-cold-migration-status.sh
# 可选自定义路径
bash scripts/linux/check-cold-migration-status.sh /mnt/starbot-root-backups /mnt/starbot-archive /mnt/gdrive-qianfu
```

## 2026-05-26 自动巡检落地（远程）

已在 `103.236.92.10` 落地：

- `/root/check-cold-migration-status.sh`（执行脚本）
- `/etc/cron.d/cold-migration-check`（计划任务）
- `/var/log/cold-migration-check.log`（巡检日志）

计划任务内容：

```cron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
CRON_TZ=Asia/Shanghai
35 4 * * * root flock -n /tmp/cold-migration-check.lock /root/check-cold-migration-status.sh >> /var/log/cold-migration-check.log 2>&1
```

说明：

- 每天 `04:35`（上海时区）自动巡检。
- 使用 `flock` 防止上一次未结束时并发重入。
- 已手工执行一次并成功生成日志。

注意：

- `timeout while reading /mnt/gdrive-qianfu` 可能偶发（FUSE 挂载读取 `df` 阻塞），若 `findmnt -T /mnt/gdrive-qianfu` 正常且占位计数正常，可视为可接受告警，不代表迁移失效。
- 已配置日志轮转：`/etc/logrotate.d/cold-migration-check`（`daily`、保留 `14` 份、`compress`、`copytruncate`）。

## 2026-05-26 双样本闭环验收补充

在此前 `starbot-archive` 样本之外，又对 `starbot-root-backups` 做了一次完整闭环：

- `target`: `/mnt/starbot-root-backups/starbot.prev-20260523-104042`
- 过程：备份 note -> `restore_cold_migration.sh restore` -> 抽样核验 -> 删除恢复内容 -> 回填原 note
- 恢复阶段观察：
  - 解压后目录体积约 `404M`（压缩包体积约 `31M`，压缩比导致）
  - 抽样文件可读（`README.md`、`backend/.env*`、`starbot*.service` 等）
- 回滚后：
  - 目标目录恢复为占位态，`MIGRATION_NOTE.txt` 在位
  - 全局占位计数保持：
    - `/mnt/starbot-root-backups`：`11`
    - `/mnt/starbot-archive`：`25`

结论：两类目录（`archive` 与 `root-backups`）都已验证“可恢复且可回到占位态”。
