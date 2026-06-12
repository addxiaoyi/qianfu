# M-14 核查记录

日期：2026-05-13

## 背景

backlog 中存在一条待办：

- `M-14`
- 描述：`server-service` 和 `user-service` 中 `_getUserFromUserService` 被前缀标记为未使用，需要确认删除还是启用

## 核查范围

- `services/server-service/src/services/serverService.ts`
- `services/user-service/src/services/userService.ts`
- 全仓关键字搜索：`_getUserFromUserService`、`getUserFromUserService`

## 结论

当前源码中不存在 `_getUserFromUserService`，也不存在同名可启用逻辑。

这说明 `M-14` 属于过期 backlog，不是当前代码问题。

## 证据摘要

1. `services/server-service/src/services/serverService.ts` 未包含 `_getUserFromUserService`
2. `services/user-service/src/services/userService.ts` 未包含 `_getUserFromUserService`
3. 全仓搜索仅 `docs/IMPROVEMENT-BACKLOG.md` 命中该字符串

## 处理建议

- 将 `M-14` 标记为“已核实为过期项”
- 不做业务代码变更
- 若后续需要跨服务用户拉取能力，按真实调用场景重新设计接口与测试，不沿用旧遗留描述
