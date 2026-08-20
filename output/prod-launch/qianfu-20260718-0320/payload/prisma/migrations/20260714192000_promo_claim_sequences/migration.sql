-- Existing schema uniqueness guarantees at most one legacy row per user/task.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_PromoClaimRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "claim_status" TEXT NOT NULL DEFAULT 'PENDING',
    "reward_status" TEXT NOT NULL DEFAULT 'PENDING',
    "verify_result" TEXT,
    "verify_detail" TEXT,
    "proof_data" TEXT,
    "claim_request_no" TEXT NOT NULL,
    "claim_no" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "claim_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" DATETIME,
    "rewarding_at" DATETIME,
    "rewarded_at" DATETIME,
    "failed_reason" TEXT,
    "audit_by" INTEGER,
    "audit_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "PromoClaimRecord_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "PromoTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromoClaimRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_PromoClaimRecord" (
    "id", "task_id", "user_id", "platform_user_id", "claim_status", "reward_status",
    "verify_result", "verify_detail", "proof_data", "claim_request_no", "claim_no",
    "idempotency_key", "claim_at", "verified_at", "rewarding_at", "rewarded_at",
    "failed_reason", "audit_by", "audit_note", "created_at", "updated_at"
)
SELECT
    "id", "task_id", "user_id", "platform_user_id", "claim_status", "reward_status",
    "verify_result", "verify_detail", "proof_data", "claim_request_no", 1,
    "claim_request_no", "claim_at", "verified_at", "rewarding_at", "rewarded_at",
    "failed_reason", "audit_by", "audit_note", "created_at", "updated_at"
FROM "PromoClaimRecord";

DROP TABLE "PromoClaimRecord";
ALTER TABLE "new_PromoClaimRecord" RENAME TO "PromoClaimRecord";

CREATE UNIQUE INDEX "PromoClaimRecord_claim_request_no_key" ON "PromoClaimRecord"("claim_request_no");
CREATE UNIQUE INDEX "PromoClaimRecord_user_id_task_id_claim_no_key" ON "PromoClaimRecord"("user_id", "task_id", "claim_no");
CREATE UNIQUE INDEX "PromoClaimRecord_user_id_task_id_idempotency_key_key" ON "PromoClaimRecord"("user_id", "task_id", "idempotency_key");
CREATE INDEX "PromoClaimRecord_task_id_idx" ON "PromoClaimRecord"("task_id");
CREATE INDEX "PromoClaimRecord_user_id_idx" ON "PromoClaimRecord"("user_id");
CREATE INDEX "PromoClaimRecord_claim_status_idx" ON "PromoClaimRecord"("claim_status");
CREATE INDEX "PromoClaimRecord_reward_status_idx" ON "PromoClaimRecord"("reward_status");
CREATE INDEX "PromoClaimRecord_platform_user_id_idx" ON "PromoClaimRecord"("platform_user_id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
