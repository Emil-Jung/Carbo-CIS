# CIS Explorer redesign — current shell inspection

**Status:** Read-only audit (no shell changes).  
**Design direction (team):** Bold Carbo concept (Option C) — visual reference lives outside this repo; do not guess its appearance when implementing.  
**Date:** 2026-03-28

This document describes the existing **Carbo Integrated System** web shell (`shell/`) before the Explorer redesign. Use it for navigation, branding, and prototype planning.

Related: [CARBO-DESIGN.md](./CARBO-DESIGN.md) (shared tokens), [DEPLOY.md](./DEPLOY.md) (shell publish path).

---

## 1. Current shell layout

**Entry:** `shell/index.html` — three top-level views:

| View | Purpose |
|------|---------|
| `#login-view` | Sign-in (Identity) |
| `#setup-view` | First-time password setup |
| `#app-view` | Authenticated app |

**Authenticated chrome** (`#app-view`):

- **Top bar** (`header.topbar`): logo + “Carbo Integrated System” (left), **`#topbar-context`** module title (center, e.g. “Dashboard”, “Bags Status”), version/user + **Sign out** (right). On the desktop app, **Check for updates** may be injected when `pywebview` is present.
- **Main area:** `#module-content` — sole content region; **no sidebar**.
- **Floating nav:** `#cis-float-nav` — fixed bottom-left **Back** only (hidden on dashboard).

There is **no persistent left navigation** today. Layout is **top bar + full-width main**.

**Boot sequence:** `auth.js` → `modules/*.js` (each registers on `CIS.modules`) → `app.js` loads `config.json`, validates token via Identity, then `showDashboard()` or opens a deep-linked module.

---

## 2. Landing page (dashboard)

**Implementation:** `shell/modules/dashboard.js`, invoked from `app.js` → `showDashboard()`.

**Content:**

- Welcome line using `display_name` or `login_id`.
- Subtitle: applications vs reports/lookups.
- Three **sections** driven by a fixed `LAYOUT` map (not auto-discovered from modules):
  - **Administration:** Identity Admin, Device Keys
  - **Applications:** Producers Office, Traceability, Quality Capture, Maintenance Manager
  - **Reports & lookups:** three rows (Producers View, Permit Status, Quality View, Maintenance Ops, Consumption, Restaurant Report, Deliveries Register, Bags Movement, Bags Status, Supplier Contacts, etc.)

**Tiles:** permission-aware (`CIS.canAccessModule`); `inactive` modules show **Coming soon**; locked tiles show **No access**. Click → `CIS.openModule(mod.id)`.

This is a **catalog of tiles**, not an operational “today at a glance” landing (no shortcuts widget area, alerts strip, or KPI strip in the shell itself).

---

## 3. Navigation and how modules open

**Core API** (`shell/app.js`):

| API | Role |
|-----|------|
| `CIS.openModule(id)` | Permission check, updates `#topbar-context`, calls `mod.render(container, ctx)` |
| `CIS.showDashboard()` / `CIS.goHome()` | Reset stack, render dashboard |
| `navStack` + `MODULE_PARENTS` / `parentModule` | Hierarchical back (dashboard → hub → leaf) |
| `?module=<id>` on load | Stored in `sessionStorage`, stripped from URL, opened after login |
| `CIS.setFloatingBack({ onClick })` | In-module drill-back overrides stack pop |

**Navigation rule:** `.cursor/rules/cis-navigation.mdc` — one floating **Back** in `#cis-float-nav`; no duplicate in-page back buttons in modules.

**Module contract:** each file does `CIS.modules.push({ id, title, description, requires / requiresAny, render, optional inactive, icon, parentModule, … })`.

**Opening patterns:**

