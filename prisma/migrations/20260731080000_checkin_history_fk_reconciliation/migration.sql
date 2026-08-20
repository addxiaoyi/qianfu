-- Upgrade runtime-created legacy checkin_history tables to the Prisma relation.
-- Existing versions had the same columns but no user foreign key.

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

DROP TABLE IF EXISTS "_checkin_history_migrated";
CREATE TABLE "_checkin_history_migrated" (
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

INSERT OR IGNORE INTO "_checkin_history_migrated" (
    "id", "user_id", "checkin_date", "timezone", "base_reward",
    "bonus_reward", "total_reward", "streak_days", "created_at"
)
SELECT
    h."id", h."user_id", h."checkin_date", h."timezone", h."base_reward",
    h."bonus_reward", h."total_reward", h."streak_days", h."created_at"
FROM "checkin_history" h
INNER JOIN "User" u ON u."id" = h."user_id";

DROP TABLE "checkin_history";
ALTER TABLE "_checkin_history_migrated" RENAME TO "checkin_history";

CREATE UNIQUE INDEX IF NOT EXISTS "checkin_history_user_id_checkin_date_key" ON "checkin_history"("user_id", "checkin_date");
CREATE INDEX IF NOT EXISTS "checkin_history_user_id_created_at_idx" ON "checkin_history"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "checkin_history_user_id_checkin_date_idx" ON "checkin_history"("user_id", "checkin_date" DESC);
