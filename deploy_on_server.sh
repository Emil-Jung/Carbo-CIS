#!/bin/bash
# Deploy CIS web shell to nginx (run ON bkweb3.bigk.co.uk)
#
# git pull alone does NOT update https://bkweb3.bigk.co.uk/cis/ — this script
# pulls and copies shell/* to /opt/carbo/cis/shell/ (what nginx serves).
#
# Usage:
#   cd /opt/carbo/carbo-cis
#   bash deploy_on_server.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$REPO_ROOT/sync_cis_shell_on_server.sh"
