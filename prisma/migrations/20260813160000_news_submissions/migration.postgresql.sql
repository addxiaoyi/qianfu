CREATE TABLE "news_submissions" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "rejection_reason" TEXT,
  "reviewed_by" INTEGER,
  "announcement_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "news_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "news_submissions_announcement_id_key" ON "news_submissions"("announcement_id");
CREATE INDEX "news_submissions_user_id_status_updated_at_idx" ON "news_submissions"("user_id", "status", "updated_at");
CREATE INDEX "news_submissions_status_created_at_idx" ON "news_submissions"("status", "created_at");
ALTER TABLE "news_submissions" ADD CONSTRAINT "news_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_submissions" ADD CONSTRAINT "news_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
