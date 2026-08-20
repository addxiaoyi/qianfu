# 2026-05-13 部署状态记录

## 当前目标

先将千服平台完整部署到服务器 `103.236.92.10`，暂时不以域名切流为前置条件，先确保通过服务器 IP 可访问前端与 API。

## 已确认的服务器状态

- 系统：Ubuntu 22.04
- 已安装：Node 24、npm 11、pm2、nginx、docker、docker-compose
- Redis 已监听 `127.0.0.1:6379`

## 已完成事项

1. 服务器已创建部署目录：
   - `/www/wwwroot/qianfu-app`
2. 已上传并落地：
   - `qianfu-liandeng/dist`
   - `dist-server`
   - `prisma/dev.db`
3. 已写入服务器侧 `.env`
4. 已将 Nginx 默认 HTTP 入口切到：
   - `/www/wwwroot/qianfu-app/qianfu-liandeng/dist`
5. 当前访问 `http://103.236.92.10/` 已能返回前端静态页面
6. 根前端构建脚本已修正为实际调用：
   - `npm --prefix qianfu-liandeng run build`
7. 已修复一批明确阻塞构建的问题：
   - `server/controllers/registerController.ts`
   - `server/controllers/promoController.ts`
   - `qianfu-liandeng/src/App.tsx`
   - `qianfu-liandeng/src/pages/MarketplaceDetail.tsx`

## 当前阻塞

后端源码的首批显式 TS 报错已修复，但“完整可运行产物”仍被共享包与 Prisma 产物格式问题阻塞。

### 阻塞 1：Node 24 ESM 兼容

`dist-server` 初始产物中大量相对导入没有 `.js` 扩展名，Node 24 无法直接执行。

已新增脚本：

- `scripts/fix-esm-import-extensions.mjs`

并接入：

- `npm run server:build`

### 阻塞 2：Prisma 运行时产物需要同步到 `dist-server`

已新增脚本：

- `scripts/sync-prisma-client-to-dist.mjs`

并接入：

- `npm run server:build`

### 阻塞 3：`packages/shared/dist` 仍不是 Node 24 可直接执行的 ESM 产物

当前本地验证显示：

- `packages/shared/dist/index.js` 仍触发目录导入 / 模块格式问题
- 导致 `dist-server/server/index.js` 仍无法完整启动

## 当前结论

前端静态站点已部署到服务器并可访问，但后端 API 还未成功接管。

因此当前状态是：

- 前端：部分完成
- API：未完成
- 整站联调：未完成

## 下一步建议

1. 修复 `packages/shared/dist` 的 Node 24 运行兼容性
2. 本地完成 `dist-server/server/index.js` 启动验证
3. 重新上传后端与共享包产物到服务器
4. 重启 PM2 `qianfu-api`
5. 验证：
   - `http://103.236.92.10/`
   - `http://103.236.92.10/health`
   - `http://103.236.92.10/api/health`
## 2026-05-13 继续推进
- 已锁定新的后端阻塞不在业务代码，而在编译后处理脚本。
- `fix-esm-import-extensions.mjs` 对 bare import 重复命中，导致 `dist-server-build/server/index.js` 产物损坏。
- 已修复脚本，下一步从干净目录重建 `dist-server-build` 并继续做本地运行验证。
## 2026-05-13 构建脚本修复
- 已确认 `fix-esm-import-extensions.mjs` 的原实现存在重复命中与写回异常。
- 已改为单一正则顺序替换，目标是稳定修正所有相对 ESM 导入扩展名。
- 当前正在重新生成干净的 `dist-server-build` 做最终本地启动验证。
## 2026-05-13 Prisma 导入修复
- 本地运行验证已推进到 `server/index` 启动阶段。
- 新定位到 `server/intelligent-probe/db.ts` 仍在 ESM 下目录导入 Prisma client。
- 已改为显式导入 `../../prisma/generated/local-client/index.js`，正在重建验证。
## 2026-05-13 数据库路径校正
- 已确认远端 Node API 监听在 3001，Prisma Linux 引擎也已生成并写入 dist-server。
- 当前 `/api/health` 失败已收敛为 SQLite 路径解析错位，主库与 localDb 没有显式共用服务器 `prisma/dev.db`。
- 已给 `server/localDb.ts` 增加 `LOCAL_DATABASE_URL` / `DATABASE_URL` 显式数据源回退，正在重建并准备同步到服务器。
