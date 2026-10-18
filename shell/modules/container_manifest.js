/* Container load sheet — print layout (general + EUDR placeholder). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      var p = String(iso).split("-");
      if (p.length === 3) return p[2] + "-" + p[1] + "-" + p[0];
      var d = new Date(iso);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
      }
    } catch (e) { /* ignore */ }
    return String(iso);
  }

  function splitColumns(lines) {
    var left = [];
    var right = [];
    (lines || []).forEach(function (ln, i) {
      if (i < 30) left.push(ln);
      else if (i < 60) right.push(ln);
    });
    while (left.length < 30) left.push(null);
    while (right.length < 30) right.push(null);
    return { left: left, right: right };
  }

  function renderColumn(rows, startNr) {
    var html =
      "<table class=\"cm-col\"><thead><tr><th>NR</th><th>SUPPLIER</th><th>WEIGHT</th></tr></thead><tbody>";
    for (var i = 0; i < 30; i++) {
      var ln = rows[i];
      var nr = startNr + i;
      html +=
        "<tr><td>" +
        (ln ? nr : "&nbsp;") +
        "</td><td>" +
        (ln ? esc(ln.supplier) : "&nbsp;") +
        "</td><td class=\"cm-w\">" +
        (ln ? esc(String(ln.weight_kg)) : "&nbsp;") +
        "</td></tr>";
    }
    html += "</tbody></table>";
    return html;
  }

  function buildHtml(manifest, variant) {
    var h = manifest.header || {};
    var sum = manifest.summary || {};
    var cols = splitColumns(manifest.lines || []);
    var product = h.product_label || h.product_key || "";
    var loadDate = fmtDate(h.load_date || h.expected_ship_date);
    var dispatchLine = "";
    if (h.walvis_dispatch_id && h.dispatch_number != null) {
      dispatchLine =
        "Walvis dispatch #" +
        h.dispatch_number +
        (h.dispatch_truck_registration ? " · " + esc(h.dispatch_truck_registration) : "");
    }

    var eudrBlock =
      variant === "eudr"
        ? "<div class=\"cm-eudr\">EUDR manifest — extended fields and layout to be added.</div>"
        : "";

    return (
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>Container " +
      esc(h.container_number) +
      "</title><style>" +
      "body{font-family:Arial,Helvetica,sans-serif;font-size:11px;margin:12mm;color:#000;}" +
      "h1{font-size:14px;margin:0 0 8px;text-align:center;letter-spacing:0.04em;}" +
      ".cm-meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:10px;}" +
      ".cm-meta div{border:1px solid #000;padding:3px 6px;min-height:1.2em;}" +
      ".cm-meta label{font-weight:700;display:block;font-size:9px;}" +
      ".cm-body{display:grid;grid-template-columns:1fr 1fr;gap:10px;}" +
      "table.cm-col{width:100%;border-collapse:collapse;}" +
      "table.cm-col th,table.cm-col td{border:1px solid #000;padding:2px 4px;vertical-align:top;}" +
      "table.cm-col th{font-size:9px;}" +
      "td.cm-w{text-align:right;width:3.2em;}" +
      ".cm-foot{display:grid;grid-template-columns:1fr 220px;gap:12px;margin-top:10px;align-items:start;}" +
      ".cm-team table{width:100%;border-collapse:collapse;}" +
      ".cm-team th,.cm-team td{border:1px solid #000;padding:2px 4px;}" +
      ".cm-totals table{width:100%;border-collapse:collapse;}" +
      ".cm-totals td{border:1px solid #000;padding:3px 6px;}" +
      ".cm-totals td:last-child{text-align:right;font-weight:700;}" +
      ".cm-eudr{margin:8px 0;padding:6px;border:1px dashed #666;font-size:10px;}" +
      "@media print{body{margin:8mm;}}" +
      "</style></head><body>" +
      "<h1>CONTAINER LOAD SHEET" +
      (variant === "eudr" ? " (EUDR)" : "") +
      "</h1>" +
      eudrBlock +
      "<div class=\"cm-meta\">" +
      "<div><label>DATE</label>" +
      esc(loadDate) +
      "</div>" +
      "<div><label>PRODUCT</label>" +
      esc(product) +
      "</div>" +
      "<div><label>TO</label>" +
      esc(h.ship_to || "") +
      "</div>" +
      "<div><label>CONTAINER</label>" +
      esc(h.container_number) +
      "</div>" +
      "<div><label>DELIVERY NOTE</label>" +
      esc(h.delivery_note || h.booking_ref || "") +
      "</div>" +
      "<div><label>TRANSPORTER</label>" +
      esc(h.transporter || "") +
      "</div>" +
      "<div><label>TAG</label>" +
      esc(h.tag_ref || "") +
      "</div>" +
      "<div><label>TARE</label>" +
      esc(sum.tare_kg != null ? String(sum.tare_kg) : "") +
      "</div>" +
      "</div>" +
      (dispatchLine ? "<p style=\"margin:0 0 8px;font-size:10px;\"><strong>Linked:</strong> " + dispatchLine + "</p>" : "") +
      "<div class=\"cm-body\">" +
      renderColumn(cols.left, 1) +
      renderColumn(cols.right, 31) +
      "</div>" +
      "<div class=\"cm-foot\">" +
      "<div class=\"cm-team\"><strong>Loading team</strong><table><thead><tr><th>NR</th><th>Name</th></tr></thead><tbody>" +
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map(function (n) {
          return "<tr><td>" + n + "</td><td>&nbsp;</td></tr>";
        })
        .join("") +
      "</tbody></table></div>" +
      "<div class=\"cm-totals\"><table>" +
      "<tr><td>QTY BAGS</td><td>" +
      esc(String(sum.qty_bags != null ? sum.qty_bags : 0)) +
      "</td></tr>" +
      "<tr><td>WEIGHT LOADED</td><td>" +
      esc(String(sum.weight_loaded_kg != null ? sum.weight_loaded_kg : 0)) +
      "</td></tr>" +
      "<tr><td>TARE</td><td>" +
      esc(String(sum.tare_kg != null ? sum.tare_kg : 0)) +
      "</td></tr>" +
      "<tr><td>TOTAL</td><td>" +
      esc(String(sum.total_kg != null ? sum.total_kg : 0)) +
      "</td></tr>" +
      "</table></div></div>" +
      "<script>window.onload=function(){window.print();};</script>" +
      "</body></html>"
    );
  }

  CIS.printContainerManifest = function (manifest, variant) {
    var w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      alert("Allow pop-ups to print the container manifest.");
      return;
    }
    w.document.open();
    w.document.write(buildHtml(manifest, variant === "eudr" ? "eudr" : "general"));
    w.document.close();
  };
})();
