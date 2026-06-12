# Mobile, Level, Real Data Hotfix - 2026-05-18

## Scope

This pass addresses the user-reported production-readiness issues around mobile display, fake frontend data, unavailable dark theme controls, check-in level logic, rule display, and broken 3D head rendering.

## Changes Completed

- Registration/email verification follow-up:
  - New password registration now creates an authenticated but `email_verified=false` account.
  - Registration generates a six-digit email code immediately and stores only the hashed code.
  - `/auth/verify-code` now returns a usable local JWT and full safe user payload after successful verification.
  - `/profile` no longer double-masks fields such as `email` and `email_verified`, so frontend auth/verification routing can rely on real values.
  - Register page now persists the returned local token/user and redirects to `/verify-code?email=...`.
  - Verify page can use the current user email when the query parameter is absent, and stores the token returned by code verification.
- Mobile auth navigation now uses `authStore.isAuthenticated` instead of the old mock `localStorage.isLoggedIn` flag.
- Mobile routes now use fresh auth state on each render. The old `useMemo([])` wrapper kept stale auth closures and could make mobile login/logout appear unresponsive.
- Mobile protected routes now require authentication:
  - `/me`
  - `/me/settings`
  - `/me/notifications`
  - `/messages`
  - `/payment`
  - `/tickets`
  - `/dashboard`
  - email-verified routes `/editor` and `/tickets/new`
- Mobile settings no longer exposes a fake dark mode toggle. The page now only shows working account/support/legal navigation.
- Mobile user center now reads real profile, check-in status, server quota, and ticket data from API endpoints.
- Dashboard check-in now reads `/user/checkin/status`, disables the button after a real same-day check-in, updates `authStore.user`, and displays backend level fields:
  - `level`
  - `experience_points`
  - `xp_into_level`
  - `xp_for_next_level`
  - `level_progress`
- 3D head display was downgraded to a stable pixelated Minecraft head image because the previous pseudo-cube mapped the same flat helm image to every side.
- Billing page now renders real `/wallet/transactions` rows or an empty state.
- Profile page now renders real check-in state and wallet transaction rows or empty states.
- Server detail page no longer shows fake `pravatar` users, fake leaderboard entries, fake latency/uptime/certification logs, or hardcoded rules. It uses server fields where available and empty states where not.
- Mobile home featured list now renders real `/public/servers` data or an empty state.
- Server list no longer hardcodes `1,240` or fake `01 / 24` pagination; it displays the loaded server count.
- Mobile ticket list now renders `/tickets` data, supports real status/priority labels, and no longer contains sample support tickets.
- Mobile ticket detail now loads `/tickets/:id`, posts replies to `/tickets/:id/messages`, and no longer simulates agent replies.
- Mobile ticket creation now posts real `/tickets` payloads and routes to the created ticket.
- Mobile messages now composes real `/notifications` and `/tickets` updates instead of hardcoded conversations.
- Mobile notifications now loads `/notifications` and uses the existing read/read-all endpoints; the unsupported fake delete-all action was removed.
- Mobile search now queries `/public/servers` with real search/category/sort params and links each card to the real server detail route.
- Mobile server detail now reads the route `:id`, loads `/servers/:id`, shows real metadata/rules/comments/similar servers or empty states, and replaces fake favorite/share/play buttons with working like/copy/share actions.
- Mobile payment now reuses the production payment flow instead of separate `/products`, `/coupons`, and `/payments` mock/fallback logic.
- Mobile home quick actions now point only to implemented routes; the top-right icon opens the user center, and the search form navigates to the real mobile search route.
- Server list category tabs now send real category/search params, and the old no-op settings icon now refreshes the list.
- Dashboard activity feed now uses real check-in, wallet transaction, and account verification data. If there is no real activity, it shows an explicit empty state instead of hardcoded fake logs.
- Billing's primary recharge control is now a real link to `/payment`; the check-in button reads `/user/checkin/status` and disables itself when today's check-in is already complete.
- The 3D head component now renders a deterministic local pixel avatar first and overlays the remote skin only if it loads successfully, so external skin services can no longer break the card.
- `/wallet/transactions` now returns `created_at` and `createdAt` as ISO strings, fixing the `{}` timestamp response that caused "时间未知" in Dashboard/Billing activity views.

## Verification

Ran:

```bash
npm --prefix qianfu-liandeng run build
```

Result:

