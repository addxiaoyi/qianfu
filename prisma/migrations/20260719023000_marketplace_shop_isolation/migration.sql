-- Add durable, non-sensitive marketplace verification state to sellers.
ALTER TABLE "User" ADD COLUMN "marketplace_verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "User" ADD COLUMN "marketplace_verification_submitted_at" DATETIME;
ALTER TABLE "User" ADD COLUMN "marketplace_verification_reviewed_at" DATETIME;
ALTER TABLE "User" ADD COLUMN "marketplace_verification_reviewed_by" INTEGER;
ALTER TABLE "User" ADD COLUMN "marketplace_verification_note" TEXT;
ALTER TABLE "User" ADD COLUMN "marketplace_verification_expires_at" DATETIME;

-- One current shop row per seller; immutable versions remain in MarketplaceShopConfigVersion.
CREATE TABLE "MarketplaceShop" (
    "owner_id" INTEGER NOT NULL PRIMARY KEY,
    "banner_url" TEXT NOT NULL DEFAULT '',
    "avatar_url" TEXT NOT NULL DEFAULT '',
    "announcement_title" TEXT NOT NULL DEFAULT '',
    "announcement_text" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "shop_name" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL DEFAULT 'default',
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "announcement_click_count" INTEGER NOT NULL DEFAULT 0,
    "featured_click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceShop_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "User_marketplace_verification_status_idx" ON "User"("marketplace_verification_status");
CREATE INDEX "User_marketplace_verification_expires_at_idx" ON "User"("marketplace_verification_expires_at");
CREATE INDEX "MarketplaceShop_updated_at_idx" ON "MarketplaceShop"("updated_at");
