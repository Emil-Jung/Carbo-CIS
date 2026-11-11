/* Container traceability summary — producer/farm/bag spreadsheet per FCL (EUDR pack). */
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
        return d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    } catch (e) { /* ignore */ }
    return String(iso);
  }

  function firstContainerFromPack(pack) {
    var list = (pack && pack.containers) || [];
    return list.length ? list[0] : null;
  }

  function summaryStyles() {
    return (
      "@page{size:A4 landscape;margin:10mm}" +
      "body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#000;margin:0;padding:0}" +
      ".cts-page{width:277mm;min-height:190mm;margin:0 auto;padding:8mm 10mm;box-sizing:border-box}" +
      ".cts-title{font-size:14pt;font-weight:700;text-align:center;margin:0 0 6px;letter-spacing:0.04em}" +
      ".cts-subtitle{text-align:center;font-size:9pt;margin:0 0 8px;color:#333}" +
      "table.cts-meta{width:100%;border-collapse:collapse;margin-bottom:8px}" +
      "table.cts-meta td{border:1px solid #000;padding:3px 6px;vertical-align:top}" +
      "table.cts-meta .cts-lbl{font-weight:700;width:18%;background:#f0f0f0}" +
      ".cts-section{font-weight:700;margin:10px 0 4px;font-size:10pt}" +
      "table.cts-grid{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:10px}" +
      "table.cts-grid th,table.cts-grid td{border:1px solid #000;padding:3px 5px;vertical-align:top;font-size:8pt}" +
      "table.cts-grid th{background:#e8e8e8;font-weight:700;text-align:center}" +
      "table.cts-grid td.cts-num{text-align:right;white-space:nowrap}" +
      ".cts-foot{font-size:7.5pt;color:#444;margin-top:8px}" +
      ".cts-warn{color:#8a4b00}"
    );
  }

  function metaRow(label, value) {
    return (
      "<tr><td class=\"cts-lbl\">" +
      esc(label) +
      "</td><td colspan=\"3\">" +
      esc(value || "—") +
      "</td></tr>"
    );
  }

  function renderProducerTable(producers) {
    var html =
      '<table class="cts-grid"><thead><tr>' +
      "<th>Producer</th><th>Farm</th><th>GPS</th><th>Bags</th><th>Net kg</th><th>Data notes</th>" +
      "</tr></thead><tbody>";
    if (!producers.length) {
      html += '<tr><td colspan="6">No producer rows — container may have no loaded bags.</td></tr>';
    }
    producers.forEach(function (p) {
      var gaps = (p.information_gaps || [])
        .map(function (g) {
          return g.message || g.code || "";
        })
        .filter(Boolean)
        .join("; ");
      html +=
        "<tr><td>" +
        esc(p.supplier_name) +
        "</td><td>" +
        esc(p.farm_display) +
        "</td><td>" +
        esc(p.gps_coordinates || "—") +
        "</td><td class=\"cts-num\">" +
        esc(String(p.bag_count || 0)) +
        "</td><td class=\"cts-num\">" +
        esc(String(p.weight_kg || 0)) +
        '</td><td class="' +
        (gaps ? "cts-warn" : "") +
        '">' +
        esc(gaps || "—") +
        "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function renderBagTable(lines) {
    var html =
      '<table class="cts-grid"><thead><tr>' +
      "<th>Nr</th><th>Bag ID</th><th>Product</th><th>Stream</th><th>Producer</th><th>FSC</th><th>kg</th>" +
      "</tr></thead><tbody>";
    if (!lines.length) {
      html += '<tr><td colspan="7">No bag lines on manifest.</td></tr>';
    }
    lines.forEach(function (ln, idx) {
      var serial = String(ln.bag_identifier || "").trim();
      var code = String(ln.product_code || "").trim();
      var items = code ? serial + " " + code : serial;
      html +=
        "<tr><td class=\"cts-num\">" +
        (ln.nr != null ? ln.nr : idx + 1) +
        "</td><td>" +
        esc(items) +
        "</td><td>" +
        esc(code || "—") +
        "</td><td>" +
        esc(ln.product_stream || "—") +
        "</td><td>" +
        esc(ln.supplier || "—") +
        "</td><td>" +
        esc(ln.fsc_label || "—") +
        "</td><td class=\"cts-num\">" +
        esc(ln.weight_kg != null ? String(ln.weight_kg) : "—") +
        "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  CIS.buildContainerTraceabilitySummaryHtml = function (pack) {
    var cont = firstContainerFromPack(pack);
    if (!cont) {
      throw new Error("Traceability pack did not return a container.");
    }
    var manifest = cont.manifest || {};
    var header = manifest.header || {};
    var summary = manifest.summary || cont.summary || {};
    var lines = manifest.lines || [];
    var producers = cont.producers || [];

    var body =
      '<div class="cts-page">' +
      '<h1 class="cts-title">CONTAINER TRACEABILITY SUMMARY</h1>' +
      '<p class="cts-subtitle">Producer, farm and bag-level traceability for customs / EUDR evidence (not the load-weighing sheet).</p>' +
      '<table class="cts-meta">' +
      metaRow("Container", header.container_number || cont.container_number) +
      metaRow("FCL", header.fcl_number || cont.fcl_number) +
      metaRow("Booking ref", header.booking_ref || cont.booking_ref) +
      metaRow("Product", cont.product_label || header.product_label || header.product_key) +
      metaRow("Consignee", header.ship_to || cont.ship_to) +
      metaRow(
        "Loaded",
        fmt(summary.qty_bags != null ? summary.qty_bags : summary.bag_count) +
          " bags · " +
          fmt(summary.weight_loaded_kg != null ? summary.weight_loaded_kg : summary.net_kg) +
          " kg net"
      ) +
      metaRow("Load date", fmtDate(header.load_date || header.session_loading_date || cont.load_date)) +
      "</table>" +
      '<div class="cts-section">A — Producers / farms (rolled up)</div>' +
      renderProducerTable(producers) +
      '<div class="cts-section">B — Bags in this container</div>' +
      renderBagTable(lines) +
      '<p class="cts-foot">Generated from Charcoal Traceability manifest and producer registry. ' +
      "GPS coordinates use the Producers API where linked.</p>" +
      "</div>";

    return (
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>Container traceability summary</title>" +
      "<style>" +
      summaryStyles() +
      "</style></head><body>" +
      body +
      "</body></html>"
    );
  };

  CIS.containerTraceabilitySummaryPdfFilename = function (pack) {
    var cont = firstContainerFromPack(pack);
    var ref = ((cont && (cont.container_number || cont.fcl_number)) || "container")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 48);
    return "Traceability_Summary_" + ref + ".pdf";
  };

  CIS.fetchContainerTraceabilityPack = async function (api, containerId) {
    if (!containerId) throw new Error("Choose a container first.");
    if (!api || typeof api.traceability !== "function") {
      throw new Error("Traceability API is not available.");
    }
    return await api.traceability("/containers/eudr-documentation-pack", {
      method: "POST",
      body: { container_ids: [containerId] },
    });
  };

  CIS.showContainerTraceabilitySummaryPreview = async function (api, containerId, printOpts) {
    if (!CIS.showHtmlDocumentPreview) {
      throw new Error("Document output module not loaded.");
    }
    var pack = await CIS.fetchContainerTraceabilityPack(api, containerId);
    var cont = firstContainerFromPack(pack);
    var label = (cont && cont.container_number) || "Container";
    var frozenPack = pack;
    return CIS.showHtmlDocumentPreview({
      title: "Preview — Traceability summary · " + label,
      frameClassName: "a4-print-preview-overlay__frame cm-container-sheet-preview-frame",
      pdfFilename: CIS.containerTraceabilitySummaryPdfFilename(frozenPack),
      autoPrintAfterLoad: !!(printOpts && printOpts.autoPrint),
      getHtml: function () {
        return CIS.buildContainerTraceabilitySummaryHtml(frozenPack);
      },
      downloadPdf: function () {
        return CIS.downloadHtmlDocumentPdf(
          CIS.buildContainerTraceabilitySummaryHtml(frozenPack),
          CIS.containerTraceabilitySummaryPdfFilename(frozenPack)
        );
      },
    });
  };
})();
