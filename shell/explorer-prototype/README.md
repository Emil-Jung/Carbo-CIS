# CIS Shell V2.0 — visual prototype

Responsive **desktop + smartphone** shell (320px–desktop). Mobile navigation uses the **menu button** and slide-in drawer (Ask Emil, Settings, and all module labels).

Landing order: **greeting + landscape banner**, then **operational dashboard** (KPI cards, tables, shortcuts).

Static **visual mashup** of:

- **Option B (Modern Carbo)** — warm ivory workspace, light cards, restrained status colours, comfortable typography and spacing.
- **Option C (Bold Carbo)** — charcoal sidebar, Namibian landscape identity (hero + accents), energetic gold, Ask Emil, settings attention dot.

V2 chrome wraps the **production module scripts** in the right workspace (`explorer-v2-cis-bridge.js`) using your existing `/cis/` session token. The **sample dashboard** (banner + KPI cards) stays on Dashboard; other nav items open real CIS modules. Production entry remains [`/cis/`](../index.html).

Navigation map: [NAV-MAP.md](./NAV-MAP.md).

## View locally

```powershell
cd "G:\My Coding Projects\Carbo-CIS\shell\explorer-prototype"
python -m http.server 8765
```

Open http://127.0.0.1:8765/

## View on bkweb3 (after deploy)

https://bkweb3.bigk.co.uk/cis/explorer-prototype/

## Design references

Approved PNGs and usage: see [ASSETS.md](./ASSETS.md).

## Files

| File | Role |
|------|------|
| `index.html` | Layout and sample operational content |
| `explorer-v2-themes.css` | Theme tokens (`data-cis-v2-theme`; default `golden-sunset`) |
| `explorer-v2.css` | Layout and component styling (uses theme tokens) |
| `explorer-v2.js` | Drawer, settings sheet, theme, notifications |
