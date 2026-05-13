#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BUNDLE_DIR="${1:-portable-bundle-linux}"
MYSQL_DATA_DIR="${MYSQL_DATA_DIR:-/var/lib/mysql}"
REDIS_DATA_DIR="${REDIS_DATA_DIR:-/var/lib/redis}"
INCLUDE_NODE_MODULES="${INCLUDE_NODE_MODULES:-1}"

step() { echo "[STEP] $1"; }
ok() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; }

copy_tree() {
  local src="$1"
  local dst="$2"
  mkdir -p "$dst"
  rsync -a --delete "$src"/ "$dst"/
}

copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [[ -e "$src" ]]; then
    mkdir -p "$dst"
    cp -a "$src" "$dst"/
  fi
}

resolve_bin_dir() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    return 1
  fi
  local exe
  exe="$(command -v "$cmd")"
  dirname "$exe"
}

sha256_line() {
  local file="$1"
  local rel="$2"
  if command -v sha256sum >/dev/null 2>&1; then
    echo "$(sha256sum "$file" | awk '{print $1}') *$rel"
  elif command -v shasum >/dev/null 2>&1; then
    echo "$(shasum -a 256 "$file" | awk '{print $1}') *$rel"
  else
    echo "NO_SHA_TOOL *$rel"
  fi
}

step "Preparing bundle directory"
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"/{project,runtimes,scripts/linux,manifest}

step "Detecting runtime paths"
JAVA_BIN_DIR="$(resolve_bin_dir java || true)"
NODE_BIN_DIR="$(resolve_bin_dir node || true)"
MYSQLD_BIN_DIR="$(resolve_bin_dir mysqld || true)"
REDIS_BIN_DIR="$(resolve_bin_dir redis-server || true)"

if [[ -z "${JAVA_BIN_DIR}" || -z "${NODE_BIN_DIR}" || -z "${MYSQLD_BIN_DIR}" ]]; then
  echo "[FAIL] Missing required runtime in PATH (java/node/mysqld)." >&2
  exit 1
fi

JAVA_HOME="$(cd "$JAVA_BIN_DIR/.." && pwd)"
NODE_HOME="$(cd "$NODE_BIN_DIR/.." && pwd)"
MYSQL_HOME="$(cd "$MYSQLD_BIN_DIR/.." && pwd)"

step "Copying runtimes"
copy_tree "$JAVA_HOME" "$BUNDLE_DIR/runtimes/java"
copy_tree "$NODE_HOME" "$BUNDLE_DIR/runtimes/node"
copy_tree "$MYSQL_HOME" "$BUNDLE_DIR/runtimes/mysql"

if [[ -n "$REDIS_BIN_DIR" ]]; then
  REDIS_HOME="$(cd "$REDIS_BIN_DIR/.." && pwd)"
  copy_tree "$REDIS_HOME" "$BUNDLE_DIR/runtimes/redis"
else
  REDIS_HOME=""
  warn "redis-server not found in PATH; Redis runtime will not be included."
fi

if [[ -d "$MYSQL_DATA_DIR" ]]; then
  step "Copying MySQL data directory: $MYSQL_DATA_DIR"
  copy_tree "$MYSQL_DATA_DIR" "$BUNDLE_DIR/runtimes/mysql-data"
else
  warn "MySQL data directory not found: $MYSQL_DATA_DIR"
fi

if [[ -d "$REDIS_DATA_DIR" ]]; then
  step "Copying Redis data directory: $REDIS_DATA_DIR"
  copy_tree "$REDIS_DATA_DIR" "$BUNDLE_DIR/runtimes/redis-data"
else
  warn "Redis data directory not found: $REDIS_DATA_DIR"
fi

step "Ensuring Prisma client (prisma/generated)"
if [[ -f "node_modules/.bin/prisma" ]]; then
  npx prisma generate
elif [[ -d "prisma/generated/client" ]]; then
  ok "prisma/generated already present"
else
  warn "No node_modules/.bin/prisma and no prisma/generated — run npm ci here first, or start-portable will try prisma generate at runtime."
fi

step "Copying project files"
for d in server src prisma public scripts xpay-3.1_YTM7H tests; do
  if [[ -d "$d" ]]; then
    copy_tree "$d" "$BUNDLE_DIR/project/$d"
  fi
done

for f in package.json package-lock.json .env .env.example tsconfig.json tsconfig.node.json tsconfig.server.json vite.config.ts LOCAL_FULLSTACK_INTEGRATION.md PORTABLE_MIGRATION.md; do
  copy_if_exists "$f" "$BUNDLE_DIR/project"
done

if [[ "$INCLUDE_NODE_MODULES" == "1" ]]; then
  if [[ -d "node_modules" ]]; then
    step "Copying node_modules (may take a while)"
    copy_tree "node_modules" "$BUNDLE_DIR/project/node_modules"
  else
    warn "node_modules not found; target machine needs npm ci"
  fi
else
  warn "INCLUDE_NODE_MODULES=0, skip copying node_modules"
fi

step "Creating portable startup script"
cat > "$BUNDLE_DIR/scripts/linux/start-portable.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_DIR="$BASE_DIR/project"

