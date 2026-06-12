# XPay Multi-Tenant Admin Plan

## Goal
- Make XPay independently usable as a multi-project payment service.
- Support admin-created tenant accounts, secure token generation, per-tenant callback config, and per-tenant payment method storage.
- Avoid hardcoded credentials or plaintext secret leakage.

## Current investigation
- Inspect existing XPay Java auth / admin / merchant model.
- Compare with QianFu payment project model already in repo.
- Decide whether to extend XPay directly or layer QianFu-admin over XPay.

## Constraints
- Production-like server already exists.
- Need secure super-admin bootstrap from env, not hardcoded in code.
- Need callback isolation and per-tenant secrets.
