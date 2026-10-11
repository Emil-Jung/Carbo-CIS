# CIS V2 — department navigation (target)

Design record (Oct 2026). V2 prototype may still show collapsible module lists until department dashboards ship.

## Left panel (target)

Fixed order, **no nested collapsibles**:

1. **Office**
2. **Logistics**
3. **Control Room**
4. **Production**
5. **Maintenance**

Optional bottom dock: **Administration** (`identity_admin`, `device_keys`) — CIS users & keys only, not business “office work”.

Clicking a department opens that department’s **dashboard in the right panel** (tiles / summary / shortcuts). Modules open from the dashboard, not from a long sidebar tree.

Home / top-level **Dashboard** may remain for admins who span all departments (operational KPIs later wired to live APIs).

## Labels — not a sidebar department

| Module | Sidebar | Where users reach it |
|--------|---------|----------------------|
| `print_labels` | **Hidden** | Shortcut tile on **Office**, **Production**, and **Logistics** dashboards (if `traceability.labels.print` or equivalent) |
| `labels` (hub) | **Hidden** | Not needed when Print Labels is linked directly |
| `label_deployment` (fencing) | **Hidden** | **Admin / Emil only** — via Administration or Production dashboard “advanced” if granted; not for floor or PJ |

**Administration** in CIS means **Identity + device keys**, not label printing.

Label printing is a **cross-cutting tool** (office pre-print, production floor, logistics if ever needed), not its own left-rail entry.

## Department dashboards (content sketch)

### Office

- Producers capture / view, quality viewer, deliveries register, supplier contacts  
- **Print labels** (if permitted)

### Logistics

- Delivery confirmations pending  
- Walvis dispatches (load / receive summary)  
- Movement schedule  
- Containers  
- Bags Status (oversight)  
- **Print labels** (optional tile if PJ/Jessica ever need it)

### Control Room

- Open Control Room app (iframe) or embedded summary + launch

### Production

- Packaging shift, pallet configuration, manager override  
- Charcoal intake, restaurant quality, bags status as needed  
- **Print labels** (if permitted)

### Maintenance

- Maintenance manager, fleet status, consumption

## Permissions

Unchanged: each tile/module still uses `CIS.canAccessModule`. PJ sees a thin Logistics dashboard; Emil sees all departments he is granted.

## Implementation order

1. ✅ Department groups in nav (interim: collapsible lists — replace with flat five buttons).  
2. Department dashboard host + tile grid per `CIS_V2_NAV.groups[].items`.  
3. Contextual `print_labels` on Office / Production / Logistics dashboards.  
4. Hide `labels`, `print_labels`, `label_deployment` from sidebar; keep modules loaded.  
5. Logistics hub widgets (single-screen PJ view).  
6. Cutover `/cis/` → V2.
