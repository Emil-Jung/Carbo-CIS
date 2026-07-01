# CIS — build, publish & install

CIS is an installed Windows app (WebView2 via pywebview — no bundled Chromium, so
~25–35 MB). It auto-updates from the server by downloading and silently running a
new installer. The server only hosts the update files. Requires `carbo-identity`
running (see `Carbo-Identity/DEPLOY.md`).

SSH: `ssh bkweb3dev@192.168.89.101` (VPN on). Public host: `bkweb3.bigk.co.uk`.

## Prerequisites (build PC)
- Python + `pip install -r desktop/requirements.txt` (pywebview, pyinstaller)
- [Inno Setup 6](https://jrsoftware.org/isinfo.php) (provides `ISCC.exe`)
- (Optional) Put `MicrosoftEdgeWebview2Setup.exe` in `desktop/installer/redist/` so the
  installer can auto-install the WebView2 runtime on the rare PC that lacks it.

## Server layout

| Path (server)           | Served at                              | Contents                          |
|-------------------------|----------------------------------------|-----------------------------------|
| `/opt/carbo/cis/app/`   | `https://bkweb3.bigk.co.uk/cis/app/`   | `version.json` + `CarboCIS-Setup.exe` |
| `/opt/carbo/cis/shell/` | `https://bkweb3.bigk.co.uk/cis/` (opt) | web copy of the shell             |

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
REM 1. bump the right part in version.py (see ../VERSIONING.md)
BUILD-CIS.cmd                                   REM one-folder app (exe + DLLs)
BUILD-INSTALLER.cmd                             REM -> installer\Output\CarboCIS-Setup.exe
powershell -ExecutionPolicy Bypass -File scripts\stage-cis-download.ps1
```
`stage-cis-download.ps1` creates `desktop\cis_download\` with `CarboCIS-Setup.exe`
and `version.json` (correct SHA256).

Upload both to the server (VPN on):
```powershell
scp "desktop\cis_download\*" bkweb3dev@192.168.89.101:~/cis_app_upload/
```
On the server:
```bash
sudo cp ~/cis_app_upload/* /opt/carbo/cis/app/
curl -s https://bkweb3.bigk.co.uk/cis/app/version.json
```

Every installed app checks `version.json` on launch (and via the in-app **Check for
updates** button) and, when the server version is higher, downloads the installer,
verifies its SHA256, runs it silently (per-user, no UAC), and relaunches.

## First install on a PC (Namibia / Big K)
1. Get `CarboCIS-Setup.exe` (from `cis_download`, USB, or the `/cis/app/` URL).
2. Run it. Per-user install to `%LOCALAPPDATA%\Programs\Carbo CIS`, Start Menu +
   optional desktop shortcut. No admin needed.
3. From then on it self-updates.

## Notes
- **WebView2 runtime**: present on Win 11 and virtually all updated Win 10. If missing,
  the installer runs the bundled bootstrapper (if provided) or the app prompts once.
- **Offline (future Traceability)**: modules are bundled (work offline) and WebView2
  storage is persistent, so queued scans/sieving will survive restarts and sync later.
- **Code signing** (recommended before wide Big K rollout): sign `CarboCIS-Setup.exe`
  and the app exe to avoid SmartScreen warnings.

## Smoke test
1. Launch → login. Admin sees **Identity Admin**; create Simon (operations) + Juliana (finance).
2. Simon → Operations + Consumption. Juliana → Consumption only.
3. Bump `version.py`, rebuild, publish; relaunch an older install → it updates silently.
