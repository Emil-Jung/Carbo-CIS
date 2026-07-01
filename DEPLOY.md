# CIS — build, publish & install

CIS is an installed desktop app that auto-updates from the server. The server only
hosts the update files; it does not run CIS. Requires `carbo-identity` running
(see `Carbo-Identity/DEPLOY.md`).

SSH: `ssh bkweb3dev@192.168.89.101` (VPN on). Public host: `bkweb3.bigk.co.uk`.

## Server layout

| Path (server)              | Served at                                  | Contents                    |
|----------------------------|--------------------------------------------|-----------------------------|
| `/opt/carbo/cis/app/`      | `https://bkweb3.bigk.co.uk/cis/app/`       | `version.json` + the `.exe` |
| `/opt/carbo/cis/shell/`    | `https://bkweb3.bigk.co.uk/cis/` (optional)| web copy of the shell       |

### One-time server setup

```bash
sudo mkdir -p /opt/carbo/cis/app /opt/carbo/cis/shell
sudo chown -R bkweb3dev:bkweb3dev /opt/carbo/cis
# add the blocks from nginx_cis.conf to the HTTPS server block, then:
sudo nginx -t && sudo systemctl reload nginx
```

## Release a new version (from your PC)

```
cd desktop
REM 1. bump the right part in version.py (see VERSIONING.md)
BUILD-CIS.cmd
powershell -ExecutionPolicy Bypass -File scripts\stage-cis-download.ps1
```

This creates `desktop\cis_download\` with `Carbo Integrated System.exe` and
`version.json` (with the correct SHA256).

Upload both to the server (VPN on):

```powershell
scp "desktop\cis_download\*" bkweb3dev@192.168.89.101:~/cis_app_upload/
```

On the server, move them into place:

```bash
sudo cp ~/cis_app_upload/* /opt/carbo/cis/app/
curl -s https://bkweb3.bigk.co.uk/cis/app/version.json
```

Every installed app checks `version.json` on launch (and via **Help → Check for
updates**) and offers the update when the server version is higher.

## First install on a manager's PC

1. Copy `Carbo Integrated System.exe` to the PC (from `cis_download`, USB, or the
   `/cis/app/` URL).
2. Put it in its own folder (it writes `version.txt`, `update.log` beside itself),
   e.g. `C:\CarboCIS\`.
3. Double-click to run; pin to taskbar. From then on it self-updates.

## Smoke test

1. Launch → login screen. Sign in as the bootstrap admin → **Identity Admin** appears.
2. Create Simon (role `operations`) and Juliana (role `finance`).
3. Sign in as Simon → **Operations** + **Consumption**. As Juliana → **Consumption** only.
4. Bump `version.py`, rebuild, publish; relaunch an old install → it offers the update.
