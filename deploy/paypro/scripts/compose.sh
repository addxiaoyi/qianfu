#!/usr/bin/env sh

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  PAYPRO_COMPOSE_MODE=plugin
elif command -v docker-compose >/dev/null 2>&1; then
  PAYPRO_COMPOSE_MODE=standalone
else
  echo 'Docker Compose is not available.' >&2
  return 127 2>/dev/null || exit 127
fi

compose() {
  if [ "$PAYPRO_COMPOSE_MODE" = 'plugin' ]; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}
