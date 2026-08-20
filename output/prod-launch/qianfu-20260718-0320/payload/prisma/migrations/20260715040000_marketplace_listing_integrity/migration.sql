-- AlterTable
ALTER TABLE "MarketplaceProduct" ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT true;

-- Keep the most recently updated review before adding the per-user constraint.
DELETE FROM "MarketplaceReview"
WHERE "user_id" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "MarketplaceReview" AS "newer"
    WHERE "newer"."product_id" = "MarketplaceReview"."product_id"
      AND "newer"."user_id" = "MarketplaceReview"."user_id"
      AND (
        "newer"."updated_at" > "MarketplaceReview"."updated_at"
        OR (
          "newer"."updated_at" = "MarketplaceReview"."updated_at"
          AND "newer"."created_at" > "MarketplaceReview"."created_at"
        )
        OR (
          "newer"."updated_at" = "MarketplaceReview"."updated_at"
          AND "newer"."created_at" = "MarketplaceReview"."created_at"
          AND "newer"."id" > "MarketplaceReview"."id"
        )
      )
  );

-- Rebuild denormalized ratings after removing legacy duplicate reviews.
UPDATE "MarketplaceProduct"
SET
  "review_count" = (
    SELECT COUNT(*)
    FROM "MarketplaceReview"
    WHERE "MarketplaceReview"."product_id" = "MarketplaceProduct"."id"
  ),
  "rating" = COALESCE((
    SELECT ROUND(AVG("rating"), 2)
    FROM "MarketplaceReview"
    WHERE "MarketplaceReview"."product_id" = "MarketplaceProduct"."id"
  ), 0);

-- CreateIndex
CREATE INDEX "MarketplaceProduct_is_published_idx" ON "MarketplaceProduct"("is_published");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceReview_product_id_user_id_key" ON "MarketplaceReview"("product_id", "user_id");
