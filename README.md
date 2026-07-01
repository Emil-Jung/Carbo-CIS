# Carbo Integrated System (CIS)

An **installed desktop app** (one per PC, like the Maintenance Manager) that gives
managers one login and shows only the modules their permissions allow. It is the
forerunner of the full CIS and replaces handing each person a device key.

It is **not** a PWA. The app is a thin PySide6 window that hosts the web
shell/modules inside it and **auto-updates from the server** — so adding a module
later (e.g. Traceability) is just: build, bump version, publish; every PC updates.

## Two layers

```
desktop/         The installed app (PySide6 + embedded web view + auto-updater)
  app.py           hosts the bundled shell locally, Help > Check for updates / About
  version.py       X.Y.Z = CIS . Module . Internal   (see VERSIONING.md)
  config.py        cloud API URLs + update download URL
  cis_update.py    version.json check + hash-verified exe swap (same as Manager)
  scripts/update_cis.ps1     detached updater
  scripts/stage-cis-download.ps1   builds version.json + exe with SHA256
  cis.spec, BUILD-CIS.cmd, RUN-CIS.cmd, requirements.txt

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

See [`DEPLOY.md`](DEPLOY.md). In short: `BUILD-CIS.cmd` → `stage-cis-download.ps1`
→ upload `version.json` + the `.exe` to `/opt/carbo/cis/app/` on the server.
