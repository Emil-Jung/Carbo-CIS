#!/bin/bash
# Copy staged CIS installer from this repo into nginx web dir.
# Run ON the server after: cd /opt/carbo/carbo-cis && git pull
#
#   bash sync_cis_app_on_server.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/desktop/cis_download"
DEST="${CIS_WEB_DIR:-/opt/carbo/cis/app}"

for f in CarboCIS-Setup.exe version.json; do
    if [[ ! -f "$SRC/$f" ]]; then
        echo "Missing $SRC/$f — build on PC, commit, push, then git pull here."
        exit 1
    fi
done

mkdir -p "$DEST"
cp -f "$SRC/CarboCIS-Setup.exe" "$SRC/version.json" "$DEST/"
chmod 644 "$DEST/CarboCIS-Setup.exe" "$DEST/version.json"

echo "Synced to $DEST:"
ls -lh "$DEST/CarboCIS-Setup.exe" "$DEST/version.json"
echo ""
echo "Verify in browser: https://bkweb3.bigk.co.uk/cis/app/version.json"
