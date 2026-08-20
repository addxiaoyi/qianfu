-- Persist a stable GitHub provider identity instead of relying on mutable email addresses.
ALTER TABLE "User" ADD COLUMN "github_user_id" TEXT;
CREATE UNIQUE INDEX "User_github_user_id_key" ON "User"("github_user_id");
