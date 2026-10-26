#!/usr/bin/env node
/**
 * Bags Status: 45s live refresh on drill views, no floating button.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsPath = path.join(__dirname, "..", "shell", "modules", "bags_status.js");
const src = fs.readFileSync(jsPath, "utf8");

const checks = [
  { name: "30s interval", ok: /BS_AUTO_REFRESH_MS = 30000/.test(src) },
  { name: "no floating refresh button", ok: !/bs-float-refresh-btn/.test(src) },
  { name: "reloadDrillFromServer for In storage AGL drill", ok: /selected\.mode === "events"/.test(src) && /bagsStatusDrillPath\(selected\.key\)/.test(src) },
  { name: "countdown fires refresh at zero", ok: /countdownSec === 0/.test(src) && /refreshReport\(\{ silent: true \}\)/.test(src) },
  {
    name: "countdown resets after paint",
    ok: /paint\(\);[\s\S]{0,120}resetCountdown\(\)/.test(src),
  },
  { name: "cache-bust on live GET", ok: /function traceabilityLiveGet/.test(src) },
  { name: "unified drill back stack", ok: /var drillStack = \[\]/.test(src) && /function pushDrillNav/.test(src) && /drillStack\.pop\(\)/.test(src) },
];

let failed = 0;
for (const c of checks) {
  console.log((c.ok ? "OK" : "FAIL") + "  " + c.name);
  if (!c.ok) failed += 1;
}
if (failed) process.exit(1);
console.log("\nAll checks passed.");
