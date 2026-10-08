# Upload Carbo Print Labels installer to bkweb3

After fixing A4 print (`CreatePrinterDC`), build on a Windows dev PC and upload.

## 1. Build (Windows)

```powershell
cd "D:\My Coding Projects\Carbo-CIS\desktop"
.\BUILD-PRINT-LABELS.cmd
```

Requires: Python 3, `pip install pyinstaller pywin32 pywebview qrcode pillow`

## 2. Installer (Inno Setup)

```powershell
cd "D:\My Coding Projects\Carbo-CIS\desktop"
# ISCC from Inno Setup install, e.g.:
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" /DAppVer=1.6.4 installer\print_labels.iss
```

Output: `desktop\installer\Output\CarboPrintLabels-Setup.exe`

## 3. Upload to server

```bash
scp "desktop/installer/Output/CarboPrintLabels-Setup.exe" \
  bkweb3dev@192.168.89.101:/opt/carbo/cis/app/CarboPrintLabels-Setup.exe
```

Or copy via USB/RDP to `/opt/carbo/cis/app/`.

CIS config points here: `"printLabelsInstallerUrl": "/cis/app/CarboPrintLabels-Setup.exe"`

## 4. Install on plant PC

- Run `CarboPrintLabels-Setup.exe` (or download from CIS Labels tile)
- Add network/USB printers in **Windows Settings** first
- In app: **Refresh printer list** → pick A4 printer under **A4 pallet sheets**

Version **1.6.4** fixes A4 `CreatePrinterDC` / pywin32 printing.
