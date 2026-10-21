# CIS Shell V2 — **RETIRED** (Oct 2026)

**Production (only):** https://bkweb3.bigk.co.uk/cis/

Shell V2 / explorer-prototype was removed from the repo. `/cis/explorer-prototype/` redirects to `/cis/`. Do not rebuild V2 unless explicitly requested.

---

## Historical note (pre-retirement)

V2 reused the same `shell/modules/*.js` and session token as V1; only chrome, navigation, and dashboards differed.

---

## Current state

| Area | Status |
|------|--------|
| Department sidebar (Office · Logistics · Control Room · Production · Maintenance) | Live — flat department buttons |
| Department dashboards (tile list → open module) | Live |
| Home dashboard (Charcoal intake + Bags Status + storage snapshot) | Live |
| Hidden nav: `labels`, `print_labels`, `label_deployment`, `traceability` hub | Live — contextual tiles on Office / Production / Logistics |
| Module cache (switch apps without re-fetch) | Live (`explorer-v2-cis-bridge.js`) |
| Logistics / Office / Production dept hub widgets | Live — Walvis, in transit, pending deliveries, packaging shift (`explorer-v2-dashboard.js`) |
| Cutover `/cis/` → V2 | **Not yet** — V1 remains default |

**Code:** `shell/explorer-prototype/` — see [README](../shell/explorer-prototype/README.md), [DESIGN-DEPARTMENTS](../shell/explorer-prototype/DESIGN-DEPARTMENTS.md), [NAV-MAP](../shell/explorer-prototype/NAV-MAP.md).

---

## Module parity with V1

V2 `index.html` must keep the **same module script versions** (and flags such as `CIS_BS_DRILL_SORT_NEWEST_FIRST`) as production `shell/index.html`. After V1 deploy, sync V2 script tags or run a diff.

---

## Traceability-first (Oct 2026)

Home dashboard leads with **Charcoal intake** + **Bags Status**, then **storage snapshot** (factory stream breakdown). See [CIS-V2-TRACEABILITY.md](./CIS-V2-TRACEABILITY.md) for V1 hub → V2 mapping.

## Next priorities (suggested order)

1. ~~**Logistics hub (PJ view)**~~ — done (stat cards + module shortcuts).
2. ~~**Production dashboard**~~ — done (active packaging shift + Print labels tile).
3. ~~**Office dashboard**~~ — done (pending delivery confirmations or deliveries register row count).
4. **Logistics hub (phase 2)** — movement schedule “due today”, container highlights.
5. **Mobile polish** — drawer, bottom bar, module scroll + float back (reuse V1 patterns where needed).
6. **Cutover plan** — config flag or nginx default to V2; rollback = restore V1 `index.html` as entry.
7. **Theme tokens** — align `explorer-v2-themes.css` with [CARBO-DESIGN.md](../CARBO-DESIGN.md) for one design system.

---

## Deploy

On bkweb3 after `git push`:

```bash
cd /opt/carbo/carbo-cis && git pull origin master && bash deploy_on_server.sh
bash deploy_explorer_prototype_on_server.sh
```

`deploy_on_server.sh` copies all of `shell/*` (including `explorer-prototype/`). The second script rsyncs the prototype folder and verifies production `index.html` was not touched.

---

## Walvis / traceability work

Operational fixes (dispatch #1, addendum, Bags Status audit lines) land in **shared modules** — they appear in both V1 and V2 once script versions are synced and traceability API is restarted on bkweb3.

---

*Updated 12 Oct 2026 — V2 development resumed after Walvis Dispatch #1 reconciliation.*
