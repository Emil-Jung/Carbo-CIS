# Carbo Integrated System (CIS) — shell

A single web app (one URL, one login) that shows managers only the modules their
permissions allow. This is the forerunner of the full CIS. It replaces the idea of
handing each person a device key.

- **Login** goes to `carbo-identity` (`/identity/api/auth/login`).
- **Modules** are gated by permissions returned from `/identity/api/auth/me`.
- **Data** comes from the domain APIs (e.g. maintenance `/maintenance/api/...`).

## Modules (phase 1)

| Module          | Nav label      | Permission               | For       | Reads |
|-----------------|----------------|--------------------------|-----------|-------|
| Operations      | Operations     | `maintenance.ops.view`   | Simon     | `/vehicles`, `/exceptions` |
| Consumption     | Consumption    | `maintenance.fuel.view`  | Juliana   | `/vehicles`, `/fuel-summaries` |
| Identity Admin  | Identity Admin | `identity.admin`         | You       | identity API |

Consumption shows **litres only** — no pricing yet (added later).

## Files

```
shell/
  index.html          login + app shell
  styles.css
  config.json         API base URLs (edit for local dev)
  app.js              login, token, permission-gated module loader
  modules/
    identity_admin.js
    maintenance_ops.js
    consumption.js
```

## Add a new module later

1. Add its permission to `carbo-identity` `app/permissions.py` and grant it to a role.
2. Create `shell/modules/<name>.js` that calls `window.CIS.modules.push({ id, title, requires, render })`.
3. Add a `<script>` tag for it in `index.html`.

The shell shows the module's nav entry only to users who hold `requires`.

## Deploy

Static files → `/opt/carbo/cis/shell/` on the Big-K server, served at
`https://bkweb3.bigk.co.uk/cis/`. See `DEPLOY.md`.

## Local dev

Because browsers block cross-origin without CORS, either:
- run behind the same nginx (recommended), or
- set absolute bases in `config.json` (both APIs already allow `*` CORS):

```json
{
  "identityApiBase": "http://localhost:8003",
  "maintenanceApiBase": "http://localhost:8001"
}
```

Then serve the shell folder: `python -m http.server 8080` and open
`http://localhost:8080/`.
