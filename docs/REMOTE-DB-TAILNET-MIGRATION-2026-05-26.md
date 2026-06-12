# 远端 DB（Tailnet）接入与非隐私迁移（2026-05-26）

## 目标

- 将生产机接入指定 tailnet 后，验证远端 MySQL 可达性。
- 确认可用数据库与权限，避免误用无权限/不存在的库。
- 提供可重复执行的“非隐私数据迁移”脚本，释放本地库承载压力。

## 本次实测结论

1. 生产机 `103.236.92.10` 已可用 `tailscale`，并成功执行：

```bash
tailscale up --login-server=https://hs.s3.fan --authkey=*** --accept-routes --reset
```

2. Tailnet 内网链路可达：
- `192.168.1.3:3306` TCP 连通 `OK`

3. 远端 MySQL（`192.168.1.3:3306`）数据库清单包含：
- `qianfu_public`（存在）
- 不存在 `qianfu`

4. `steve@%` 权限：
- 对 `qianfu_public.*` 有权限
- 对 `qianfu` 无权限（且库本身不存在）

5. 因此：对账与迁移目标库统一使用 `qianfu_public`。

## 证据日志

- `tmp/remote-env-update-20260526-204321.log`
- `tmp/remote-502-diagnose-20260526-204437.log`
- `tmp/remote-db-perm-check-20260526-204932.log`
- `tmp/remote-tailnet-db-check-20260526-205057.log`

## 新增迁移脚本

- `scripts/linux/migrate-public-data-to-remote-mysql.sh`

默认迁移白名单（非隐私表）：
- `AllianceGroup`
- `TeamMember`
- `ResourceLink`
- `IntroPage`
- `IntroPageVersion`

脚本行为：
- 逐表导出（源库）-> 目标表 `TRUNCATE` -> 导入 -> 行数对账。
- 生成 `summary.tsv`，记录每张表 `source_rows/target_rows/status`。
- 默认带 `--no-tablespaces`，避免 MariaDB 在无 `PROCESS` 权限时产生 dump 噪音。

## 使用方式（在 Linux 生产机）

```bash
SOURCE_HOST=127.0.0.1 \
SOURCE_PORT=3306 \
SOURCE_DB=qianfu \
SOURCE_USER=qianfu \
SOURCE_PASSWORD='***' \
TARGET_HOST=192.168.1.3 \
TARGET_PORT=3306 \
TARGET_DB=qianfu_public \
TARGET_USER=steve \
TARGET_PASSWORD='***' \
bash scripts/linux/migrate-public-data-to-remote-mysql.sh
```

可选：自定义表集（空格分隔）：

```bash
TABLES="AllianceGroup TeamMember ResourceLink" bash scripts/linux/migrate-public-data-to-remote-mysql.sh
```

## 2026-05-26 实跑结果（生产机）

- 工作目录：`/tmp/qianfu-public-migration-20260526-132316`
- 结果：
  - `AllianceGroup`: `0 -> 0` (`OK`)
  - `TeamMember`: `0 -> 0` (`OK`)
  - `ResourceLink`: `0 -> 0` (`OK`)
  - `IntroPage`: `0 -> 0` (`OK`)
  - `IntroPageVersion`: `0 -> 0` (`OK`)
- 本地证据日志：`tmp/remote-public-data-migrate-20260526-212322.log`
- 脚本直跑证据日志：`tmp/remote-public-data-script-run-20260526-212837.log`

## 回滚策略

1. 迁移前先做源库与目标库快照。
2. 如果发现目标数据异常：
- 直接用目标库迁移前快照回滚。
3. 若只需回滚单表：
- 以快照中的单表 dump 覆盖恢复。

## 注意事项

- 本脚本不迁移 `User/Payment/Ticket/Report/Promo*` 等隐私或资金相关表。
- `SystemConfig` 含 `is_secret` 配置项，不在默认迁移范围内。
- 若未来需要迁移更多表，必须先完成“隐私/资金影响评估”再放入白名单。
