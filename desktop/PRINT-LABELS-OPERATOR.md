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

### 3. If `Test-NetConnection 192.168.8.73 -Port 9100` fails

Ping can work while port 9100 is blocked. Fix on the **printer or firewall**, not in the app:

1. Open the Zebra web page: `http://192.168.8.73` (from a PC on the same network).
2. Enable **raw TCP printing on port 9100** (Link-OS: *Print → Print Language ZPL*, communications TCP active).
3. Ask IT to allow **Wi‑Fi → printer** traffic on **TCP 9100** (plant firewall).

Until port 9100 works, use **Windows printer mode** in the app (pick the Zebra from the dropdown after adding it in Windows).

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
