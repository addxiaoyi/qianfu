-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "endpoint" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "method" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "recheck_status" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "rechecked_at" DATETIME;
ALTER TABLE "AuditLog" ADD COLUMN "rechecked_by" INTEGER;
ALTER TABLE "AuditLog" ADD COLUMN "session_id" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "user_agent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "last_code_send_at" DATETIME;
ALTER TABLE "User" ADD COLUMN "login_lockout_at" DATETIME;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "ServerStatusHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id" INTEGER NOT NULL,
    "sampled_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "online" BOOLEAN NOT NULL,
    "players_online" INTEGER,
    "players_max" INTEGER,
    "latency_ms" INTEGER,
    "version_raw" TEXT,
    CONSTRAINT "ServerStatusHistory_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ServerComment_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerComment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerLike" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerLike_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerLike_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerFavorite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerFavorite_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerFavorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "user_id" INTEGER,
    "permissions" TEXT DEFAULT '[]',
    "expires_at" DATETIME,
    "last_used_at" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ApiKey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "author_name" TEXT NOT NULL,
    "cover_url" TEXT,
    "download_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "creator_id" INTEGER,
    CONSTRAINT "MarketplaceProduct_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "buyer_id" INTEGER,
    "buyer_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "fulfillment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "delivery_url" TEXT,
    "payment_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceOrder_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "MarketplaceProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceOrder_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceOrder_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "user_id" INTEGER,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceReview_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "MarketplaceProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceReview_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceFavorite_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "MarketplaceProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceFavorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceFulfillmentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    CONSTRAINT "MarketplaceFulfillmentLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "MarketplaceOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceFulfillmentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceShopConfigVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_id" INTEGER,
    "product_id" TEXT,
    "banner_url" TEXT NOT NULL,
    "avatar_url" TEXT NOT NULL,
    "announcement_title" TEXT NOT NULL,
    "announcement_text" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "shop_name" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'default',
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceShopConfigVersion_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "MarketplaceProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoPlatformBinding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "platform_username" TEXT,
    "binding_status" TEXT NOT NULL DEFAULT 'PENDING',
    "bind_source" TEXT NOT NULL DEFAULT 'MANUAL',
    "verified_at" DATETIME,
    "last_verify_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "PromoPlatformBinding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "platform" TEXT NOT NULL,
    "target_type" TEXT NOT NULL DEFAULT 'video',
    "target_id" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "cover_url" TEXT,
    "reward_amount" INTEGER NOT NULL,
    "reward_type" TEXT NOT NULL DEFAULT 'BALANCE',
    "rule_config" TEXT NOT NULL,
    "claim_limit_per_user" INTEGER NOT NULL DEFAULT 1,
    "total_limit" INTEGER,
    "daily_limit" INTEGER,
    "need_audit" BOOLEAN NOT NULL DEFAULT false,
    "auto_verify" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "start_at" DATETIME,
    "end_at" DATETIME,
    "rule_version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "published_by" INTEGER,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PromoClaimRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "claim_status" TEXT NOT NULL DEFAULT 'PENDING',
    "reward_status" TEXT NOT NULL DEFAULT 'PENDING',
    "verify_result" TEXT,
    "verify_detail" TEXT,
    "proof_data" TEXT,
    "claim_request_no" TEXT NOT NULL,
    "claim_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" DATETIME,
    "rewarding_at" DATETIME,
    "rewarded_at" DATETIME,
    "failed_reason" TEXT,
    "audit_by" INTEGER,
    "audit_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "PromoClaimRecord_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "PromoTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromoClaimRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoVerifyLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "claim_id" INTEGER NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "verify_status" TEXT NOT NULL,
    "request_data" TEXT,
    "response_data" TEXT,
    "error_message" TEXT,
    "source" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoVerifyLog_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "PromoClaimRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoWalletTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "change_amount" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "ref_type" TEXT NOT NULL,
    "ref_id" INTEGER NOT NULL,
    "before_balance" INTEGER NOT NULL,
    "after_balance" INTEGER NOT NULL,
    "remark" TEXT,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoWalletTransaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Payment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "created_at", "currency", "id", "payment_method", "plan_id", "status", "updated_at", "user_id") SELECT "amount", "created_at", "currency", "id", "payment_method", "plan_id", "status", "updated_at", "user_id" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_user_id_idx" ON "Payment"("user_id");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_plan_id_idx" ON "Payment"("plan_id");
