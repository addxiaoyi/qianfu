CREATE TABLE IF NOT EXISTS checkin_history (
  id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  checkin_date VARCHAR(32) NOT NULL,
  timezone VARCHAR(128),
  base_reward DOUBLE NOT NULL,
  bonus_reward DOUBLE NOT NULL DEFAULT 0,
  total_reward DOUBLE NOT NULL,
  streak_days INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT checkin_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES `User`(`id`) ON DELETE CASCADE,
  UNIQUE KEY checkin_history_user_id_checkin_date_key (user_id, checkin_date),
  KEY checkin_history_user_id_created_at_idx (user_id, created_at DESC),
  KEY checkin_history_user_id_checkin_date_idx (user_id, checkin_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS server_facets (
  id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
  server_id INTEGER NOT NULL,
  kind VARCHAR(32) NOT NULL,
  value VARCHAR(191) NOT NULL,
  normalized_value VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT server_facets_server_id_fkey FOREIGN KEY (server_id) REFERENCES `Server`(`id`) ON DELETE CASCADE,
  UNIQUE KEY server_facets_server_id_kind_normalized_value_key (server_id, kind, normalized_value),
  KEY server_facets_kind_normalized_value_idx (kind, normalized_value),
  KEY server_facets_server_id_kind_idx (server_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO server_facets (server_id, kind, value, normalized_value)
SELECT s.id, 'TAG', TRIM(j.value), LOWER(TRIM(j.value))
FROM `Server` s
JOIN JSON_TABLE(IF(JSON_VALID(s.tags), s.tags, JSON_ARRAY()), '$[*]' COLUMNS(value VARCHAR(191) PATH '$')) j
WHERE TRIM(j.value) <> '';

INSERT IGNORE INTO server_facets (server_id, kind, value, normalized_value)
SELECT s.id, 'VERSION', TRIM(j.value), LOWER(TRIM(j.value))
FROM `Server` s
JOIN JSON_TABLE(IF(JSON_VALID(s.supported_versions), s.supported_versions, JSON_ARRAY()), '$[*]' COLUMNS(value VARCHAR(191) PATH '$')) j
WHERE TRIM(j.value) <> '';

INSERT IGNORE INTO server_facets (server_id, kind, value, normalized_value)
SELECT s.id, 'NETWORK_ENV', TRIM(j.value), LOWER(TRIM(j.value))
FROM `Server` s
JOIN JSON_TABLE(IF(JSON_VALID(s.network_env), s.network_env, JSON_ARRAY()), '$[*]' COLUMNS(value VARCHAR(191) PATH '$')) j
WHERE TRIM(j.value) <> '';
