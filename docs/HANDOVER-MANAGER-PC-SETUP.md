# Manager PC — repo setup & Carbo Print Labels (Cursor handover)

**Purpose:** Set up **Git + Carbo-CIS** on a Windows PC at Carbo, build **`CarboPrintLabels-Setup.exe`**, and install on label-station PCs.  
**Paste the block in §1 into a new Cursor chat on that PC** so the agent knows the goal and constraints.

Last updated: 2026-10-27 (no-VPN / Git-only plant workflow).

---

## 0. No VPN on the manager PC — use Git only

The manager PC **does not** reach bkweb3 over VPN/SSH. That is fine. Use a **two-step pipeline**:

| Step | Where | VPN? | What |
|------|--------|------|------|
| **A. Publish source** | Home / dev PC (you) | Yes, when deploying server | `git push` to GitHub — **Carbo-CIS** `master` |
| **B. Build & install** | Manager PC at Carbo | **No** | `git pull` from GitHub → build installer → **USB or LAN copy** to label PCs |

**Manager PC must NOT rely on:** SSH to `192.168.89.101`, `scp`, `deploy_on_server.sh`, or downloading the installer from bkweb3.

**Manager PC DOES use:** **GitHub** (HTTPS) — same as any public Git host; no Carbo VPN required.

**Label PCs after install:** Print Labels still calls **`https://bkweb3.bigk.co.uk`** for sign-in and bag IDs. On the **plant/office network**, that is usually reachable **without VPN** (normal HTTPS). If sign-in fails, check browser access to `https://bkweb3.bigk.co.uk/cis/` from that PC — that is a network/firewall issue, not Git.

**Installer never goes through Git.** After `git pull`, you **build** `CarboPrintLabels-Setup-<version>.exe` locally and copy the file to each station.

---

## 1. Cursor brief (copy everything below this line into Cursor)

```markdown
You are helping set up the Carbo manager/build PC and release **Carbo Print Labels** for plant installation.

## Goal
1. Clone/update **Carbo-CIS** from GitHub (`Emil-Jung/Carbo-CIS`, branch `master`).
2. Install build prerequisites (Python 3, pip deps, Inno Setup 6).
3. Run `desktop\BUILD-PRINT-LABELS.cmd` then `desktop\BUILD-PRINT-LABELS-INSTALLER.cmd`.
4. Produce `desktop\installer\Output\CarboPrintLabels-Setup-<version>.exe` and install it on each label PC (or copy via USB).

## Important facts
- **This PC has NO VPN.** Do not use SSH/scp to bkweb3. Workflow: **git pull → build installer → copy .exe to label PCs** (USB or shared folder).
- **Print Labels is NOT updated by CIS web deploy on bkweb3.** The UI ships inside **CarboPrintLabels-Setup.exe**. See `desktop/DEPLOY-PRINT-LABELS-INSTALLER.md`.
- The **`.exe` installer is gitignored**; only **source** is in Git. You must **build** on Windows after every `git pull` that changes Print Labels.
- Label PCs need **HTTPS** to `https://bkweb3.bigk.co.uk` for login and bag IDs (typically works on Carbo office/plant LAN without VPN).
- Default Zebra LAN: **192.168.8.73:9100** — confirm at the plant.
- **Do not** commit `.env`, passwords, or build outputs. **Do not** force-push `master`.

## Repo path (adjust drive letter)
Use one stable folder, e.g. `D:\Carbo\Carbo-CIS` or `G:\My Coding Projects\Carbo-CIS`.

## When done
Report: Git commit hash, installer filename + version from `desktop/version.py`, and confirm the app opens and shows sign-in.

## Reference docs in repo
- `desktop/PRINT-LABELS-OPERATOR.md` — plant operators + Zebra setup
- `desktop/DEPLOY-PRINT-LABELS-INSTALLER.md` — build/publish policy
- `desktop/SETUP-ZEBRA-LAN.ps1` — one-time Zebra LAN printer on label PCs
```

---

## 2. One-time: tools on the manager PC

| Tool | Purpose |
|------|---------|
| **Git for Windows** | Clone/pull Carbo-CIS |
| **Python 3.10+** (3.11 or 3.12 OK) | Build; tick “Add python.exe to PATH” |
| **Inno Setup 6** | Build `CarboPrintLabels-Setup.exe` |
| **Cursor** (optional) | Same as build PC; paste §1 |

Install Inno Setup if missing:

```powershell
winget install JRSoftware.InnoSetup --source winget
```

Verify:

```powershell
git --version
python --version
python -m pip --version
```

---

## 3. Clone Carbo-CIS (first time)

```powershell
mkdir D:\Carbo -Force
cd D:\Carbo
git clone https://github.com/Emil-Jung/Carbo-CIS.git
cd Carbo-CIS
git checkout master
git pull origin master
```

**GitHub auth:** If `git clone` / `git pull` asks for credentials, sign in with GitHub (HTTPS token or `gh auth login`). This repo is private to your org/user.

**Only Carbo-CIS is required** for Print Labels. Other Carbo repos (Identity, Traceability) run on **bkweb3** — not needed on the manager PC unless you also develop CIS shell there.

---

## 4. Daily: get latest before a release

```powershell
cd D:\Carbo\Carbo-CIS
git status
git pull origin master
```

- If `git pull` fails with “local changes would be overwritten”, **do not** discard work blindly. Run `git status`, stash or commit intentional changes, or ask Cursor to compare with `origin/master`.
- Expected latest handover-related work lives on **`master`**; note `git rev-parse --short HEAD` after pull (e.g. `739c976` or newer).

---

## 5. Build the Print Labels installer

```powershell
cd D:\Carbo\Carbo-CIS\desktop

