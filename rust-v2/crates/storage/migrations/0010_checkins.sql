CREATE TABLE IF NOT EXISTS user_checkins (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS user_checkins_recent_idx ON user_checkins (user_id, checkin_date DESC);
