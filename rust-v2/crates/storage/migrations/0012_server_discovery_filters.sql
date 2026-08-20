ALTER TABLE servers ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS version TEXT;
CREATE INDEX IF NOT EXISTS servers_discovery_filters_idx ON servers (review_status, category, version, created_at DESC);
