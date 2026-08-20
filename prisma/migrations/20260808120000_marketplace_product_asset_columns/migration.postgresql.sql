ALTER TABLE "MarketplaceProduct" ADD COLUMN IF NOT EXISTS "file_sha256" TEXT;
ALTER TABLE "MarketplaceProduct" ADD COLUMN IF NOT EXISTS "asset_size" INTEGER;
ALTER TABLE "MarketplaceProduct" ADD COLUMN IF NOT EXISTS "asset_mime" TEXT;
