CREATE TABLE "CreemPaymentRecord" (
  "payment_id" TEXT NOT NULL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "project_key" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "product_kind" TEXT NOT NULL DEFAULT 'one_time',
  "expected_amount" INTEGER NOT NULL,
  "expected_currency" TEXT NOT NULL,
  "checkout_id" TEXT,
  "order_id" TEXT,
  "transaction_id" TEXT,
  "customer_id" TEXT,
  "customer_email" TEXT,
  "subscription_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "access_status" TEXT NOT NULL DEFAULT 'PENDING',
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);
CREATE TABLE "CreemWebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "event_type" TEXT NOT NULL,
  "object_id" TEXT,
  "payment_id" TEXT,
  "mode" TEXT,
  "payload_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "error" TEXT,
  "event_at" DATETIME,
  "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" DATETIME
);
CREATE TABLE "CreemSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "payment_id" TEXT,
  "user_id" INTEGER NOT NULL,
  "project_key" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "customer_id" TEXT,
  "customer_email" TEXT,
  "status" TEXT NOT NULL,
  "access_active" BOOLEAN NOT NULL DEFAULT false,
  "previous_role" TEXT,
  "previous_permissions" TEXT,
  "granted_role" TEXT,
  "current_period_start_at" DATETIME,
  "current_period_end_at" DATETIME,
  "next_transaction_at" DATETIME,
  "canceled_at" DATETIME,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "last_transaction_id" TEXT,
  "last_event_id" TEXT,
  "last_event_at" DATETIME,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CreemPaymentRecord_checkout_id_key" ON "CreemPaymentRecord"("checkout_id");
CREATE UNIQUE INDEX "CreemPaymentRecord_order_id_key" ON "CreemPaymentRecord"("order_id");
CREATE UNIQUE INDEX "CreemPaymentRecord_transaction_id_key" ON "CreemPaymentRecord"("transaction_id");
CREATE UNIQUE INDEX "CreemPaymentRecord_subscription_id_key" ON "CreemPaymentRecord"("subscription_id");
CREATE INDEX "CreemPaymentRecord_user_id_idx" ON "CreemPaymentRecord"("user_id");
CREATE INDEX "CreemPaymentRecord_project_key_idx" ON "CreemPaymentRecord"("project_key");
CREATE INDEX "CreemPaymentRecord_status_idx" ON "CreemPaymentRecord"("status");
CREATE INDEX "CreemPaymentRecord_product_id_idx" ON "CreemPaymentRecord"("product_id");
CREATE INDEX "CreemPaymentRecord_created_at_idx" ON "CreemPaymentRecord"("created_at");
CREATE INDEX "CreemWebhookEvent_event_type_idx" ON "CreemWebhookEvent"("event_type");
CREATE INDEX "CreemWebhookEvent_payment_id_idx" ON "CreemWebhookEvent"("payment_id");
CREATE INDEX "CreemWebhookEvent_status_idx" ON "CreemWebhookEvent"("status");
CREATE INDEX "CreemWebhookEvent_payload_hash_idx" ON "CreemWebhookEvent"("payload_hash");
CREATE INDEX "CreemWebhookEvent_received_at_idx" ON "CreemWebhookEvent"("received_at");
CREATE INDEX "CreemSubscription_payment_id_idx" ON "CreemSubscription"("payment_id");
CREATE INDEX "CreemSubscription_user_id_idx" ON "CreemSubscription"("user_id");
CREATE INDEX "CreemSubscription_project_key_idx" ON "CreemSubscription"("project_key");
CREATE INDEX "CreemSubscription_product_id_idx" ON "CreemSubscription"("product_id");
CREATE INDEX "CreemSubscription_status_idx" ON "CreemSubscription"("status");
CREATE INDEX "CreemSubscription_access_active_idx" ON "CreemSubscription"("access_active");
CREATE INDEX "CreemSubscription_current_period_end_at_idx" ON "CreemSubscription"("current_period_end_at");
