# CIS V2 — Traceability (V1 hub → V2 homes)

V1 **Traceability** tile (`shell/modules/traceability.js`) is hidden in V2. The same modules load from `shell/modules/*`; navigation is by **department** plus the **home dashboard** traceability row.

## Home dashboard (all users with access)

| Widget | Module | API |
|--------|--------|-----|
| Charcoal intake | `bags_movement_report` | `GET /reports/bags-movement?scope=all&compact=1` |
| Bags Status summary | `bags_status_report` | `GET /reports/bags-status` |
| Storage snapshot | `bags_status_report` | Same — factory breakdown by stream + pallet SKU |

Factory snapshot sections: **Bulk bags** — **Still weathering** / **Weathered** (Restaurant, Lumpwood, Fines always shown); **Pallets in storage** (product codes from `physical_pallets.by_product` on yard statuses); **Briquettes**.

Home number format: **tonnage/kg first**, **(bag count)** in brackets — production and office read the lead weight; logistics reads the bracketed bags.

Coast snapshot: **Carbo Yard — Walvis Bay**, **AGL yard — Walvis Bay** (same layout: Restaurant + Lumpwood bulk, pallet SKUs), and a separate **In container** box. Bag Walk blocks **fines → Walvis truck** unless a **manager PIN** override is entered.

**In system** footer on the home snapshot = bags still on an **open** storage status (includes **in container**). Excludes **sold**, **dispatched**, **packed_into_pallet**, **used_in_briquettes**. This is **not** all-time sieved intake (see Charcoal intake card).

## V1 Traceability hub → V2 department

| V1 hub option | V2 home |
|---------------|---------|
| Control Room | **Control Room** dept |
| Delivery Confirmations | **Logistics** dept (+ Office hub widget) |
| Labels / Print | Contextual tile Office · Production · Logistics |
| Label deployment | Production contextual (admin) |
| Movement schedule | **Logistics** |
| Packaging shift | **Production** (+ hub widget) |
| Walvis dispatches | **Logistics** (+ hub widget) |
| Containers | **Logistics** |
| Pallet configuration | **Production** |
| Manager override | **Production** |

## Next (traceability UX)

- Embed Control Room status on Control Room dept dashboard.
- Cross-links from Charcoal intake ↔ Bags Status drill paths (same serial).
- Movement schedule + containers on Logistics hub phase 2.

*Oct 2026 — traceability-first V2 pass.*
