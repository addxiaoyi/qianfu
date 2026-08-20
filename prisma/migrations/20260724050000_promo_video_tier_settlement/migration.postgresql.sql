-- Provider: PostgreSQL
-- Generated from an exact current-schema-minus-feature baseline with Prisma migrate diff.
-- Additive and non-idempotent: back up the target database and verify these objects are absent before applying.

ALTER TABLE "PromoClaimRecord" ADD COLUMN "highest_rewarded_tier" TEXT,
ADD COLUMN "last_metric_at" TIMESTAMP(3),
ADD COLUMN "platform_author_id" TEXT,
ADD COLUMN "platform_video_id" TEXT,
ADD COLUMN "publish_at" TIMESTAMP(3),
ADD COLUMN "settlement_status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "total_rewarded_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "video_url" TEXT;

CREATE TABLE "PromoMetricSnapshot" (
    "id" SERIAL NOT NULL,
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
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoRewardSettlement" (
    "id" SERIAL NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoRewardSettlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromoMetricSnapshot_claim_id_captured_at_idx" ON "PromoMetricSnapshot"("claim_id", "captured_at");
CREATE INDEX "PromoMetricSnapshot_source_idx" ON "PromoMetricSnapshot"("source");
CREATE UNIQUE INDEX "PromoRewardSettlement_idempotency_key_key" ON "PromoRewardSettlement"("idempotency_key");
CREATE INDEX "PromoRewardSettlement_claim_id_created_at_idx" ON "PromoRewardSettlement"("claim_id", "created_at");
CREATE INDEX "PromoRewardSettlement_status_idx" ON "PromoRewardSettlement"("status");
CREATE UNIQUE INDEX "PromoRewardSettlement_claim_id_tier_key_key" ON "PromoRewardSettlement"("claim_id", "tier_key");
CREATE INDEX "PromoClaimRecord_settlement_status_idx" ON "PromoClaimRecord"("settlement_status");
CREATE INDEX "PromoClaimRecord_platform_video_id_idx" ON "PromoClaimRecord"("platform_video_id");
CREATE INDEX "PromoClaimRecord_last_metric_at_idx" ON "PromoClaimRecord"("last_metric_at");
CREATE UNIQUE INDEX "PromoClaimRecord_task_id_platform_video_id_key" ON "PromoClaimRecord"("task_id", "platform_video_id");

ALTER TABLE "PromoMetricSnapshot" ADD CONSTRAINT "PromoMetricSnapshot_claim_id_fkey"
    FOREIGN KEY ("claim_id") REFERENCES "PromoClaimRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromoRewardSettlement" ADD CONSTRAINT "PromoRewardSettlement_claim_id_fkey"
    FOREIGN KEY ("claim_id") REFERENCES "PromoClaimRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