- TypeScript project build passed.
- Vite production build passed.
- Static scan found no remaining matches in `qianfu-liandeng/src` for the removed fake strings: `某推荐`, `124 PLAYERS`, `1,240`, `深色模式`, `Matrix_Overlord`, `DATA_VERIFIED`, `Handshake_Complete`, `UID: 123456`.
- Browser mobile smoke for `/mobile` at `390x844` showed no horizontal overflow and no fake-string matches. Browser retest was interrupted by plugin connection reset after the mobile auth route fix, so authenticated flow still needs a live backend smoke.
- Re-ran `npm --prefix qianfu-liandeng run build` after the second real-data sweep. TypeScript and Vite production build passed.
- Re-ran `npm --prefix qianfu-liandeng run build` after the registration/verification frontend fix. TypeScript and Vite production build passed.
- Ran `npm run typecheck:server` after the registration/verification/profile backend fix. Server typecheck passed.
- Ran `npm run server:build` after the registration/verification/profile backend fix. Compiled `dist-server` was regenerated.
- Local API smoke on `http://127.0.0.1:43101` using a temporary SQLite copy passed:
  - registration creates `email_verified=false`
  - register response returns local JWT
  - profile returns real email/verification fields
  - immediate code resend is rate-limited as expected after registration-generated code
  - invalid verification code is rejected
  - check-in grants `25 XP`
  - profile level progress reflects the new XP
  - duplicate same-day check-in is idempotent
- Captured Playwright mobile screenshots at `390x844` for:
  - `output/playwright/mobile-home-wait.png`
  - `output/playwright/mobile-search.png`
  - `output/playwright/mobile-servers.png`
  - `output/playwright/mobile-me-redirect.png`
- `/me` unauthenticated smoke correctly rendered the login screen instead of the user center.
- `/mobile`, `/search`, and `/servers` rendered within the mobile viewport. In local preview the API returned empty/loading states because no full backend was attached, but the UI no longer displayed removed fake server/ticket/message data.
- Production deployment on `103.236.92.10` completed for the latest frontend dist and the wallet route timestamp hotfix. `nginx -t` passed and `qianfu-api` restarted online under PM2.
- Live API check confirmed `/api/v1/wallet/transactions?limit=1` returns an ISO string timestamp, for example `created_at: "2026-05-16T14:06:04.141Z"`.
- Live browser smoke report `logs/live-browser-smoke-realdata-head-2026-05-18.json` passed with `failedCount=0`:
  - authenticated Dashboard loads without JS crashes
  - Dashboard has no `2 分钟前`, `15 分钟前`, or `1 小时前` fake activity logs
  - Dashboard/Billing show real wallet timestamps instead of `时间未知`
  - Billing recharge links to `/#/payment`
  - 3D head card renders with local/live fallback state
  - mobile `/mobile` at `390x844` has `overflow=0`
  - known fake/mobile dark-theme strings remain absent
- Final admin/frontend production pass on 2026-05-18:
  - Admin routes now stay on `/#/admin*` instead of being redirected back to `/#/`.
  - `normalizeUser` now lowercases backend roles such as `ADMIN` / `NORMAL`, fixing front-end auth guards and admin route gating.
  - `AdminDashboard`, `AdminReview`, `AdminReports`, `AdminTickets`, `AdminModeration`, and `AdminAuditStats` now read real backend endpoints instead of missing or fake sources.
  - `AdminUsers` and `AdminSidebar` no longer show hardcoded population or latency numbers; they now show real user/global stats.
  - `TicketList`, `TicketDetail`, and desktop `TicketCreate` now use the real ticket payload shape (`title`, `description`, `created_at`, etc.).
  - Response masking now preserves `Date` fields as ISO strings and preserves `email_verified` as a boolean, eliminating the `{}` timestamp issue across more admin/user views.
  - `adminLimiter` was increased from `30` to `180` requests per 15 minutes in production so normal admin UI navigation and multi-query dashboards do not immediately self-rate-limit.
- Additional live reports:
  - `logs/live-admin-smoke-2026-05-18.json`
  - `logs/live-final-smoke-2026-05-18.json`
  - These confirmed:
    - admin pages load under authenticated admin session
    - no `404` endpoint-mismatch UI errors remain on the audited admin pages
    - no front-end JS crash remains on the audited pages
    - admin APIs `/admin/users`, `/audit/stats`, `/audit/logs`, `/review/pending`, `/reports`, and `/tickets` returned `200`

## Remaining Follow-Up

- Run one manual end-to-end operator pass in a real browser for:
  - `/admin-users` role change
  - `/admin-review` actual approve/reject on a real pending server
  - `/admin-reports` actual resolve/reject on a real report
  - `/admin-tickets` with at least one real ticket present
- If exact 3D skin rendering is still required, implement proper Minecraft skin atlas extraction. The current production-safe version intentionally favors a stable local pixel avatar with optional remote skin overlay.
- Backend should expose structured public server rules if rules need richer rendering than current metadata fields.
- Some other pages outside this pass may still contain placeholder marketing copy and should be audited in a separate sweep.
- Wider live smoke should continue across server detail, marketplace, admin mail, GitHub OAuth callback, and real payment-provider paths before considering the whole site launch-complete.
