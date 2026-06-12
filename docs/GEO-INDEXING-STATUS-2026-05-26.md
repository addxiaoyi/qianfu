# GEO/SEO 进展状态（2026-05-26）

## 当前状态

1. 路由模式
- 前端已使用 `BrowserRouter`（`qianfu-liandeng/src/App.tsx`）。
- `main.tsx` 含 hash 到 path 的兼容重写逻辑，用于旧链接平滑迁移。

2. 动态 SEO 资源
- 已提供动态：
  - `/robots.txt`
  - `/llms.txt`
  - `/sitemap.xml`
- 相关实现：
  - `server/controllers/seoController.ts`
  - `server/routes/assets.ts`

3. 公开页元数据
- 已落地 `SeoHead/PageSeo` 与核心页面 SEO 字段（见 `docs/GEO-HARDENING-2026-05-22.md`）。

## 仍建议推进

1. 预渲染/SSR
- 当前仍是 SPA，爬虫首屏依赖 JS 执行。
- 建议下一阶段引入：
  - 关键页面预渲染（首页、列表、详情）
  - 或服务端渲染（SSR）以提升收录稳定性。

2. sitemap 动态源扩展
- 已纳入 `Server/Marketplace/Team/Resource`。
- 后续可补：
  - 用户公开主页 URL（按业务策略）
  - 更精细 `lastmod` 与更新频率分层。