CREATE INDEX "Payment_created_at_idx" ON "Payment"("created_at");
CREATE INDEX "Payment_updated_at_idx" ON "Payment"("updated_at");
CREATE INDEX "Payment_user_id_created_at_idx" ON "Payment"("user_id", "created_at");
CREATE INDEX "Payment_status_created_at_idx" ON "Payment"("status", "created_at");
CREATE TABLE "new_Server" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "owner_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "thumbnail" TEXT,
    "summary" TEXT,
    "summary_en" TEXT,
    "content_html" TEXT,
    "ip" TEXT DEFAULT 'Hidden',
    "group_number" TEXT,
    "tags" TEXT DEFAULT '[]',
    "link" TEXT,
    "activity" INTEGER NOT NULL DEFAULT 0,
    "synced_at" DATETIME,
    "review_status" TEXT NOT NULL DEFAULT 'PENDING',
    "review_notes" TEXT,
    "reviewed_by" INTEGER,
    "reviewed_at" DATETIME,
    "listing_plan" TEXT,
    "listing_started_at" DATETIME,
    "listing_expires_at" DATETIME,
    "listing_price_paid" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "platform" TEXT,
    "category" TEXT,
    "online_mode" BOOLEAN,
    "supported_versions" TEXT,
    "network_env" TEXT,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Server_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Server_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Server" ("activity", "content_html", "created_at", "group_number", "id", "ip", "link", "listing_expires_at", "listing_plan", "listing_price_paid", "listing_started_at", "name", "name_en", "owner_id", "review_notes", "review_status", "reviewed_at", "reviewed_by", "summary", "summary_en", "synced_at", "tags", "thumbnail", "updated_at") SELECT "activity", "content_html", "created_at", "group_number", "id", "ip", "link", "listing_expires_at", "listing_plan", "listing_price_paid", "listing_started_at", "name", "name_en", "owner_id", "review_notes", "review_status", "reviewed_at", "reviewed_by", "summary", "summary_en", "synced_at", "tags", "thumbnail", "updated_at" FROM "Server";
DROP TABLE "Server";
ALTER TABLE "new_Server" RENAME TO "Server";
CREATE INDEX "Server_owner_id_idx" ON "Server"("owner_id");
CREATE INDEX "Server_review_status_idx" ON "Server"("review_status");
CREATE INDEX "Server_activity_idx" ON "Server"("activity");
CREATE INDEX "Server_tags_idx" ON "Server"("tags");
CREATE INDEX "Server_supported_versions_idx" ON "Server"("supported_versions");
CREATE INDEX "Server_network_env_idx" ON "Server"("network_env");
CREATE INDEX "Server_created_at_idx" ON "Server"("created_at");
CREATE INDEX "Server_updated_at_idx" ON "Server"("updated_at");
CREATE INDEX "Server_listing_expires_at_idx" ON "Server"("listing_expires_at");
CREATE INDEX "Server_name_idx" ON "Server"("name");
CREATE INDEX "Server_name_en_idx" ON "Server"("name_en");
CREATE INDEX "Server_ip_idx" ON "Server"("ip");
CREATE INDEX "Server_platform_idx" ON "Server"("platform");
CREATE INDEX "Server_category_idx" ON "Server"("category");
CREATE INDEX "Server_review_status_activity_idx" ON "Server"("review_status", "activity" DESC);
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wallet_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "metadata" TEXT,
    "signature" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Transaction_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "created_at", "description", "id", "metadata", "signature", "status", "type", "updated_at", "wallet_id") SELECT "amount", "created_at", "description", "id", "metadata", "signature", "status", "type", "updated_at", "wallet_id" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_wallet_id_idx" ON "Transaction"("wallet_id");
