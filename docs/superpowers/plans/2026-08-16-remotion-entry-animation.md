# Remotion 首次打开入场动画 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在千服联灯应用壳层增加一次性的 Minecraft B2「飞越方块群」Remotion 入场动画，并保证跳过、减少动态效果、异常降级和移动端验收完整。

**Architecture:** `EntryAnimationGate` 负责会话门控、可访问性和失败降级；`MinecraftFlightComposition` 只负责基于 Remotion frame 的视觉时间轴；`entryAnimationState` 提供可测试的 sessionStorage 和 reduced-motion 逻辑。Gate 放在 `App.tsx` 的路由内容外层，真实页面始终在动画下方渲染。

**Tech Stack:** React 19, TypeScript, Vite, `remotion@4.0.512`, `@remotion/player@4.0.512`, Vitest, jsdom, Playwright-compatible in-app browser.

---

### Task 1: Add Remotion dependencies and pure playback state helpers

**Files:**
- Modify: `qianfu-liandeng/package.json`
- Modify: `qianfu-liandeng/package-lock.json`
- Create: `qianfu-liandeng/src/components/entry/entryAnimationState.ts`
- Test: `tests/unit/remotion-entry-animation-state.test.ts`

- [ ] **Step 1: Add the pinned browser playback dependencies**

Run:

```powershell
npm install --prefix qianfu-liandeng remotion@4.0.512 @remotion/player@4.0.512
```

Expected: `package.json` contains both packages at `4.0.512`, and `package-lock.json` is updated without unrelated dependency upgrades.

- [ ] **Step 2: Write the failing state-helper tests**

Create tests covering the exact policy:

```ts
import { describe, expect, it } from 'vitest';
import {
  ENTRY_ANIMATION_STORAGE_KEY,
  markEntryAnimationPlayed,
  shouldPlayEntryAnimation,
} from '@/components/entry/entryAnimationState';

describe('entry animation state', () => {
  it('plays once when the session has no completion marker', () => {
    const storage = new Map<string, string>();
    expect(shouldPlayEntryAnimation(storage, false)).toBe(true);
    markEntryAnimationPlayed(storage);
    expect(storage.get(ENTRY_ANIMATION_STORAGE_KEY)).toBe('played');
  });

  it('does not play again after completion or when reduced motion is enabled', () => {
    const storage = new Map<string, string>([[ENTRY_ANIMATION_STORAGE_KEY, 'played']]);
    expect(shouldPlayEntryAnimation(storage, false)).toBe(false);
    expect(shouldPlayEntryAnimation(new Map(), true)).toBe(false);
  });

  it('fails open when storage read or write throws', () => {
    const throwingStorage = { get: () => { throw new Error('storage blocked'); } };
    expect(shouldPlayEntryAnimation(throwingStorage, false)).toBe(true);
    expect(() => markEntryAnimationPlayed({ set: () => { throw new Error('storage blocked'); } })).not.toThrow();
  });
});
```

The helper should accept a narrow `EntryAnimationStorage` interface with `get` and `set` methods so tests do not need a real browser storage implementation. `shouldPlayEntryAnimation` must catch a throwing `get` and return `true` unless reduced motion is enabled. Production adapters should catch `window.sessionStorage` access errors and return `null`.

- [ ] **Step 3: Run the focused test and verify it fails**

Run:

```powershell
npm exec vitest run tests/unit/remotion-entry-animation-state.test.ts -- --maxWorkers=1
```

Expected: FAIL because `entryAnimationState.ts` does not exist yet.

- [ ] **Step 4: Implement the minimal state helper**

Implement these stable exports:

```ts
export const ENTRY_ANIMATION_STORAGE_KEY = 'qianfu.entry-animation.v1';

export type EntryAnimationStorage = {
  get(key: string): string | null;
  set(key: string, value: string): void;
};

export const shouldPlayEntryAnimation = (
  storage: EntryAnimationStorage | null,
  prefersReducedMotion: boolean,
) => !prefersReducedMotion && storage?.get(ENTRY_ANIMATION_STORAGE_KEY) !== 'played';

export const markEntryAnimationPlayed = (storage: EntryAnimationStorage | null) => {
  try {
    storage?.set(ENTRY_ANIMATION_STORAGE_KEY, 'played');
  } catch {
    // A blocked sessionStorage must never prevent the page from loading.
  }
};
```

The production `readEntryAnimationStorage()` adapter must catch both obtaining `window.sessionStorage` and calling `get`, returning `null` on failure. The `shouldPlayEntryAnimation` path must also catch a throwing `get` and treat it as playable.

