# Carbo Integrated System (CIS)

An **installed desktop app** (one per PC, like the Maintenance Manager) that gives
managers one login and shows only the modules their permissions allow. It is the
forerunner of the full CIS and replaces handing each person a device key.

It is **not** a PWA. The app is a thin host (WebView2 via pywebview — uses the OS
Edge engine, no bundled Chromium, ~25–35 MB) that renders the bundled web
shell/modules and **auto-updates from the server** by running a new installer
silently — so adding a module later (e.g. Traceability) is just: build, bump
version, publish; every PC updates.

## Two layers

```
desktop/         The installed app (pywebview/WebView2 host + auto-updater)
  app.py           hosts the bundled shell on 127.0.0.1, JS update bridge, startup check
  version.py       X.Y.Z = CIS . Module . Internal   (see VERSIONING.md)
  config.py        cloud API URLs + update URL + persistent WebView2 storage dir
  cis_update.py    version.json check + hash-verified installer run
  scripts/update_cis.ps1           detached updater (downloads + runs setup silently)
  scripts/stage-cis-download.ps1   builds version.json + installer with SHA256
  installer/cis.iss                Inno Setup (per-user, WebView2 check)
  cis.spec, BUILD-CIS.cmd, BUILD-INSTALLER.cmd, RUN-CIS.cmd, requirements.txt

shell/           The web shell + modules (bundled into the app; also web-servable)
  index.html, app.js, styles.css, config.json
  modules/ identity_admin.js, maintenance_ops.js, consumption.js
```

- **Login** → `carbo-identity` (`/identity/api/auth/login`).
- **Modules** gated by permissions from `/identity/api/auth/me`.
- **Data** from domain APIs (maintenance today; quality/traceability later).

## Modules (phase 1)

| Module          | Nav label      | Permission               | For       |
|-----------------|----------------|--------------------------|-----------|
| Operations      | Operations     | `maintenance.ops.view`   | Simon     |
| Consumption     | Consumption    | `maintenance.fuel.view`  | Juliana (litres only, no pricing yet) |
| Identity Admin  | Identity Admin | `identity.admin`         | You       |

## Versioning

`X.Y.Z` where X = CIS version, Y = module adjustments, Z = internal build.
Full rules and examples in [`VERSIONING.md`](VERSIONING.md).

## Add a new module later

1. Add its permission to `carbo-identity` `app/permissions.py`; grant it to a role.
2. Create `shell/modules/<name>.js` calling `window.CIS.modules.push({ id, title, requires, render })`.
3. Add its `<script>` tag in `shell/index.html`.
4. Bump `Y` in `desktop/version.py`, build, publish — installed apps self-update.

## Run from source (dev)

```
cd desktop
python -m venv .venv && .venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python app.py     REM  or RUN-CIS.cmd
```

Override endpoints for local dev with env vars `IDENTITY_API_BASE_URL`,
`MAINTENANCE_API_BASE_URL` (both APIs allow CORS `*`).

## Build & release

See [`DEPLOY.md`](DEPLOY.md). In short: `BUILD-CIS.cmd` → `BUILD-INSTALLER.cmd` →
`stage-cis-download.ps1` → upload `version.json` + `CarboCIS-Setup.exe` to
`/opt/carbo/cis/app/` on the server. Needs Inno Setup 6 installed.
