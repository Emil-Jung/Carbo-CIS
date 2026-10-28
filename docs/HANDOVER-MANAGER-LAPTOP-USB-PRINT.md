# Manager laptop — Print Labels USB pack (dev copy)

**Manager-facing guide:** `docs/MANAGER-PRINT-LABELS-INSTALL.md` (copy to Dropbox as **`INSTALL.md`**).  
Handover folder `Carbo-Exchange\Carbo-Print-Labels\` should contain only:

- `CarboPrintLabels-Setup.exe`
- `INSTALL.md` (same content as `MANAGER-PRINT-LABELS-INSTALL.md`)

---

## Dev PC — build and copy to USB / Dropbox

```powershell
cd "G:\My Coding Projects\Carbo-CIS\desktop"
.\BUILD-PRINT-LABELS.cmd
.\BUILD-PRINT-LABELS-INSTALLER.cmd
```

Copy to the handover folder:

- `desktop\installer\Output\CarboPrintLabels-Setup.exe` (or rename the versioned output to this name)
- Copy **`docs/MANAGER-PRINT-LABELS-INSTALL.md`** → **`INSTALL.md`**; update the version line if the app version changed

The `.exe` is **not** in GitHub — build on a machine that has the repo.

---

## Manager PC (summary)

Full steps (Zebra driver, app, test print): see **`INSTALL.md`** in the USB folder.

1. Run **`CarboPrintLabels-Setup.exe`**
2. Install **ZDesigner / ZPL** driver for **ZT231** (USB) — see INSTALL.md Step 2
3. App: **Windows printer name**, stock **61 × 28 mm**, test print quantity **1**
4. Network: **https://bkweb3.bigk.co.uk/cis/** must load in a browser

No Git on the manager laptop. Updates = new installer from dev.
