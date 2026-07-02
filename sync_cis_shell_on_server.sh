#!/bin/bash
# Publish CIS web shell to nginx (browser at /cis/).
#
# Nginx serves:  /opt/carbo/cis/shell/
# Git repo lives: /opt/carbo/carbo-cis/
# git pull alone does NOT update the browser — this script copies shell/* across.
#
# Run ON the server (after git push from your PC):
#   bash sync_cis_shell_on_server.sh
#
# Or from your PC (VPN on):
#   DEPLOY-SHELL.cmd

set -e

REPO="${CIS_REPO_DIR:-/opt/carbo/carbo-cis}"
DEST="${CIS_SHELL_DIR:-/opt/carbo/cis/shell}"

if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: CIS git repo not found at $REPO"
  echo "One-time setup:"
  echo "  cd /opt/carbo && git clone https://github.com/Emil-Jung/Carbo-CIS.git carbo-cis"
  exit 1
fi

echo ">> git pull in $REPO"
cd "$REPO"
git pull

if [[ ! -d "$REPO/shell" ]]; then
  echo "ERROR: $REPO/shell missing"
  exit 1
fi

mkdir -p "$DEST"
echo ">> copy shell/* -> $DEST"
cp -r "$REPO/shell/"* "$DEST/"

echo ""
echo "Deployed shell:"
ls -la "$DEST" | head -8
echo "..."
test -f "$DEST/modules/dashboard.js" && echo "OK: dashboard.js present" || echo "WARN: dashboard.js missing"
test -f "$DEST/assets/logo.png" && echo "OK: logo.png present" || echo "WARN: logo.png missing"
grep -q 'gold' "$DEST/styles.css" && echo "OK: black/gold styles.css" || echo "WARN: old styles.css?"

VER=$(grep -o '"cisVersion"[[:space:]]*:[[:space:]]*"[^"]*"' "$DEST/config.json" 2>/dev/null | head -1 || true)
echo "config.json $VER"

echo ""
echo "Verify in browser (Ctrl+F5): https://bkweb3.bigk.co.uk/cis/"
echo "View page source — should contain: dashboard.js, logo.png, topbar-context"
echo "Should NOT contain: module-nav (old sidebar layout)"
