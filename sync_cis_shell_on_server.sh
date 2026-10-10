#!/bin/bash
# Publish CIS web shell to nginx (browser at /cis/).
#
# Nginx serves:  /opt/carbo/cis/shell/
# Git repo lives: /opt/carbo/carbo-cis/
# git pull alone does NOT update the browser — this script copies shell/* across.
#
# Run ON the server (after git push from your PC):
#   cd /opt/carbo/carbo-cis
#   bash deploy_on_server.sh
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

PL_VER=$(grep -o 'PL_UI_VERSION = "[^"]*"' "$DEST/modules/print_labels.js" 2>/dev/null | head -1 || true)
echo "print_labels.js $PL_VER"
if grep -q 'sideCol' "$DEST/modules/print_labels.js" 2>/dev/null; then
  echo "ERROR: print_labels.js still references sideCol — aborting (broken deploy)"
  exit 1
fi

test -f "$DEST/modules/pallet_configuration.js" \
  && echo "OK: pallet_configuration.js present" \
  || echo "WARN: pallet_configuration.js missing — git pull Carbo-CIS then re-run this script"

grep -q 'pallet_configuration.js' "$DEST/index.html" 2>/dev/null \
  && echo "OK: index.html loads pallet_configuration.js" \
  || echo "WARN: index.html missing pallet_configuration.js script tag"

grep -q 'delivery_confirmations.js' "$DEST/index.html" 2>/dev/null \
  && echo "OK: index.html loads delivery_confirmations.js" \
  || echo "WARN: index.html missing delivery_confirmations.js script tag"

if grep -q 'Charcoal Tracker xlsb' "$DEST/modules/delivery_confirmations.js" 2>/dev/null; then
  echo "OK: delivery_confirmations.js is the Deliveries-sheet UI (form grids)"
else
  echo "ERROR: delivery_confirmations.js is OLD or missing — git pull Carbo-CIS then re-run this script"
  exit 1
fi

grep -q 'delivery-conf-form-grid' "$DEST/styles.css" 2>/dev/null \
  && echo "OK: styles.css includes delivery-conf-* rules" \
  || echo "WARN: styles.css missing delivery-conf CSS — PJ tile will look broken"

CR_LIVE=$(grep -o '"controlRoomLive"[[:space:]]*:[[:space:]]*[^,}]*' "$DEST/config.json" 2>/dev/null | head -1 || true)
echo "config.json $CR_LIVE (false = Control Room stays Coming soon)"

GIT_HEAD=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo "?")
echo ""
echo "Git HEAD in repo: $GIT_HEAD"
BS_VER=$(grep -o 'bags_status.js?v=[^"]*' "$DEST/index.html" 2>/dev/null | head -1 || true)
echo "nginx shell index.html: ${BS_VER:-bags_status.js tag missing}"
if ! diff -q "$REPO/shell/index.html" "$DEST/index.html" >/dev/null 2>&1; then
  echo "ERROR: $DEST/index.html differs from repo — copy step failed?"
  exit 1
fi
echo "OK: nginx shell index.html matches repo"

echo ""
echo "Verify in browser (Ctrl+F5): https://bkweb3.bigk.co.uk/cis/"
echo "View page source — should contain: dashboard.js, logo.png, topbar-context"
echo "Should NOT contain: module-nav (old sidebar layout)"
