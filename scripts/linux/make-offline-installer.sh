#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BUNDLE_DIR="${1:-offline-bundle}"
ARCHIVE_NAME="${2:-qianfu-offline-installer.tar.gz}"

echo "[STEP] Building offline bundle..."
bash scripts/linux/package-offline-bundle.sh "$BUNDLE_DIR"

echo "[STEP] Adding installer UX scripts..."
mkdir -p "$BUNDLE_DIR/scripts/linux"
cp scripts/linux/install-offline.sh "$BUNDLE_DIR/scripts/linux/install-offline.sh"
cp scripts/linux/verify-offline-stack.sh "$BUNDLE_DIR/scripts/linux/verify-offline-stack.sh"
cp scripts/linux/collect-diagnostics.sh "$BUNDLE_DIR/scripts/linux/collect-diagnostics.sh"
chmod +x "$BUNDLE_DIR/scripts/linux/install-offline.sh"
chmod +x "$BUNDLE_DIR/scripts/linux/verify-offline-stack.sh"
chmod +x "$BUNDLE_DIR/scripts/linux/collect-diagnostics.sh"

cat > "$BUNDLE_DIR/install.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
chmod +x scripts/linux/install-offline.sh
bash scripts/linux/install-offline.sh
EOF
chmod +x "$BUNDLE_DIR/install.sh"

echo "[STEP] Packaging tar.gz..."
tar -czf "$ARCHIVE_NAME" -C "$BUNDLE_DIR" .

echo "[DONE] Offline installer created: $ARCHIVE_NAME"
echo "       Transfer it to an offline Linux host and run:"
echo "       tar -xzf $ARCHIVE_NAME -C qianfu-offline && cd qianfu-offline && bash install.sh"
