CREATE TABLE "MarketplaceAppeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appellant_id" INTEGER NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "reviewer_id" INTEGER,
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" DATETIME,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceAppeal_appellant_id_fkey" FOREIGN KEY ("appellant_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceAppeal_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "MarketplaceAppeal_appellant_id_idx" ON "MarketplaceAppeal"("appellant_id");
CREATE INDEX "MarketplaceAppeal_status_idx" ON "MarketplaceAppeal"("status");
CREATE INDEX "MarketplaceAppeal_target_type_target_id_idx" ON "MarketplaceAppeal"("target_type", "target_id");
CREATE INDEX "MarketplaceAppeal_submitted_at_idx" ON "MarketplaceAppeal"("submitted_at");
CREATE UNIQUE INDEX "MarketplaceAppeal_pending_target_key" ON "MarketplaceAppeal"("appellant_id", "target_type", "target_id") WHERE "status" = 'PENDING';
