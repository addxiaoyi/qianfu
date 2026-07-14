# Promotion Task Center Design

## Goal

Replace the marketing-only `/promotion` page with a usable promotion task center where authenticated users can bind one account per supported platform, submit evidence for eligible tasks, track each claim, and receive wallet rewards only after an administrator approves the evidence.

The first release must not claim automatic platform verification. It uses manual review until a trusted platform API or signed webhook can prove the requested action.

## Scope

Included:

- User task list with eligibility, remaining capacity, reward, deadline, and claim status.
- Platform account binding with ownership conflict protection.
- Claim submission with proof, an idempotency key, and multiple claims when the task permits them.
- Claim history and counts for the signed-in user.
- Manual administrator approval or rejection with atomic, idempotent wallet reward delivery.
- Per-user, per-day, and total task limits enforced under concurrency.
- Loading, empty, error, unauthenticated, unbound, pending, rewarded, and rejected states.

Excluded from this release:

- Automatic verification based only on configured actions.
- OAuth account linking or scraping third-party platforms.
- Reusing another user's external platform identity.
- Cash withdrawal, external payouts, referrals, bidding, or advertising purchase flows.

## Existing Problems

The current implementation has four conflicting behaviors:

1. `PromoClaimRecord` is unique on `(user_id, task_id)`, so `claim_limit_per_user > 1` cannot work.
2. `submitPromoClaim` returns the first existing claim, so it never creates a second permitted claim.
3. `bindPlatformAccount` upserts by external platform identity and can reassign an identity already owned by another user.
4. `verifyActionsLocally` verifies that actions exist in configuration, not that a user performed them, yet the result can trigger an immediate wallet reward.

The `/promotion` page is also a marketing page and does not call the existing user promotion APIs.

## User Experience

`/promotion` becomes the task center itself. It is a work-focused page, not a marketing hero.

The primary view contains:

- A compact summary row: available tasks, pending reviews, rewarded claims, and total rewards.
- Tabs for available tasks and claim history.
- A platform binding section showing each required platform and its current state.
- A task list with platform, required action text, reward, remaining quota, deadline, and the user's claim count.
- A claim dialog containing the task target link, bound account, proof fields, and a clear manual-review notice.

Task actions use these states:

- `Bind account`: no active binding exists for the task platform.
- `Submit proof`: the task is active and all limits have capacity.
- `Under review`: the submitted claim is pending.
- `Rewarded`: an approved claim has credited the wallet.
- `Rejected`: the claim shows the administrator note and may be retried only when task limits still allow another claim.
- `Unavailable`: the task is not started, expired, paused, disabled, or out of capacity.

Desktop uses a two-column task and activity layout. Mobile uses the same information in one column with stable bottom-sheet dialogs. No nested cards or oversized promotional sections are introduced.

## Data Model

### Platform Binding

Keep both existing unique constraints:

- `(platform, platform_user_id)` prevents one external identity from belonging to multiple users.
- `(user_id, platform)` limits a user to one active identity per platform.

Binding writes target `(user_id, platform)`. Before create or update, the service checks whether `(platform, platform_user_id)` belongs to another user. A conflict returns `409` and never changes the existing owner.

Manual binding starts as `ACTIVE` only because it identifies where evidence should be attributed; it does not mean the platform has verified account ownership. The API and UI must describe it as a user-provided binding.

### Claims

Remove `@@unique([user_id, task_id])` from all Prisma deployment schemas. Add:

- `claim_no Int` for the user's sequence within a task.
- `idempotency_key String` scoped to the user and task.
- `@@unique([user_id, task_id, claim_no])`.
- `@@unique([user_id, task_id, idempotency_key])`.

`claim_request_no` remains globally unique for operational tracing.

Existing claims migrate with `claim_no = 1` and an idempotency key derived from their existing request number. The migration must abort if duplicate legacy rows violate the new sequence assumption.

### Status Contract

For the manual-review-first release:

- New claims: `claim_status=PENDING`, `reward_status=PENDING`.
- Approved claims: transition through `reward_status=REWARDING`, then atomically become `claim_status=REWARDED`, `reward_status=REWARDED`.
- Rejected claims: `claim_status=REJECTED`, `reward_status=REJECTED` with a required audit note.

No user submission may directly increment wallet balance.

## API Design

Existing authenticated endpoints remain under `/api/v1/promo`.

### Read Endpoints

- `GET /tasks`: returns only currently visible user tasks, pagination, task capacity, binding state, `userClaimCount`, and the latest claim status.
- `GET /tasks/:id`: returns a user-safe task detail without other users, audit logs, or internal verification payloads.
- `GET /bindings/me`: returns only the current user's bindings.
- `GET /claims/me`: returns the current user's claims with task summary and pagination.
- `GET /admin/tasks/:id`: returns task claims and verification logs and is administrator-only.
- `GET /admin/claims`: returns the administrator claim-review queue with status filters and pagination.

The current administrator screens must use the two `/admin/*` read endpoints. They must not reuse `/claims/me` or the user-safe task detail response.

### Write Endpoints

