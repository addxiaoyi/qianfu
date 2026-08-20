ALTER TABLE "Server" ADD COLUMN "listing_plan" TEXT;
ALTER TABLE "Server" ADD COLUMN "listing_started_at" DATETIME;
ALTER TABLE "Server" ADD COLUMN "listing_expires_at" DATETIME;
ALTER TABLE "Server" ADD COLUMN "listing_price_paid" INTEGER;

CREATE INDEX "Server_listing_expires_at_idx" ON "Server"("listing_expires_at");
