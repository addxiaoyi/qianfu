CREATE TABLE IF NOT EXISTS `MarketplaceProductVersion` (
  `id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `version` VARCHAR(191) NOT NULL,
  `file_sha256` VARCHAR(191) NULL,
  `asset_size` INTEGER NULL,
  `asset_mime` VARCHAR(191) NULL,
  `download_url` TEXT NULL,
  `listing_snapshot` LONGTEXT NOT NULL,
  `created_by` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `MarketplaceProductVersion_product_id_created_at_idx` (`product_id`, `created_at`),
  INDEX `MarketplaceProductVersion_file_sha256_idx` (`file_sha256`),
  CONSTRAINT `MarketplaceProductVersion_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `MarketplaceProduct` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MarketplaceOrderEvidence` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `product_version_id` VARCHAR(191) NULL,
  `listing_snapshot` LONGTEXT NOT NULL,
  `policy_snapshot` LONGTEXT NOT NULL,
  `accepted_at` DATETIME(3) NOT NULL,
  `buyer_ip_hmac` VARCHAR(191) NULL,
  `user_agent_hmac` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MarketplaceOrderEvidence_order_id_key` (`order_id`),
  INDEX `MarketplaceOrderEvidence_product_version_id_idx` (`product_version_id`),
  INDEX `MarketplaceOrderEvidence_accepted_at_idx` (`accepted_at`),
  CONSTRAINT `MarketplaceOrderEvidence_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `MarketplaceOrder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MarketplaceOrderEvidence_product_version_id_fkey` FOREIGN KEY (`product_version_id`) REFERENCES `MarketplaceProductVersion` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MarketplaceDeliveryEvidence` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `product_version_id` VARCHAR(191) NULL,
  `event_type` VARCHAR(191) NOT NULL,
  `delivery_ref` VARCHAR(191) NULL,
  `ip_hmac` VARCHAR(191) NULL,
  `user_agent_hmac` VARCHAR(191) NULL,
  `metadata_json` LONGTEXT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `MarketplaceDeliveryEvidence_order_id_occurred_at_idx` (`order_id`, `occurred_at`),
  INDEX `MarketplaceDeliveryEvidence_product_version_id_idx` (`product_version_id`),
  INDEX `MarketplaceDeliveryEvidence_event_type_idx` (`event_type`),
  CONSTRAINT `MarketplaceDeliveryEvidence_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `MarketplaceOrder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MarketplaceDeliveryEvidence_product_version_id_fkey` FOREIGN KEY (`product_version_id`) REFERENCES `MarketplaceProductVersion` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MarketplaceAppeal` (
  `id` VARCHAR(191) NOT NULL,
  `appellant_id` INTEGER NOT NULL,
  `target_type` VARCHAR(191) NOT NULL,
  `target_id` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `evidence` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `decision_note` TEXT NULL,
  `reviewer_id` INTEGER NULL,
  `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewed_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `MarketplaceAppeal_appellant_id_idx` (`appellant_id`),
  INDEX `MarketplaceAppeal_status_idx` (`status`),
  INDEX `MarketplaceAppeal_target_type_target_id_idx` (`target_type`, `target_id`),
  INDEX `MarketplaceAppeal_submitted_at_idx` (`submitted_at`),
  CONSTRAINT `MarketplaceAppeal_appellant_id_fkey` FOREIGN KEY (`appellant_id`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MarketplaceAppeal_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
