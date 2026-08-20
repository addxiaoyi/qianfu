CREATE TABLE IF NOT EXISTS server_probe_results (
    server_id UUID PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
    reachable BOOLEAN NOT NULL,
    edition TEXT NOT NULL,
    error TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
