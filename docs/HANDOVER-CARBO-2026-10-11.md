# Carbo handover — 11 Oct 2026 (for Cursor on laptop at Carbo)

> **Field work 19 Oct 2026:** use **[HANDOVER-CARBO-2026-10-19.md](./HANDOVER-CARBO-2026-10-19.md)** (Bag Walk canonical status, ops float, pallet column, deploy HEADs).

Use this when you open **`G:\My Coding Projects`** (or your synced clone) **on VPN at Carbo**. Past chat: agent transcript `97a24333-d638-4b75-8888-b688fa4210e3`.

---

## Mindset / context (operational)

- Bags are being scanned at Carbo; **Bags Status V1** was confusing (Walvis dates, sort order). UI fixes are **live on `/cis/` only**.
- **V2 explorer prototype is active again** (12 Oct 2026) — see `docs/CIS-V2-ROADMAP.md`. Production default remains `/cis/` until cutover.
- Tomorrow’s real work is **process + data integrity**, not more shell polish:
  - **Assign dispatches** (Walvis dispatch module / truck loads).
  - **Packaging scheduling** (`packaging_shift` module + backend shifts).
  - **Correct loads sent to the wrong party** without breaking traceability — prefer **audit-backed status moves** and dispatch records over raw SQL deletes.
- Team bypassed workflow rules; any correction should **preserve `ct_audit_log`**, use official storage-status / dispatch APIs where possible, and document who/when/why.

---

## Git sync (laptop start-of-day)

From each repo folder (not the parent monorepo root):

| Repo | Branch | Remote |
|------|--------|--------|
| `Carbo-CIS/` | `master` | `git pull origin master` |
| `Charcoal-Traceability/` | `master` | `git pull origin master` |
| `Carbo-Identity/` | `master` | `git pull origin master` |
| `Carbo-Production/` | `main` | `git pull origin main` |

**Build PC state when handover written:** all Carbo repos **clean and pushed** except:

- `Charcoal-Traceability/` — **untracked local scratch** under `scripts/` and `_READONLY-REFERENCE-*` — **do not commit** unless you intend to.
- `Carbo-Identity/` — untracked `encryption notes.txt` — **do not commit**.
- `Carbo-Production/` — CRLF-only noise on `api/main.py` was **restored**; nothing to push.

---

## What shipped today (Carbo-CIS V1)

**Repo:** `Carbo-CIS` @ **`e9fdd46`** (deployed to nginx shell).

**Production URL:** https://bkweb3.bigk.co.uk/cis/ — **Ctrl+F5** after deploy.

| Commit | Summary |
|--------|---------|
| `e9fdd46` | **Status since** = last status change (`status_changed_at`, else `recorded_at`). **All bag lists** sort by that stamp, **newest first** (V1 only). |
| `fdb35b9` | Walvis rows no longer show factory intake date as “at Walvis since …”; Detail column no longer duplicates “since”. |
| `1635e49` | Sort gated: **`window.CIS_BS_DRILL_SORT_NEWEST_FIRST = true`** only in **`shell/index.html`** (V1). V2 prototype unchanged. |

**Cache bust:** `bags_status.js?v=1.6.31`

**V1 flag (must stay in production index.html):**

```html
<script>window.CIS_BS_DRILL_SORT_NEWEST_FIRST = true;</script>
<script src="modules/bags_status.js?v=1.6.31"></script>
```

**V2:** `shell/explorer-prototype/` — **beta** at `/cis/explorer-prototype/`. Keep module script tags in sync with V1 (including `CIS_BS_DRILL_SORT_NEWEST_FIRST`).

---

## Charcoal-Traceability (API)

**GitHub HEAD:** **`b3a7087`** — API drill sort reverted (ordering is **V1 shell only**).

**bkweb3:** traceability clone may still be at **`63393ea`** until you pull + restart. When at Carbo with VPN:

```bash
ssh bkweb3dev@192.168.89.101
cd /opt/carbo/charcoal-traceability && git pull origin master
sudo systemctl restart charcoal-traceability
git rev-parse HEAD   # expect b3a7087
```

Non-interactive SSH often **cannot sudo** — restart on server console if needed.

**Row timestamps:** `status_changed_at` from `storage_status_changed_at` or latest `bag_storage_status_changed` audit; see `_bags_status_row_dict` in `backend/traceability_routes.py`.

---

## Deploy workflow (mandatory at Carbo)

See **`.cursor/rules/carbo-git-commit-push.mdc`** in `G:\My Coding Projects`.

1. Commit → push the **repo you edited**.
2. SSH `bkweb3dev@192.168.89.101` (VPN).
3. **Carbo-CIS:** `cd /opt/carbo/carbo-cis && git pull origin master && bash deploy_on_server.sh`
4. **Charcoal-Traceability:** pull + `bash deploy_on_server.sh` + restart service.
5. Verify repo HEAD and nginx `index.html` script versions.

**From PC:** `Carbo-CIS\DEPLOY-SHELL.cmd` after push.

---

## Tomorrow’s task map

1. **Walvis dispatches** — `walvis_dispatches.js`, `walvis_dispatch.py`; assign loads; align `storage_status` with dispatch bags.
2. **Packaging scheduling** — `packaging_shift.js`, shift tables/API.
3. **Mis-assigned loads** — query current state + audit log; fix via supported transitions, not silent SQL; re-check Bags Status / Movement report.

---

## Cursor prompt (tomorrow)

> Read `Carbo-CIS/docs/HANDOVER-CARBO-2026-10-11.md`. V1 only, V2 parked. VPN on. Help assign Walvis dispatches, packaging scheduling, and correct mis-assigned loads with audit/traceability intact. Follow carbo-git-commit-push.

---

*11 Oct 2026*
