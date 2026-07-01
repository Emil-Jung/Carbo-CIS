#!/bin/bash
# One-time CIS static/update directories on Big-K (run with sudo once).
#
#   bash setup_cis_server_dirs.sh
#
# Creates /opt/carbo/cis/app and /opt/carbo/cis/shell owned by bkweb3dev.
# Upload CarboCIS-Setup.exe + version.json into app/ from your PC.
# Optionally copy shell/ from the Carbo-CIS git repo into shell/.

set -e

APP_USER="${APP_USER:-bkweb3dev}"

sudo mkdir -p /opt/carbo/cis/app /opt/carbo/cis/shell
sudo chown -R "$APP_USER:$APP_USER" /opt/carbo/cis

echo "Created:"
ls -la /opt/carbo/cis/
echo ""
echo "Next: upload cis_download/* to /opt/carbo/cis/app/"
echo "Optional: cp -r /opt/carbo/carbo-cis/shell/* /opt/carbo/cis/shell/"
echo "Then add nginx blocks from Carbo-CIS/nginx_cis.conf and reload nginx."
