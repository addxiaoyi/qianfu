# XPay Multi-Tenant Admin Runbook

## Added capabilities
- Local bootstrap super-admin from env only.
- Super-admin can create subordinate local admin accounts.
- Per-tenant callback URL, callback secret, access token.
- Per-tenant payment method records.
- Secrets are stored hashed; generated plaintext is returned only once at creation/rotation time.

## Required env vars
- `XPAY_ADMIN_JWT_SECRET`
- `XPAY_SUPERADMIN_BOOTSTRAP_USERNAME`
- `XPAY_SUPERADMIN_BOOTSTRAP_PASSWORD`

## New admin auth API
- `POST /admin/auth/local/login`
  - body: `{ "username": "...", "password": "..." }`

## New admin management API
- `POST /admin/local-admins`
- `GET /admin/tenants`
- `POST /admin/tenants`
- `POST /admin/tenants/{tenantId}/rotate-secrets`

## Security notes
- Do not write bootstrap credentials into source code.
- Change bootstrap password after first successful login.
- Generated tenant `accessToken` and `callbackSecret` are only shown once and should be stored in an external secret manager.
- Callback secret and access token are persisted as SHA-256 hashes only.
- Local admin passwords are persisted as PBKDF2 hashes.

## Remaining work
- Wire tenant access token into public create-pay endpoints.
- Enforce tenant ownership checks on rotate/update endpoints.
- Add password reset/change API for local admins.
- Add QR upload/storage flow per tenant payment method.
- Add DB migration for existing production XPay instances.
