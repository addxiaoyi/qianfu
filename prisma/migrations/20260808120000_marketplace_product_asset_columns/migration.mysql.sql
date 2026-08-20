ALTER TABLE `MarketplaceProduct` ADD COLUMN `file_sha256` VARCHAR(191) NULL;
ALTER TABLE `MarketplaceProduct` ADD COLUMN `asset_size` INTEGER NULL;
ALTER TABLE `MarketplaceProduct` ADD COLUMN `asset_mime` VARCHAR(191) NULL;
