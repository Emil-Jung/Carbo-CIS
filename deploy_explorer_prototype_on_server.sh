#!/bin/bash
# Deploy CIS Shell V2.0 prototype ONLY — does not copy shell/index.html or other production root files.
#
# Nginx: https://bkweb3.bigk.co.uk/cis/explorer-prototype/
# Source: $REPO/shell/explorer-prototype/
# Dest:   /opt/carbo/cis/shell/explorer-prototype/
#
# Usage (on bkweb3):
#   cd /opt/carbo/carbo-cis && bash deploy_explorer_prototype_on_server.sh

set -e

REPO="${CIS_REPO_DIR:-/opt/carbo/carbo-cis}"
SRC="$REPO/shell/explorer-prototype"
DEST="${CIS_V2_SHELL_DIR:-/opt/carbo/cis/shell/explorer-prototype}"
PROD_INDEX="/opt/carbo/cis/shell/index.html"

if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: CIS git repo not found at $REPO"
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "ERROR: $SRC missing — git pull Carbo-CIS first"
  exit 1
fi

if [[ ! -f "$PROD_INDEX" ]]; then
  echo "ERROR: Production shell not found at $PROD_INDEX — aborting"
  exit 1
fi

PROD_HASH_BEFORE=$(sha256sum "$PROD_INDEX" | awk '{print $1}')
echo ">> git pull in $REPO"
cd "$REPO"
git pull origin master

PROD_HASH_AFTER=$(sha256sum "$PROD_INDEX" | awk '{print $1}')
if [[ "$PROD_HASH_BEFORE" != "$PROD_HASH_AFTER" ]]; then
  echo "ERROR: $PROD_INDEX changed during git pull — refusing prototype-only deploy"
  exit 1
fi

mkdir -p "$DEST"
echo ">> sync prototype only: $SRC/ -> $DEST/"
rsync -a --delete "$SRC/" "$DEST/"

GIT_HEAD=$(git rev-parse HEAD)
echo ""
echo "Git HEAD: $GIT_HEAD"
echo "Prototype index: $DEST/index.html"
grep -o 'explorer-v2-cis-bridge.js?v=[^"]*' "$DEST/index.html" | head -1 || true
grep -o 'cis-module-viewport' "$DEST/index.html" | head -1 && echo "OK: module viewport (cached hosts)"
grep -q 'sidebar-bottom-dock' "$DEST/index.html" && echo "OK: bottom dock markup"
grep -q 'sidebar-nav-dock-admin' "$DEST/index.html" && echo "OK: dock Administration host"

PROD_HASH_FINAL=$(sha256sum "$PROD_INDEX" | awk '{print $1}')
if [[ "$PROD_HASH_BEFORE" != "$PROD_HASH_FINAL" ]]; then
  echo "ERROR: Production index.html was modified — abort"
  exit 1
fi
echo "OK: production $PROD_INDEX unchanged (sha256 $PROD_HASH_FINAL)"

echo ""
echo "Verify: https://bkweb3.bigk.co.uk/cis/explorer-prototype/ (Ctrl+F5)"
echo "Production /cis/ was NOT redeployed by this script."