- `POST /bindings`: validates platform and external identity, rejects ownership conflicts, and updates only the caller's platform binding.
- `POST /claims`: requires CSRF and an `Idempotency-Key` header. The body contains `taskId` and bounded proof fields.
- Existing admin approve and reject endpoints remain CSRF-protected and admin-only.

All responses keep the repository's standard success/error envelope. Validation errors use `400`, authentication `401`, authorization `403`, missing resources `404`, and ownership, limit, or idempotency conflicts `409`.

## Claim Transaction

Claim submission executes in a serializable transaction with bounded retry for database serialization and uniqueness conflicts:

1. Validate authentication, task ID, proof shape, and idempotency key.
2. Load the enabled task and verify its start and end times.
3. Load the caller's platform binding.
4. Return the existing claim when the same idempotency key is replayed.
5. Count the user's claims for the task, today's task claims in Asia/Shanghai, and all task claims.
6. Enforce per-user, daily, and total limits.
7. Assign `claim_no = userClaimCount + 1` and create a pending claim.
8. Write a verification log with source `MANUAL` and no pass result.
9. Commit and return `201`.

The unique sequence and idempotency constraints close races that count checks alone cannot prevent.

## Reward Transaction

Administrator approval uses one transaction:

1. Atomically claim the reward transition only when the claim is not already `REWARDING` or `REWARDED`.
2. Create or load the wallet.
3. Increment the wallet balance.
4. Insert a uniquely referenced `PromoWalletTransaction` for the claim.
5. Mark the claim rewarded with administrator ID, note, and timestamps.

A repeated approval returns the existing rewarded claim without a second balance increment. Rejection is allowed only from a non-rewarded state and requires a non-empty note.

## Security And Validation

- Normalize supported platform names through an allowlist, not arbitrary strings.
- Bound external IDs, usernames, URLs, and proof text by length and type.
- Reject HTML and unsupported proof keys at the API boundary.
- Do not store access tokens, platform cookies, or passwords in promotion records.
- Require authentication for all user promotion routes and administrator middleware for all admin routes.
- Require CSRF for every mutation.
- Rate-limit binding and claim submission separately from general API traffic.
- Never expose another user's binding, claim, proof, audit note, or verification detail.
- Log claim and reward transitions without proof content or other sensitive values.

## Frontend Structure

Create focused modules following the existing React Query and request client patterns:

- `PromotionTaskCenter.tsx`: page composition and tab state.
- `promotionApi.ts`: typed task, binding, and claim requests.
- `PromotionSummary.tsx`: stable summary metrics.
- `PromotionBindings.tsx`: binding status and conflict-safe form.
- `PromotionTaskList.tsx`: loading, empty, error, and task rows.
- `PromotionClaimDialog.tsx`: proof entry and submission state.
- `PromotionClaimHistory.tsx`: paginated status history.

The existing `PromotionLanding.tsx` route is replaced rather than adding another competing user route. Existing admin pages remain separate and must use admin-only list endpoints instead of `/claims/me`.

## Testing

Backend tests must cover:

- External identity conflicts do not reassign ownership.
- A user can create claim 1 and claim 2 when the configured limit is 2.
- Claim 3 is rejected at the per-user limit.
- Daily and total limits hold under concurrent submissions.
- Idempotency replay returns one claim and one sequence number.
- Every new claim is pending and does not change wallet balance.
- Approval credits exactly once; repeated approval does not credit again.
- Rejection requires a note and cannot overwrite a rewarded claim.
- User-safe task details do not expose other users or audit data.
- Authentication, administrator authorization, CSRF, validation, and rate limits are enforced.

Frontend tests must cover:

- Loading, empty, error, unauthenticated, and unbound states.
- Binding conflict messaging.
- Claim submission disables duplicate clicks and sends one idempotency key.
- Task counts and latest statuses update after submission.
- Desktop and mobile layouts keep controls visible without overlap.

Production smoke verification uses uniquely prefixed accounts and always removes created bindings, claims, wallet transactions, and users in foreign-key order. It verifies wallet balance before and after one approval and confirms a repeated approval changes nothing.

## Rollout

1. Add cross-database Prisma migrations and migration parity tests.
2. Deploy backend behavior with user reward auto-verification disabled.
3. Deploy the task-center frontend and admin claim-list correction.
4. Create one low-value manual-review test task.
5. Run authenticated bind, claim, approve, idempotency, limit, privacy, and cleanup smoke tests.
6. Enable real tasks only after production logs, wallet balances, and claim counts agree.

Rollback keeps the old frontend build available and restores the previous backend artifact. The schema change is additive except for replacing the old claim uniqueness constraint; rollback code must continue to read the new columns without deleting claim history.

## Acceptance Criteria

- `/promotion` is a functional authenticated task center.
- No claim rewards itself during submission.
- One external platform identity cannot move between users.
- Configured per-user limits greater than one work as stored and displayed.
- Daily and total limits remain correct under concurrent requests.
- Claim and approval retries are idempotent.
- Wallet reward, transaction record, and claim state change atomically.
- Users can see only their own bindings and claims.
- Administrators can review pending claims through admin-only endpoints.
- All supported Prisma schemas, targeted tests, type checks, builds, and production smoke checks pass before release.
