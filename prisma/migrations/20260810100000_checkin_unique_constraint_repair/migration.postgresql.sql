DELETE FROM checkin_history
WHERE id NOT IN (
  SELECT MIN(id)
  FROM checkin_history
  GROUP BY user_id, checkin_date
);

CREATE UNIQUE INDEX IF NOT EXISTS checkin_history_user_id_checkin_date_key
  ON checkin_history(user_id, checkin_date);
