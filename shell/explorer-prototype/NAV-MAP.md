# CIS Shell V2.0 — navigation destination map

Mirrors production modules with V2 grouping. Permissions: `CIS.canAccessModule` (unchanged).

## Main scroll nav

| Tier | Module id | Production title | Notes |
|------|-----------|------------------|--------|
| *(top)* | `dashboard` | Dashboard | V2 sample operational landing |
| **Applications** | `producers_office` | Capture Producers | |
| | `traceability` | Traceability | Hub |
| | ↳ `control_room` | Control Room | iframe PWA — cached host in V2 |
| | ↳ `delivery_confirmations` | Delivery Confirmations | |
| | ↳ `labels` | Labels | Hub |
| | ↳ `print_labels` | Print Labels | |
| | ↳ `label_deployment` | Label Fencing | |
| | ↳ `movement_schedule` | Movement schedule | |
| | ↳ `walvis_dispatches` | Walvis dispatches | |
| | ↳ `containers` | Containers | |
| | ↳ `pallet_configuration` | Pallet Configuration | |
| | ↳ `manager_override` | Manager Override | |
| | ↳ `bag_stock` | Bag stock | Inactive |
| | `maintenance_manager` | Maintenance | |
| | `maintenance_certs` | Certificates | Inactive |
| **Reports & lookups** | `producers_view` | View Producers | |
| | `quality_view` | Quality Analysis | |
| | `maintenance_ops` | Fleet Status | |
| | `consumption` | Consumption | |
| | `restaurant_report` | Restaurant quality | |
| | `deliveries_register` | Charcoal deliveries | |
| | `bags_movement_report` | Charcoal Intake | |
| | `bags_status_report` | Bags Status | |
| | `supplier_contacts` | Supplier contacts | |

## Bottom dock (fixed order)

1. **Administration** (shield) — `identity_admin`, `device_keys`
2. **Settings** (gear + notification dot)
3. **Ask Emil** (coming soon)

## Hidden from V2 nav (scripts/APIs remain)

| Module id | Reason |
|-----------|--------|
| `quality_capture` | Capture app excluded; reporting via `quality_view` |
| `permit_status` | FSC — separate future scope |
| *(none in CIS)* | FSC Audits, Carbo Live — not registered in shell |

## State (V2 bridge)

Module hosts are cached in `#cis-module-viewport`; switching nav hides/shows hosts instead of `innerHTML` clear. Back stack preserves app → report → app (e.g. Control Room ↔ Charcoal Intake).
