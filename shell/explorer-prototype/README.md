# CIS Shell V2.0 — visual prototype

Static **visual mashup** of:

- **Option B (Modern Carbo)** — warm ivory workspace, light cards, restrained status colours, comfortable typography and spacing.
- **Option C (Bold Carbo)** — charcoal sidebar, Namibian landscape identity (hero + accents), energetic gold, Ask Emil, settings attention dot.

**Not connected** to `app.js`, modules, auth, or APIs. Production entry remains [`/cis/`](../index.html).

## View locally

```powershell
cd "G:\My Coding Projects\Carbo-CIS\shell\explorer-prototype"
python -m http.server 8765
```

Open http://127.0.0.1:8765/

## View on bkweb3 (after deploy)

https://bkweb3.bigk.co.uk/cis/explorer-prototype/

## Design references

Stored in `assets/design-reference-option-b.jpg` and `assets/design-reference-option-c.jpg`.

Hero and strip imagery use `assets/hero-namibia.svg` and `assets/sidebar-landscape.svg` (vector placeholders until licensed photography is supplied).

## Files

| File | Role |
|------|------|
| `index.html` | Layout and sample operational content |
| `explorer-v2.css` | V2 tokens and mashup styling |
| `explorer-v2.js` | Mobile sidebar drawer only |
