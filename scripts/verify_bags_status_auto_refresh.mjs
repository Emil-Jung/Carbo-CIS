#!/usr/bin/env node
/**
 * Static dry-run: Bags Status module load wiring (no auto-refresh UI).
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
    name: "no floating refresh button",
    ok: !/bs-float-refresh-btn/.test(src) && !/window\.location\.reload\(\)/.test(src),
  },
  {
    name: "initial refreshReport on module open",
    ok: /async function refreshReport\(opts\)/.test(src) && /await refreshReport\(\{ reset: true \}\)/.test(src),
  },
  {
    name: "reloadDrillFromServer for drill refetch helper",
    ok: /async function reloadDrillFromServer\(\)/.test(src),
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

console.log("\nAll checks passed.");
