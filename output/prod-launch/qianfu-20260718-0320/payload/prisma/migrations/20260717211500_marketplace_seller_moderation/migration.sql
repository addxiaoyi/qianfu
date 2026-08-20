ALTER TABLE "User" ADD COLUMN "marketplace_seller_status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "marketplace_seller_notes" TEXT;

CREATE INDEX "User_marketplace_seller_status_idx" ON "User"("marketplace_seller_status");
