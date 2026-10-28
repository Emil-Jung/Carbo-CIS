# Carbo Print Labels — install guide (manager PC)

**Version on this USB:** 1.6.17 (October 2026)

This folder is everything needed on a **manager laptop** that will print bag labels with a **Zebra ZT231** over **USB**. You do **not** need Git, Cursor, or VPN for normal use.

| File | Purpose |
|------|---------|
| **CarboPrintLabels-Setup.exe** | Install the Print Labels app (run once, or again to upgrade) |
| **INSTALL.md** | This guide |

---

## Before you start

1. **Network:** Open **Microsoft Edge** and go to **https://bkweb3.bigk.co.uk/cis/**  
   You should see the CIS sign-in page. If not, fix Wi‑Fi or LAN with IT first — the app cannot load bag IDs without this.
2. **Account:** You need a normal **CIS login** with **label print** permission (Identity admin can tick this under Users & access).
3. **Hardware:** Zebra **ZT231**, USB cable, label roll (**61 × 28 mm** standard unless IT says otherwise).

---

## Step 1 — Install Carbo Print Labels

1. Copy this folder from USB (or run directly from USB).
2. Double‑click **`CarboPrintLabels-Setup.exe`**.
3. If Windows asks for administrator approval, choose **Yes**.
4. Follow the installer (defaults are fine).
5. Open **Start → Carbo Print Labels**.
6. Sign in with your CIS user and password (same as web CIS).

---

## Step 2 — Install the Zebra printer driver (Windows)

The app sends labels through a **Windows printer queue**. Windows must have a working **Zebra driver** for your ZT231 before printing will work.

### Option A — USB cable (try this first)

1. **Power on** the Zebra and connect **USB** to the laptop.
2. Wait 1–2 minutes. Windows may install a driver automatically.
3. Open **Settings → Bluetooth & devices → Printers & scanners**.
4. You should see a new printer, often named like:
   - `ZDesigner ZT231-203dpi ZPL`, or  
   - `ZTC ZT231-203dpi ZPL`, or  
   - `Zebra ZT231`
5. Open the printer → **Print test page**. If a label or test prints, skip to **Step 3**.

### Option B — Install Zebra’s driver manually (if nothing appears or test fails)

1. On the same laptop, open a browser and go to Zebra’s support site for the **ZT231**:  
   **https://www.zebra.com/us/en/support-downloads/printers/desktop/zt231.html**
2. Under **Drivers**, download **ZDesigner Driver for Windows** (or **Zebra Setup Utilities for Windows** — it includes driver setup).
3. Run the installer **as Administrator** if prompted.
4. When the wizard asks how to connect, choose **USB** (printer plugged in and powered on).
5. Finish the wizard. Confirm the printer appears under **Settings → Printers & scanners** with a name like **`ZDesigner ZT231-203dpi ZPL`**.
6. **Print test page** again from Windows.

### Driver notes (important)

- Use a **ZPL** driver (ZDesigner / ZTC ZPL). Do **not** use a generic “Microsoft IPP” or photo printer driver for bag labels.
- **Leave the USB cable connected** while printing. If you unplug USB, the queue may show **Offline** — that is normal until you plug in again.
- This guide is for **USB on the manager laptop**. Plant label PCs that print over **network (LAN)** are set up differently by IT; you do **not** need LAN scripts for this USB workflow.

---

## Step 3 — Configure Carbo Print Labels

1. In the app, open the **Printer** section.
2. **Zebra label stock:** choose **61 × 28 mm (standard)** (or **54 × 25 mm (legacy)** only if that is the roll on the printer).
3. **Zebra connection:** use **Windows printer name** (not “network IP”).
4. In the dropdown, select the **exact name** from Windows (e.g. `ZDesigner ZT231-203dpi ZPL`).
5. Save / continue if the app asks.

---

## Step 4 — Test print

1. Choose **Zebra** label format (not A4 pallet unless you need pallet sheets).
2. Enter quantity **1** → **Continue** → confirm → **Print**.
3. One bag label should come out. If it does, setup is complete.

---

## Daily use

1. Open **Carbo Print Labels** → sign in.
2. Plug in **USB** if the printer was disconnected.
3. Confirm **Zebra** format and the correct **Windows printer** in the Printer panel.
4. Enter quantity → **Continue** → **Print**.
5. If a batch stopped part‑way, use **Reprint labels** for the missing bag IDs.

---

## If something fails

| Problem | What to try |
|---------|-------------|
| Cannot sign in | Open **https://bkweb3.bigk.co.uk/cis/** in Edge; check network with IT |
| “No permission” to print | Ask Identity admin for **label print** on your login |
| Zebra not in app dropdown | USB connected; check **Printers & scanners**; restart the app |
| Printer **Offline** | Reconnect USB; power‑cycle the Zebra; run **Print test page** in Windows |
| Wrong label size / bad print | Wrong **label stock** in app; reselect **61 × 28 mm**; test with quantity **1** |
| Driver missing | Repeat **Step 2 Option B** (ZDesigner driver from Zebra) |
| App looks old or wrong | Run **`CarboPrintLabels-Setup.exe`** again from a newer USB copy (overwrites in place) |

---

## Updates

IT or the dev team will give you a **new USB folder** with a newer **`CarboPrintLabels-Setup.exe`**. Install over the old version; your Windows printer setup stays the same.

*Questions about permissions or bkweb3 access: Identity / IT. Questions about label layout or app behaviour: Carbo dev team.*
