# Manager PC — repo setup & Carbo Print Labels (Cursor handover)

**Purpose:** Set up **Git + Carbo-CIS** on a Windows PC at Carbo, build **`CarboPrintLabels-Setup.exe`**, and install on label-station PCs.  
**Paste the block in §1 into a new Cursor chat on that PC** so the agent knows the goal and constraints.

Last updated: 2026-10-27 (align with `origin/master` after pull).

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
- **Print Labels is NOT updated by CIS web deploy on bkweb3.** The UI ships inside **CarboPrintLabels-Setup.exe**. See `desktop/DEPLOY-PRINT-LABELS-INSTALLER.md`.
- The **`.exe` installer is gitignored**; only **source** is in Git. You must **build** on Windows.
- Label PCs need **network** to bkweb3 for login and bag ID APIs (`https://bkweb3.bigk.co.uk/...`). VPN may be required off-site.
- Default Zebra LAN in CIS config: **192.168.8.73:9100** (`shell/config.json` → `zebraPrinterHost` / `zebraPrinterPort`). Plant LAN may differ — confirm with IT.
- **Do not** commit `.env`, passwords, or `encryption notes.txt`. **Do not** force-push `master`.

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

**Optional — same installer on bkweb3 download link** (VPN + SSH):

```powershell
scp "D:\Carbo\Carbo-CIS\desktop\installer\Output\CarboPrintLabels-Setup-1.6.17.exe" `
  bkweb3dev@192.168.89.101:/opt/carbo/cis/app/CarboPrintLabels-Setup.exe
```

Then browsers can use: `https://bkweb3.bigk.co.uk/cis/app/CarboPrintLabels-Setup.exe`  
(Replace version in filename with your built file; server name must stay **`CarboPrintLabels-Setup.exe`**.)

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

Server deploy (VPN): SSH `bkweb3dev@192.168.89.101`, paths under `/opt/carbo/`. **Print Labels plant rollout does not require server deploy** — only the installer on PCs.

---

## 9. Troubleshooting (quick)

| Symptom | Check |
|---------|--------|
| Sign-in fails | VPN? `https://bkweb3.bigk.co.uk/cis/` reachable in browser? |
| No bag IDs / print run errors | Traceability API on server; user needs label-print permission in Identity |
| Zebra won’t print | `SETUP-ZEBRA-LAN.ps1` as Admin; port **9100**; printer queue **Zebra ZT231 LAN** |
| App UI old but login works | Old installer — rebuild and reinstall **CarboPrintLabels-Setup.exe** on that PC |
| Cursor agent edits wrong repo | Confirm cwd is `Carbo-CIS` root; Carbo commit rules apply only to Carbo repos |

---

## 10. Identity permission (admin)

Print Labels uses CIS login. Users need label-print access in **Users & access** (Identity). Catalog key is tied to the print-labels module (not “Dispatch”). If operators can sign in but cannot allocate/print, grant the **label print** permission for their login — ask whoever administers Identity on bkweb3.

---

*End of handover. Keep this file in the repo; after policy changes, update §1 Cursor brief and bump “Last updated”.*
