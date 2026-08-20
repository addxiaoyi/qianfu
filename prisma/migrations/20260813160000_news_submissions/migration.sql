CREATE TABLE "news_submissions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "rejection_reason" TEXT,
  "reviewed_by" INTEGER,
  "announcement_id" TEXT UNIQUE,
  "reviewed_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "news_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "news_submissions_user_id_status_updated_at_idx" ON "news_submissions" ("user_id", "status", "updated_at");
CREATE INDEX "news_submissions_status_created_at_idx" ON "news_submissions" ("status", "created_at");
