# CIS Shell V2.0 — approved prototype assets

All files live in `shell/explorer-prototype/assets/`. Copies are binary-identical to the supplied sources (no redraw or compression).

| Filename in repo | Source (build PC) | Used in |
|------------------|-------------------|---------|
| `Carbo-Main-Logo.png` | `G:\My Coding Projects\FSC-Management-System\assets\Carbo Main Logo.png` | `index.html` — sidebar brand, favicon |
| `Golden-Acacia-Sunset-Plain.png` | `C:\Users\Administrator\Downloads\Golden Acacia Sunset Plain.png` | `index.html` — `<img class="hero-bg">` (168px strip, `object-fit: cover`, focal ~64% vertical / sun right) |
| `Moody-Acacia-Sunset-Savanna.png` | `C:\Users\Administrator\Downloads\Moody Acacia Sunset Savanna.png` | `explorer-v2.css` — `.sidebar-bg`, `.reports-card-landscape` footer |

Reference copies (design history only, not used in CSS/HTML): `design-reference-option-b.jpg`, `design-reference-option-c.jpg`.

To refresh assets after art updates, recopy from the same source paths and commit only under `shell/explorer-prototype/assets/`.
