#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(CDPATH= cd -- "$DEPLOY_ROOT/../.." && pwd)
PAYPRO_ROOT="$REPO_ROOT/tmp/PayPro"
JAR_SOURCE="$PAYPRO_ROOT/target/paypro-1.0-SNAPSHOT.jar"
SCHEMA_SOURCE="$PAYPRO_ROOT/src/main/resources/db.sql"
SKIP_BUILD=${SKIP_BUILD:-false}

if [ ! -d "$PAYPRO_ROOT" ]; then
  echo "PayPro source not found: $PAYPRO_ROOT" >&2
  exit 1
fi

if [ "$SKIP_BUILD" != "true" ]; then
  (cd "$PAYPRO_ROOT" && mvn test && mvn -DskipTests package)
fi

for source in "$JAR_SOURCE" "$SCHEMA_SOURCE"; do
  if [ ! -f "$source" ]; then
    echo "Required source file is missing: $source" >&2
    exit 1
  fi
done

mkdir -p "$DEPLOY_ROOT/artifacts" "$DEPLOY_ROOT/mysql-init" "$DEPLOY_ROOT/payment-assets/qr" "$DEPLOY_ROOT/backups"
cp "$JAR_SOURCE" "$DEPLOY_ROOT/artifacts/paypro.jar"
cp "$SCHEMA_SOURCE" "$DEPLOY_ROOT/mysql-init/001-schema.sql"
(
  cd "$DEPLOY_ROOT/artifacts"
  sha256sum paypro.jar > paypro.jar.sha256
)
(
  cd "$DEPLOY_ROOT/mysql-init"
  sha256sum 001-schema.sql > 001-schema.sql.sha256
)

echo "PayPro deployment context prepared."
echo "No containers were started and no payment method was enabled."
