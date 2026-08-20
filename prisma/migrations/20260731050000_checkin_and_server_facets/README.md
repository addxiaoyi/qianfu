# Check-in and server facet normalization

| Provider | Migration |
|---|---|
| SQLite | `migration.sql` through Prisma migrate |
| MySQL 8+ | `migration.mysql.sql` through the production reconciliation runbook |
| PostgreSQL | `migration.postgresql.sql` through the PostgreSQL migration runbook |

The legacy `Server.tags`, `Server.supported_versions`, and `Server.network_env` strings remain as API compatibility fields. Exact filters use `server_facets`; migration SQL backfills valid JSON arrays and application writes keep the relation synchronized.
