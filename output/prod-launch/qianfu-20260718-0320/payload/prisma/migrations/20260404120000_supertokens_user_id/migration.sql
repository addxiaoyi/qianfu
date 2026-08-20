-- AlterTable
ALTER TABLE "User" ADD COLUMN "supertokens_user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_supertokens_user_id_key" ON "User"("supertokens_user_id");
