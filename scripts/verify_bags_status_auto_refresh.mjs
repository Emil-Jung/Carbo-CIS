#!/usr/bin/env node
/**
 * Static dry-run: Bags Status auto-refresh wiring (no browser).
 * Run: node scripts/verify_bags_status_auto_refresh.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsPath = path.join(__dirname, "..", "shell", "modules", "bags_status.js");
const src = fs.readFileSync(jsPath, "utf8");

const checks = [
  {
    name: "45 second interval constant",
    ok: /var BS_AUTO_REFRESH_MS = 45000;/.test(src),
  },
  {
    name: "reloadDrillFromServer defined",
    ok: /async function reloadDrillFromServer\(\)/.test(src),
  },
  {
    name: "events drill refetch (e.g. In storage — AGL)",
    ok: /selected\.mode === "events"/.test(src) && /bagsStatusDrillPath\(selected\.key\)/.test(src),
  },
  {
    name: "refreshReport awaits drill reload",
    ok: /await reloadDrillFromServer\(\)/.test(src),
  },
  {
    name: "countdown triggers refresh (not cosmetic only)",
    ok: /countdownSec <= 0/.test(src) && /refreshReport\(\{ silent: true \}\)/.test(src),
  },
  {
    name: "no separate pollTimer interval (single 1s ticker)",
    ok: !/pollTimer = setInterval/.test(src),
  },
  {
    name: "wx drill stores querySel for refetch",
    ok: /querySel: sel/.test(src),
  },
];

let failed = 0;
for (const c of checks) {
  const mark = c.ok ? "OK" : "FAIL";
  console.log(`${mark}  ${c.name}`);
  if (!c.ok) failed += 1;
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}

console.log("\nAll checks passed — Bags Status should refresh every 45s including drill views.");
