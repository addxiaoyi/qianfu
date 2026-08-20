# Popular video tier settlement migration

This directory contains equivalent additive schema changes for each supported database provider.

| Provider | File | Execution path |
|---|---|---|
| SQLite | `migration.sql` | Normal local `prisma migrate deploy` flow |
| MySQL | `migration.mysql.sql` | Reviewed SQL applied through the production MySQL reconciliation/runbook |
| PostgreSQL | `migration.postgresql.sql` | Reviewed SQL applied through the PostgreSQL migration runbook |

## Safety rules

1. Do not execute `migration.sql` against MySQL or PostgreSQL. The repository migration lock is SQLite-oriented.
2. Back up the target database before applying a provider-specific file.
3. Confirm the target already contains the earlier promotion idempotency and claim sequence changes (`claim_no`, `idempotency_key`, and their unique indexes).
4. Confirm these objects do not already exist. The provider-specific SQL is additive but intentionally non-idempotent so a partially applied migration fails visibly rather than silently diverging.
5. Apply the SQL first in a disposable database cloned from the target schema.
6. After application, run schema reconciliation against the target provider and require an empty target-to-schema delta for these objects.
7. Restart the API only after the new columns, tables, indexes, and foreign keys have been verified.

## Expected changes

- Eight nullable/defaulted columns added to `PromoClaimRecord`.
- New `PromoMetricSnapshot` table.
- New `PromoRewardSettlement` table.
- Unique video-per-task and unique settlement-per-tier constraints.
- Cascade deletion from a claim to metric snapshots and settlements.

No provider-specific file contains `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or data-rewrite statements.
