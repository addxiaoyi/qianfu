# Check-in history foreign-key reconciliation

Legacy runtime controllers created `checkin_history` with the expected columns and uniqueness rule, but without a database foreign key to `User`.

| Provider | Migration behavior |
|---|---|
| SQLite | Rebuilds the table, preserves rows whose users still exist, and adds `ON DELETE CASCADE`. |
| PostgreSQL | Removes orphan rows and conditionally adds the canonical foreign key. |
| MySQL 8+ | Removes orphan rows and conditionally adds the canonical foreign key through `information_schema`. |

This is a follow-up migration so the checksum of `20260731050000_checkin_and_server_facets` remains immutable for databases where it has already been applied.
