-- AlterTable
ALTER TABLE "User" ADD COLUMN "experience_points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "last_checkin_at" DATETIME;
