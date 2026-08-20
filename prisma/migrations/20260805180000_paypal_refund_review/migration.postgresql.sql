CREATE TABLE IF NOT EXISTS "PaypalPaymentRecord" (
  "payment_id" TEXT NOT NULL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "project_key" TEXT NOT NULL,
  "upstream_order_id" TEXT NOT NULL,
  "capture_id" TEXT,
  "expected_amount" INTEGER NOT NULL,
  "expected_currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "review_status" TEXT NOT NULL DEFAULT 'NONE',
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "PaypalWebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "event_type" TEXT NOT NULL,
  "payment_id" TEXT,
  "order_id" TEXT,
  "capture_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "error" TEXT,
  "payload_hash" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaypalPaymentRecord_upstream_order_id_key"
  ON "PaypalPaymentRecord" ("upstream_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "PaypalPaymentRecord_capture_id_key"
  ON "PaypalPaymentRecord" ("capture_id");
CREATE INDEX IF NOT EXISTS "PaypalPaymentRecord_user_id_idx"
  ON "PaypalPaymentRecord" ("user_id");
CREATE INDEX IF NOT EXISTS "PaypalPaymentRecord_project_key_idx"
  ON "PaypalPaymentRecord" ("project_key");
CREATE INDEX IF NOT EXISTS "PaypalPaymentRecord_status_idx"
  ON "PaypalPaymentRecord" ("status");
CREATE INDEX IF NOT EXISTS "PaypalPaymentRecord_review_status_idx"
  ON "PaypalPaymentRecord" ("review_status");

CREATE INDEX IF NOT EXISTS "PaypalWebhookEvent_payment_id_idx"
  ON "PaypalWebhookEvent" ("payment_id");
CREATE INDEX IF NOT EXISTS "PaypalWebhookEvent_order_id_idx"
  ON "PaypalWebhookEvent" ("order_id");
CREATE INDEX IF NOT EXISTS "PaypalWebhookEvent_capture_id_idx"
  ON "PaypalWebhookEvent" ("capture_id");
CREATE INDEX IF NOT EXISTS "PaypalWebhookEvent_status_idx"
  ON "PaypalWebhookEvent" ("status");
