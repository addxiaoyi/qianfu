-- Product listings must be reviewed before they can be publicly sold.
ALTER TABLE "MarketplaceProduct" ADD COLUMN "listing_status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "moderation_notes" TEXT;

-- Existing public listings are retained; newly created or edited listings require review.
UPDATE "MarketplaceProduct"
SET "listing_status" = 'APPROVED'
WHERE "is_published" = true;

CREATE INDEX "MarketplaceProduct_listing_status_idx" ON "MarketplaceProduct"("listing_status");
