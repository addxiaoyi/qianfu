ALTER TABLE "Report" ADD COLUMN "target_ref" TEXT;

CREATE INDEX "Report_target_type_target_ref_idx" ON "Report"("target_type", "target_ref");
