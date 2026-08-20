# Server Discovery UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public Minecraft server discovery flow easier to scan, compare, inspect, and act on without adding commercial functionality.

**Architecture:** Keep the existing public server API and React route structure. Add shared server display helpers for status and freshness, keep list filter state in URL search parameters, and use the same display model in desktop cards, desktop detail, mobile search, and mobile detail.

**Tech Stack:** React, TypeScript, React Router, TanStack Query, Tailwind utility classes, Vitest, existing Framer Motion components.

---

### Task 1: Shared discovery display model

**Files:**
- Modify: `qianfu-liandeng/src/utils/serverView.ts`
- Modify: `qianfu-liandeng/src/types/server.ts`
- Test: `tests/unit/server-discovery-display.test.ts`

- [ ] Write failing tests for status labels, status tone, player count, and freshness labels using online, offline, unknown, and missing timestamp fixtures.
- [ ] Run `npx vitest run tests/unit/server-discovery-display.test.ts --maxWorkers=1` and confirm the new helper imports or expectations fail because the helpers do not exist.
- [ ] Add typed helpers for status display, player count, version list, and relative freshness while preserving existing fallback behavior.
- [ ] Run the focused test and existing `server-view` tests until green.

### Task 2: Public list intent navigation and URL filters

**Files:**
- Modify: `qianfu-liandeng/src/pages/ServerList.tsx`
- Modify: `qianfu-liandeng/src/store/uiStore.ts`
- Test: `tests/unit/server-discovery-list-ux-contract.test.ts`

- [ ] Write failing source contract tests for URL initialization, URL synchronization, intent links, filter reset, and result summary.
- [ ] Run the focused contract test and confirm it fails on the missing URL/filter behavior.
- [ ] Implement `useSearchParams`-backed search, category, platform, version, online, and sort state; use the existing API query parameters and preserve the public endpoint.
- [ ] Add the four intent controls: now playing (`online=true`), active players (`sortBy=players`), newest (`sortBy=created`), and all servers.
- [ ] Add visible active-filter summary and a one-click clear action with keyboard-accessible controls.
- [ ] Run focused tests and the existing public directory contracts.

### Task 3: Desktop server card action hierarchy

**Files:**
- Modify: `qianfu-liandeng/src/components/business/ServerCard.tsx`
- Modify: `qianfu-liandeng/src/pages/ServerList.tsx`
- Test: `tests/unit/server-card-layout-contract.test.ts`

- [ ] Extend the card contract test for status badge, freshness label, independent copy button, and a detail link as the primary action.
- [ ] Run the card contract test to record the expected failure.
- [ ] Implement fixed media dimensions, status badge, normalized metadata rows, explicit detail action, and copy feedback using the existing clipboard utility.
- [ ] Prevent card-level navigation when the copy control is activated and keep missing address state truthful.
- [ ] Run card tests, lint, and frontend typecheck.

### Task 4: Desktop and mobile detail first-screen actions

**Files:**
- Modify: `qianfu-liandeng/src/pages/ServerDetail.tsx`
- Modify: `qianfu-liandeng/src/components/mobile/MobileServerDetail.tsx`
- Test: `tests/unit/server-detail-ux-contract.test.ts`
- Test: `tests/unit/mobile-server-detail-resilience-contract.test.ts`

- [ ] Write failing contracts for a first-screen status/metadata block, copy-address primary action, and mobile bottom action labels.
- [ ] Run focused detail tests and confirm failure.
- [ ] Reuse shared display helpers to place status, player count, freshness, version, platform, category, tags, and address in the first-screen information block.
- [ ] Keep existing auth, favorite, share, retry, similar-server, and safe public-data boundaries intact.
- [ ] Run desktop and mobile detail tests plus typecheck.

### Task 5: Build and browser acceptance

**Files:**
- Modify: generated frontend assets only through the existing build command.
- Review: `qianfu-liandeng/src/pages/ServerList.tsx`, `qianfu-liandeng/src/components/business/ServerCard.tsx`, `qianfu-liandeng/src/pages/ServerDetail.tsx`, `qianfu-liandeng/src/components/mobile/MobileServerDetail.tsx`

- [ ] Run the focused Vitest suite, frontend typecheck, changed-file lint, and production frontend build.
- [ ] Run the browser against `/servers` at desktop and mobile widths; verify intent navigation, URL persistence, card density, empty/error states, and no overlapping text.
- [ ] Open one real public server detail route and verify status, metadata, copy action, and mobile bottom bar.
- [ ] Run the repository frontend manifest and compression guards.
- [ ] Report any authenticated or production-only flow that remains blocked rather than treating local/browser evidence as production proof.
