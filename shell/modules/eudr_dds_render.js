/* EUDR Due Diligence Statement — print/PDF HTML (matches reference layout). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var DECLARATION =
    "“By submitting this due diligence statement, the operator confirms that due " +
    "diligence in accordance with Regulation (EU) 2023/1115 was carried out and " +
    "that no or only a negligible risk was found that the relevant products do not " +
    "comply with Article 3, point (a) or (b), of that Regulation.”";

  var ADDRESS_HTML =
    "admin@carbonamibia.com.na<br>www.carbonamibia.com.na<br><br>" +
    "PO Box 1486<br>Grootfontein, Namibia<br><br>" +
    "Ervin 484<br>Maroela Street<br>Grootfontein, Namibia<br><br>" +
    "Tel: +264 (0) 67 240279";

  CIS.EUDR_DDS_FIELD_KEYS = [
    "client",
    "container",
    "container_schedule",
    "carbo_ref",
    "destination",
    "shipment_date",
    "operator",
    "operator_address",
    "eori",
    "product",
    "hs_code",
    "trade_description",
    "wood_species",
    "net_mass",
    "country",
    "geolocation",
    "dds_reference",
    "container_sheet",
    "geojson",
    "traceability_record",
    "signed_for",
    "signature_date",
    "signatory",
    "signature",
  ];

  CIS.eudrDdsDefaultFields = function () {
    var today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    return {
      client: "",
      container: "",
      container_schedule: "",
      carbo_ref: "",
      destination: "",
      shipment_date: today,
      operator: "Carbo Namibia",
      operator_address: "[Carbo registered address]",
      eori: "[If applicable / EU operator reference]",
      product: "Hardwood charcoal",
      hs_code: "4402 — Charcoal, whether or not agglomerated",
      trade_description: "Hardwood lump charcoal for retail / food-service use",
      wood_species:
        "[Common name and full scientific name — insert from production record]",
      net_mass: "[XX,XXX kg]",
      country: "Namibia",
      geolocation:
        "See accompanying Container Sheet and GeoJSON files covering all production plots contributing to this container",
      dds_reference: "[EU Information System DDS reference number, once submitted]",
      container_sheet:
        "Detailed producer, farm, camp, production and traceability information for this container.",
      geojson:
        "Geolocation files for all production plots contributing to the container.",
      traceability_record:
        "Carbo system record linking production material to the container.",
      signed_for: "Carbo Namibia",
      signature_date: today,
      signatory: "[Name / Function]",
      signature: "[Signature]",
    };
  };

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nl2br(text) {
    return escapeHtml(text).replace(/\r?\n/g, "<br>");
  }

  function shellAssetUrl(filename) {
    try {
      var cur = document.currentScript;
      if (cur && cur.src) {
        return cur.src.replace(/modules\/[^/]+$/, "assets/") + filename;
      }
    } catch (e) { /* ignore */ }
    var link = document.querySelector('script[src*="eudr_dds_render.js"]');
    if (link && link.src) {
      return link.src.replace(/modules\/[^/]+$/, "assets/") + filename;
    }
    var root = "/cis/";
    try {
      if (document.location && document.location.pathname) {
        root = document.location.pathname.replace(/\/?index\.html?$/, "/");
        if (!root.endsWith("/")) root += "/";
      }
    } catch (e2) { /* ignore */ }
    return root + "assets/" + filename;
  }

  var assetDataUrlCache = {};

  function fetchAssetDataUrl(filename) {
    if (assetDataUrlCache[filename]) {
      return Promise.resolve(assetDataUrlCache[filename]);
    }
    var url = shellAssetUrl(filename);
    return fetch(url, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load asset " + filename);
        return res.blob();
      })
      .then(function (blob) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () {
            assetDataUrlCache[filename] = reader.result;
            resolve(reader.result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      });
  }

  CIS.prepareEudrDdsAssetUrls = function () {
    return Promise.all([
      fetchAssetDataUrl("eudr-letterhead-logo.png"),
      fetchAssetDataUrl("eudr-watermark.png"),
    ]).then(function (pair) {
      return { logoSrc: pair[0], watermarkSrc: pair[1] };
    });
  };

  function documentStyles() {
    return (
      ":root{--gold:#d9a62e;--line:#888;--head:#e7e7e7;--ink:#171717}" +
      "*{box-sizing:border-box}" +
      "html,body{margin:0;padding:0;background:#fff;color:var(--ink);" +
      "font:13px Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      ".eudr-dds-page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;" +
      "padding:13mm 14mm 14mm;position:relative;overflow:hidden}" +
      ".eudr-dds-letterhead{display:grid;grid-template-columns:33mm 1fr 55mm;gap:7mm;" +
      "min-height:43mm;align-items:start}" +
      ".eudr-dds-logo{width:28mm;height:39mm;object-fit:contain}" +
      ".eudr-dds-brand{padding-top:12mm;color:var(--gold);font-size:19px;letter-spacing:1px}" +
      ".eudr-dds-tagline{font-size:11px;letter-spacing:1.5px;color:#888;margin-top:12px;white-space:nowrap}" +
      ".eudr-dds-address{text-align:right;color:#888;font-size:10px;line-height:1.65;" +
      "padding-top:2mm;letter-spacing:.4px}" +
      ".eudr-dds-title{margin:6mm 0 1mm 11mm;font-size:19px;font-weight:700}" +
      ".eudr-dds-subtitle{margin:0 0 5mm 11mm;font-size:12px}" +
      "table{border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 4mm}" +
      "td,th{border:1px solid var(--line);padding:4px 7px;vertical-align:middle;overflow-wrap:anywhere}" +
      ".eudr-dds-label{background:var(--head);font-weight:700;width:27%}" +
      ".eudr-dds-value{width:73%;white-space:pre-wrap}" +
      ".eudr-dds-summary .eudr-dds-label{width:17%}.eudr-dds-summary .eudr-dds-value{width:33%}" +
      ".eudr-dds-section-title{text-align:center;font-weight:700;margin:2mm 0 2mm}" +
      ".eudr-dds-package .eudr-dds-label{width:28%}.eudr-dds-package .eudr-dds-value{width:72%}" +
      ".eudr-dds-declaration{line-height:1.45;margin:0 0 2mm}" +
      ".eudr-dds-signature td{height:30px}.eudr-dds-signature .eudr-dds-label{width:24%}" +
      ".eudr-dds-footer{position:absolute;bottom:6mm;right:15mm;text-align:right;color:#999;" +
      "font-size:10px;line-height:1.55;z-index:1}" +
      ".eudr-dds-watermark{position:absolute;right:10mm;bottom:17mm;width:33mm;opacity:.11;" +
      "z-index:0;pointer-events:none}" +
      ".eudr-dds-content{position:relative;z-index:1}" +
      ".eudr-dds-scope-note{font-size:11px;margin:0 0 4mm 11mm;color:#444}" +
      ".eudr-dds-schedule td{font-size:10px;padding:3px 5px}" +
      ".eudr-dds-schedule .eudr-dds-label{width:100%;text-align:center}" +
      ".eudr-dds-page-break{page-break-after:always}" +
      ".eudr-dds-cont-page-title{font-size:12px;font-weight:700;margin:0 0 3mm}" +
      "@page{size:A4;margin:0}"
    );
  }

  function formatKgCell(r) {
    if (r.duplicate_bag_ids && r.duplicate_bag_ids.length) {
      return (
        "Unconfirmed — duplicate bag row(s): " +
        r.duplicate_bag_ids.slice(0, 3).join(", ") +
        (r.duplicate_bag_ids.length > 3 ? "…" : "")
      );
    }
    if (r.mass_complete && r.net_mass_kg != null) {
      return String(r.net_mass_kg).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " kg";
    }
    var partial = r.net_mass_kg_display != null ? r.net_mass_kg_display : r.net_mass_kg;
    if (partial != null) {
      return (
        "Incomplete — " +
        String(partial).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
        " kg (" +
        (r.bags_with_mass != null ? r.bags_with_mass : "?") +
        "/" +
        (r.bag_count != null ? r.bag_count : "?") +
        " bags)"
      );
    }
    return "No net product mass recorded";
  }

  function renderScheduleTableChunk(rows, opts) {
    opts = opts || {};
    var html =
      '<table class="eudr-dds-schedule"><tr>' +
      '<td class="eudr-dds-label" colspan="3">CONTAINERS INCLUDED IN THIS BOOKING</td></tr>' +
      '<tr><td class="eudr-dds-label">Container number</td><td class="eudr-dds-label">FCL</td>' +
      '<td class="eudr-dds-label">Net product mass</td></tr>';
    rows.forEach(function (r) {
      html +=
        "<tr><td class=\"eudr-dds-value\">" +
        escapeHtml(r.container_number || "—") +
        "</td><td class=\"eudr-dds-value\">" +
        escapeHtml(r.fcl_number || "—") +
        "</td><td class=\"eudr-dds-value\">" +
        escapeHtml(formatKgCell(r)) +
        "</td></tr>";
    });
    if (opts.totalLabel) {
      html +=
        '<tr><td class="eudr-dds-label" colspan="2">Booking total (net product mass)</td>' +
        '<td class="eudr-dds-value">' +
        escapeHtml(opts.totalLabel) +
        "</td></tr>";
    }
    html += "</table>";
    return html;
  }

  function renderContainerSchedulePages(scopeSnapshot, logo, wm, bookingRef) {
    var rows = (scopeSnapshot && scopeSnapshot.containers) || [];
    if (!rows.length) {
      return (
        '<p class="eudr-dds-scope-note">No container rows in frozen scope snapshot.</p>'
      );
    }
    var agg = scopeSnapshot.aggregates || {};
    var totalLabel = null;
    if (agg.net_mass_all_containers && agg.net_mass_kg != null) {
      totalLabel =
        String(agg.net_mass_kg).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
        " kg (complete total)";
    } else if (agg.net_mass_partial_kg) {
      totalLabel =
        String(agg.net_mass_partial_kg).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
        " kg (partial — not all containers complete)";
    }
    var chunkSize = 22;
    var chunks = [];
    for (var i = 0; i < rows.length; i += chunkSize) {
      chunks.push(rows.slice(i, i + chunkSize));
    }
    var out = "";
    chunks.forEach(function (chunk, idx) {
      var isLast = idx === chunks.length - 1;
      if (idx === 0) {
        out += renderScheduleTableChunk(chunk, isLast ? { totalLabel: totalLabel } : {});
        return;
      }
      out +=
        '<div class="eudr-dds-page eudr-dds-page-break">' +
        '<img class="eudr-dds-watermark" alt="" src="' +
        escapeHtml(wm) +
        '">' +
        '<div class="eudr-dds-content">' +
        '<p class="eudr-dds-cont-page-title">EUDR Due Diligence Statement — Booking ' +
        escapeHtml(bookingRef || "") +
        " (container schedule continued)</p>" +
        renderScheduleTableChunk(chunk, isLast ? { totalLabel: totalLabel } : {}) +
        '<div class="eudr-dds-footer">Reg no: 2005/570<br>Vat no: 4077142-01-5<br>FSC-C114374</div>' +
        "</div></div>";
    });
    return out;
  }

  function renderBookingSummaryTable(f, scopeSnapshot) {
    var n =
      (scopeSnapshot && scopeSnapshot.container_count) ||
      (scopeSnapshot && scopeSnapshot.containers && scopeSnapshot.containers.length) ||
      "—";
    return (
      '<table class="eudr-dds-summary"><tr>' +
      '<td class="eudr-dds-label">Booking reference</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "carbo_ref")) +
      '</td><td class="eudr-dds-label">Client reference</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "client")) +
      "</td></tr><tr>" +
      '<td class="eudr-dds-label">Destination</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "destination")) +
      '</td><td class="eudr-dds-label">Shipment date</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "shipment_date")) +
      "</td></tr><tr>" +
      '<td class="eudr-dds-label">Container count</td><td class="eudr-dds-value">' +
      escapeHtml(String(n)) +
      '</td><td class="eudr-dds-label">Booking net mass</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "net_mass")) +
      "</td></tr></table>"
    );
  }

  function cellValue(fields, key) {
    var v = fields && fields[key];
    if (v == null || v === "") return "—";
    return String(v);
  }

  /**
   * @param {object} fields
   * @param {{ logoSrc?: string, watermarkSrc?: string }} assets
   * @param {{ scopeMode?: string, scopeSnapshot?: object }} scope
   */
  CIS.buildEudrDdsDocumentHtml = function (fields, assets, scope) {
    assets = assets || {};
    scope = scope || {};
    var f = fields || {};
    var scopeMode = scope.scopeMode || "single";
    var scopeSnapshot = scope.scopeSnapshot || null;
    var logo = assets.logoSrc || shellAssetUrl("eudr-letterhead-logo.png");
    var wm = assets.watermarkSrc || shellAssetUrl("eudr-watermark.png");
    var opAddr = cellValue(f, "operator_address");
    if (opAddr.indexOf("[Carbo registered address]") >= 0) {
      opAddr = ADDRESS_HTML.replace(/<br>/g, "\n");
    }

    var body =
      '<div class="eudr-dds-page">' +
      '<img class="eudr-dds-watermark" alt="" src="' +
      escapeHtml(wm) +
      '">' +
      '<div class="eudr-dds-content">' +
      '<header class="eudr-dds-letterhead">' +
      '<img class="eudr-dds-logo" alt="Carbo Namibia" src="' +
      escapeHtml(logo) +
      '">' +
      '<div><div class="eudr-dds-brand">Carbo Namibia Pty Ltd</div>' +
      '<div class="eudr-dds-tagline">together we create a better life to live</div></div>' +
      '<div class="eudr-dds-address">' +
      ADDRESS_HTML +
      "</div></header>" +
      '<h1 class="eudr-dds-title">CARBO NAMIBIA<br>EUDR DUE DILIGENCE STATEMENT</h1>' +
      '<p class="eudr-dds-subtitle">Internal reference – Client: ' +
      escapeHtml(cellValue(f, "client")) +
      "</p>" +
      (scopeMode === "booking"
        ? renderBookingSummaryTable(f, scopeSnapshot) +
          renderContainerSchedulePages(
            scopeSnapshot,
            logo,
            wm,
            cellValue(f, "carbo_ref")
          )
        : '<table class="eudr-dds-summary"><tr>' +
          '<td class="eudr-dds-label">Container number</td><td class="eudr-dds-value">' +
          escapeHtml(cellValue(f, "container")) +
          '</td><td class="eudr-dds-label">Carbo reference</td><td class="eudr-dds-value">' +
          escapeHtml(cellValue(f, "carbo_ref")) +
          "</td></tr><tr>" +
          '<td class="eudr-dds-label">Destination</td><td class="eudr-dds-value">' +
          escapeHtml(cellValue(f, "destination")) +
          '</td><td class="eudr-dds-label">Shipment date</td><td class="eudr-dds-value">' +
          escapeHtml(cellValue(f, "shipment_date")) +
          "</td></tr></table>") +
      "<table><tr><td class=\"eudr-dds-label\">Operator</td><td class=\"eudr-dds-value\">" +
      escapeHtml(cellValue(f, "operator")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">Operator Address</td><td class="eudr-dds-value">' +
      nl2br(opAddr) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">EORI Number</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "eori")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">Product</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "product")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">HS Code</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "hs_code")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">Trade Description</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "trade_description")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">Wood Species</td><td class="eudr-dds-value">' +
      nl2br(cellValue(f, "wood_species")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">Net Mass</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "net_mass")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">Country of Production</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "country")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">Production Geolocation</td><td class="eudr-dds-value">' +
      nl2br(cellValue(f, "geolocation")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">DDS Reference</td><td class="eudr-dds-value">' +
      nl2br(cellValue(f, "dds_reference")) +
      "</td></tr></table>" +
      '<div class="eudr-dds-section-title">ACCOMPANYING TRACEABILITY PACKAGE</div>' +
      '<table class="eudr-dds-package">' +
      '<tr><td class="eudr-dds-label">Container Sheet</td><td class="eudr-dds-value">' +
      nl2br(cellValue(f, "container_sheet")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">GeoJSON Files</td><td class="eudr-dds-value">' +
      nl2br(cellValue(f, "geojson")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">Traceability Record</td><td class="eudr-dds-value">' +
      nl2br(cellValue(f, "traceability_record")) +
      "</td></tr></table>" +
      '<div class="eudr-dds-section-title">DECLARATION</div>' +
      '<p class="eudr-dds-declaration">' +
      escapeHtml(DECLARATION) +
      "</p>" +
      '<table class="eudr-dds-signature">' +
      "<tr><td class=\"eudr-dds-label\">Signed for and on behalf of:</td><td class=\"eudr-dds-value\">" +
      escapeHtml(cellValue(f, "signed_for")) +
      '</td><td class="eudr-dds-label">Date:</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "signature_date")) +
      "</td></tr>" +
      '<tr><td class="eudr-dds-label">Name and function:</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "signatory")) +
      '</td><td class="eudr-dds-label">Signature:</td><td class="eudr-dds-value">' +
      escapeHtml(cellValue(f, "signature")) +
      "</td></tr></table>" +
      '<div class="eudr-dds-footer">Reg no: 2005/570<br>Vat no: 4077142-01-5<br>FSC-C114374</div>' +
      "</div></div>";

    return (
      "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
      "<title>EUDR Due Diligence Statement</title><style>" +
      documentStyles() +
      "</style></head><body>" +
      body +
      "</body></html>"
    );
  };

  CIS.buildEudrDdsPdfFilename = function (fields, scope) {
    scope = scope || {};
    var base =
      scope.scopeMode === "booking" && fields && fields.carbo_ref
        ? fields.carbo_ref
        : (fields && fields.container) || "container";
    var safe = String(base).replace(/[^\w.\-]+/g, "_").slice(0, 40);
    return "EUDR_DDS_" + safe + ".pdf";
  };
})();
