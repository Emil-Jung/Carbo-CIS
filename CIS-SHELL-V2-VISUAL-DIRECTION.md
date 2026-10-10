# CIS Shell V2.0 — visual direction (B × C mashup)

**Scope:** Look-and-feel only. No module integration in the first iteration.

## Intent

One coherent interface — not two concepts pasted together.

| From Option B (Modern Carbo) | From Option C (Bold Carbo) |
|------------------------------|----------------------------|
| Warm ivory workspace (`#f3efe6`, white cards) | Charcoal sidebar (`#1c1a18`) |
| Restrained status palette on light surfaces | Gold identity, “CARBO” sidebar mark |
| Comfortable sans-serif UI type | Display serif for hero greeting |
| Spacious panels, soft shadows | Namibian landscape on landing hero |
| Clean header with search + user chip | Ask Emil block, settings + red dot |
| — | Dark “Key reports” card with landscape peek |
| — | Mobile bottom bar with central Ask Emil |

## Imagery rules

- **Landing hero:** Full-width savanna sunset with left-weighted dark gradient so white headline stays readable. Does not extend into data grids.
- **Sidebar:** Thin landscape strip + reports card footer — identity, not decoration in the working stack.
- **Module interiors (future):** Plain workspace only; no full-bleed photos behind tables or forms.

## Tokens (prototype)

Defined in `shell/explorer-prototype/explorer-v2.css` under `:root`. When V2 ships, align or extend [CARBO-DESIGN.md](./CARBO-DESIGN.md) for cross-app consistency.

## Reference artwork

Team concepts: `shell/explorer-prototype/assets/design-reference-option-b.jpg`, `design-reference-option-c.jpg`.

Prototype implementation: https://bkweb3.bigk.co.uk/cis/explorer-prototype/ (after shell deploy).
