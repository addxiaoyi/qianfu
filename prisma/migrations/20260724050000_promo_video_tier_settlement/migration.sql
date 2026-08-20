-- AlterTable
ALTER TABLE "PromoClaimRecord" ADD COLUMN "video_url" TEXT;
ALTER TABLE "PromoClaimRecord" ADD COLUMN "platform_video_id" TEXT;
ALTER TABLE "PromoClaimRecord" ADD COLUMN "platform_author_id" TEXT;
ALTER TABLE "PromoClaimRecord" ADD COLUMN "publish_at" DATETIME;
ALTER TABLE "PromoClaimRecord" ADD COLUMN "settlement_status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "PromoClaimRecord" ADD COLUMN "highest_rewarded_tier" TEXT;
ALTER TABLE "PromoClaimRecord" ADD COLUMN "total_rewarded_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PromoClaimRecord" ADD COLUMN "last_metric_at" DATETIME;

-- CreateTable
CREATE TABLE "PromoMetricSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "claim_id" INTEGER NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "source_ref" TEXT,
    "raw_summary" TEXT,
    "captured_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoMetricSnapshot_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "PromoClaimRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoRewardSettlement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "claim_id" INTEGER NOT NULL,
    "metrics_snapshot_id" INTEGER,
    "tier_key" TEXT NOT NULL,
    "tier_name" TEXT NOT NULL,
    "target_amount" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "calculation_snapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoRewardSettlement_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "PromoClaimRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PromoClaimRecord_task_id_platform_video_id_key" ON "PromoClaimRecord"("task_id", "platform_video_id");
CREATE INDEX "PromoClaimRecord_settlement_status_idx" ON "PromoClaimRecord"("settlement_status");
CREATE INDEX "PromoClaimRecord_platform_video_id_idx" ON "PromoClaimRecord"("platform_video_id");
CREATE INDEX "PromoClaimRecord_last_metric_at_idx" ON "PromoClaimRecord"("last_metric_at");
CREATE INDEX "PromoMetricSnapshot_claim_id_captured_at_idx" ON "PromoMetricSnapshot"("claim_id", "captured_at");
CREATE INDEX "PromoMetricSnapshot_source_idx" ON "PromoMetricSnapshot"("source");
CREATE UNIQUE INDEX "PromoRewardSettlement_idempotency_key_key" ON "PromoRewardSettlement"("idempotency_key");
CREATE UNIQUE INDEX "PromoRewardSettlement_claim_id_tier_key_key" ON "PromoRewardSettlement"("claim_id", "tier_key");
CREATE INDEX "PromoRewardSettlement_claim_id_created_at_idx" ON "PromoRewardSettlement"("claim_id", "created_at");
CREATE INDEX "PromoRewardSettlement_status_idx" ON "PromoRewardSettlement"("status");
