CREATE UNIQUE INDEX IF NOT EXISTS "PromoWalletTransaction_ref_type_ref_id_key"
ON "PromoWalletTransaction"("ref_type", "ref_id");
