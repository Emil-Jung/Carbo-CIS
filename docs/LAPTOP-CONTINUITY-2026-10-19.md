# Laptop continuity — Carbo dev (19 Oct 2026)

Use this when moving from the **build PC** to the **laptop**. Open workspace **`G:\My Coding Projects`** (or your synced clone), then **@ this file** in a new Agent chat.

**Agent transcript ID (build PC):** `97a24333-d638-4b75-8888-b688fa4210e3`  
**Older handover:** `docs/HANDOVER-CARBO-2026-10-11.md` (partially stale — prefer this doc).

---

## Standing rules (tell the agent if it forgets)

1. **CIS V1 only** — production is https://bkweb3.bigk.co.uk/cis/ (`shell/index.html`, `shell/modules/*`). **Do not** change or deploy V2 (`shell/explorer-prototype/`) unless you explicitly ask for **V2 transition**.
2. **Carbo workflow** — after code changes: commit + push + **deploy on bkweb3** + verify (see workspace `.cursor/rules/carbo-git-commit-push.mdc` on build PC).
3. **New Identity permissions** — catalog only, default OFF; no bulk SQL grants (see `carbo-identity-permissions-default-off.mdc`).

---

## Git — what to pull (source of truth)

Run from each repo folder:

| Repo | Branch | Command |
|------|--------|---------|
| `Carbo-CIS/` | `master` | `git pull origin master` |
| `Charcoal-Traceability/` | `master` | `git pull origin master` |
| `Carbo-Identity/` | `master` | `git pull origin master` |
| `Carbo-Production/` | `main` | `git pull origin main` |

**Build PC state (19 Oct 2026):** all four repos **clean, pushed, match origin**.

| Repo | HEAD | Notes |
|------|------|--------|
| Carbo-CIS | `7309320` | Pallet config active/inactive blocks; containers UI; dashboard reports layout |
| Charcoal-Traceability | `4726751` | Container Option A + manifest API + migration `046` |
| Carbo-Identity | `55865b7` | No changes this session |
| Carbo-Production | `29cc2f0` | No changes this session |

**Local-only (do not expect on GitHub):** Traceability `scripts/_*` scratch files; Identity `encryption notes.txt`.

**bkweb3:** CIS shell deployed at `7309320`; Traceability API at `4726751` (VPN + `bkweb3dev@192.168.89.101`).

---

## What we built recently (context for the agent)

### Carbo-CIS
- **Dashboard** — Reports & lookups rows match Applications 4-column grid; shortened tile descriptions for some modules.
- **Walvis Bags Status** — simpler dispatch tiles (name, bag count, received date).
- **Containers** — booking fields, Walvis dispatch link, print manifest (+ EUDR placeholder).
- **Pallet configuration** — **Active products** and **Inactive products** as two separate blocks (not one Status column).

### Charcoal-Traceability
- **Container manifest** — load metadata, optional `walvis_dispatch_id`, eligibility when scanning **Into container**.
- Migration **`046_ct_container_manifest_up.sql`**.

### Open / deferred (office session)
- Container UX: **Yard**, **Tare**, **Shipping company** label, dispatch dropdown length — may **revert Option A** after office review.
- EUDR manifest layout TBD.
- Cross-cutting **dropdown hygiene** later.

---

## Part A — On the build PC (before you leave)

Do these once while still on the machine that has this chat.

### A1. Confirm GitHub is current

```powershell
cd "G:\My Coding Projects\Carbo-CIS"
git fetch origin
git status -sb
git rev-parse HEAD
# Expect: ## master...origin/master and HEAD 7309320 (or newer if you pulled after this doc)
```

Repeat for `Charcoal-Traceability`, `Carbo-Identity`, `Carbo-Production`.

### A2. Pull this handoff on the laptop later

This file is in **`Carbo-CIS/docs/`** — it travels with `git pull`. No export menu required.

### A3. Sync workspace Cursor rules (not in Git)

