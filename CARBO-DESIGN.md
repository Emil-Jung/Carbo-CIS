# Carbo Namibia — design tokens

Use these across **all** Carbo web apps (CIS shell, Quality, Producers, Maintenance PWA)
so the experience feels like one system.

## Colours

| Token | Hex | Use |
|-------|-----|-----|
| Background | `#0c0c0c` | Page background |
| Panel | `#1a1a1a` | Cards, headers |
| Panel elevated | `#242424` | Inputs, table headers |
| Border | `#3d3520` | Dividers, tile borders |
| Gold | `#c9a227` | Primary accent, section titles |
| Gold bright | `#e4c04a` | Headings, hover, buttons |
| Gold dim | `#8a7420` | Subtle borders |
| Text | `#f5f0e6` | Body text |
| Muted | `#a89f8a` | Secondary text |

## CSS variables (copy into each app)

```css
:root {
  --bg: #0c0c0c;
  --panel: #1a1a1a;
  --border: #3d3520;
  --gold: #c9a227;
  --gold-bright: #e4c04a;
  --text: #f5f0e6;
  --muted: #a89f8a;
}
```

Reference implementation: `Carbo-CIS/shell/styles.css`

## CIS dashboard layout

Each business area has two rows:

1. **Applications** — capture or management (Sieving Sheet, Manager, Producers Office, Users & access)
2. **Reports & lookups** — read-only (Quality viewer, Operations, Consumption, FSC register)

Everyone sees all tiles. Permissions control which open.

## Apps vs lookups

| Area | Application | Lookup |
|------|-------------|--------|
| Administration | Users & access | — |
| Production | Sieving Sheet, Producers Office | Quality viewer, FSC Public Register |
| Maintenance | Maintenance Manager (Windows) | Operations, Consumption |

Capture PWAs (Quality, Producers Office) use device/office keys — CIS links to them; they do not embed in the shell.

## Icons

Generate from `Carbo-CIS/CIS APP logo.png` with padding (see `scripts/GENERATE-ICONS.cmd`).
