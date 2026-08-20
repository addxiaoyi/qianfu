CREATE TABLE IF NOT EXISTS checkin_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  checkin_date TEXT NOT NULL,
  timezone TEXT,
  base_reward DOUBLE PRECISION NOT NULL,
  bonus_reward DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_reward DOUBLE PRECISION NOT NULL,
  streak_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT checkin_history_user_id_checkin_date_key UNIQUE (user_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS checkin_history_user_id_created_at_idx ON checkin_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkin_history_user_id_checkin_date_idx ON checkin_history(user_id, checkin_date DESC);

CREATE TABLE IF NOT EXISTS server_facets (
  id SERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES "Server"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT server_facets_server_id_kind_normalized_value_key UNIQUE (server_id, kind, normalized_value)
);
CREATE INDEX IF NOT EXISTS server_facets_kind_normalized_value_idx ON server_facets(kind, normalized_value);
CREATE INDEX IF NOT EXISTS server_facets_server_id_kind_idx ON server_facets(server_id, kind);

CREATE OR REPLACE FUNCTION qianfu_json_text_array(raw_value TEXT)
RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN
  IF raw_value IS NULL OR btrim(raw_value) = '' THEN RETURN; END IF;
  RETURN QUERY SELECT jsonb_array_elements_text(raw_value::jsonb);
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

INSERT INTO server_facets (server_id, kind, value, normalized_value)
SELECT s.id, 'TAG', btrim(v), lower(btrim(v)) FROM "Server" s CROSS JOIN LATERAL qianfu_json_text_array(s.tags) v
WHERE btrim(v) <> '' ON CONFLICT DO NOTHING;
INSERT INTO server_facets (server_id, kind, value, normalized_value)
SELECT s.id, 'VERSION', btrim(v), lower(btrim(v)) FROM "Server" s CROSS JOIN LATERAL qianfu_json_text_array(s.supported_versions) v
WHERE btrim(v) <> '' ON CONFLICT DO NOTHING;
INSERT INTO server_facets (server_id, kind, value, normalized_value)
SELECT s.id, 'NETWORK_ENV', btrim(v), lower(btrim(v)) FROM "Server" s CROSS JOIN LATERAL qianfu_json_text_array(s.network_env) v
WHERE btrim(v) <> '' ON CONFLICT DO NOTHING;

DROP FUNCTION qianfu_json_text_array(TEXT);
