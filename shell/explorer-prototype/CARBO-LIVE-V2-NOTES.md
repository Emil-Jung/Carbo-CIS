# Carbo Live — existing implementation (reference for V2)

**Production app:** `Charcoal-Traceability/pwa-production-viewer/`  
**URL (typical):** `https://bkweb3.bigk.co.uk/traceability/production-viewer/` (nginx alias to PWA folder)

Standalone PWA — **not** embedded in production CIS shell (`/cis/index.html`) today.

## What Carbo Live is

Office **Production Live Ticker**: latest factory scan, today’s intake totals, intake pace, and weathering-clock summary, refreshed every **30 seconds**.

## Display structure (production)

| Region | DOM / file | Purpose |
|--------|------------|---------|
| Header | `#pvLiveDot`, `#pvClock`, `#pvRefreshNote` | Live status dot, Windhoek clock, last refresh note |
| Ticker | `#pvLiveTicker` inside `.pv-live-ticker__viewport` | Horizontally scrolling tiles (duplicated track for seamless loop); tap/space pauses |
| Tiles | `.pv-live-tile--scan`, `--day`, `--pace`, `--weathering` | Latest scan, today kg by stream, bags/day pace, weathered today/week |
| Dashboard below | `#pvTiles`, stream bar, producer list | Full-page KPIs (not required in CIS landing strip) |

## Data sources (unchanged in V2 embed)

From `pwa-production-viewer/app.js`:

1. `GET /traceability/api/v1/reports/bags-movement?scope=all&compact=1` — movement rows, in_system, label_inventory, intake_pace  
2. `GET /traceability/api/v1/reports/bags-weathering` — `weathered_summary.today` / `.this_week` for weathering tile  

Auth: Bearer token (`Authorization` header). Production PWA uses `localStorage.pv_cis_token`. CIS shell uses `cis_token`. V2 prototype tries **`cis_token` first**, then **`pv_cis_token`**.

Refresh: **30s** interval + manual refresh + `visibilitychange` refetch.

## V2 prototype integration

| File | Role |
|------|------|
| `carbo-live-v2.js` | Same fetch/render/ticker behaviour as production `app.js` (ticker slice only) |
| `carbo-live-v2.css` | Light workspace + charcoal band + gold accents; responsive tile widths (320–430px+) |

**Not modified:** `Charcoal-Traceability/pwa-production-viewer/*` (production Carbo Live unchanged until full V2 cutover).
