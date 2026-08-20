# 新闻报纸长篇阅读 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将公开新闻页改造成报纸版块与超长篇叙事阅读体验，同时保持现有公告接口和后台发布流程不变。

**Architecture:** 保留 `News.tsx` 的查询、排序、StatusWrapper 和安全内容解析；仅重组页面呈现层，增加本地派生的阅读时间、章节目录和报纸栏位。测试继续采用源码契约测试，并通过生产浏览器验证真实公告数据、桌面端和移动端布局。

**Tech Stack:** React、TypeScript、Tailwind CSS、React Query、Lucide、Vitest、Playwright CLI。

---

### Task 1: 锁定报纸阅读契约

**Files:**
- Modify: `tests/unit/news-feature-contract.test.ts`

- [ ] **Step 1: Write the failing assertions**

增加对报头、章节目录、长文正文、阅读时间、短讯栏和引用样式标记的断言；保留现有 API、路由、加载和空状态断言。

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run --maxWorkers=1 --pool=threads --no-file-parallelism tests/unit/news-feature-contract.test.ts`

Expected: 新增报纸结构断言失败，原因是当前 `News.tsx` 没有这些标记。

### Task 2: 实现头版长文版式

**Files:**
- Modify: `qianfu-liandeng/src/pages/News.tsx`

- [ ] **Step 1: Add pure display helpers**

根据现有 `Announcement` 字段派生中文日期、阅读分钟数、正文段落和目录项目；继续把图片块交给 `AnnouncementMessage`，不引入 HTML 渲染。

- [ ] **Step 2: Build the newspaper shell**

添加报头、头版主文、目录栏、长文正文和短讯归档；桌面端使用主文加窄侧栏，移动端按报头、目录、正文、短讯顺序单列显示。

- [ ] **Step 3: Preserve operational states**

保持 `StatusWrapper` 的加载、错误、空状态，保留新闻链接、图片失败提示和个人备案公告文本边界。

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run --maxWorkers=1 --pool=threads --no-file-parallelism tests/unit/news-feature-contract.test.ts`

Expected: `1` 个测试文件、所有新闻契约通过。

### Task 3: Typecheck and production build

**Files:**
- No source changes.

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: exit code 0。

- [ ] **Step 2: Run frontend build**

Run: `npm --prefix qianfu-liandeng run build`

Expected: Vite production build exits 0。

### Task 4: Browser acceptance and release

**Files:**
- No source changes after verification.

- [ ] **Step 1: Verify desktop news page**

Open `https://mc-u.top/news` at `1314x912`; confirm报头、头版主文、目录和短讯可读，页面无横向溢出。

- [ ] **Step 2: Verify mobile news page**

Open `https://mc-u.top/news` at `390x844`; confirm单列阅读、标题换行、底部导航和正文图片不溢出。

- [ ] **Step 3: Publish only the frontend dist**

Archive `qianfu-liandeng/dist`，上传到新的静态 release，记录旧 `current` 指针，原子切换并 reload Nginx；不重启 API 或 PM2。

- [ ] **Step 4: Run production smoke**

Run: `ssh ... bash -s < scripts/linux/qianfu-prod-smoke.sh`

Expected: `smoke_ok=true checks=8`。
