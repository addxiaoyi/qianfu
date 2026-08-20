-- E10: query performance hardening for high-frequency list endpoints
-- Keep migration narrow: add missing indexes only (no table rebuild).

CREATE INDEX IF NOT EXISTS "Payment_plan_id_idx" ON "Payment"("plan_id");
CREATE INDEX IF NOT EXISTS "Payment_created_at_idx" ON "Payment"("created_at");
CREATE INDEX IF NOT EXISTS "Payment_updated_at_idx" ON "Payment"("updated_at");
CREATE INDEX IF NOT EXISTS "Payment_user_id_created_at_idx" ON "Payment"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "Payment_status_created_at_idx" ON "Payment"("status", "created_at");

CREATE INDEX IF NOT EXISTS "Ticket_created_at_idx" ON "Ticket"("created_at");
CREATE INDEX IF NOT EXISTS "Ticket_user_id_status_updated_at_idx" ON "Ticket"("user_id", "status", "updated_at");

CREATE INDEX IF NOT EXISTS "AuditLog_created_at_action_idx" ON "AuditLog"("created_at", "action");
CREATE INDEX IF NOT EXISTS "AuditLog_user_id_created_at_idx" ON "AuditLog"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "PermissionHistory_user_id_created_at_idx" ON "PermissionHistory"("user_id", "created_at");