- [ ] **Step 5: Run the focused test and verify it passes**

Run the same Vitest command. Expected: all state-helper tests pass.

- [ ] **Step 6: Commit the isolated state helper**

```powershell
git add qianfu-liandeng/package.json qianfu-liandeng/package-lock.json qianfu-liandeng/src/components/entry/entryAnimationState.ts tests/unit/remotion-entry-animation-state.test.ts
git commit -m "feat: add entry animation playback state"
```

### Task 2: Build the Minecraft flight Composition

**Files:**
- Create: `qianfu-liandeng/src/components/entry/MinecraftFlightComposition.tsx`
- Test: `tests/unit/remotion-entry-animation-composition.test.ts`

- [ ] **Step 1: Write the failing Composition contract test**

Assert the Composition source uses the approved timing and no external media:

```ts
const source = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/components/entry/MinecraftFlightComposition.tsx'), 'utf8');

it('defines the approved B2 timing and local visual layers', () => {
  expect(source).toContain('durationInFrames = 72');
  expect(source).toContain('fps = 60');
  expect(source).toContain('useCurrentFrame');
  expect(source).toContain('interpolate');
  expect(source).not.toMatch(/https?:\/\//);
  expect(source).not.toMatch(/<audio|<video/);
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```powershell
npm exec vitest run tests/unit/remotion-entry-animation-composition.test.ts -- --maxWorkers=1
```

Expected: FAIL because the Composition source is missing.

- [ ] **Step 3: Implement the fixed-size, responsive Composition**

Create a pure component with `durationInFrames = 72`, `fps = 60`, and a `1440x900` composition coordinate space. Use `AbsoluteFill` for layers and derive all motion from `useCurrentFrame()`:

- Background: solid dark navy sky, fixed pixel stars, and a low-poly voxel terrain band.
- Terrain: 7-9 fixed-size square blocks with staggered `interpolate()` opacity, `translateY`, and scale values; keep all geometry inside the composition bounds.
- Camera: apply a single scene transform that moves forward from `scale(1.04)` to `scale(1.16)` between frames 15 and 48, then settles toward the page handoff.
- Branding: render `千服联灯` and `SERVER DISCOVERY` with restrained sizes, `spring()` entrance around frames 38-56, and no forced uppercase on the Chinese title.
- End state: fade the scene from frames 60-72 so the gate can remove the overlay without a hard flash.

Use `useVideoConfig()` only for composition dimensions when helpful; do not read route data, fetch APIs, use browser storage, or mount event listeners inside the Composition.

- [ ] **Step 4: Run the Composition contract test and build check**

Run:

```powershell
npm exec vitest run tests/unit/remotion-entry-animation-composition.test.ts -- --maxWorkers=1
npm --prefix qianfu-liandeng run build
```

Expected: the contract passes and Vite resolves `remotion` imports.

- [ ] **Step 5: Commit the Composition**

```powershell
git add qianfu-liandeng/src/components/entry/MinecraftFlightComposition.tsx tests/unit/remotion-entry-animation-composition.test.ts
git commit -m "feat: add Minecraft flight entry composition"
```

### Task 3: Integrate the EntryAnimationGate into the application shell

**Files:**
- Create: `qianfu-liandeng/src/components/entry/EntryAnimationGate.tsx`
- Modify: `qianfu-liandeng/src/App.tsx`
- Test: `tests/unit/remotion-entry-animation-gate.test.tsx`

- [ ] **Step 1: Write failing gate behavior tests**

Use jsdom and a mocked `@remotion/player` that captures `autoPlay`, `durationInFrames`, and `onEnded`. Cover:

```tsx
it('renders the player only for an unplayed session', () => {
  render(<EntryAnimationGate><div>page</div></EntryAnimationGate>);
  expect(screen.getByTestId('entry-animation')).toBeInTheDocument();
  expect(screen.getByText('page')).toBeInTheDocument();
});

