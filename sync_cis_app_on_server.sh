#!/bin/bash
# Copy uploaded CIS installer files into the nginx web dir.
# Run ON the server after UPLOAD-CIS-TO-SERVER.cmd from your PC (VPN on).
#
#   bash sync_cis_app_on_server.sh

set -e
SRC="${CIS_UPLOAD_DIR:-$HOME/cis_app_upload}"
DEST="${CIS_WEB_DIR:-/opt/carbo/cis/app}"

for f in CarboCIS-Setup.exe version.json; do
    if [[ ! -f "$SRC/$f" ]]; then
        echo "Missing $SRC/$f"
        echo "On your PC run: UPLOAD-CIS-TO-SERVER.cmd (after BUILD-INSTALLER + stage-cis-download)"
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
