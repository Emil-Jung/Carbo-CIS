# CIS rollout — deploy (PC → server)

After **git push** from your PC, run **`bash deploy_on_server.sh`** in each repo on the server (VPN + SSH).

SSH: `ssh bkweb3dev@192.168.89.101`

---

## Step 1 — Push from PC

Push **Carbo-Identity**, **Quality-Platform**, **Producers-Platform**, and **Carbo-CIS** (see git commit messages in your session or prior deploy notes).

---

## Step 2 — Server deploy (in this order)

```bash
ssh bkweb3dev@192.168.89.101

cd /opt/carbo/carbo-identity
bash deploy_on_server.sh

cd /opt/carbo/quality-platform
bash deploy_on_server.sh

cd /opt/carbo/producers-platform
bash deploy_on_server.sh

cd /opt/carbo/carbo-cis
bash deploy_on_server.sh
```

Each script: **git pull**, update deps if needed, restart service (or copy CIS shell), **health check**.

---

## Step 3 — Browser

Open https://bkweb3.bigk.co.uk/cis/ → **Ctrl+F5**

Check `config.json` shows current `cisVersion` (e.g. `"1.3.9"`).

---

## One-time env checks (if not already set)

```bash
grep IDENTITY_API_URL /opt/carbo/quality-platform/quality_api/.env
grep IDENTITY_API_URL /opt/carbo/producers-platform/producers_api/.env
# Both should show: IDENTITY_API_URL=http://127.0.0.1:8004
```

If missing, add and re-run `bash deploy_on_server.sh` in that repo.

---

## PC shortcut (CIS shell only)

From `Carbo-CIS` on PC (VPN on): `DEPLOY-SHELL.cmd`  
(runs `git pull` + `bash deploy_on_server.sh` on the server)

---

## Smoke test

| Check | Expect |
|-------|--------|
| CIS login | https://bkweb3.bigk.co.uk/cis/ |
| Quality Analysis (staff user) | Opens in CIS, no device key |
| Producers (admin / producers.office) | Embedded office, list loads |
| `curl -s http://127.0.0.1:8004/health` | identity ok |
| `curl -s http://127.0.0.1:8002/health` | quality ok |
| `curl -s http://127.0.0.1:8003/health` | producers ok |

Use **localhost** curl on the server — public HTTPS curl to your own URL often hangs.

---

## Staff access

### How access works

| Piece | What it does |
|-------|----------------|
| **Role `quality_viewer`** | Permission `quality.view` only — opens **Quality Analysis** |
| **Dashboard** | All tiles visible; locked tiles show **No access** |
| **Admin** | Role `admin` — create users, assign roles |

### Admin login (`admin`)

CIS admin User ID is **`admin`** (not a server Linux account).

After deploy, `bash deploy_on_server.sh` in carbo-identity runs `seed_identity.py` — it creates **`admin`** if missing and may print a one-time password.

### Create staff users

1. Sign in as **admin** at https://bkweb3.bigk.co.uk/cis/
2. **Administration → Users & access → + New user**
3. User ID + display name; leave password blank
4. Role **`quality_viewer`** is pre-checked — leave it (uncheck admin)
5. Save → copy the personal invite link (`?user=...`) and send to the person
6. They set a password on first sign-in

### Smoke test (as a staff user)

1. Open invite link → set password → dashboard
2. **Reports & lookups → Quality Analysis** — should open in-page
3. Other tiles show **No access** (expected)
4. Browse a date / producer — data loads

If Quality Analysis is blank or “unauthorized”, re-check `IDENTITY_API_URL` on quality API and run `bash deploy_on_server.sh` again in quality-platform and carbo-identity.

### Give someone more later

| Need | Role / permission |
|------|-------------------|
| View sheets only | `quality_viewer` |
| Capture sieving (field) | add `quality.capture` or `operations` role |
| Fuel / fleet | `operations` or `finance` |
| Producers office | `producers.office` (admin has this) |
| User admin | `admin` |

Edit user in **Users & access** → check extra roles → Save.

### Quick URLs

| URL | Expect |
|-----|--------|
| https://bkweb3.bigk.co.uk/cis/ | CIS login |
| https://bkweb3.bigk.co.uk/identity/api/health | `{"status":"ok",...}` |
| https://bkweb3.bigk.co.uk/quality/viewer/ | Viewer (device key or CIS iframe) |
