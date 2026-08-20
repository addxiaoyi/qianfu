-- M-11/M-12: move check-in history under Prisma and normalize server list facets.

CREATE TABLE IF NOT EXISTS "checkin_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "checkin_date" TEXT NOT NULL,
    "timezone" TEXT,
    "base_reward" REAL NOT NULL,
    "bonus_reward" REAL NOT NULL DEFAULT 0,
    "total_reward" REAL NOT NULL,
    "streak_days" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checkin_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_history_user_id_checkin_date_key" ON "checkin_history"("user_id", "checkin_date");
CREATE INDEX IF NOT EXISTS "checkin_history_user_id_created_at_idx" ON "checkin_history"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "checkin_history_user_id_checkin_date_idx" ON "checkin_history"("user_id", "checkin_date" DESC);

CREATE TABLE IF NOT EXISTS "server_facets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "server_facets_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "server_facets_server_id_kind_normalized_value_key" ON "server_facets"("server_id", "kind", "normalized_value");
CREATE INDEX IF NOT EXISTS "server_facets_kind_normalized_value_idx" ON "server_facets"("kind", "normalized_value");
CREATE INDEX IF NOT EXISTS "server_facets_server_id_kind_idx" ON "server_facets"("server_id", "kind");

INSERT OR IGNORE INTO "server_facets" ("server_id", "kind", "value", "normalized_value")
SELECT s."id", 'TAG', trim(CAST(j.value AS TEXT)), lower(trim(CAST(j.value AS TEXT)))
FROM "Server" s, json_each(CASE WHEN json_valid(s."tags") THEN s."tags" ELSE '[]' END) j
WHERE trim(CAST(j.value AS TEXT)) <> '';

INSERT OR IGNORE INTO "server_facets" ("server_id", "kind", "value", "normalized_value")
SELECT s."id", 'VERSION', trim(CAST(j.value AS TEXT)), lower(trim(CAST(j.value AS TEXT)))
FROM "Server" s, json_each(CASE WHEN json_valid(s."supported_versions") THEN s."supported_versions" ELSE '[]' END) j
WHERE trim(CAST(j.value AS TEXT)) <> '';

INSERT OR IGNORE INTO "server_facets" ("server_id", "kind", "value", "normalized_value")
SELECT s."id", 'NETWORK_ENV', trim(CAST(j.value AS TEXT)), lower(trim(CAST(j.value AS TEXT)))
FROM "Server" s, json_each(CASE WHEN json_valid(s."network_env") THEN s."network_env" ELSE '[]' END) j
WHERE trim(CAST(j.value AS TEXT)) <> '';
