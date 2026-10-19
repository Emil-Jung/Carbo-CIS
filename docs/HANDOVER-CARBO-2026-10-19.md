# Carbo handover — 19 Oct 2026 (Monday floor recovery)

Use at **Carbo on VPN** with workspace **`G:\My Coding Projects`**.  
Past chat: agent transcript `97a24333-d638-4b75-8888-b688fa4210e3`.

**Production CIS:** https://bkweb3.bigk.co.uk/cis/ — **V1 only** (`/cis/`). Do not change V2 unless explicitly asked.

---

## Your focus today at Carbo

1. **Walvis dispatches** — assign / reconcile open truck load (truck may not have arrived; dispatch stays **open** until office closes it). Use CIS → Traceability → Walvis dispatch.
2. **Link dispatch ↔ container** — when **container loading** is released in CIS → Containers, yard scans use **Into container**; ops float shows **Container loading** lines only while a booking is released and not full.
3. **Staff** — Bag Walk: **scan only**, no Settings scan-site / Walvis mode (removed). Same behaviour on phone and Zebra after app refresh.

**Do not refactor sieving / Control Room / intake** — that path has been stable since go-live; touch only when asked.

---

## Non-negotiable architecture (traceability)

| Rule | Meaning |
|------|--------|
| **Bag `storage_status` is canonical** | Legal moves = `STATUS_TRANSITIONS` + `transition_allowed()` in `Charcoal-Traceability/backend/bag_storage.py`. |
| **No scanner “location modes”** | Removed device label → profile, Scan site Settings, `X-Bag-Walk-Site`, `walvis_yard_scan` gates (commits through `61e4ee5`). |
| **Location interpretation later** | Yard/factory intelligence can return once the floor trusts status-only Bag Walk again. |
| **Ops float = live sessions only** | Sieving truck, packaging shift(s), **open** Walvis dispatch, **released** container loading — not label parks / label deployment fencing. |

**Bag Walk PWA:** service worker **v87** (`20261019-bag-status-canonical`). Floor: **close and reopen** Bag Walk once so Zebras drop old cache — not a Settings change.

---

## bkweb3 deploy state (verified 19 Oct 2026)

| Repo | Branch | HEAD | Deploy |
|------|--------|------|--------|
| **Charcoal-Traceability** | `master` | `46da4f6` | `cd /opt/carbo/charcoal-traceability && git pull && bash deploy_on_server.sh` (restarts API on **8005**) |
| **Carbo-CIS** | `master` | `76d6912` | `cd /opt/carbo/carbo-cis && git pull && bash deploy_on_server.sh` (copies shell → `/opt/carbo/cis/shell/`) |

**Public API smoke:** `https://bkweb3.bigk.co.uk/traceability/api/v1/config` → 200.

**CIS cache busts (view source after Ctrl+F5):**

- `bags_status.js?v=1.6.54-pallet-traceability-column`
- `operations_summary.js?v=1.4.4-ops-float-sessions`

SSH: `bkweb3dev@192.168.89.101` (VPN). From PC after CIS push: `Carbo-CIS\DEPLOY-SHELL.cmd`.

---

## What shipped 18–19 Oct (summary)

### Bag Walk / API (Charcoal-Traceability)

| Commit | What |
|--------|------|
| `61e4ee5` | Remove scanner modes — status-only next steps and saves |
| `1adc00d` / `a6b87af` | Zero floor config; clear legacy Walvis localStorage |
| `2ce946e` | Ops summary API: container loading; drop label deployments from float data |
| `46da4f6` | Pallet rows: `content_traceability` (SKU + source makeup) |

### CIS V1 shell (Carbo-CIS)

| Commit | What |
|--------|------|
| `da70d9f` | Ops float UI: Walvis manifest progress; container loading; no label park/deployment |
| `76d6912` | Bags Status drill column **Source / traceability** (pallets ≠ bulk producer) |

---

## Active operations float (bottom-right)

| Line | When it appears |
|------|-----------------|
| **Sieving** | Control Room active truck (slot 1) |
| **Packaging** | Active packaging shift SKU(s) in catalog |
| **Walvis dispatch** | `ct_walvis_dispatch.status = 'open'` (released load) + bag counts on manifest when planned |
| **Container loading** | Container **released for loading**, not full (`operations_summary.py` → `container_loading[]`) |

Label deployment / labels parked remain in **Traceability → Label Fencing** — not on the float.

---

## Bags Status — pallet BAG IDs

- Column **Source / traceability** (was **Producer**).
- **Bulk bags:** farm/producer from intake.
- **Pallet BAG ID:** e.g. `DOM04 · 1 source · Farm name` or `LF2.5 · Mixed (3 sources) — tap for split`.
- Tap row for source bulk allocations (unchanged drill-down).

---

## Git on laptop (start of session)

```text
git pull origin master   # in Charcoal-Traceability, Carbo-CIS
```

Do **not** commit untracked scratch under `Charcoal-Traceability/scripts/` or `_READONLY-REFERENCE-*`.

---

## Deploy workflow (mandatory after code edits)

See **`.cursor/rules/carbo-git-commit-push.mdc`**.

1. Commit + push the repo you edited.
2. SSH bkweb3 → pull + deploy script per repo above.
3. Verify server `git rev-parse HEAD` and nginx `index.html` script `?v=` matches commit.

---

## Cursor prompt (at Carbo)

> Read `Carbo-CIS/docs/HANDOVER-CARBO-2026-10-19.md`. V1 CIS only. Help with Walvis dispatch assignment, container release/loading linkage, and data fixes via supported storage-status / dispatch APIs — not silent SQL. Bag status is canonical; no new scanner modes. Follow carbo-git-commit-push.

---

## Older handover

`HANDOVER-CARBO-2026-10-11.md` — Bags Status sort / Walvis date display (still valid background); superseded for **19 Oct floor** by this file.

*19 Oct 2026*
