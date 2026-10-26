/**
 * Static + module smoke for location sheet wiring (no live API).
 * Run: node scripts/verify_location_sheet_handlers.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const td = fs.readFileSync(
  path.join(root, "shell/modules/traceability_documentation.js"),
  "utf8"
);
const render = fs.readFileSync(
  path.join(root, "shell/modules/eudr_documentation_render.js"),
  "utf8"
);
const css = fs.readFileSync(path.join(root, "shell/styles.css"), "utf8");

const checks = [
  ["location PDF button id", /id:\s*"td-doc-location-sheet-pdf"/.test(td)],
  ["location Print button id", /id:\s*"td-doc-location-sheet-print"/.test(td)],
  ["PDF click uses loading modal", /btnLocationPdf\.addEventListener\("click", async function/.test(td) && /showSheetLoadingModal\("Preparing accompanying location sheet/.test(td)],
  ["Print click uses preview", /showEudrLocationSheetPreview\(packPrint, \{ autoPrintAfterLoad: true \}/.test(td)],
  ["in-row error element", /td-doc-location-sheet-msg/.test(td)],
  ["fetchLocationSheetPack helper", /async function fetchLocationSheetPack/.test(td)],
  ["preview downloadPdf hook", /downloadPdf:\s*function/.test(render)],
  ["eudr actions stack layout", /\.td-doc-eudr-actions[\s\S]*flex-direction:\s*column/.test(css)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(ok ? "OK" : "FAIL", name);
  if (!ok) failed++;
}

if (failed) {
  process.exit(1);
}
console.log("All", checks.length, "handler wiring checks passed.");
