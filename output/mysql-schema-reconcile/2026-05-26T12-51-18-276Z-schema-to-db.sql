-- DropForeignKey
ALTER TABLE `Session` DROP FOREIGN KEY `Session_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Notification` DROP FOREIGN KEY `Notification_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Wallet` DROP FOREIGN KEY `Wallet_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Transaction` DROP FOREIGN KEY `Transaction_wallet_id_fkey`;

-- DropForeignKey
ALTER TABLE `UserBioVersion` DROP FOREIGN KEY `UserBioVersion_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Server` DROP FOREIGN KEY `Server_owner_id_fkey`;

-- DropForeignKey
ALTER TABLE `Server` DROP FOREIGN KEY `Server_reviewed_by_fkey`;

-- DropForeignKey
ALTER TABLE `ServerStatusHistory` DROP FOREIGN KEY `ServerStatusHistory_server_id_fkey`;

-- DropForeignKey
ALTER TABLE `ServerComment` DROP FOREIGN KEY `ServerComment_server_id_fkey`;

-- DropForeignKey
ALTER TABLE `ServerComment` DROP FOREIGN KEY `ServerComment_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ServerLike` DROP FOREIGN KEY `ServerLike_server_id_fkey`;

-- DropForeignKey
ALTER TABLE `ServerLike` DROP FOREIGN KEY `ServerLike_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ServerVersion` DROP FOREIGN KEY `ServerVersion_editor_id_fkey`;

-- DropForeignKey
ALTER TABLE `ReviewHistory` DROP FOREIGN KEY `ReviewHistory_reviewer_id_fkey`;

-- DropForeignKey
ALTER TABLE `PermissionHistory` DROP FOREIGN KEY `PermissionHistory_admin_id_fkey`;

-- DropForeignKey
ALTER TABLE `PermissionHistory` DROP FOREIGN KEY `PermissionHistory_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ApiKey` DROP FOREIGN KEY `ApiKey_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ModerationLog` DROP FOREIGN KEY `ModerationLog_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Ticket` DROP FOREIGN KEY `Ticket_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Ticket` DROP FOREIGN KEY `Ticket_payment_id_fkey`;

-- DropForeignKey
ALTER TABLE `TicketMessage` DROP FOREIGN KEY `TicketMessage_ticket_id_fkey`;

-- DropForeignKey
ALTER TABLE `TicketMessage` DROP FOREIGN KEY `TicketMessage_sender_id_fkey`;

-- DropForeignKey
ALTER TABLE `Payment` DROP FOREIGN KEY `Payment_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Report` DROP FOREIGN KEY `Report_reporter_id_fkey`;

-- DropForeignKey
ALTER TABLE `Report` DROP FOREIGN KEY `Report_handler_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceProduct` DROP FOREIGN KEY `MarketplaceProduct_creator_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceOrder` DROP FOREIGN KEY `MarketplaceOrder_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceOrder` DROP FOREIGN KEY `MarketplaceOrder_buyer_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceOrder` DROP FOREIGN KEY `MarketplaceOrder_payment_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceReview` DROP FOREIGN KEY `MarketplaceReview_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceReview` DROP FOREIGN KEY `MarketplaceReview_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceFavorite` DROP FOREIGN KEY `MarketplaceFavorite_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceFavorite` DROP FOREIGN KEY `MarketplaceFavorite_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceFulfillmentLog` DROP FOREIGN KEY `MarketplaceFulfillmentLog_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceFulfillmentLog` DROP FOREIGN KEY `MarketplaceFulfillmentLog_userId_fkey`;

-- DropForeignKey
ALTER TABLE `MarketplaceShopConfigVersion` DROP FOREIGN KEY `MarketplaceShopConfigVersion_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `PromoPlatformBinding` DROP FOREIGN KEY `PromoPlatformBinding_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `PromoClaimRecord` DROP FOREIGN KEY `PromoClaimRecord_task_id_fkey`;

-- DropForeignKey
ALTER TABLE `PromoClaimRecord` DROP FOREIGN KEY `PromoClaimRecord_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `PromoVerifyLog` DROP FOREIGN KEY `PromoVerifyLog_claim_id_fkey`;

-- DropForeignKey
ALTER TABLE `PromoWalletTransaction` DROP FOREIGN KEY `PromoWalletTransaction_user_id_fkey`;

-- DropIndex
DROP INDEX `Server_review_status_activity_idx` ON `Server`;

-- DropIndex
DROP INDEX `ServerStatus_playersOnline_idx` ON `ServerStatus`;

-- AlterTable
ALTER TABLE `Server` MODIFY `summary` longtext NULL,
    MODIFY `content_html` longtext NULL;

-- AlterTable
ALTER TABLE `ServerVersion` MODIFY `summary` longtext NULL,
    MODIFY `content_html` longtext NULL,
    MODIFY `tags` longtext NULL;

-- AlterTable
ALTER TABLE `IntroPage` MODIFY `content_html` longtext NOT NULL,
    MODIFY `seo_description` longtext NULL;

-- AlterTable
ALTER TABLE `IntroPageVersion` MODIFY `content_html` longtext NOT NULL;

-- DropTable
DROP TABLE `User`;

-- DropTable
DROP TABLE `Session`;

-- DropTable
DROP TABLE `Notification`;

-- DropTable
DROP TABLE `Wallet`;

-- DropTable
DROP TABLE `Transaction`;

-- DropTable
DROP TABLE `UserBioVersion`;

-- DropTable
DROP TABLE `ServerStatusHistory`;

-- DropTable
DROP TABLE `ServerComment`;

-- DropTable
DROP TABLE `ServerLike`;

-- DropTable
DROP TABLE `SystemConfig`;

-- DropTable
DROP TABLE `ReviewHistory`;

-- DropTable
DROP TABLE `PermissionHistory`;

-- DropTable
DROP TABLE `AuditLog`;

-- DropTable
DROP TABLE `ApiKey`;

-- DropTable
DROP TABLE `ModerationLog`;

-- DropTable
DROP TABLE `Ticket`;

-- DropTable
DROP TABLE `TicketMessage`;

-- DropTable
DROP TABLE `Payment`;

-- DropTable
DROP TABLE `Report`;

-- DropTable
DROP TABLE `MarketplaceProduct`;

-- DropTable
DROP TABLE `MarketplaceOrder`;

-- DropTable
DROP TABLE `MarketplaceReview`;

-- DropTable
DROP TABLE `MarketplaceFavorite`;

-- DropTable
DROP TABLE `MarketplaceFulfillmentLog`;

-- DropTable
DROP TABLE `MarketplaceShopConfigVersion`;

-- DropTable
DROP TABLE `PromoPlatformBinding`;

-- DropTable
DROP TABLE `PromoTask`;

-- DropTable
DROP TABLE `PromoClaimRecord`;

-- DropTable
DROP TABLE `PromoVerifyLog`;

-- DropTable
DROP TABLE `PromoWalletTransaction`;

-- CreateIndex
CREATE INDEX `Server_review_status_activity_idx` ON `Server`(`review_status` ASC, `activity` ASC);

-- CreateIndex
CREATE INDEX `Server_reviewed_by_fkey` ON `Server`(`reviewed_by` ASC);

-- CreateIndex
CREATE INDEX `ServerStatus_playersOnline_idx` ON `ServerStatus`(`playersOnline` ASC);

-- CreateIndex
CREATE INDEX `ServerVersion_editor_id_fkey` ON `ServerVersion`(`editor_id` ASC);

