ALTER TABLE "MarketplaceProduct" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CNY';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "tax_included" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketplaceProduct" ADD COLUMN "additional_fees" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MarketplaceProduct" ADD COLUMN "validity_text" TEXT NOT NULL DEFAULT '长期有效，具体以商品说明为准';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "delivery_method" TEXT NOT NULL DEFAULT '数字下载';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "delivery_eta" TEXT NOT NULL DEFAULT '支付确认后自动交付';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "compatibility" TEXT NOT NULL DEFAULT '请查看商品描述中的兼容性说明';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "is_platform_operated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MarketplaceProduct" ADD COLUMN "seller_identity" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "after_sales_contact" TEXT NOT NULL DEFAULT '平台工单';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "refund_terms" TEXT NOT NULL DEFAULT '适用平台退款政策';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "ip_source" TEXT NOT NULL DEFAULT '卖家声明拥有合法权利或授权';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "prohibited_use" TEXT NOT NULL DEFAULT '禁止侵权、转售或违法用途';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "risk_notice" TEXT NOT NULL DEFAULT '请在兼容环境中使用并自行备份';
ALTER TABLE "MarketplaceProduct" ADD COLUMN "product_version" TEXT NOT NULL DEFAULT '1.0.0';

CREATE TABLE IF NOT EXISTS "MarketplaceProductVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "product_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "file_sha256" TEXT,
  "asset_size" INTEGER,
  "asset_mime" TEXT,
  "download_url" TEXT,
  "listing_snapshot" TEXT NOT NULL,
  "created_by" INTEGER,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceProductVersion_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "MarketplaceProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MarketplaceProductVersion_product_id_created_at_idx" ON "MarketplaceProductVersion"("product_id", "created_at");
CREATE INDEX IF NOT EXISTS "MarketplaceProductVersion_file_sha256_idx" ON "MarketplaceProductVersion"("file_sha256");

CREATE TABLE IF NOT EXISTS "MarketplaceOrderEvidence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "order_id" TEXT NOT NULL,
  "product_version_id" TEXT,
  "listing_snapshot" TEXT NOT NULL,
  "policy_snapshot" TEXT NOT NULL,
  "accepted_at" DATETIME NOT NULL,
  "buyer_ip_hmac" TEXT,
  "user_agent_hmac" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOrderEvidence_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "MarketplaceOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceOrderEvidence_product_version_id_fkey" FOREIGN KEY ("product_version_id") REFERENCES "MarketplaceProductVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceOrderEvidence_order_id_key" ON "MarketplaceOrderEvidence"("order_id");
CREATE INDEX IF NOT EXISTS "MarketplaceOrderEvidence_product_version_id_idx" ON "MarketplaceOrderEvidence"("product_version_id");
CREATE INDEX IF NOT EXISTS "MarketplaceOrderEvidence_accepted_at_idx" ON "MarketplaceOrderEvidence"("accepted_at");

CREATE TABLE IF NOT EXISTS "MarketplaceDeliveryEvidence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "order_id" TEXT NOT NULL,
  "product_version_id" TEXT,
  "event_type" TEXT NOT NULL,
  "delivery_ref" TEXT,
  "ip_hmac" TEXT,
  "user_agent_hmac" TEXT,
  "metadata_json" TEXT,
  "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceDeliveryEvidence_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "MarketplaceOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceDeliveryEvidence_product_version_id_fkey" FOREIGN KEY ("product_version_id") REFERENCES "MarketplaceProductVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MarketplaceDeliveryEvidence_order_id_occurred_at_idx" ON "MarketplaceDeliveryEvidence"("order_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "MarketplaceDeliveryEvidence_product_version_id_idx" ON "MarketplaceDeliveryEvidence"("product_version_id");
CREATE INDEX IF NOT EXISTS "MarketplaceDeliveryEvidence_event_type_idx" ON "MarketplaceDeliveryEvidence"("event_type");

CREATE TABLE IF NOT EXISTS "MarketplaceAppeal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "appellant_id" INTEGER NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decision_note" TEXT,
  "reviewer_id" INTEGER,
  "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" DATETIME,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "MarketplaceAppeal_appellant_id_fkey" FOREIGN KEY ("appellant_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceAppeal_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MarketplaceAppeal_appellant_id_idx" ON "MarketplaceAppeal"("appellant_id");
CREATE INDEX IF NOT EXISTS "MarketplaceAppeal_status_idx" ON "MarketplaceAppeal"("status");
CREATE INDEX IF NOT EXISTS "MarketplaceAppeal_target_type_target_id_idx" ON "MarketplaceAppeal"("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "MarketplaceAppeal_submitted_at_idx" ON "MarketplaceAppeal"("submitted_at");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceAppeal_pending_target_key" ON "MarketplaceAppeal"("appellant_id", "target_type", "target_id") WHERE "status" = 'PENDING';
