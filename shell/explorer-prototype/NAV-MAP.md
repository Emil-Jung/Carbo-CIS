# CIS Shell V2.0 — navigation destination map

Mirrors production `dashboard.js` **LAYOUT** plus Traceability hub children (`traceability.js`, `labels_hub.js`) and other registered modules not on the dashboard tiles.

| Group | Module id | Production title | Notes |
|-------|-----------|------------------|--------|
| *(top)* | `dashboard` | Dashboard | V2 sample operational landing (prototype cards) |
| **Applications** | `producers_office` | Capture Producers | |
| | `traceability` | Traceability | Hub |
| | ↳ `control_room` | Control Room | Traceability child |
| | ↳ `delivery_confirmations` | Delivery Confirmations | |
| | ↳ `labels` | Labels | Hub |
| | ↳ `print_labels` | Print Labels | Under Labels |
| | ↳ `label_deployment` | Label Fencing | Under Labels |
| | ↳ `movement_schedule` | Movement schedule | |
| | ↳ `walvis_dispatches` | Walvis dispatches | Manifest vs received |
| | ↳ `containers` | Containers | |
| | ↳ `pallet_configuration` | Pallet Configuration | |
| | ↳ `manager_override` | Manager Override | |
| | ↳ `bag_stock` | Bag stock | Inactive in production |
| | `quality_capture` | Quality | |
| | `maintenance_manager` | Maintenance | |
| | `maintenance_certs` | Certificates | Inactive |
| **Reports & lookups** | `producers_view` | View Producers | |
| | `permit_status` | Permit Status | |
| | `quality_view` | Quality Analysis | |
| | `maintenance_ops` | Fleet Status | |
| | `consumption` | Consumption | |
| | `restaurant_report` | Restaurant quality | |
| | `deliveries_register` | Charcoal deliveries | |
| | `bags_movement_report` | Charcoal Intake | |
| | `bags_status_report` | Bags Status | |
| | `supplier_contacts` | Supplier contacts | |
| **Administration** *(above Ask Emil)* | `identity_admin` | Users & access | Group header: shield icon |
| | `device_keys` | Device keys | |
| *(footer)* | — | Settings | Gear icon + notification dot |

Permission gating uses `CIS.canAccessModule` from the live module registry (same as production). Inactive modules remain listed and open with production “Coming soon” behaviour where applicable.
