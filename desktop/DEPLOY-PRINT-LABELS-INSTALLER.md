# Carbo Print Labels — release to plant PCs

Print Labels is a **standalone Windows app**. The UI and ZPL layout ship **inside** `CarboPrintLabels-Setup.exe`. Deploying CIS on bkweb3 **does not** change label PCs until you run a **new Print Labels installer** on each machine.

## Policy

| Changes with… | What |
|---------------|------|
| **CarboPrintLabels-Setup.exe** on each PC | Screen, label layout, printer bridge, app version |
| **bkweb3 / CIS deploy** | CIS dashboard only (not Print Labels UI) |
| **Internet on label PC** | Login and bag ID APIs only (same as before) |

Roll out the **same installer file** to all label PCs (e.g. three stations) so they stay on one version until the next deliberate release.

## 1. Build (Windows dev PC)

```powershell
cd "D:\My Coding Projects\Carbo-CIS\desktop"
.\BUILD-PRINT-LABELS.cmd
```

Requires: Python 3, `pip install -r requirements-print-labels.txt`

`BUILD-PRINT-LABELS.cmd` regenerates `desktop/assets/print_labels.ico` (embedded in the `.exe` and installer wizard) and updates `shell/assets/print_labels-icon-*.png` for the in-app favicon.

## 2. Installer (Inno Setup)

```powershell
.\BUILD-PRINT-LABELS-INSTALLER.cmd
```

Output: `desktop\installer\Output\CarboPrintLabels-Setup-<version>.exe`  
Version comes from `version.py`.

## 3. Publish installer (optional download link)

Upload as the fixed name CIS serves:

```bash
scp "desktop/installer/Output/CarboPrintLabels-Setup-<version>.exe" \
  bkweb3dev@192.168.89.101:/opt/carbo/cis/app/CarboPrintLabels-Setup.exe
```

Or copy the `.exe` by USB to each plant PC — **that is the normal path for the three label stations**.

## 4. Install on each label PC

1. Close **Carbo Print Labels** if open.
2. Run **CarboPrintLabels-Setup.exe** (reinstall over the top is OK).
3. Open **Start → Carbo Print Labels**.
4. Confirm the top bar shows **`bundled`** and build **`20261020-bundled-only`** (or newer after your release).

Dev-only shortcut to copy `dist\` without Inno: `SYNC-PRINT-LABELS-TO-INSTALL.cmd` — **not** for plant rollout; use the installer on operator PCs.
