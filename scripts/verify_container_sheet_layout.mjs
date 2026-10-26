/**
 * Layout verification for Container Load Sheet HTML (not string-only smoke).
 * Writes shell/test/_container_sheet_layout_output.html for browser/PDF inspection.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const modPath = path.join(root, "shell/modules/container_manifest.js");
const outPath = path.join(root, "shell/test/_container_sheet_layout_output.html");

const rows = [];
for (let i = 1; i <= 48; i++) {
  const n = String(5658 + i).padStart(6, "0");
  rows.push({
    serial: "BAG-2026-" + n,
    net_weight_kg: 387,
    status_changed_at: "2026-10-20T12:00:0" + (i % 10) + "Z",
  });
}

const manifest = {
  header: {
    container_number: "GAOU6688205",
    fcl_number: "MSCU1234567",
    product_key: "DOM2.5",
    product_label: "Pallet — DOM2.5",
    ship_to: "Big-K",
    booking_ref: "EBKG19038595",
    delivery_note: "",
    transporter: "",
    tare_kg: 3840,
    session_loading_date: "2026-10-20",
  },
  summary: { tare_kg: 3840 },
  _sheet_loading_rows: rows,
};

const sandbox = {
  window: { CIS: {}, CIS_BS_DRILL_SORT_NEWEST_FIRST: true },
  document: {},
};
vm.runInNewContext(fs.readFileSync(modPath, "utf8"), sandbox);
const CIS = sandbox.window.CIS;

const html = CIS.buildContainerManifestHtml(manifest, "general", {});
fs.writeFileSync(outPath, html, "utf8");

const entries = CIS.containerSheetLoadingEntries(manifest);
const wSum = entries.reduce((s, e) => s + Number(e.weight_kg || 0), 0);

const checks = [
  ["ITEMS column heading", html.includes("<th>ITEMS</th>") && !html.includes("<th>SUPPLIER</th>")],
  ["48 loading entries", entries.length === 48],
  ["weight sum 18576", wSum === 18576],
  ["QTY in totals", html.includes("18576") && html.includes("QTY BAGS")],
  ["gross total loaded+tare", html.includes(String(18576 + 3840))],
  ["4-row totals table", (html.match(/class="cm-total-lbl"/g) || []).length === 4],
  ["continuous NR 31", html.includes(">31<")],
  ["LOADING DATE heading", html.includes("LOADING DATE")],
  ["no loading team block", !html.includes("Loading Team")],
  ["CONTAINER and FCL rows", html.includes("CONTAINER") && html.includes("FCL")],
  ["loading date from scans", html.includes("20-10-2026")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(ok ? "PASS" : "FAIL", name);
  if (!ok) failed++;
}
console.log("Wrote", outPath);
process.exit(failed ? 1 : 0);
