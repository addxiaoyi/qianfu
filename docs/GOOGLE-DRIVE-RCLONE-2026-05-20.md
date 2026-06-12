# Google Drive / rclone 接入 2026-05-20

## 目标

- 把千服服务器上的备份、插件、上传资源归档到 Google Drive
- 支持从 Google Drive 回拉恢复
- 支持“像挂载一样”浏览云盘内容
- 明确哪些目录适合上云，哪些目录不能直接挂云运行

## 当前服务器事实

- 服务器：`103.236.92.10`
- 系统：`Ubuntu 24.04.1 LTS`
- FUSE 可用：`/usr/bin/fusermount`
- 新盘已挂载：`/mnt`
- 当前推荐本地冷数据目录：
  - `/mnt/qianfu-data/backups`
  - `/mnt/qianfu-data/cutover-backups`

## 关键结论

- `rclone` 的 remote 名称不是 Google 自动生成的，而是你在 `rclone config` 里自己起的别名
- remote 名称的获取方法：

```bash
rclone listremotes
rclone config file
```

- 如果配置文件里有：

```ini
[gdrive]
type = drive
...
```

那么 remote 名称就是 `gdrive`

## 很重要：remote 是“每台机器各自配置”的

如果你在本地电脑已经完成了 Google Drive 授权，不代表服务器自动也有这个 remote。

服务器真正能用某个 remote，取决于它本机是否存在：

```bash
/root/.config/rclone/rclone.conf
```

如果本地已经授权完成，最快的上服务器方式不是重新折腾授权，而是直接把本地可用的 `rclone.conf` 复制到服务器：

```bash
mkdir -p /root/.config/rclone
chmod 700 /root/.config/rclone
# 上传你的 rclone.conf 到 /root/.config/rclone/rclone.conf
chmod 600 /root/.config/rclone/rclone.conf
rclone listremotes
```

## 推荐 remote 组织方式

建议 remote 名称简单稳定，例如：

- `gdrive`
- `qianfu-gdrive`

建议云盘目录结构：

```text
gdrive:qianfu/backups
gdrive:qianfu/cutover-backups
gdrive:qianfu/plugins
gdrive:qianfu/uploads
```

## 推荐上云内容

适合放 Google Drive：

- 数据库备份
- 应用切主前备份
- 插件包
- 上传附件归档
- 历史日志压缩包

不适合直接挂 Google Drive 运行：

- MySQL 数据目录
- Prisma / Node 运行时热目录
- PM2 正在运行的代码目录
- 高频读写上传目录作为唯一主存储

原因很简单：Google Drive 挂载更适合冷存储、备份、手动恢复，不适合作为生产热数据盘。

## 仓库内新增脚本

### 1. 安装 rclone

```bash
bash scripts/linux/install-rclone.sh
```

用途：

- 等待 `apt/dpkg` 锁释放
- 安装 `rclone`
- 打印 `rclone version`
- 打印配置文件路径
- 打印 remote 列表

### 2. 常用 Google Drive 操作

```bash
bash scripts/linux/rclone-gdrive.sh status
bash scripts/linux/rclone-gdrive.sh test-remote
bash scripts/linux/rclone-gdrive.sh push-backups
bash scripts/linux/rclone-gdrive.sh push-cutover-backups
bash scripts/linux/rclone-gdrive.sh push-plugins
bash scripts/linux/rclone-gdrive.sh push-uploads
bash scripts/linux/rclone-gdrive.sh copy-down backups /tmp/qianfu-backups-restore
bash scripts/linux/rclone-gdrive.sh mount
bash scripts/linux/rclone-gdrive.sh umount
```

默认环境变量：

- `RCLONE_REMOTE_NAME=gdrive`
- `RCLONE_REMOTE_ROOT=qianfu`
- `BACKUP_DIR=/mnt/qianfu-data/backups`
- `CUTOVER_BACKUP_DIR=/mnt/qianfu-data/cutover-backups`
- `PLUGIN_DIR=/www/wwwroot/qianfu-app/plugins`
- `UPLOAD_DIR=/www/wwwroot/qianfu-app/uploads`
- `MOUNT_POINT=/mnt/gdrive-qianfu`

如果你的 remote 名称不是 `gdrive`，直接改环境变量：

```bash
RCLONE_REMOTE_NAME=qianfu-gdrive bash scripts/linux/rclone-gdrive.sh status
```

## 典型场景

### 场景 1：把服务器备份推到云盘

```bash
RCLONE_REMOTE_NAME=gdrive bash scripts/linux/rclone-gdrive.sh push-backups
RCLONE_REMOTE_NAME=gdrive bash scripts/linux/rclone-gdrive.sh push-cutover-backups
```

### 场景 2：把插件目录推到云盘

```bash
RCLONE_REMOTE_NAME=gdrive bash scripts/linux/rclone-gdrive.sh push-plugins
```

### 场景 3：从云盘把资源拉回服务器

```bash
RCLONE_REMOTE_NAME=gdrive bash scripts/linux/rclone-gdrive.sh copy-down plugins /tmp/qianfu-plugins-restore
```

### 场景 4：像挂载盘一样浏览云盘

```bash
RCLONE_REMOTE_NAME=gdrive bash scripts/linux/rclone-gdrive.sh mount
ls -lah /mnt/gdrive-qianfu
```

卸载：

```bash
bash scripts/linux/rclone-gdrive.sh umount
```

## systemd 挂载样例

已补样例文件：

```text
deploy/systemd/rclone-gdrive-mount.service.example
```

如果需要开机自动挂载，可复制为正式 unit：

```bash
cp deploy/systemd/rclone-gdrive-mount.service.example /etc/systemd/system/rclone-gdrive-mount.service
systemctl daemon-reload
systemctl enable --now rclone-gdrive-mount.service
systemctl status rclone-gdrive-mount.service
```

## 最稳的实际建议

生产上建议采用下面这套策略：

1. 运行目录继续留在本地磁盘
2. 备份目录继续放 `/mnt/qianfu-data`
3. 用 `rclone copy` / `rclone sync` 定时推送 Google Drive
4. 需要恢复时再从 Google Drive 拉回
5. 挂载只作为浏览和手动恢复入口，不作为 MySQL 或应用主盘

## 下一步闭环

要真正打通，还差最后 1 个事实确认：

- 服务器上的 `rclone.conf` 里到底 remote 叫什么

确认方法：

```bash
rclone listremotes
```

如果空白，就说明授权只在别的机器完成了，服务器还没拿到对应配置。
