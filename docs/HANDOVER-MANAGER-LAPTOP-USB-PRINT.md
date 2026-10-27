# Manager laptop — Print Labels only (no Git, USB Zebra)

Use this when the manager PC **does not** clone Carbo-CIS. Copy **`CarboPrintLabels-Setup.exe`** on a USB stick (built on the dev PC), install once, print with the Zebra on **USB**.

---

## A. Dev PC (you) — put files on USB

1. Build (if you do not already have a fresh installer):

   ```powershell
   cd "G:\My Coding Projects\Carbo-CIS\desktop"
   .\BUILD-PRINT-LABELS.cmd
   .\BUILD-PRINT-LABELS-INSTALLER.cmd
   ```

2. Copy to USB:

   - `desktop\installer\Output\CarboPrintLabels-Setup-<version>.exe`
   - This file: `docs\HANDOVER-MANAGER-LAPTOP-USB-PRINT.md` (optional)

No VPN or bkweb3 needed to build. The `.exe` is **not** in GitHub — only you can produce it on a machine that has the repo.

---

## B. Manager laptop — install app

1. Plug USB → run **`CarboPrintLabels-Setup.exe`** (admin if Windows asks).
2. Start **Carbo Print Labels** from the Start menu.
3. Sign in with a normal **CIS user** that has **label print** permission.
4. Confirm the laptop can open **`https://bkweb3.bigk.co.uk/cis/`** in a browser (plant network; VPN not required). Without that, bag IDs will not load.

---

## C. Zebra ZT231 — USB (LAN not used)

1. Connect Zebra to the laptop with **USB**.
2. Windows: **Settings → Printers & scanners** — let the driver install (or use Zebra’s driver if prompted).
3. Note the **exact printer name** in Windows (e.g. `ZDesigner ZT231-203dpi ZPL` or `ZTC ZT231-203dpi ZPL`).
4. In **Carbo Print Labels → Printer**:
   - **Zebra label stock:** **61 × 28 mm (standard)** unless using old small rolls (54 × 25 mm).
   - Use **Windows printer name** (not “network IP” mode).
   - Select the **USB** queue from the dropdown.
5. Print a **small test** (quantity **1**) before a large run.
6. **Leave USB connected** while printing. If the cable is unplugged, the Windows queue often shows **Offline** — that is normal for USB.

You do **not** need `SETUP-ZEBRA-LAN.ps1` for this workflow.

---

## D. Daily printing (manager)

1. Open app → sign in.
2. Choose **Zebra** (not A4 pallet unless needed).
3. Enter quantity → **Continue** → confirm → **Print**.
4. For a failed batch, use **Reprint labels** for the missing Bag IDs.

---

## E. If something fails

| Problem | What to try |
|---------|-------------|
| Cannot sign in | Open `https://bkweb3.bigk.co.uk/cis/` in Edge; fix Wi‑Fi/LAN with IT |
| No permission to print | Identity admin grants label-print access for that login |
| Zebra not in dropdown | USB plugged in; check Printers & scanners; reboot app |
| Print job errors | Wrong stock size selected; try Test print; reselect Windows printer |
| App looks old | Install a newer `CarboPrintLabels-Setup.exe` from USB (over install) |

---

*No Git on the manager laptop. Updates = new `.exe` on USB from the dev PC.*
