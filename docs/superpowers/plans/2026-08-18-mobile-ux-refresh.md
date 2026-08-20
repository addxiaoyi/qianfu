# Mobile UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with checkpoints.

**Goal:** Improve all mobile-facing pages so they are compact, readable, touch-friendly, truthful, and stable at 320px, 375px, and 430px widths without changing desktop layouts.

**Architecture:** Keep the existing React mobile component boundaries. First tighten the shared `MobileLayout` and navigation contract, then align home/search/detail components to the same spacing and card primitives. Use existing `serverView`, API hooks, `MobileSelectSheet`, and motion primitives; add only scoped mobile styles and focused contract tests.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Vitest, React Testing Library/browser smoke checks.

---

### Task 1: Establish Mobile Layout Contracts

**Files:**
- Modify: `qianfu-liandeng/src/components/mobile/MobileLayout.tsx`
- Modify: `qianfu-liandeng/src/components/mobile/MobileBottomNav.tsx`
- Modify: `qianfu-liandeng/src/index.css`
- Test: `tests/unit/mobile-layout-ux-contract.test.ts`

- [ ] **Step 1: Write the failing contract test**

Assert that the shared shell has a single mobile scroll root, safe-area bottom padding, reduced-motion support, and navigation buttons with accessible labels. Assert that no global mobile rule re-enables horizontal overflow.