| Pattern | Examples |
|---------|----------|
| Dashboard tile | Most modules |
| Hub grid (second level) | `traceability.js` → Control Room, Labels, Containers, …; `labels_hub.js` → Print Labels, Label Fencing |
| Embedded iframe + CIS auth (`postMessage`) | Producers Office, Control Room, Quality Capture/View, Maintenance PWAs |
| Native JS UI in shell | Identity Admin, Device Keys, Print Labels, Bags Status, Consumption, many reports |
| Desktop bridge (`pywebview`) | Maintenance Manager opens local `.exe`; browser gets fallback launcher URL |

**Hub hierarchy (examples):** Traceability → Labels → Print Labels — float **Back** uses `MODULE_PARENTS` in `app.js` (and optional `parentModule` on the module).

**Note:** Some modules register in code but are not top-level dashboard tiles (e.g. `control_room`, `print_labels`). `shell/modules/bag_stock.js` defines a module with `parentModule: "traceability"` but is **not** included in `index.html` script list unless added later.

---

## 4. CSS, branding, logos, responsive / mobile

**Styles:** single `shell/styles.css` (~3k lines) + per-module classes on `#module-content`.

**Design tokens (`:root`):** dark charcoal `#0c0c0c`, gold `#c9a227` / `#e4c04a`, warm text `#f5f0e6`, brown-gold borders. Font stack: Segoe UI, Roboto, Helvetica, Arial.

**Assets:** `shell/assets/logo.png`, favicons, PWA icons (`icon-192`, `icon-512`).

**PWA:** `shell/manifest.json` — `theme_color` `#c9a227`, `background_color` `#0c0c0c`, `display: standalone`.

**Login:** centered card, gold-framed logo, gradient primary buttons (consistent with app chrome).

**App chrome:** 76px top bar (68px on small screens), gold bottom border on bar.

**Dashboard:** max-width ~1100px, CSS grid rows; hubs reuse `.dashboard-tile` / `.traceability-hub-grid`.

**Module exception:** **Bags Status** uses `.bs-dashboard-host` — intentional **light/white analytics theme** inside the dark shell.

**Responsive behaviour:**

- Viewport meta present; touch-friendly password toggle.
- `@media (max-width: 900px)` — dashboard application row → 2 columns; Bags Status layout tweaks.
- `@media (max-width: 640px)` — single-column dashboard rows, reduced top bar/logo, tighter `module-content` padding.
- Float Back uses `env(safe-area-inset-bottom)` for notched phones.

**Not present today:** global theme switcher, settings panel, notification dot, left drawer, hamburger menu.

---

## 5. Configuration and delivery

**Runtime config:** `shell/config.json` — API bases, external PWA URLs, `controlRoomLive`, `shellRev`, `cisVersion`, etc.

**Browser (optional):** `https://bkweb3.bigk.co.uk/cis/` → nginx alias `/opt/carbo/cis/shell/` (`nginx_cis.conf`). **`git pull` in the repo does not update the live site** until `deploy_on_server.sh` copies `shell/*` to that path (see [DEPLOY.md](./DEPLOY.md), `DEPLOY-SHELL.cmd`).

**Desktop:** `desktop/app.py` — WebView2; when online, loads the same remote shell as the browser (`CIS_SHELL_URL`, default `https://bkweb3.bigk.co.uk/cis/index.html`). Offline/bundled copy via local HTTP server and writable temp shell dir.

---

## 6. Run / view a prototype without affecting live CIS

**Live entry:** `/cis/` → `shell/index.html`. Users and the desktop app depend on that path unless overridden locally.

**Safe prototype approaches:**

1. **Separate URL under the same nginx tree (team review on VPN)**  
   Add e.g. `shell/explorer-prototype/index.html` with its own CSS/JS. After deploy, reachable at  
   `https://bkweb3.bigk.co.uk/cis/explorer-prototype/`  
   while **`/cis/`** and **`/cis/index.html`** remain production. Users only see the prototype if they open that path.

