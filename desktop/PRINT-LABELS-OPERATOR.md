# Print Labels — operator guide (plant team)

Daily printing should be **three steps**. No USB cables. One-time setup is done by IT/admin.

## One-time setup (admin / IT)

Do this **once per label PC** (Windows laptop at the plant).

### 1. Install the app

- Run **Carbo Print Labels** from the Start menu (or install `CarboPrintLabels-Setup.exe`).
- Sign in with your normal CIS user.

### 2. Add printers in Windows (not USB)

**Settings → Bluetooth & devices → Printers & scanners → Add device → Add manually**

| Printer | Type | Address |
|---------|------|---------|
| **Zebra ZT231** (small bag labels) | TCP/IP, port **9100** | `192.168.8.73` |
| **A4 office printer** (pallet sheets) | TCP/IP or network name | (your office printer) |

For the Zebra: choose **Generic / Text Only** or **ZDesigner** driver if offered — we send raw ZPL.

### 3. Permanent LAN fix (run once at the plant)

**PowerShell as Administrator** in the `desktop` folder:

```powershell
cd "D:\My Coding Projects\Carbo-CIS\desktop"
Set-ExecutionPolicy -Scope Process Bypass
.\SETUP-ZEBRA-LAN.ps1
```

This checks ping + port 9100, creates a **LAN** Windows printer (`Zebra ZT231 LAN`), and tells you if port 9100 is still closed.

### 4. If port 9100 fails (ping OK, TCP fails)

Fix **on the Zebra** — not on the laptop:

| Method | What to do |
|--------|------------|
| **Network label** | Menu → **Print Network Configuration** — confirm IP is `192.168.8.73` |
| **Web UI** | Browser `http://192.168.8.73` → **Print Server** → port **9100** enabled |
| **Front panel** | Menu → **Network → Print Server** → **On** |
| **USB bridge (2 min)** | USB + [Zebra Setup Utilities](https://www.zebra.com/us/en/support-downloads/printer-software/printer-setup-utilities.html) → enable **Raw TCP 9100** → unplug USB → run `SETUP-ZEBRA-LAN.ps1` again |

**USB-installed printer shows Offline** when unplugged — that is normal. Do not use the USB queue for daily work; use **`Zebra ZT231 LAN`** after the script runs.

### 5. Printing hundreds of labels

In Carbo Print Labels: enter quantity (e.g. **100**), **Continue**, confirm once, **Print**. The app sends labels one-by-one to the printer — leave it running until complete.

---

## Daily use (operators)

1. Open **Carbo Print Labels** → sign in.
2. **Printer panel**
   - **Small labels:** pick the Zebra (network IP *or* Windows printer — whichever IT configured).
   - **A4 pallet sheets:** pick the A4 printer.
   - Click **Test Zebra connection** if using network IP (should say OK before a big print run).
3. **Print run**
   - Choose **Zebra** or **A4** format.
   - Enter **quantity** → **Continue** → confirm → **Print**.

If a run fails part-way, use **Reprint labels** for the missing Bag IDs.

---

## Which Zebra mode?

| Mode | When to use |
|------|-------------|
| **Windows printer name** | Easiest for operators — IT added the Zebra in Windows once. |
| **Network IP 192.168.8.73** | Direct LAN ZPL when port 9100 is open (no Windows driver needed). |

Both use the **network** — neither requires a USB cable.
