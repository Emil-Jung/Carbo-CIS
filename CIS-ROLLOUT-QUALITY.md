# CIS rollout — Quality sheets (view only)

One goal: **staff sign in, open Quality sheets, read sieving data.** Everything else stays visible on the dashboard but shows **No access** until you grant roles later.

**URL:** https://bkweb3.bigk.co.uk/cis/

---

## How access works

| Piece | What it does |
|-------|----------------|
| **Role `quality_viewer`** | Permission `quality.view` only — opens **Quality sheets** |
| **Dashboard** | All tiles visible; locked tiles show **No access** |
| **Admin** | Role `admin` — create users, assign roles |

No nginx changes needed if `/cis/`, `/identity/api/`, and `/quality/viewer/` already work.

---

## Step 1 — Push from your PC (always first)

```powershell
cd "G:\My Coding Projects\Carbo-Identity"
git add -A
git commit -m "quality_viewer: view-only staff role"
git push origin master

cd "G:\My Coding Projects\Carbo-CIS"
git add -A
git commit -m "CIS rollout: default quality_viewer role, quality sheets tile"
git push origin master
```

(Quality-Platform only if you changed viewer/API auth recently — usually already deployed.)

---

## Step 2 — Server: Identity (roles)

```bash
ssh bkweb3dev@192.168.89.101

cd /opt/carbo/carbo-identity
git pull origin master

cd identity_api
unset DATABASE_URL
python seed_identity.py
sudo systemctl restart carbo-identity

curl -s http://127.0.0.1:8004/health
```

`seed_identity.py` updates the `quality_viewer` role to **view only** (removes capture).

---

## Step 3 — Server: Quality API (CIS login → viewer)

Ensure identity introspection is configured:

```bash
grep IDENTITY_API_URL /opt/carbo/quality-platform/quality_api/.env
# Should show: IDENTITY_API_URL=http://127.0.0.1:8004
```

If missing, add to `quality_api/.env` then:

```bash
sudo systemctl restart quality-api
curl -s http://127.0.0.1:8002/health
```

---

## Step 4 — Server: CIS web shell

```bash
cd /opt/carbo/carbo-cis
git pull origin master
bash sync_cis_shell_on_server.sh
```

Or from your PC (VPN on): `DEPLOY-SHELL.cmd`

Hard refresh in browser: **Ctrl+F5** on https://bkweb3.bigk.co.uk/cis/

Check `config.json` shows `"cisVersion": "1.3.3"`.

---

## Step 5 — Create staff users (admin)

1. Sign in as **admin** at https://bkweb3.bigk.co.uk/cis/
2. **Administration → Users & access → + New user**
3. User ID + display name; leave password blank
4. Role **`quality_viewer`** is pre-checked — leave it (uncheck admin)
5. Save → copy the personal invite link (`?user=...`) and send to the person
6. They set a password on first sign-in

---

## Step 6 — Smoke test (as a staff user)

1. Open invite link → set password → dashboard
2. **Production & quality → Reports & lookups → Quality sheets** — should open
3. Other tiles show **No access** (expected)
4. Browse a date / producer — data loads

If Quality sheets is blank or “unauthorized”:

```bash
# On server — identity reachable from quality?
curl -s http://127.0.0.1:8004/health
curl -s http://127.0.0.1:8002/health
```

---

## Give someone more later

| Need | Role / permission |
|------|-------------------|
| View sheets only | `quality_viewer` |
| Capture sieving (field) | add `quality.capture` or `operations` role |
| Fuel / fleet | `operations` or `finance` |
| User admin | `admin` |

Edit user in **Users & access** → check extra roles → Save.

---

## Quick checks

| URL | Expect |
|-----|--------|
| https://bkweb3.bigk.co.uk/cis/ | CIS login |
| https://bkweb3.bigk.co.uk/identity/api/health | `{"status":"ok",...}` |
| https://bkweb3.bigk.co.uk/quality/viewer/ | Viewer (device key or CIS iframe) |

**On the server**, do not curl your own public HTTPS URL for CIS (often hangs). Use localhost checks above.