2. **Local static server (dev)**  
   Serve the prototype folder (e.g. `python -m http.server` on a free port).  
   **Caveat:** `config.json` uses relative API paths (`/identity/api`, …) — layout-only mockups work; full auth/API needs proxy through bkweb3 or absolute bkweb3 URLs in a dev config copy.

3. **Desktop isolated load**  
   Set `CIS_SHELL_URL` to the prototype URL on one machine — does not change other users’ default.

4. **Avoid for early UI-only work:** editing production `index.html` / `app.js` in place without a separate entry — that **is** the live shell once deployed.

Do not deploy a prototype to bkweb3 until the team agrees; until then, keep work in git and use local serve or a dev machine.

---

## 7. Recommended prototype location

**Primary:** `Carbo-CIS/shell/explorer-prototype/`

| Reason | Detail |
|--------|--------|
| Isolation | Own `index.html`, styles, shell JS — production boot path unchanged |
| Reuse later | Incrementally import `auth.js`, `cis_helpers.js`, existing `modules/*.js`, or stub `CIS.openModule` for nav-only iteration |
| Preview URL | Optional bkweb3 path under `/cis/explorer-prototype/` without replacing `/cis/index.html` |
| Nav evolution | New left nav can centralise calls to `navStack`, `openModule`, and `setFloatingBack` per `.cursor/rules/cis-navigation.mdc` |

**Suggested phases (after approval + Option C reference):**

1. **Chrome only** — left nav, operational landing mock, “? Ask Emil — Coming Soon”, settings wheel + theme stub + notification dot (no module wiring).
2. **Wire navigation** — map nav items to existing module ids and hub routes; mobile drawer / collapsed rail.
3. **Bold Carbo tokens** — apply only from supplied Option C reference (Figma, PNGs, or HTML export).

**Heavier alternative:** feature flag inside `app.js` — touches live shell; prefer after prototype URL is signed off.

---

## 8. Planned redesign vs current gaps

| Planned feature | Today |
|-----------------|--------|
| Persistent left nav (mobile-friendly) | None — tile + hub + float Back |
| Operational landing + shortcuts | Welcome + static tile grid |
| “? Ask Emil — Coming Soon” (nav, near bottom) | Not present |
| Settings wheel, theme selection, red attention dot | No settings UI; no global theme (except Bags Status local light theme) |
| Bold Carbo identity (Option C) | Current CIS = dark + gold; high-contrast “Bold Carbo” awaits external reference |

**Constraints for implementation (from product):** do not change business logic, APIs, or databases as part of shell-only prototype work unless explicitly scoped.

---

## 9. Module inventory (code registration)

Approximately **27** `CIS.modules.push` registrations under `shell/modules/`. The dashboard is `CIS.dashboard`, not a module id.

Scripts loaded in production are listed in `shell/index.html` (order matters: modules before `app.js`).

---

## 10. Key file reference

| Area | Path |
|------|------|
| Shell HTML | `shell/index.html` |
| Boot / navigation | `shell/app.js` |
| Dashboard landing | `shell/modules/dashboard.js` |
| Shared UI / iframe embed | `shell/modules/cis_helpers.js` |
| Styles / tokens | `shell/styles.css` |
| Config | `shell/config.json` |
| Nav rule | `.cursor/rules/cis-navigation.mdc` |
| Nginx (optional web shell) | `nginx_cis.conf` |
| Server deploy | `deploy_on_server.sh`, `sync_cis_shell_on_server.sh` |

---

## Shell V2.0 visual prototype (in progress)

**Path:** `shell/explorer-prototype/` — Modern Carbo × Bold Carbo mashup (static UI, no module wiring).

See [shell/explorer-prototype/README.md](./shell/explorer-prototype/README.md).

## Next steps

1. Review V2 prototype visuals; replace SVG landscape placeholders with approved photography when available.
2. Wire navigation and modules after visual sign-off.
3. Cut over production `index.html` only when explicitly agreed.
