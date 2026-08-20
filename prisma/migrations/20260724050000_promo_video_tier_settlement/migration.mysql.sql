-- Provider: MySQL
-- Generated from an exact current-schema-minus-feature baseline with Prisma migrate diff.
-- Additive and non-idempotent: back up the target database and verify these objects are absent before applying.

ALTER TABLE `PromoClaimRecord` ADD COLUMN `highest_rewarded_tier` VARCHAR(191) NULL,
    ADD COLUMN `last_metric_at` DATETIME(3) NULL,
    ADD COLUMN `platform_author_id` VARCHAR(191) NULL,
    ADD COLUMN `platform_video_id` VARCHAR(191) NULL,
    ADD COLUMN `publish_at` DATETIME(3) NULL,
    ADD COLUMN `settlement_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `total_rewarded_amount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `video_url` TEXT NULL;

CREATE TABLE `PromoMetricSnapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `claim_id` INTEGER NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `likes` INTEGER NOT NULL DEFAULT 0,
    `comments` INTEGER NOT NULL DEFAULT 0,
    `shares` INTEGER NOT NULL DEFAULT 0,
    `favorites` INTEGER NOT NULL DEFAULT 0,
    `coins` INTEGER NOT NULL DEFAULT 0,
    `source` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `source_ref` TEXT NULL,
    `raw_summary` LONGTEXT NULL,
    `captured_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PromoMetricSnapshot_claim_id_captured_at_idx`(`claim_id`, `captured_at`),
    INDEX `PromoMetricSnapshot_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PromoRewardSettlement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `claim_id` INTEGER NOT NULL,
    `metrics_snapshot_id` INTEGER NULL,
    `tier_key` VARCHAR(191) NOT NULL,
    `tier_name` VARCHAR(191) NOT NULL,
    `target_amount` INTEGER NOT NULL,
    `paid_amount` INTEGER NOT NULL,
    `idempotency_key` VARCHAR(191) NOT NULL,
    `calculation_snapshot` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'COMPLETED',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PromoRewardSettlement_idempotency_key_key`(`idempotency_key`),
    INDEX `PromoRewardSettlement_claim_id_created_at_idx`(`claim_id`, `created_at`),
    INDEX `PromoRewardSettlement_status_idx`(`status`),
    UNIQUE INDEX `PromoRewardSettlement_claim_id_tier_key_key`(`claim_id`, `tier_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `PromoClaimRecord_settlement_status_idx` ON `PromoClaimRecord`(`settlement_status`);
CREATE INDEX `PromoClaimRecord_platform_video_id_idx` ON `PromoClaimRecord`(`platform_video_id`);
CREATE INDEX `PromoClaimRecord_last_metric_at_idx` ON `PromoClaimRecord`(`last_metric_at`);
CREATE UNIQUE INDEX `PromoClaimRecord_task_id_platform_video_id_key` ON `PromoClaimRecord`(`task_id`, `platform_video_id`);

ALTER TABLE `PromoMetricSnapshot` ADD CONSTRAINT `PromoMetricSnapshot_claim_id_fkey`
    FOREIGN KEY (`claim_id`) REFERENCES `PromoClaimRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PromoRewardSettlement` ADD CONSTRAINT `PromoRewardSettlement_claim_id_fkey`
    FOREIGN KEY (`claim_id`) REFERENCES `PromoClaimRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
