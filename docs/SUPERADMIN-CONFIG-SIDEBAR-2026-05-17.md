# 2026-05-17 超管个人中心配置侧栏

## 本次目标

- 把超管可配置入口从分散状态收口到个人中心左侧栏。
- 避免继续只靠 `/admin-qianfu` 单页跳转，导致其他配置入口难找。

## 已完成

### 1. 超管个人中心侧栏新增配置分组

文件：

- `qianfu-liandeng/src/pages/Dashboard.tsx`

仅当 `user.role === 'admin'` 时显示 `Super Admin / Config` 分组，包含：

- `控制总览` -> `/admin`
- `系统设置` -> `/admin-settings`
- `支付配置` -> `/admin-qianfu`
- `端口安全` -> `/admin-port5555`
- `用户管理` -> `/admin-users`
- `服务器审核` -> `/admin-review`
- `工单管理` -> `/admin-tickets`
- `内容审核` -> `/admin-moderation`
- `激励任务` -> `/promotion/tasks`
- `领取审核` -> `/promotion/claims`
- `店铺管理` -> `/seller/shop`
- `审计日志` -> `/admin-audit`
- `数据统计` -> `/admin-audit-stats`
- `举报管理` -> `/admin-reports`

### 2. 补上 `AdminSettings` 路由

文件：

- `qianfu-liandeng/src/App.tsx`

新增：

- `/admin-settings`

桌面端与移动端 admin route 均已挂载。

### 3. `AdminSettings` 不再是假表单

文件：

- `qianfu-liandeng/src/pages/admin/AdminSettings.tsx`

原页面会提交到不存在的 `/admin/settings`，现已改成真实可用的 `Config Hub`，只负责跳转到已存在的配置模块。

### 4. 管理后台侧栏同步补入口

文件：

- `qianfu-liandeng/src/components/admin/AdminSidebar.tsx`

已增加：

- `common.settings` -> `/admin-settings`

## 验证

- `npm --prefix qianfu-liandeng run build` 通过
- 前端新构建已同步到远端 `103.236.92.10`
- `http://mc-u.top/` 仍返回 `200`

