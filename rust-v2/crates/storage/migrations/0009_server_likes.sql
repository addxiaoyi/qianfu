CREATE TABLE IF NOT EXISTS server_likes (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, server_id)
);

CREATE INDEX IF NOT EXISTS server_likes_server_idx ON server_likes (server_id);
