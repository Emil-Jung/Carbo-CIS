#!/usr/bin/env node
/**
 * Static dry-run: Bags Status manual refresh button (no auto countdown).
 * Run: node scripts/verify_bags_status_auto_refresh.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsPath = path.join(__dirname, "..", "shell", "modules", "bags_status.js");
const cssPath = path.join(__dirname, "..", "shell", "styles.css");
const src = fs.readFileSync(jsPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

const checks = [
  {
    name: "floating Refresh button reloads page",
    ok: /bs-float-refresh-btn/.test(src) && /window\.location\.reload\(\)/.test(src),
  },
  {
    name: "auto countdown not started on module load",
    ok: !/startCountdown\(\);\s*\n\s*await refreshReport/.test(src),
  },
  {
    name: "reloadDrillFromServer defined (initial load still refetches drills)",
    ok: /async function reloadDrillFromServer\(\)/.test(src),
  },
  {
    name: "events drill refetch helper",
    ok: /selected\.mode === "events"/.test(src) && /bagsStatusDrillPath\(selected\.key\)/.test(src),
  },
  {
    name: "float refresh button styled fixed",
    ok: /\.bs-float-refresh-btn/.test(css) && /position:\s*fixed/.test(css),
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

console.log("\nAll checks passed — Bags Status uses manual floating Refresh (full page reload).");
