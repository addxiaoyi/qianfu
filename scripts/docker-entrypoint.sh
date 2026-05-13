#!/bin/sh
set -eu
cd /app

if [ "${SKIP_PRISMA_MIGRATE:-0}" != "1" ]; then
  npx prisma migrate deploy
fi

exec "$@"
