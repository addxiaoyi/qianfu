ALTER TABLE "MarketplaceOrder" ADD COLUMN "dispute_status" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "MarketplaceOrder" ADD COLUMN "dispute_reason" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "dispute_description" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "dispute_resolution" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "dispute_opened_at" DATETIME;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "dispute_resolved_at" DATETIME;

CREATE INDEX "MarketplaceOrder_dispute_status_idx" ON "MarketplaceOrder"("dispute_status");
