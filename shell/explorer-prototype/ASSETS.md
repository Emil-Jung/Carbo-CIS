# CIS Shell V2.0 — approved prototype assets

All files live in `shell/explorer-prototype/assets/`. **PNG masters** are binary-identical to the supplied sources. **WebP** variants are proportionally downscaled (same aspect ratio, no crop change) for faster load; layout CSS is unchanged.

| Filename in repo | Source (build PC) | Used in |
|------------------|-------------------|---------|
| `Carbo-Main-Logo.png` | `G:\My Coding Projects\FSC-Management-System\assets\Carbo Main Logo.png` | `index.html` — sidebar brand, favicon |
| `Golden-Acacia-Sunset-Plain.png` | `C:\Users\Administrator\Downloads\Golden Acacia Sunset Plain.png` | Hero `<picture>` PNG fallback |
| `Golden-Acacia-Sunset-Plain.webp` | Derived (1920×640, ~86 quality) | Hero primary — same `object-fit: cover`, `object-position: 58% 64%` |
| `Moody-Acacia-Sunset-Savanna.png` | `C:\Users\Administrator\Downloads\Moody Acacia Sunset Savanna.png` | Sidebar / reports footer PNG fallback |
| `Moody-Acacia-Sunset-Savanna.webp` | Derived (1024px wide, ~82 quality) | Sidebar `<picture>` (same `object-fit: cover`, `object-position: center 55%`) |

Reference copies (design history only, not used in CSS/HTML): `design-reference-option-b.jpg`, `design-reference-option-c.jpg`.

To refresh assets after art updates, recopy from the same source paths and commit only under `shell/explorer-prototype/assets/`.

**Replacing the sidebar photo:** drop in new art as `Moody-Acacia-Sunset-Savanna.png` (or add a new filename and update `index.html` `<picture>` + regenerate `.webp` with the same proportional resize script). Tune `object-position` in `explorer-v2.css` (`.sidebar-bg img`) if the focal point moves. Scrim strength is `.sidebar-bg::after` — lighten if the new art is already dark.
