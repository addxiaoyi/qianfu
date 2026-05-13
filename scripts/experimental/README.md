# Experimental Scripts

此目录用于存放临时调试、连通性验证、一次性排障脚本。

## 原则

- 不纳入 CI 必跑链路。
- 不作为正式发布流程依赖。
- 优先通过 `package.json` 中的 `exp:*` 命令运行。
- 脚本稳定后，如有长期价值再迁移到正式脚本目录并纳入文档。

## 当前脚本

- `test-api.ts`：本地 API 返回内容快速检查
- `test-redis-cache.ts`：Redis 缓存读写与失效行为验证
- `test-supabase-connection.ts`：可选 Supabase 连通性验证

## 运行方式

- `npm run exp:test-api`
- `npm run exp:test-redis`
- `npm run exp:test-supabase`