JAVA_BIN="$BASE_DIR/runtimes/java/bin"
NODE_BIN="$BASE_DIR/runtimes/node/bin"
MYSQL_BIN="$BASE_DIR/runtimes/mysql/bin"
MYSQL_DATA="$BASE_DIR/runtimes/mysql-data"
REDIS_BIN="$BASE_DIR/runtimes/redis/bin"
REDIS_DATA="$BASE_DIR/runtimes/redis-data"

export PATH="$JAVA_BIN:$NODE_BIN:$MYSQL_BIN:$PATH"
export JAVA_HOME="$(cd "$JAVA_BIN/.." && pwd)"

echo "[STEP] Starting embedded MySQL (3306)"
if [[ -d "$MYSQL_DATA" ]]; then
  nohup "$MYSQL_BIN/mysqld" \
    --basedir="$BASE_DIR/runtimes/mysql" \
    --datadir="$MYSQL_DATA" \
    --port=3306 \
    --bind-address=127.0.0.1 \
    --skip-networking=0 \
    --mysqlx=0 \
    > "$BASE_DIR/manifest/mysql-portable.log" 2>&1 &
else
  echo "[WARN] mysql-data not found; initialize MySQL manually."
fi

if [[ -x "$REDIS_BIN/redis-server" ]]; then
  mkdir -p "$REDIS_DATA"
  echo "[STEP] Starting embedded Redis (6379)"
  nohup "$REDIS_BIN/redis-server" \
    --port 6379 \
    --dir "$REDIS_DATA" \
    --appendonly yes \
    > "$BASE_DIR/manifest/redis-portable.log" 2>&1 &
else
  echo "[WARN] redis runtime not found in bundle."
fi

echo "[STEP] Starting xpay (8888)"
cd "$PROJECT_DIR/xpay-3.1_YTM7H/xpay-code"
nohup "$JAVA_BIN/java" \
  -Xms256m -Xmx512m \
  -jar target/xpay-3.1.0.jar \
  --server.port=8888 \
  --spring.main.allow-circular-references=true \
  --spring.datasource.url="jdbc:mysql://127.0.0.1:3306/xpay?characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true" \
  --spring.datasource.username=root \
  --spring.datasource.password= \
  --spring.datasource.druid.filters=stat,wall \
  --spring.redis.host=127.0.0.1 \
  --spring.redis.port=6379 \
  --spring.redis.timeout=1000 \
  > "$BASE_DIR/manifest/xpay-portable.log" 2>&1 &

echo "[STEP] Starting backend (3000)"
cd "$PROJECT_DIR"
if [[ -f "node_modules/.bin/prisma" ]]; then
  echo "[STEP] prisma generate (portable)"
  npx prisma generate > "$BASE_DIR/manifest/prisma-portable.log" 2>&1 || echo "[WARN] prisma generate failed; see manifest/prisma-portable.log"
fi
nohup "$NODE_BIN/npm" run server > "$BASE_DIR/manifest/backend-portable.log" 2>&1 &

echo "[OK] Portable stack start command issued."
echo "Backend: http://127.0.0.1:3000"
echo "XPay:    http://127.0.0.1:8888/starmc/pay"
EOF
chmod +x "$BUNDLE_DIR/scripts/linux/start-portable.sh"

step "Generating manifest"
cat > "$BUNDLE_DIR/manifest/portable-manifest.json" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "host": "$(hostname)",
  "javaHome": "$JAVA_HOME",
  "nodeHome": "$NODE_HOME",
  "mysqlHome": "$MYSQL_HOME",
  "redisHome": "${REDIS_HOME}",
  "mysqlDataIncluded": $([[ -d "$MYSQL_DATA_DIR" ]] && echo true || echo false),
  "mysqlDataSource": "$MYSQL_DATA_DIR",
  "redisDataIncluded": $([[ -d "$REDIS_DATA_DIR" ]] && echo true || echo false),
  "redisDataSource": "$REDIS_DATA_DIR",
  "nodeModulesIncluded": $([[ "$INCLUDE_NODE_MODULES" == "1" ]] && echo true || echo false)
}
EOF

step "Writing quick file hashes"
{
  [[ -f "$BUNDLE_DIR/project/package.json" ]] && sha256_line "$BUNDLE_DIR/project/package.json" "project/package.json"
  [[ -f "$BUNDLE_DIR/project/package-lock.json" ]] && sha256_line "$BUNDLE_DIR/project/package-lock.json" "project/package-lock.json"
  [[ -f "$BUNDLE_DIR/project/xpay-3.1_YTM7H/xpay-code/target/xpay-3.1.0.jar" ]] && sha256_line "$BUNDLE_DIR/project/xpay-3.1_YTM7H/xpay-code/target/xpay-3.1.0.jar" "project/xpay-3.1_YTM7H/xpay-code/target/xpay-3.1.0.jar"
  [[ -f "$BUNDLE_DIR/scripts/linux/start-portable.sh" ]] && sha256_line "$BUNDLE_DIR/scripts/linux/start-portable.sh" "scripts/linux/start-portable.sh"
} > "$BUNDLE_DIR/manifest/sha256sum.txt"

ok "Portable Linux bundle created: $BUNDLE_DIR"
echo "Next: run ./$BUNDLE_DIR/scripts/linux/start-portable.sh on target machine."