CREATE INDEX "Transaction_created_at_idx" ON "Transaction"("created_at");
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");
CREATE INDEX "Transaction_metadata_idx" ON "Transaction"("metadata");
CREATE TABLE "new_Wallet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Wallet" ("balance", "created_at", "currency", "id", "is_active", "updated_at", "user_id") SELECT "balance", "created_at", "currency", "id", "is_active", "updated_at", "user_id" FROM "Wallet";
DROP TABLE "Wallet";
ALTER TABLE "new_Wallet" RENAME TO "Wallet";
CREATE UNIQUE INDEX "Wallet_user_id_key" ON "Wallet"("user_id");
CREATE INDEX "Wallet_user_id_idx" ON "Wallet"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ServerStatusHistory_server_id_sampled_at_idx" ON "ServerStatusHistory"("server_id", "sampled_at");

-- CreateIndex
CREATE INDEX "ServerStatusHistory_sampled_at_idx" ON "ServerStatusHistory"("sampled_at");

-- CreateIndex
CREATE INDEX "ServerComment_server_id_created_at_idx" ON "ServerComment"("server_id", "created_at");

-- CreateIndex
CREATE INDEX "ServerLike_server_id_idx" ON "ServerLike"("server_id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerLike_server_id_user_id_key" ON "ServerLike"("server_id", "user_id");

-- CreateIndex
CREATE INDEX "ServerFavorite_server_id_idx" ON "ServerFavorite"("server_id");

-- CreateIndex
CREATE INDEX "ServerFavorite_user_id_idx" ON "ServerFavorite"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerFavorite_server_id_user_id_key" ON "ServerFavorite"("server_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_hash_key" ON "ApiKey"("key_hash");

-- CreateIndex
CREATE INDEX "ApiKey_key_hash_idx" ON "ApiKey"("key_hash");

-- CreateIndex
CREATE INDEX "ApiKey_user_id_idx" ON "ApiKey"("user_id");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_category_idx" ON "MarketplaceProduct"("category");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_price_idx" ON "MarketplaceProduct"("price");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_sales_idx" ON "MarketplaceProduct"("sales");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_created_at_idx" ON "MarketplaceProduct"("created_at");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_product_id_idx" ON "MarketplaceOrder"("product_id");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_buyer_id_idx" ON "MarketplaceOrder"("buyer_id");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_created_at_idx" ON "MarketplaceOrder"("created_at");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_payment_status_idx" ON "MarketplaceOrder"("payment_status");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_fulfillment_status_idx" ON "MarketplaceOrder"("fulfillment_status");

-- CreateIndex
CREATE INDEX "MarketplaceReview_product_id_idx" ON "MarketplaceReview"("product_id");

-- CreateIndex
CREATE INDEX "MarketplaceReview_user_id_idx" ON "MarketplaceReview"("user_id");

-- CreateIndex
CREATE INDEX "MarketplaceReview_created_at_idx" ON "MarketplaceReview"("created_at");

-- CreateIndex
CREATE INDEX "MarketplaceFavorite_user_id_idx" ON "MarketplaceFavorite"("user_id");

-- CreateIndex
CREATE INDEX "MarketplaceFavorite_product_id_idx" ON "MarketplaceFavorite"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceFavorite_product_id_user_id_key" ON "MarketplaceFavorite"("product_id", "user_id");

-- CreateIndex
CREATE INDEX "MarketplaceFulfillmentLog_order_id_idx" ON "MarketplaceFulfillmentLog"("order_id");

-- CreateIndex
CREATE INDEX "MarketplaceFulfillmentLog_status_idx" ON "MarketplaceFulfillmentLog"("status");

-- CreateIndex
CREATE INDEX "MarketplaceFulfillmentLog_created_at_idx" ON "MarketplaceFulfillmentLog"("created_at");

-- CreateIndex
CREATE INDEX "MarketplaceShopConfigVersion_owner_id_idx" ON "MarketplaceShopConfigVersion"("owner_id");

-- CreateIndex
CREATE INDEX "MarketplaceShopConfigVersion_product_id_idx" ON "MarketplaceShopConfigVersion"("product_id");

-- CreateIndex
CREATE INDEX "MarketplaceShopConfigVersion_created_at_idx" ON "MarketplaceShopConfigVersion"("created_at");

-- CreateIndex
CREATE INDEX "MarketplaceShopConfigVersion_is_active_idx" ON "MarketplaceShopConfigVersion"("is_active");

-- CreateIndex
CREATE INDEX "PromoPlatformBinding_user_id_idx" ON "PromoPlatformBinding"("user_id");

-- CreateIndex
CREATE INDEX "PromoPlatformBinding_platform_idx" ON "PromoPlatformBinding"("platform");

-- CreateIndex
CREATE INDEX "PromoPlatformBinding_binding_status_idx" ON "PromoPlatformBinding"("binding_status");

-- CreateIndex
CREATE UNIQUE INDEX "PromoPlatformBinding_platform_platform_user_id_key" ON "PromoPlatformBinding"("platform", "platform_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "PromoPlatformBinding_user_id_platform_key" ON "PromoPlatformBinding"("user_id", "platform");

-- CreateIndex
CREATE INDEX "PromoTask_status_idx" ON "PromoTask"("status");

-- CreateIndex
CREATE INDEX "PromoTask_platform_idx" ON "PromoTask"("platform");

-- CreateIndex
CREATE INDEX "PromoTask_created_at_idx" ON "PromoTask"("created_at");

-- CreateIndex
CREATE INDEX "PromoTask_start_at_end_at_idx" ON "PromoTask"("start_at", "end_at");

-- CreateIndex
CREATE UNIQUE INDEX "PromoTask_platform_target_id_key" ON "PromoTask"("platform", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "PromoClaimRecord_claim_request_no_key" ON "PromoClaimRecord"("claim_request_no");

-- CreateIndex
CREATE INDEX "PromoClaimRecord_task_id_idx" ON "PromoClaimRecord"("task_id");

-- CreateIndex
CREATE INDEX "PromoClaimRecord_user_id_idx" ON "PromoClaimRecord"("user_id");

-- CreateIndex
CREATE INDEX "PromoClaimRecord_claim_status_idx" ON "PromoClaimRecord"("claim_status");

-- CreateIndex
CREATE INDEX "PromoClaimRecord_reward_status_idx" ON "PromoClaimRecord"("reward_status");

-- CreateIndex
CREATE INDEX "PromoClaimRecord_platform_user_id_idx" ON "PromoClaimRecord"("platform_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "PromoClaimRecord_user_id_task_id_key" ON "PromoClaimRecord"("user_id", "task_id");

-- CreateIndex
CREATE INDEX "PromoVerifyLog_claim_id_idx" ON "PromoVerifyLog"("claim_id");

-- CreateIndex
CREATE INDEX "PromoVerifyLog_task_id_idx" ON "PromoVerifyLog"("task_id");

-- CreateIndex
CREATE INDEX "PromoVerifyLog_user_id_idx" ON "PromoVerifyLog"("user_id");

-- CreateIndex
CREATE INDEX "PromoVerifyLog_verify_status_idx" ON "PromoVerifyLog"("verify_status");

-- CreateIndex
CREATE INDEX "PromoVerifyLog_created_at_idx" ON "PromoVerifyLog"("created_at");

-- CreateIndex
CREATE INDEX "PromoWalletTransaction_user_id_idx" ON "PromoWalletTransaction"("user_id");

-- CreateIndex
CREATE INDEX "PromoWalletTransaction_change_type_idx" ON "PromoWalletTransaction"("change_type");

-- CreateIndex
CREATE INDEX "PromoWalletTransaction_created_at_idx" ON "PromoWalletTransaction"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "PromoWalletTransaction_ref_type_ref_id_key" ON "PromoWalletTransaction"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "AuditLog_rechecked_at_idx" ON "AuditLog"("rechecked_at");

-- CreateIndex
CREATE INDEX "AuditLog_recheck_status_idx" ON "AuditLog"("recheck_status");

-- CreateIndex
CREATE INDEX "AuditLog_ip_address_idx" ON "AuditLog"("ip_address");

-- CreateIndex
CREATE INDEX "PermissionHistory_user_id_idx" ON "PermissionHistory"("user_id");

-- CreateIndex
CREATE INDEX "PermissionHistory_admin_id_idx" ON "PermissionHistory"("admin_id");

-- CreateIndex
CREATE INDEX "PermissionHistory_created_at_idx" ON "PermissionHistory"("created_at");

-- CreateIndex
CREATE INDEX "Ticket_payment_id_idx" ON "Ticket"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_permissions_idx" ON "User"("permissions");

-- CreateIndex
CREATE INDEX "User_preferences_idx" ON "User"("preferences");
