# Carbo handover — home PC — 20 Oct 2026

Use on **home PC** after `git pull` on each repo. Workspace on work machine: `D:\My Coding Projects\`; adjust drive letter if yours is `G:\` or `E:\`.

**Production CIS:** https://bkweb3.bigk.co.uk/cis/ (V1 shell at `/cis/`).  
**Bag Walk:** https://bkweb3.bigk.co.uk/traceability/bags-lookup/

---

## Pull these repos (master)

| Repo | Remote | Latest commit (20 Oct 2026) |
|------|--------|-----------------------------|
| **Carbo-CIS** | `origin/master` | `b0cc3f0` — Active operations drag fix (v2) |
| **Charcoal-Traceability** | `origin/master` | `3098229` — Bag Walk shell guard; no truck UI on scanner |
| **Carbo-Identity** | (no changes this session) | pull anyway for parity |

```powershell
cd "D:\My Coding Projects\Carbo-CIS"
git pull origin master

cd "D:\My Coding Projects\Charcoal-Traceability"
git pull origin master

cd "D:\My Coding Projects\Carbo-Identity"
git pull origin master
```

---

## Why “it never works the first time” (deploy discipline)

1. **`git pull` on bkweb3 is not enough for CIS** — nginx serves **`/opt/carbo/cis/shell/`**, not the git tree. Always run **`bash deploy_on_server.sh`** after pull in `carbo-cis`.
2. **Browsers and PWAs cache old JS** — bump **`shellRev`** (CIS) or **`shell_rev.json`** (Bag Walk) on every UI change; hard refresh or let the shell guard reload stale tabs.
3. **Verify with rev strings**, not “it looks the same”:
   - CIS top bar: includes **`20261020-float-ops-drag-v2`**
   - Bag Walk → Settings: **`Shell 20261020-scanner-no-truck-ui`**
   - Walvis dispatch detail: `data-walvis-ui-rev="1.6.68-manifest-list-only"` (no tick boxes, list only)

---

## bkweb3 deploy (when you want floor to see changes)

**Traceability API + PWA files:**

```bash
cd /opt/carbo/charcoal-traceability
git pull origin master
bash deploy_on_server.sh
# Restarts charcoal-traceability on 8005 when systemd/sudo allows
```

**CIS browser shell:**

```bash
cd /opt/carbo/carbo-cis
git pull origin master
bash deploy_on_server.sh
```

From Windows (VPN): `Carbo-CIS\DEPLOY-SHELL.cmd` copies shell to server when configured.

---

## What shipped 20 Oct 2026

### Policy (floor vs office)

- **Scanner (Bag Walk):** scan → bag → tap step → confirm only. **No** truck picker, dispatch bar, or “open new truck” on device. GF load uses **released dispatch in CIS** (server picks open plan).
- **CIS Walvis:** traceability manifest **read-only** after close — no remove/backfill/catch-up utilities in UI; data fixes on **server / SQL**, not CIS side tools.
- **Data corrections:** master storage / server-side, not scanner or CIS reconcile widgets.

### Carbo-CIS (`master`)

| Commit | Summary |
|--------|---------|
| `8ea476c` | Walvis dispatch detail: read-only manifest table |
| `b8c6f63` | Remove list-page “Admin & reconcile tools”; cache bust |
| `9d60403` / `d6dc14b` | CIS **shell cache guard** (`shell_cache_guard.js`, `shellRev` polling) |
| `a0b4962` / `b0cc3f0` | **Active operations** panel (bottom-right): **“Drag to move”** bar; document-level drag; **`20261020-float-ops-drag-v2`** |

**Shell rev (config.json):** `20261020-float-ops-drag-v2`

**Walvis module script:** `walvis_dispatches.js?v=1.6.68-manifest-list-only`

### Charcoal-Traceability (`master`)

| Commit | Summary |
|--------|---------|
| `575fdba` | Manifest append-only; offload `load_source` fix; scanner simplification start |
| `3098229` | Bag Walk: remove truck overlay; **`pwa_cache_guard.js`** + **`shell_rev.json`**; SW **v98** (no precache of `app.js`) |

**Bag Walk shell rev:** `20261020-scanner-no-truck-ui`

**Backend note:** `record_dispatch_offload` / manifest attach-only behaviour in `walvis_dispatch.py` — deploy API with traceability script above.

---

## Active operations float (bottom-right gold box)

- Shows sieving, packaging shift(s), open Walvis dispatch, container loading (read-only summary).
- **Drag:** use the **“Drag to move”** strip at the top of the card; **double-click** strip or title to reset to bottom-right.
- If there is **no** drag strip, the old CIS shell is still loaded → run **deploy_on_server.sh** + hard refresh.

---

## Walvis CIS — what you should see

- **List:** no “Admin & reconcile tools” accordion.
- **Detail:** Loaded · Received counts + **table only** (no checkboxes, no Fill Received, no remove selected).
- **Left column:** truck setup / plan / release / close / meta only.

---

## Bag Walk — what Shorty should see

- Home: **Scan** only (no yellow dispatch bar, no job bar when minimal home).
- In transit: confirm sheet only; errors like “no released Walvis dispatch” → fix in **CIS**, not on scanner.
- Stuck on old UI: clear site data for bkweb3 or reinstall PWA; confirm Settings shell rev.

---

## SSH / paths (reference)

| Item | Value |
|------|--------|
| Server | `bkweb3.bigk.co.uk` / VPN `192.168.89.101` |
| Traceability repo on server | `/opt/carbo/charcoal-traceability` |
| CIS git repo on server | `/opt/carbo/carbo-cis` |
| CIS nginx shell | `/opt/carbo/cis/shell/` |

---

## Optional checks after deploy

```bash
# CIS index matches repo after copy
grep shellRev /opt/carbo/cis/shell/config.json
grep float-ops-drag-v2 /opt/carbo/cis/shell/index.html

# API health
curl -sS https://bkweb3.bigk.co.uk/traceability/api/health
```

---

## Do not regress without explicit ask

- Scanner location modes / truck picker / dispatch open from kiosk
- CIS Walvis manifest remove / catch-up / fence buttons
- Heavy reconcile UI on list or detail pages

---

*Generated for home PC sync — 20 Oct 2026.*