```ts
it('keeps mobile shell scroll-safe and motion-safe', () => {
  expect(layout).toContain('data-mobile-scroll-root="true"');
  expect(layout).toContain('env(safe-area-inset-bottom)');
  expect(styles).toContain('prefers-reduced-motion');
  expect(styles).toContain('overflow-x: hidden');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails for the missing motion contract**

Run: `npx vitest run tests/unit/mobile-layout-ux-contract.test.ts --reporter=dot`

Expected: FAIL because the mobile stylesheet does not yet declare the reduced-motion override.

- [ ] **Step 3: Implement the shell changes**

Keep `MobileLayout` as the only scroll container. Replace the horizontal page transition with opacity plus a maximum 8px vertical translate, reduce shell header padding, and give the bottom navigation a stable `min-height` and explicit content padding. Add an `@media (prefers-reduced-motion: reduce)` rule that disables transitions and animations for `[data-mobile-scroll-root="true"]` descendants. Preserve the existing ICP link and safe-area behavior.

- [ ] **Step 4: Run the focused shell contract test**

Run: `npx vitest run tests/unit/mobile-layout-ux-contract.test.ts --reporter=dot`

Expected: PASS with no horizontal-overflow assertion failures.

- [ ] **Step 5: Commit the shell slice**

```bash
git add qianfu-liandeng/src/components/mobile/MobileLayout.tsx qianfu-liandeng/src/components/mobile/MobileBottomNav.tsx qianfu-liandeng/src/index.css tests/unit/mobile-layout-ux-contract.test.ts
git commit -m "fix: tighten mobile shell layout"
```

### Task 2: Rebuild Mobile Home Information Hierarchy

**Files:**
- Modify: `qianfu-liandeng/src/pages/MobileHome.tsx`
- Test: `tests/unit/mobile-home-ux-contract.test.ts`

- [ ] **Step 1: Write the failing home contract test**

Assert that home uses real server display helpers, exposes a compact search action, renders loading/error/empty states, and does not use fabricated metrics or unbounded display text.

```ts
it('keeps home content real and compact', () => {
  expect(home).toContain('getServerSummary(server)');
  expect(home).toContain('重新加载');
  expect(home).toContain('暂无已审核服务器');
  expect(home).not.toContain('12,000+');
  expect(home).not.toContain('4.2k');
});
```

- [ ] **Step 2: Run the focused test to verify the missing summary contract**

Run: `npx vitest run tests/unit/mobile-home-ux-contract.test.ts --reporter=dot`

Expected: FAIL because the current featured card does not show the submitted summary.

- [ ] **Step 3: Implement the home layout**

Use a compact page header, a full-width search field, a two-column quick-action grid with 44px controls, and a single-column featured list. Each featured item should show thumbnail, name, `getServerSummary`, platform/version, and observed online state. Keep the current query, retry, empty state, and route targets. Use `line-clamp` only for the list summary and prevent the card arrow from changing layout width.

- [ ] **Step 4: Run home tests and the public truthfulness suite**

Run: `npx vitest run tests/unit/mobile-home-ux-contract.test.ts tests/unit/public-data-truthfulness.test.ts tests/unit/server-view-summary.test.ts --reporter=dot`

Expected: PASS.

- [ ] **Step 5: Commit the home slice**

```bash
git add qianfu-liandeng/src/pages/MobileHome.tsx tests/unit/mobile-home-ux-contract.test.ts
git commit -m "fix: improve mobile home hierarchy"
```

### Task 3: Align Mobile Search and Result Cards

**Files:**
- Modify: `qianfu-liandeng/src/components/mobile/MobileSearch.tsx`
- Modify: `qianfu-liandeng/src/components/mobile/MobileSelectSheet.tsx`
- Test: `tests/unit/mobile-search-ux-contract.test.ts`

- [ ] **Step 1: Write the failing search contract test**

Assert that filters use the custom sheet instead of native selects, result cards expose real summary/address/platform data, and the empty state offers a reset action.

```ts
it('keeps search controls custom and result data truthful', () => {
  expect(search).toContain('MobileSelectSheet');
  expect(search).toContain('getServerSummary(server)');
  expect(search).toContain('没有找到相关服务器');
  expect(search).not.toContain('<select');
});
```

- [ ] **Step 2: Run the focused test and confirm the current card contract is incomplete**

Run: `npx vitest run tests/unit/mobile-search-ux-contract.test.ts --reporter=dot`

Expected: FAIL on the missing summary/address assertions.

- [ ] **Step 3: Implement the list layout**

Keep the existing query parameters and custom bottom sheets. Make the search header sticky within the mobile scroll root, keep filter chips in a single horizontally scrollable row, and use a stable list card with thumbnail, name, summary, address, platform/version, status, and one clear detail action. Ensure long hostnames wrap and do not push the card controls off-screen.

- [ ] **Step 4: Run search and server-view tests**

Run: `npx vitest run tests/unit/mobile-search-ux-contract.test.ts tests/unit/server-discovery-display.test.ts --reporter=dot`

Expected: PASS.

- [ ] **Step 5: Commit the search slice**

```bash
git add qianfu-liandeng/src/components/mobile/MobileSearch.tsx qianfu-liandeng/src/components/mobile/MobileSelectSheet.tsx tests/unit/mobile-search-ux-contract.test.ts
git commit -m "fix: improve mobile server search"
```

### Task 4: Recompose Mobile Server Details

**Files:**
- Modify: `qianfu-liandeng/src/components/mobile/MobileServerDetail.tsx`
- Test: `tests/unit/mobile-server-detail-ux-contract.test.ts`

- [ ] **Step 1: Write the failing detail contract test**

Assert that the detail page renders real introduction HTML, a copyable address action, published fields, platform/version/group information when present, and the existing error/empty states.

```ts
it('prioritizes published server information on mobile details', () => {
  expect(detail).toContain('dangerouslySetInnerHTML');
  expect(detail).toContain('服务器地址已复制');
  expect(detail).toContain('发布QQ群');
  expect(detail).toContain('该服务器暂未填写公开介绍');
});
```

- [ ] **Step 2: Run the focused test to verify the missing address action**

Run: `npx vitest run tests/unit/mobile-server-detail-ux-contract.test.ts --reporter=dot`

Expected: FAIL because the current mobile detail view displays the address without a copy control.

- [ ] **Step 3: Implement the detail layout**

Use a compact hero with stable cover ratio, name and observed status. Put the address in a dedicated row with a copy icon button and accessible label. Render sanitized `content_html` first, then a real-data field grid for platform, category, versions, group number, network, and online mode. Keep tabs for information/rules/comments, but reduce padding and remove redundant decorative blocks.

- [ ] **Step 4: Run detail and truthfulness tests**

Run: `npx vitest run tests/unit/mobile-server-detail-ux-contract.test.ts tests/unit/mobile-server-detail-resilience-contract.test.ts tests/unit/public-data-truthfulness.test.ts --reporter=dot`

Expected: PASS.

- [ ] **Step 5: Commit the detail slice**

```bash
git add qianfu-liandeng/src/components/mobile/MobileServerDetail.tsx tests/unit/mobile-server-detail-ux-contract.test.ts
git commit -m "fix: improve mobile server details"
```

### Task 5: Full Verification and Mobile Viewport Acceptance

**Files:**
- Test: `tests/unit/mobile-layout-ux-contract.test.ts`
- Test: `tests/unit/mobile-home-ux-contract.test.ts`
- Test: `tests/unit/mobile-search-ux-contract.test.ts`
- Test: `tests/unit/mobile-server-detail-ux-contract.test.ts`

- [ ] **Step 1: Run the focused mobile suite**

Run: `npx vitest run tests/unit/mobile-*-ux-contract.test.ts tests/unit/mobile-server-detail-resilience-contract.test.ts --reporter=dot`

Expected: all mobile UX and resilience tests pass.

- [ ] **Step 2: Build the frontend**

Run: `npm --prefix qianfu-liandeng run build`

Expected: Vite exits 0 and produces `qianfu-liandeng/dist/index.html`.

- [ ] **Step 3: Run the existing frontend quality checks**

Run: `npx vitest run tests/unit/public-data-truthfulness.test.ts tests/unit/server-view-summary.test.ts tests/unit/server-discovery-display.test.ts --reporter=dot`

Expected: all existing public-data and server-display tests pass.

- [ ] **Step 4: Verify real mobile viewports**

Start the Vite preview and inspect `/`, `/servers`, `/search`, and `/server/5` at 320x800, 375x812, and 430x932. Confirm no horizontal overflow, no bottom-nav overlap, readable server introduction, and visible loading/error/empty states.

- [ ] **Step 5: Deploy only after local verification**

Use the existing frontend release workflow, verify the generated manifest, then check `https://mc-u.top/`, `/servers`, and `/server/5` with a real mobile viewport. Keep the API release unchanged unless the frontend smoke test proves an API regression.
