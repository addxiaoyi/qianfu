DELETE h FROM checkin_history h
LEFT JOIN `User` u ON u.id = h.user_id
WHERE u.id IS NULL;

SET @qianfu_checkin_fk_count := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'checkin_history'
    AND COLUMN_NAME = 'user_id'
    AND REFERENCED_TABLE_NAME = 'User'
    AND REFERENCED_COLUMN_NAME = 'id'
);
SET @qianfu_checkin_fk_sql := IF(
  @qianfu_checkin_fk_count = 0,
  'ALTER TABLE checkin_history ADD CONSTRAINT checkin_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE qianfu_checkin_fk_stmt FROM @qianfu_checkin_fk_sql;
EXECUTE qianfu_checkin_fk_stmt;
DEALLOCATE PREPARE qianfu_checkin_fk_stmt;