The **parent** folder rules live only on disk unless you sync them:

| Copy this | To laptop |
|-----------|-----------|
| `G:\My Coding Projects\.cursor\rules\` | Same path under your workspace root |

Files: `carbo-git-commit-push.mdc`, `carbo-identity-permissions-default-off.mdc`.

Repo-level rules (`Carbo-CIS/.cursor/rules/`, etc.) **are** on GitHub.

### A4. User Rules (Cursor account / manual)

Cursor **Settings → Rules → User Rules** may sync if you use Settings Sync; if not, paste the block from **Appendix: User rule snippet** below on both machines.

### A5. Optional — raw chat backup (no Export UI)

Copy the Agent transcript folder (Cursor closed optional but safer):

```
From: C:\Users\Administrator\.cursor\projects\g-My-Coding-Projects\agent-transcripts\97a24333-d638-4b75-8888-b688fa4210e3\
To:   OneDrive or USB (e.g. CARBO-CHAT-BACKUP-2026-10-19\)
```

Main file: `97a24333-d638-4b75-8888-b688fa4210e3.jsonl`. On laptop, @ that file in a new chat if needed.

### A6. Optional — find Export in Cursor

1. Open this chat focused → `Ctrl+Shift+P` → type `Export` → **Export Chat** / **Export Transcript**.
2. Or **⋯** on the **chat panel header** (not always top-right of window).
3. Or right-click the **chat tab** → Export Transcript.  
Cloud Agent threads may not support export.

---

## Part B — On the laptop (first session)

### B1. Same folder path (strongly recommended)

Open the project as **`G:\My Coding Projects`** if your sync drive uses that letter. Different paths (`C:\Users\…` vs `G:\…`) = Cursor treats it as a **new workspace**; old chats will not attach.

### B2. Clone or pull repos

If fresh machine: clone the four GitHub repos into the same folder names as above.  
If existing clone: run the **git pull** table in this doc.

### B3. Install / open Cursor

- Sign in with the **same Cursor account** as the build PC.
- **File → Open Folder** → `G:\My Coding Projects` (whole workspace, not a single repo only).

### B4. VPN

Required for bkweb3 SSH/deploy: `bkweb3dev@192.168.89.101`.

### B5. First Agent message (copy/paste template)

```
Continuing Carbo work from the build PC (19 Oct 2026).

@Carbo-CIS/docs/LAPTOP-CONTINUITY-2026-10-19.md

CIS V1 only until I say V2 transition. Repos pulled. Pick up open items from the doc (containers office review, etc.).
```

Attach optional `@` to your copied `.jsonl` transcript if the agent needs deeper history.

### B6. Verify live vs git (optional)

After VPN on: CIS https://bkweb3.bigk.co.uk/cis/ — hard refresh; pallet config should show Active / Inactive blocks at commit `7309320` or later.

---

## Appendix: User rule snippet (paste in Cursor User Rules)

```markdown
Carbo CIS: Production V1 only (https://bkweb3.bigk.co.uk/cis/, shell/modules). Park V2 explorer-prototype unless I say "V2 transition".

When editing Carbo repos from G:\My Coding Projects: implement, commit, push, deploy bkweb3, verify — do not stop at "pull on server."

Laptop continuity handoff: Carbo-CIS/docs/LAPTOP-CONTINUITY-2026-10-19.md
```

---

## Appendix: Deploy quick reference

| Repo | Server path | After `git pull` |
|------|-------------|------------------|
| Carbo-CIS | `/opt/carbo/carbo-cis` | `bash deploy_on_server.sh` (copies shell to nginx) |
| Charcoal-Traceability | `/opt/carbo/charcoal-traceability` | `bash deploy_on_server.sh` |
| Carbo-Identity | `/opt/carbo/carbo-identity` | `bash deploy_on_server.sh` |

CIS shell is **not** updated by pull alone — **deploy_on_server.sh** is required for browser changes.
