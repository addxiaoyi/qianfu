# 移动端输入触发刷新三次加固（2026-05-23）

## 反馈
- 用户反馈：`https://mc-u.top/#/mobile` 等页面填写表单仍会出现“动不动刷新”体感。

## 本轮加固

### 1) 全局防误刷新手势兜底（主入口）
- 文件：`qianfu-liandeng/src/main.tsx`
- 增加：
  - 全局 `touchstart/touchmove/touchend/touchcancel` 捕获逻辑。
  - 在移动视口或移动关键路由（`/mobile`、`/login`、`/register`、`/tickets`、`/editor`）中：
    - 仅在“页面/容器顶部 + 下拉手势 + 非输入控件触发”时 `preventDefault`；
    - 阻断原生下拉刷新导致的整页重载体感。
  - 输入控件白名单（`input/textarea/select/contenteditable/.tox/.ProseMirror`），避免破坏正常输入手势。

### 2) 滚动根节点标记（移动容器）
- 文件：`qianfu-liandeng/src/components/mobile/MobileLayout.tsx`
- 增加：
  - `data-mobile-scroll-root="true"` 标记到移动内容滚动容器。
  - 供全局手势兜底准确判定 `scrollTop`，避免误判。

### 3) 清理历史 Service Worker 干扰
- 文件：`qianfu-liandeng/src/main.tsx`
- 增加：
  - 启动时执行 `navigator.serviceWorker.getRegistrations().unregister()`。
  - 目的：清除旧版本 SW 对静态资源缓存/更新控制的干扰，避免“已发布修复但端上仍像旧包”的幽灵刷新与缓存错觉。

## 验证
- 构建：
  - `npm --prefix qianfu-liandeng run build` ✅
- 公开移动输入检查：
  - `QA_BASE_URL=https://mc-u.top node scripts/ui-mobile-public-input-check.cjs` ✅ `failed=0`
- 线上部署后入口哈希：
  - `assets/index-D8ePUst4.js`
- 健康检查：
  - `GET https://mc-u.top/api/health` ✅
  - `GET https://mc-u.top/api/ready` ✅

## 发布动作
- 上传包：`/tmp/qianfu-mobile-refresh-hardening-20260523.tgz`
- 替换目录：`/www/wwwroot/qianfu-app/qianfu-liandeng/dist`
- 执行：
  - `nginx -t`
  - `nginx -s reload`
  - `pm2 restart qianfu-api`