it('removes the overlay after skip and writes the completion marker', async () => {
  render(<EntryAnimationGate><div>page</div></EntryAnimationGate>);
  await userEvent.click(screen.getByRole('button', { name: '跳过入场动画' }));
  expect(screen.queryByTestId('entry-animation')).not.toBeInTheDocument();
  expect(sessionStorage.getItem(ENTRY_ANIMATION_STORAGE_KEY)).toBe('played');
});
```

Also cover pre-marked sessions, `Escape`, reduced motion, Player `onError`, and an empty/invalid storage implementation.

- [ ] **Step 2: Run the gate tests and verify they fail**

Run:

```powershell
npm exec vitest run tests/unit/remotion-entry-animation-gate.test.tsx -- --maxWorkers=1
```

Expected: FAIL because the gate and App integration do not exist.

- [ ] **Step 3: Implement the gate**

The gate must:

1. Read reduced motion from `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once on mount.
2. Obtain a safe session storage adapter and call `shouldPlayEntryAnimation`.
3. Render children first, then a fixed `z-[100]` overlay with `data-testid="entry-animation"` and `aria-hidden="true"`.
4. Render `Player` with `component={MinecraftFlightComposition}`, `durationInFrames={72}`, `compositionWidth={1440}`, `compositionHeight={900}`, `fps={60}`, `autoPlay`, and `controls={false}`.
5. Render a native skip button outside the aria-hidden visual layer; on click or `Escape`, call `markEntryAnimationPlayed` and set `isVisible` false.
6. On `onEnded` and `onError`, mark played and remove the overlay. Error handling must not throw into the route tree.
7. Remove the keydown listener and any timers in the effect cleanup.

Do not call `window` or `sessionStorage` during module initialization so Vite tests and non-browser imports remain safe.

- [ ] **Step 4: Integrate at the route-shell boundary**

Wrap the existing App return tree once:

```tsx
<EntryAnimationGate>
  <Router>...</Router>
</EntryAnimationGate>
```

Keep `QueryClientProvider` in `main.tsx` unchanged. Do not place the gate inside a route, `Suspense` boundary, authentication guard, or mobile-only branch.

- [ ] **Step 5: Run gate tests, targeted regression tests, and lint**

Run:

```powershell
npm exec vitest run tests/unit/remotion-entry-animation-state.test.ts tests/unit/remotion-entry-animation-composition.test.ts tests/unit/remotion-entry-animation-gate.test.tsx tests/unit/server-detail-route-validation.test.ts -- --maxWorkers=1
npm --prefix qianfu-liandeng run lint
npm --prefix qianfu-liandeng run build
```

Expected: all targeted tests pass, lint exits 0, and Vite produces a production bundle.

- [ ] **Step 6: Commit the gate integration**

```powershell
git add qianfu-liandeng/src/components/entry/EntryAnimationGate.tsx qianfu-liandeng/src/App.tsx tests/unit/remotion-entry-animation-gate.test.tsx
git commit -m "feat: integrate first-visit Remotion entry animation"
```

### Task 4: Browser acceptance, release, and production verification

**Files:**
- Modify only if verification finds a defect: `qianfu-liandeng/src/components/entry/EntryAnimationGate.tsx`, `qianfu-liandeng/src/components/entry/MinecraftFlightComposition.tsx`

- [ ] **Step 1: Verify a clean first-load browser run**

Use the in-app browser at the public site with a fresh session state and verify:

- the overlay appears before the page becomes interactive;
- the B2 flight lasts about 1.2 seconds;
- the real homepage remains mounted underneath;
- the overlay disappears on completion;
- no console errors are emitted.

- [ ] **Step 2: Verify repeat-load and interaction behavior**

In the same tab, reload and confirm the overlay does not return. In a clean tab, confirm the skip button and `Escape` both remove the overlay immediately. Set a `390x844` viewport and confirm no horizontal overflow or clipped skip control.

- [ ] **Step 3: Build the final release artifact**

Run:

```powershell
npm --prefix qianfu-liandeng run build
```

Upload the resulting `qianfu-liandeng/dist` to a new release directory under `/www/wwwroot/mc-u.top/releases/<timestamp>-remotion-entry`, verify `index.html` and the entry chunks, then atomically switch `/www/wwwroot/mc-u.top/current` while keeping the previous release intact.

- [ ] **Step 4: Validate Nginx and public assets**

On the production host run:

```bash
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
```

From the workstation verify `https://mc-u.top/`, the referenced entry chunk, and `/server/5` all return HTTP 200. Confirm the public HTML references the new bundle before declaring deployment complete.

- [ ] **Step 5: Record final evidence**

Record the release directory, current symlink target, focused test result, build result, public HTTP status, and desktop/mobile browser observations. Do not include credentials, cookies, storage contents, or private API values.

## Self-review

- Spec coverage: the plan covers one-session playback, B2 timing, Remotion Player integration, skip and Escape, reduced motion, safe storage, error fallback, mobile behavior, tests, and atomic production release.
- Placeholder scan: no unresolved placeholder or unspecified implementation step remains.
- Type consistency: `EntryAnimationStorage`, `ENTRY_ANIMATION_STORAGE_KEY`, `shouldPlayEntryAnimation`, and `markEntryAnimationPlayed` are defined in Task 1 and reused by Task 3.
