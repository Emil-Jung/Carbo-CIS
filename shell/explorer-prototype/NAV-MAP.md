# CIS Shell V2 — navigation (by department)

Same production `CIS.modules` and permissions as V1. Sidebar groups replace the Traceability hub tile.

## Departments (main nav)

| Department | Module ids |
|------------|------------|
| **Office** | `producers_office`, `producers_view`, `quality_view`, `deliveries_register`, `supplier_contacts` |
| **Logistics** | `delivery_confirmations`, `walvis_dispatches`, `movement_schedule`, `containers`, `bags_status_report` |
| **Control Room** | `control_room` |
| **Production** | `labels` (+ `print_labels`, `label_deployment`), `packaging_shift`, `pallet_configuration`, `manager_override`, `bags_movement_report`, `restaurant_report` |
| **Maintenance** | `maintenance_manager`, `maintenance_ops`, `consumption` |

## Bottom dock

**Administration** — `identity_admin`, `device_keys`

## Hidden from nav (still loaded)

| Module id | Reason |
|-----------|--------|
| `traceability` | Hub replaced by flat department lists |
| `quality_capture` | Use `quality_view` |
| `permit_status` | FSC — later |
| `bag_stock`, `maintenance_certs` | Inactive |

## Landing

- **Multi-department access** (typical admin): Dashboard after sign-in.
- **Single department only** (e.g. logistics-only PJ): opens first allowed module in that department.

## URL

https://bkweb3.bigk.co.uk/cis/explorer-prototype/ — production `/cis/` unchanged until cutover.
