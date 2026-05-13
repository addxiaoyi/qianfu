/*
  Warnings:

  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `server_status` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `servers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ticket_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tickets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wallets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "audit_logs";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "server_status";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "servers";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "sessions";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ticket_messages";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "tickets";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "transactions";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "users";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "wallets";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "supabase_id" TEXT,
    "username" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'NORMAL',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "password_changed_at" DATETIME,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "token_expiry" DATETIME,
    "last_login_at" DATETIME,
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "email_cipher" TEXT,
    "preferences" TEXT DEFAULT '{}',
    "bio_html" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "reset_token" TEXT,
    "reset_token_expiry" DATETIME
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wallet_id" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "metadata" TEXT,
    "signature" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Transaction_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBioVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content_html" TEXT,
    "editor_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBioVersion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Server" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "owner_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "thumbnail" TEXT,
    "summary" TEXT,
    "summary_en" TEXT,
    "content_html" TEXT,
    "ip" TEXT DEFAULT 'Hidden',
    "group_number" TEXT,
    "tags" TEXT DEFAULT '[]',
    "link" TEXT,
    "activity" INTEGER NOT NULL DEFAULT 0,
    "synced_at" DATETIME,
    "review_status" TEXT NOT NULL DEFAULT 'PENDING',
    "review_notes" TEXT,
    "reviewed_by" INTEGER,
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Server_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Server_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerStatus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serverId" INTEGER NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "versionNameRaw" TEXT,
    "versionProtocol" INTEGER,
    "playersOnline" INTEGER,
    "playersMax" INTEGER,
    "playersList" TEXT,
    "motdRaw" TEXT,
    "motdClean" TEXT,
    "motdHtml" TEXT,
    "favicon" TEXT,
    "srvRecord" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerStatus_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "qq" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "role" TEXT NOT NULL,
    "role_en" TEXT,
    "description" TEXT,
    "description_en" TEXT,
    "avatar_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AllianceGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "link" TEXT,
    "description" TEXT,
    "description_en" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ResourceLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "title_en" TEXT,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "description_en" TEXT,
    "category" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServerVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT,
    "summary" TEXT,
    "content_html" TEXT,
    "tags" TEXT,
    "ip" TEXT,
    "editor_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerVersion_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerVersion_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reviewer_id" INTEGER NOT NULL,
    "server_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewHistory_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PermissionHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "admin_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PermissionHistory_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PermissionHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "hash" TEXT,
    "previous_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "content" TEXT,
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'SUPPORT',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "payment_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ticket_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticket_id" INTEGER NOT NULL,
    "sender_id" INTEGER,
    "content" TEXT NOT NULL,
    "is_ai" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TicketMessage_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Payment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntroPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_md" TEXT NOT NULL,
    "content_html" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "hash" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "editor_lock_user" INTEGER,
    "lock_expires_at" DATETIME,
    "last_published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntroPageVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "page_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content_md" TEXT NOT NULL,
    "content_html" TEXT NOT NULL,
    "author_id" INTEGER,
    "hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntroPageVersion_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "IntroPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reporter_id" INTEGER NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolution_notes" TEXT,
    "handler_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabase_id_key" ON "User"("supabase_id");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_created_at_idx" ON "User"("created_at");

-- CreateIndex
CREATE INDEX "User_last_login_at_idx" ON "User"("last_login_at");

-- CreateIndex
CREATE INDEX "User_email_verified_idx" ON "User"("email_verified");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_user_id_idx" ON "Session"("user_id");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Notification_user_id_idx" ON "Notification"("user_id");

-- CreateIndex
CREATE INDEX "Notification_is_read_idx" ON "Notification"("is_read");

-- CreateIndex
CREATE INDEX "Notification_created_at_idx" ON "Notification"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_user_id_key" ON "Wallet"("user_id");

-- CreateIndex
CREATE INDEX "Wallet_user_id_idx" ON "Wallet"("user_id");

-- CreateIndex
CREATE INDEX "Transaction_wallet_id_idx" ON "Transaction"("wallet_id");

-- CreateIndex
CREATE INDEX "Transaction_created_at_idx" ON "Transaction"("created_at");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "UserBioVersion_user_id_version_key" ON "UserBioVersion"("user_id", "version");

-- CreateIndex
CREATE INDEX "Server_owner_id_idx" ON "Server"("owner_id");

-- CreateIndex
CREATE INDEX "Server_review_status_idx" ON "Server"("review_status");

-- CreateIndex
CREATE INDEX "Server_activity_idx" ON "Server"("activity");

-- CreateIndex
CREATE INDEX "Server_created_at_idx" ON "Server"("created_at");

-- CreateIndex
CREATE INDEX "Server_updated_at_idx" ON "Server"("updated_at");

-- CreateIndex
CREATE INDEX "Server_name_idx" ON "Server"("name");

-- CreateIndex
CREATE INDEX "Server_name_en_idx" ON "Server"("name_en");

-- CreateIndex
CREATE INDEX "Server_ip_idx" ON "Server"("ip");

-- CreateIndex
CREATE INDEX "Server_review_status_activity_idx" ON "Server"("review_status", "activity" DESC);

-- CreateIndex
CREATE INDEX "Server_tags_idx" ON "Server"("tags");

-- CreateIndex
CREATE UNIQUE INDEX "ServerStatus_serverId_key" ON "ServerStatus"("serverId");

-- CreateIndex
CREATE INDEX "ServerStatus_online_idx" ON "ServerStatus"("online");

-- CreateIndex
CREATE INDEX "ServerStatus_playersOnline_idx" ON "ServerStatus"("playersOnline" DESC);

-- CreateIndex
CREATE INDEX "ServerStatus_lastUpdated_idx" ON "ServerStatus"("lastUpdated");

-- CreateIndex
CREATE INDEX "ServerStatus_serverId_idx" ON "ServerStatus"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_qq_key" ON "TeamMember"("qq");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceLink_title_key" ON "ResourceLink"("title");

-- CreateIndex
CREATE INDEX "ResourceLink_category_idx" ON "ResourceLink"("category");

-- CreateIndex
CREATE INDEX "ServerVersion_server_id_idx" ON "ServerVersion"("server_id");

-- CreateIndex
CREATE INDEX "ServerVersion_created_at_idx" ON "ServerVersion"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVersion_server_id_version_key" ON "ServerVersion"("server_id", "version");

-- CreateIndex
CREATE INDEX "ReviewHistory_server_id_idx" ON "ReviewHistory"("server_id");

-- CreateIndex
CREATE INDEX "ReviewHistory_reviewer_id_idx" ON "ReviewHistory"("reviewer_id");

-- CreateIndex
CREATE INDEX "ReviewHistory_created_at_idx" ON "ReviewHistory"("created_at");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "ModerationLog_action_idx" ON "ModerationLog"("action");

-- CreateIndex
CREATE INDEX "ModerationLog_created_at_idx" ON "ModerationLog"("created_at");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");

-- CreateIndex
CREATE INDEX "Ticket_user_id_idx" ON "Ticket"("user_id");

-- CreateIndex
CREATE INDEX "Ticket_updated_at_idx" ON "Ticket"("updated_at");

-- CreateIndex
CREATE INDEX "TicketMessage_ticket_id_idx" ON "TicketMessage"("ticket_id");

-- CreateIndex
CREATE INDEX "TicketMessage_created_at_idx" ON "TicketMessage"("created_at");

-- CreateIndex
CREATE INDEX "Payment_user_id_idx" ON "Payment"("user_id");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IntroPage_slug_key" ON "IntroPage"("slug");

-- CreateIndex
CREATE INDEX "IntroPageVersion_page_id_idx" ON "IntroPageVersion"("page_id");

-- CreateIndex
CREATE INDEX "IntroPageVersion_version_idx" ON "IntroPageVersion"("version");

-- CreateIndex
CREATE INDEX "Report_reporter_id_idx" ON "Report"("reporter_id");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_created_at_idx" ON "Report"("created_at");