# 1) PyInstaller app folder
.\BUILD-PRINT-LABELS.cmd

# 2) Inno Setup installer (.exe)
.\BUILD-PRINT-LABELS-INSTALLER.cmd
```

**Success output:**

- App: `desktop\dist\Carbo Print Labels\Carbo Print Labels.exe`
- Installer: `desktop\installer\Output\CarboPrintLabels-Setup-<version>.exe`  
  Version **`<version>`** comes from `desktop\version.py` → `CIS_VERSION` (e.g. `1.6.17`).

**If BUILD fails:**

- Re-run pip: `python -m pip install -r requirements-print-labels.txt`
- Close any running “Carbo Print Labels” (build script tries `taskkill`).
- Confirm Inno path (script searches Program Files for `ISCC.exe`).

---

## 6. Install on label PCs (tomorrow at Carbo)

1. Copy **`CarboPrintLabels-Setup-<version>.exe`** to each label PC (USB, share, or internal copy).
2. Close **Carbo Print Labels** if open.
3. Run the installer (upgrade over old install is OK).
4. Start **Carbo Print Labels** from Start menu → sign in with **normal CIS user** (same as web CIS).
5. **One-time on each label PC:** follow **`desktop/PRINT-LABELS-OPERATOR.md`** (Zebra LAN, label stock size, test print).

**Distribution without VPN (normal at Carbo):**

- Copy `desktop\installer\Output\CarboPrintLabels-Setup-<version>.exe` to a **USB stick** or **Windows file share**, then run on each label PC.
- Use the **same .exe file** on all label stations so versions stay matched.

**Optional (dev PC with VPN only):** upload the same `.exe` to bkweb3 so others can download from CIS — **not required** if you install from USB/share. See `desktop/DEPLOY-PRINT-LABELS-INSTALLER.md` §3.

---

## 7. What is *not* in Git

| Item | Location |
|------|----------|
| Built installer | `desktop/installer/Output/*.exe` (local only until you copy) |
| PyInstaller dist | `desktop/dist/` (gitignored) |
| Full CIS desktop installer | `desktop/cis_download/` (separate from Print Labels) |

---

## 8. Other Carbo repos (reference)

If you later set up a **full dev PC** at Carbo, these are the usual clones (all **`Emil-Jung`** on GitHub):

| Folder | Branch | Role |
|--------|--------|------|
| `Carbo-CIS` | `master` | CIS shell, Print Labels **source**, deploy scripts |
| `Charcoal-Traceability` | `master` | Traceability API, Bag Walk, kiosks |
| `Carbo-Identity` | `master` | Login & permissions |
| `Carbo-Production` | `main` | Production API |

**Server deploy** (SSH/VPN — **not on manager PC**): only from a dev machine that can reach bkweb3. **Print Labels rollout at Carbo = Git pull + local build + copy installer.**

---

## 8b. Dev PC (with VPN) — before the manager pulls

When you change Print Labels or CIS shell on the dev PC:

```powershell
cd "G:\My Coding Projects\Carbo-CIS"
git add …   # intentional files only
git commit -m "…"
git push origin master
```

Tell the manager: **“Pull and rebuild Print Labels.”** They run §4–§6; no server access needed.

---

## 9. Troubleshooting (quick)

| Symptom | Check |
|---------|--------|
| Sign-in fails | From that PC, open `https://bkweb3.bigk.co.uk/cis/` in Edge (VPN **not** required on plant LAN). If blocked, fix firewall/DNS with IT — not Git. |
| `git pull` fails | GitHub login/token; internet on manager PC |
| No bag IDs / print run errors | Traceability API on server; user needs label-print permission in Identity |
| Zebra won’t print | `SETUP-ZEBRA-LAN.ps1` as Admin; port **9100**; printer queue **Zebra ZT231 LAN** |
| App UI old but login works | Old installer — rebuild and reinstall **CarboPrintLabels-Setup.exe** on that PC |
| Cursor agent edits wrong repo | Confirm cwd is `Carbo-CIS` root; Carbo commit rules apply only to Carbo repos |

---

## 10. Identity permission (admin)

Print Labels uses CIS login. Users need label-print access in **Users & access** (Identity). Catalog key is tied to the print-labels module (not “Dispatch”). If operators can sign in but cannot allocate/print, grant the **label print** permission for their login — ask whoever administers Identity on bkweb3.

---

*End of handover. Keep this file in the repo; after policy changes, update §1 Cursor brief and bump “Last updated”.*
