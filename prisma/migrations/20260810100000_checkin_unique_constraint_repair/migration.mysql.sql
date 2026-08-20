DELETE h1 FROM checkin_history h1
JOIN checkin_history h2
  ON h1.user_id = h2.user_id
  AND h1.checkin_date = h2.checkin_date
  AND (
    h1.created_at > h2.created_at
    OR (h1.created_at = h2.created_at AND h1.id > h2.id)
  );

SET @qianfu_checkin_unique_count := (
  SELECT COUNT(*)
  FROM information_schema.statistics s1
  WHERE s1.TABLE_SCHEMA = DATABASE()
    AND s1.TABLE_NAME = 'checkin_history'
    AND s1.NON_UNIQUE = 0
    AND s1.INDEX_TYPE = 'BTREE'
    AND s1.SEQ_IN_INDEX = 1
    AND s1.COLUMN_NAME = 'user_id'
    AND s1.INDEX_NAME <> 'PRIMARY'
    AND EXISTS (
      SELECT 1
      FROM information_schema.statistics s2
      WHERE s2.TABLE_SCHEMA = DATABASE()
        AND s2.TABLE_NAME = 'checkin_history'
        AND s2.INDEX_NAME = s1.INDEX_NAME
        AND s2.SEQ_IN_INDEX = 2
        AND s2.COLUMN_NAME = 'checkin_date'
    )
);
SET @qianfu_checkin_unique_sql := IF(
  @qianfu_checkin_unique_count = 0,
  'ALTER TABLE checkin_history ADD UNIQUE KEY checkin_history_user_id_checkin_date_key (user_id, checkin_date)',
  'SELECT 1'
);
PREPARE qianfu_checkin_unique_stmt FROM @qianfu_checkin_unique_sql;
EXECUTE qianfu_checkin_unique_stmt;
DEALLOCATE PREPARE qianfu_checkin_unique_stmt;
