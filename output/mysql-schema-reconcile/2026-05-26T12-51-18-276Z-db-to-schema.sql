-- DropIndex
DROP INDEX `Server_review_status_activity_idx` ON `Server`;

-- DropIndex
DROP INDEX `Server_reviewed_by_fkey` ON `Server`;

-- DropIndex
DROP INDEX `ServerStatus_playersOnline_idx` ON `ServerStatus`;

-- DropIndex
DROP INDEX `ServerVersion_editor_id_fkey` ON `ServerVersion`;

-- AlterTable
ALTER TABLE `IntroPage` MODIFY `content_html` VARCHAR(191) NOT NULL,
    MODIFY `seo_description` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `IntroPageVersion` MODIFY `content_html` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Server` MODIFY `summary` VARCHAR(191) NULL,
    MODIFY `content_html` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ServerVersion` MODIFY `summary` VARCHAR(191) NULL,
    MODIFY `content_html` VARCHAR(191) NULL,
    MODIFY `tags` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NULL,
    `supertokens_user_id` VARCHAR(191) NULL,
    `supabase_id` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `display_name` VARCHAR(191) NULL,
    `avatar_url` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `password_changed_at` DATETIME(3) NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `verification_token` VARCHAR(191) NULL,
    `token_expiry` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `login_count` INTEGER NOT NULL DEFAULT 0,
    `email_cipher` VARCHAR(191) NULL,
    `preferences` VARCHAR(191) NULL DEFAULT '{}',
    `bio_html` VARCHAR(191) NULL,
    `permissions` VARCHAR(191) NOT NULL DEFAULT '[]',
    `reset_token` VARCHAR(191) NULL,
    `reset_token_expiry` DATETIME(3) NULL,
    `experience_points` INTEGER NOT NULL DEFAULT 0,
    `last_checkin_at` DATETIME(3) NULL,
    `last_code_send_at` DATETIME(3) NULL,
    `login_lockout_at` DATETIME(3) NULL,
    `phone` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_supertokens_user_id_key`(`supertokens_user_id`),
    UNIQUE INDEX `User_supabase_id_key`(`supabase_id`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_created_at_idx`(`created_at`),
    INDEX `User_last_login_at_idx`(`last_login_at`),
    INDEX `User_email_verified_idx`(`email_verified`),
    INDEX `User_username_idx`(`username`),
    INDEX `User_permissions_idx`(`permissions`),
    INDEX `User_preferences_idx`(`preferences`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `user_agent` VARCHAR(191) NULL,
    `ip_address` VARCHAR(191) NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_token_key`(`token`),
    INDEX `Session_user_id_idx`(`user_id`),
    INDEX `Session_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'INFO',
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_user_id_idx`(`user_id`),
    INDEX `Notification_is_read_idx`(`is_read`),
    INDEX `Notification_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Wallet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Wallet_user_id_key`(`user_id`),
    INDEX `Wallet_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wallet_id` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `description` VARCHAR(191) NULL,
    `metadata` VARCHAR(191) NULL,
    `signature` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Transaction_wallet_id_idx`(`wallet_id`),
    INDEX `Transaction_created_at_idx`(`created_at`),
    INDEX `Transaction_type_idx`(`type`),
    INDEX `Transaction_metadata_idx`(`metadata`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserBioVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `content_html` LONGTEXT NULL,
    `editor_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserBioVersion_user_id_version_key`(`user_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServerStatusHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `server_id` INTEGER NOT NULL,
    `sampled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `online` BOOLEAN NOT NULL,
    `players_online` INTEGER NULL,
    `players_max` INTEGER NULL,
    `latency_ms` INTEGER NULL,
    `version_raw` VARCHAR(191) NULL,

    INDEX `ServerStatusHistory_server_id_sampled_at_idx`(`server_id`, `sampled_at`),
    INDEX `ServerStatusHistory_sampled_at_idx`(`sampled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServerComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `server_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ServerComment_server_id_created_at_idx`(`server_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServerLike` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `server_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ServerLike_server_id_idx`(`server_id`),
    UNIQUE INDEX `ServerLike_server_id_user_id_key`(`server_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemConfig` (
    `key` VARCHAR(191) NOT NULL,
    `value` LONGTEXT NOT NULL,
    `is_secret` BOOLEAN NOT NULL DEFAULT false,
    `description` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reviewer_id` INTEGER NOT NULL,
    `server_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReviewHistory_server_id_idx`(`server_id`),
    INDEX `ReviewHistory_reviewer_id_idx`(`reviewer_id`),
    INDEX `ReviewHistory_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermissionHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `permission` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PermissionHistory_user_id_idx`(`user_id`),
    INDEX `PermissionHistory_admin_id_idx`(`admin_id`),
    INDEX `PermissionHistory_created_at_idx`(`created_at`),
    INDEX `PermissionHistory_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NULL,
    `details` LONGTEXT NULL,
    `ip_address` VARCHAR(191) NULL,
    `method` VARCHAR(191) NULL,
    `endpoint` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `session_id` VARCHAR(191) NULL,
    `rechecked_at` DATETIME(3) NULL,
    `recheck_status` VARCHAR(191) NULL,
    `rechecked_by` INTEGER NULL,
    `hash` VARCHAR(191) NULL,
    `previous_hash` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_user_id_idx`(`user_id`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_created_at_idx`(`created_at`),
    INDEX `AuditLog_created_at_action_idx`(`created_at`, `action`),
    INDEX `AuditLog_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `AuditLog_rechecked_at_idx`(`rechecked_at`),
    INDEX `AuditLog_recheck_status_idx`(`recheck_status`),
    INDEX `AuditLog_ip_address_idx`(`ip_address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiKey` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `key_hash` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NULL,
    `permissions` VARCHAR(191) NULL DEFAULT '[]',
    `expires_at` DATETIME(3) NULL,
    `last_used_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ApiKey_key_hash_key`(`key_hash`),
    INDEX `ApiKey_key_hash_idx`(`key_hash`),
    INDEX `ApiKey_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModerationLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `content_type` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NULL,
    `reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ModerationLog_action_idx`(`action`),
    INDEX `ModerationLog_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'SUPPORT',
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `payment_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Ticket_status_idx`(`status`),
    INDEX `Ticket_priority_idx`(`priority`),
    INDEX `Ticket_user_id_idx`(`user_id`),
    INDEX `Ticket_updated_at_idx`(`updated_at`),
    INDEX `Ticket_created_at_idx`(`created_at`),
    INDEX `Ticket_user_id_status_updated_at_idx`(`user_id`, `status`, `updated_at`),
    INDEX `Ticket_payment_id_idx`(`payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticket_id` INTEGER NOT NULL,
    `sender_id` INTEGER NULL,
    `content` VARCHAR(191) NOT NULL,
    `is_ai` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketMessage_ticket_id_idx`(`ticket_id`),
    INDEX `TicketMessage_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `status` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `payment_method` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Payment_user_id_idx`(`user_id`),
    INDEX `Payment_status_idx`(`status`),
    INDEX `Payment_plan_id_idx`(`plan_id`),
    INDEX `Payment_created_at_idx`(`created_at`),
    INDEX `Payment_updated_at_idx`(`updated_at`),
    INDEX `Payment_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `Payment_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporter_id` INTEGER NOT NULL,
    `target_type` VARCHAR(191) NOT NULL,
    `target_id` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `resolution_notes` VARCHAR(191) NULL,
    `handler_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Report_reporter_id_idx`(`reporter_id`),
    INDEX `Report_status_idx`(`status`),
    INDEX `Report_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarketplaceProduct` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `sales` INTEGER NOT NULL DEFAULT 0,
    `rating` DOUBLE NOT NULL DEFAULT 0,
    `review_count` INTEGER NOT NULL DEFAULT 0,
    `author_name` VARCHAR(191) NOT NULL,
    `cover_url` VARCHAR(191) NULL,
    `download_url` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `creator_id` INTEGER NULL,

    INDEX `MarketplaceProduct_category_idx`(`category`),
    INDEX `MarketplaceProduct_price_idx`(`price`),
    INDEX `MarketplaceProduct_sales_idx`(`sales`),
    INDEX `MarketplaceProduct_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarketplaceOrder` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `buyer_id` INTEGER NULL,
    `buyer_name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `total_price` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PAID',
    `payment_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `fulfillment_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `delivery_url` VARCHAR(191) NULL,
    `payment_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `MarketplaceOrder_product_id_idx`(`product_id`),
    INDEX `MarketplaceOrder_buyer_id_idx`(`buyer_id`),
    INDEX `MarketplaceOrder_created_at_idx`(`created_at`),
    INDEX `MarketplaceOrder_payment_status_idx`(`payment_status`),
    INDEX `MarketplaceOrder_fulfillment_status_idx`(`fulfillment_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarketplaceReview` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NULL,
    `rating` INTEGER NOT NULL,
    `content` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `MarketplaceReview_product_id_idx`(`product_id`),
    INDEX `MarketplaceReview_user_id_idx`(`user_id`),
    INDEX `MarketplaceReview_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarketplaceFavorite` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MarketplaceFavorite_user_id_idx`(`user_id`),
    INDEX `MarketplaceFavorite_product_id_idx`(`product_id`),
    UNIQUE INDEX `MarketplaceFavorite_product_id_user_id_key`(`product_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarketplaceFulfillmentLog` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NULL,

    INDEX `MarketplaceFulfillmentLog_order_id_idx`(`order_id`),
    INDEX `MarketplaceFulfillmentLog_status_idx`(`status`),
    INDEX `MarketplaceFulfillmentLog_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarketplaceShopConfigVersion` (
    `id` VARCHAR(191) NOT NULL,
    `owner_id` INTEGER NULL,
    `product_id` VARCHAR(191) NULL,
    `banner_url` VARCHAR(191) NOT NULL,
    `avatar_url` VARCHAR(191) NOT NULL,
    `announcement_title` VARCHAR(191) NOT NULL,
    `announcement_text` VARCHAR(191) NOT NULL,
    `bio` VARCHAR(191) NOT NULL,
    `shop_name` VARCHAR(191) NOT NULL,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'default',
    `visit_count` INTEGER NOT NULL DEFAULT 0,
    `click_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MarketplaceShopConfigVersion_owner_id_idx`(`owner_id`),
    INDEX `MarketplaceShopConfigVersion_product_id_idx`(`product_id`),
    INDEX `MarketplaceShopConfigVersion_created_at_idx`(`created_at`),
    INDEX `MarketplaceShopConfigVersion_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromoPlatformBinding` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `platform_user_id` VARCHAR(191) NOT NULL,
    `platform_username` VARCHAR(191) NULL,
    `binding_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `bind_source` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `verified_at` DATETIME(3) NULL,
    `last_verify_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `PromoPlatformBinding_user_id_idx`(`user_id`),
    INDEX `PromoPlatformBinding_platform_idx`(`platform`),
    INDEX `PromoPlatformBinding_binding_status_idx`(`binding_status`),
    UNIQUE INDEX `PromoPlatformBinding_platform_platform_user_id_key`(`platform`, `platform_user_id`),
    UNIQUE INDEX `PromoPlatformBinding_user_id_platform_key`(`user_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromoTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `platform` VARCHAR(191) NOT NULL,
    `target_type` VARCHAR(191) NOT NULL DEFAULT 'video',
    `target_id` VARCHAR(191) NOT NULL,
    `target_url` VARCHAR(191) NOT NULL,
    `cover_url` VARCHAR(191) NULL,
    `reward_amount` INTEGER NOT NULL,
    `reward_type` VARCHAR(191) NOT NULL DEFAULT 'BALANCE',
    `rule_config` LONGTEXT NOT NULL,
    `claim_limit_per_user` INTEGER NOT NULL DEFAULT 1,
    `total_limit` INTEGER NULL,
    `daily_limit` INTEGER NULL,
    `need_audit` BOOLEAN NOT NULL DEFAULT false,
    `auto_verify` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `start_at` DATETIME(3) NULL,
    `end_at` DATETIME(3) NULL,
    `rule_version` INTEGER NOT NULL DEFAULT 1,
    `created_by` INTEGER NULL,
    `published_by` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `PromoTask_status_idx`(`status`),
    INDEX `PromoTask_platform_idx`(`platform`),
    INDEX `PromoTask_created_at_idx`(`created_at`),
    INDEX `PromoTask_start_at_end_at_idx`(`start_at`, `end_at`),
    UNIQUE INDEX `PromoTask_platform_target_id_key`(`platform`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromoClaimRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `task_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `platform_user_id` VARCHAR(191) NOT NULL,
    `claim_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `reward_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `verify_result` VARCHAR(191) NULL,
    `verify_detail` VARCHAR(191) NULL,
    `proof_data` VARCHAR(191) NULL,
    `claim_request_no` VARCHAR(191) NOT NULL,
    `claim_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verified_at` DATETIME(3) NULL,
    `rewarding_at` DATETIME(3) NULL,
    `rewarded_at` DATETIME(3) NULL,
    `failed_reason` VARCHAR(191) NULL,
    `audit_by` INTEGER NULL,
    `audit_note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PromoClaimRecord_claim_request_no_key`(`claim_request_no`),
    INDEX `PromoClaimRecord_task_id_idx`(`task_id`),
    INDEX `PromoClaimRecord_user_id_idx`(`user_id`),
    INDEX `PromoClaimRecord_claim_status_idx`(`claim_status`),
    INDEX `PromoClaimRecord_reward_status_idx`(`reward_status`),
    INDEX `PromoClaimRecord_platform_user_id_idx`(`platform_user_id`),
    UNIQUE INDEX `PromoClaimRecord_user_id_task_id_key`(`user_id`, `task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromoVerifyLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `claim_id` INTEGER NOT NULL,
    `task_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `platform_user_id` VARCHAR(191) NOT NULL,
    `verify_status` VARCHAR(191) NOT NULL,
    `request_data` VARCHAR(191) NULL,
    `response_data` VARCHAR(191) NULL,
    `error_message` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PromoVerifyLog_claim_id_idx`(`claim_id`),
    INDEX `PromoVerifyLog_task_id_idx`(`task_id`),
    INDEX `PromoVerifyLog_user_id_idx`(`user_id`),
    INDEX `PromoVerifyLog_verify_status_idx`(`verify_status`),
    INDEX `PromoVerifyLog_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromoWalletTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `change_amount` INTEGER NOT NULL,
    `direction` VARCHAR(191) NOT NULL,
    `change_type` VARCHAR(191) NOT NULL,
    `ref_type` VARCHAR(191) NOT NULL,
    `ref_id` INTEGER NOT NULL,
    `before_balance` INTEGER NOT NULL,
    `after_balance` INTEGER NOT NULL,
    `remark` VARCHAR(191) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PromoWalletTransaction_user_id_idx`(`user_id`),
    INDEX `PromoWalletTransaction_change_type_idx`(`change_type`),
    INDEX `PromoWalletTransaction_ref_type_ref_id_idx`(`ref_type`, `ref_id`),
    INDEX `PromoWalletTransaction_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Server_review_status_activity_idx` ON `Server`(`review_status`, `activity` DESC);

-- CreateIndex
CREATE INDEX `ServerStatus_playersOnline_idx` ON `ServerStatus`(`playersOnline` DESC);

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Wallet` ADD CONSTRAINT `Wallet_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `Wallet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBioVersion` ADD CONSTRAINT `UserBioVersion_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Server` ADD CONSTRAINT `Server_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Server` ADD CONSTRAINT `Server_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerStatusHistory` ADD CONSTRAINT `ServerStatusHistory_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `Server`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerComment` ADD CONSTRAINT `ServerComment_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `Server`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerComment` ADD CONSTRAINT `ServerComment_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerLike` ADD CONSTRAINT `ServerLike_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `Server`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerLike` ADD CONSTRAINT `ServerLike_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerVersion` ADD CONSTRAINT `ServerVersion_editor_id_fkey` FOREIGN KEY (`editor_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewHistory` ADD CONSTRAINT `ReviewHistory_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermissionHistory` ADD CONSTRAINT `PermissionHistory_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermissionHistory` ADD CONSTRAINT `PermissionHistory_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiKey` ADD CONSTRAINT `ApiKey_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModerationLog` ADD CONSTRAINT `ModerationLog_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `Ticket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_handler_id_fkey` FOREIGN KEY (`handler_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceProduct` ADD CONSTRAINT `MarketplaceProduct_creator_id_fkey` FOREIGN KEY (`creator_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceOrder` ADD CONSTRAINT `MarketplaceOrder_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `MarketplaceProduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceOrder` ADD CONSTRAINT `MarketplaceOrder_buyer_id_fkey` FOREIGN KEY (`buyer_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceOrder` ADD CONSTRAINT `MarketplaceOrder_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceReview` ADD CONSTRAINT `MarketplaceReview_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `MarketplaceProduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceReview` ADD CONSTRAINT `MarketplaceReview_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceFavorite` ADD CONSTRAINT `MarketplaceFavorite_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `MarketplaceProduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceFavorite` ADD CONSTRAINT `MarketplaceFavorite_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceFulfillmentLog` ADD CONSTRAINT `MarketplaceFulfillmentLog_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `MarketplaceOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceFulfillmentLog` ADD CONSTRAINT `MarketplaceFulfillmentLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketplaceShopConfigVersion` ADD CONSTRAINT `MarketplaceShopConfigVersion_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `MarketplaceProduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoPlatformBinding` ADD CONSTRAINT `PromoPlatformBinding_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoClaimRecord` ADD CONSTRAINT `PromoClaimRecord_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `PromoTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoClaimRecord` ADD CONSTRAINT `PromoClaimRecord_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoVerifyLog` ADD CONSTRAINT `PromoVerifyLog_claim_id_fkey` FOREIGN KEY (`claim_id`) REFERENCES `PromoClaimRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoWalletTransaction` ADD CONSTRAINT `PromoWalletTransaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

