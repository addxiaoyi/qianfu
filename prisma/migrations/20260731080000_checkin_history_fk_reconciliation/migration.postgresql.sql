DELETE FROM checkin_history h
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = h.user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'checkin_history'::regclass
      AND conname = 'checkin_history_user_id_fkey'
  ) THEN
    ALTER TABLE checkin_history
      ADD CONSTRAINT checkin_history_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES "User"(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
