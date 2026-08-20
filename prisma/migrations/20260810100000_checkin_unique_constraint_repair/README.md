# Check-in uniqueness repair

This migration makes the `(user_id, checkin_date)` key explicit for legacy
databases where the check-in table existed before the Prisma model. If a
legacy database already contains duplicate rows for one user and day, the
oldest row is retained before the unique key is created.
