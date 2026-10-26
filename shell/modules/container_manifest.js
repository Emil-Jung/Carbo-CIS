/* Container load sheet — operational print layout (Traceability Documentation). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var ENTRIES_PER_PAGE = 60;
  var ROWS_PER_COLUMN = 30;

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

  /** Container Load Sheet only — LF2.5 → DOM2.5 display; underlying keys unchanged. */
  function sheetProductDisplay(header) {
    var h = header || {};
    var key = String(h.product_key || "").trim();
    var label = String(h.product_label || "").trim();
    var keyU = key.toUpperCase();

    if (keyU === "LF2.5" || /\bLF2\.5\b/i.test(label)) {
      return "DOM2.5 — 2.5 kg retail bag";
    }
    if (keyU === "DOM2.5" || /\bDOM2\.5\b/i.test(label)) {
      if (/2\.5\s*kg/i.test(label)) return label.replace(/\bLF2\.5\b/gi, "DOM2.5");
      return "DOM2.5 — 2.5 kg retail bag";
    }
    if (label) {
      return label
        .replace(/^Pallet\s*[—–-]\s*/i, "")
        .replace(/\bLF2\.5\b/gi, "DOM2.5")
        .replace(/\bLe Fournaise\b/gi, "DOM2.5");
    }
    return key || "";
  }

  function isPalletStream(line) {
    return String((line && line.product_stream) || "").trim().toLowerCase() === "pallet";
  }

  /** Operational loading rows — pallet records only; never bag/producer traceability rows. */
  function loadingEntriesFromManifest(manifest) {
    var lines = (manifest && manifest.lines) || [];
    var pallets = lines.filter(isPalletStream);
    return pallets.map(function (ln) {
      var w = ln.weight_kg;
      if (w == null || w === "" || isNaN(Number(w))) w = "";
      else w = Math.round(Number(w));
      return { weight_kg: w };
    });
  }

  function chunkPages(entries) {
    var pages = [];
    if (!entries.length) {
      pages.push([]);
      return pages;
    }
    for (var i = 0; i < entries.length; i += ENTRIES_PER_PAGE) {
      pages.push(entries.slice(i, i + ENTRIES_PER_PAGE));
    }
    return pages;
  }

  function splitHalves(pageEntries) {
    var left = pageEntries.slice(0, ROWS_PER_COLUMN);
    var right = pageEntries.slice(ROWS_PER_COLUMN, ENTRIES_PER_PAGE);
    while (left.length < ROWS_PER_COLUMN) left.push(null);
    while (right.length < ROWS_PER_COLUMN) right.push(null);
    return { left: left, right: right };
  }

  function renderLoadColumn(rows) {
    var html =
      '<table class="cm-load"><thead><tr><th class="cm-nr">NR</th><th>SUPPLIER</th><th class="cm-w">WEIGHT</th></tr></thead><tbody>';
    for (var i = 0; i < ROWS_PER_COLUMN; i++) {
      var ln = rows[i];
      var nr = i + 1;
      var weightCell = "&nbsp;";
      if (ln && ln.weight_kg !== "" && ln.weight_kg != null) {
        weightCell = esc(String(ln.weight_kg));
      }
      html +=
        "<tr><td class=\"cm-nr\">" +
        nr +
        "</td><td>&nbsp;</td><td class=\"cm-w\">" +
        weightCell +
        "</td></tr>";
    }
    html += "</tbody></table>";
    return html;
  }

  function computeTotals(manifest, entries) {
    var sum = (manifest && manifest.summary) || {};
    var h = (manifest && manifest.header) || {};
    var tare = sum.tare_kg;
    var hasTare = tare != null && tare !== "" && !isNaN(Number(tare));

    var weightLoaded = "";
    if (entries.length) {
      var wSum = 0;
      var any = false;
      entries.forEach(function (e) {
        if (e.weight_kg !== "" && e.weight_kg != null && !isNaN(Number(e.weight_kg))) {
          wSum += Number(e.weight_kg);
          any = true;
        }
      });
      if (any) weightLoaded = String(Math.round(wSum));
    } else if (entries.length === 0 && (manifest.lines || []).length === 0) {
      weightLoaded =
        sum.weight_loaded_kg != null && sum.weight_loaded_kg !== ""
          ? String(sum.weight_loaded_kg)
          : "";
    }

    var qtyBags = "";
    if (entries.length && entries.length === (manifest.lines || []).filter(isPalletStream).length) {
      qtyBags = String(entries.length);
    } else if (!(manifest.lines || []).length) {
      qtyBags =
        sum.qty_bags != null && sum.qty_bags !== "" ? String(sum.qty_bags) : "";
    }

    var grossTotal = "";
    if (weightLoaded !== "" && hasTare) {
      grossTotal = String(Math.round(Number(weightLoaded) + Number(tare)));
    } else if (sum.total_kg != null && entries.length && hasTare) {
      grossTotal = String(sum.total_kg);
    }

    return {
      qty_bags: qtyBags,
      weight_loaded: weightLoaded,
      gross_total: grossTotal,
      bag_total_blank: "",
    };
  }

  function detailRow(label, value) {
    return (
      '<div class="cm-detail-row">' +
      '<span class="cm-detail-lbl">' +
      esc(label) +
      "</span>" +
      '<span class="cm-detail-val">' +
      (value ? esc(value) : "&nbsp;") +
      "</span></div>"
    );
  }

  function sheetStyles() {
    return (
      "@page{size:A4 portrait;margin:10mm;}" +
      "html,body{margin:0;padding:0;background:#fff;color:#000;}" +
      "body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;line-height:1.2;}" +
      ".cm-sheet-page{box-sizing:border-box;width:100%;max-width:190mm;margin:0 auto;padding:0;page-break-after:always;}" +
      ".cm-sheet-page:last-child{page-break-after:auto;}" +
      "h1.cm-title{font-size:12pt;font-weight:700;text-align:center;margin:0 0 6px;letter-spacing:0.06em;}" +
      "h2.cm-cont{font-size:9pt;font-weight:700;text-align:center;margin:0 0 8px;}" +
      "table.cm-head{width:100%;border-collapse:collapse;margin-bottom:6px;table-layout:fixed;}" +
      "table.cm-head th,table.cm-head td{border:1px solid #000;padding:4px 6px;vertical-align:top;font-size:8pt;}" +
      "table.cm-head th{width:22%;font-weight:700;text-align:left;background:#fff;}" +
      "table.cm-head td{min-height:1.4em;}" +
      ".cm-details{border:1px solid #000;margin-bottom:8px;}" +
      ".cm-detail-row{display:flex;border-bottom:1px solid #000;min-height:22px;}" +
      ".cm-detail-row:last-child{border-bottom:0;}" +
      ".cm-detail-lbl{flex:0 0 28%;font-weight:700;font-size:8pt;padding:3px 6px;border-right:1px solid #000;}" +
      ".cm-detail-val{flex:1;padding:3px 6px;font-size:9pt;}" +
      ".cm-main{display:grid;grid-template-columns:1fr 1fr 34mm;gap:4px;align-items:start;}" +
      "table.cm-load{width:100%;border-collapse:collapse;table-layout:fixed;}" +
      "table.cm-load th,table.cm-load td{border:1px solid #000;padding:2px 3px;vertical-align:middle;font-size:7.5pt;height:16px;}" +
      "table.cm-load th{font-weight:700;text-align:center;background:#fff;}" +
      "table.cm-load td.cm-nr,table.cm-load th.cm-nr{width:7mm;text-align:center;}" +
      "table.cm-load td.cm-w,table.cm-load th.cm-w{width:11mm;text-align:right;}" +
      ".cm-side{font-size:8pt;}" +
      ".cm-side-title{font-weight:700;text-align:center;margin:0 0 3px;font-size:8pt;}" +
      "table.cm-team{width:100%;border-collapse:collapse;}" +
      "table.cm-team th,table.cm-team td{border:1px solid #000;padding:2px 3px;font-size:7.5pt;height:14px;}" +
      "table.cm-team th{text-align:center;font-weight:700;}" +
      ".cm-totals{margin-top:6px;border:1px solid #000;}" +
      ".cm-total-row{display:flex;border-bottom:1px solid #000;min-height:18px;}" +
      ".cm-total-row:last-child{border-bottom:0;}" +
      ".cm-total-lbl{flex:1;font-weight:700;font-size:7pt;padding:2px 4px;border-right:1px solid #000;}" +
      ".cm-total-val{flex:0 0 14mm;padding:2px 4px;text-align:right;font-size:8pt;}" +
      ".cm-eudr{margin:8px 0;padding:6px;border:1px dashed #666;font-size:9pt;}" +
      "@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}"
    );
  }

  function renderSheetPage(manifest, variant, printOpts, pageEntries, pageIndex, pageCount, totals) {
    var opts = printOpts || {};
    var h = manifest.header || {};
    var sheetDateRaw =
      opts.sheetDate != null && opts.sheetDate !== ""
        ? opts.sheetDate
        : h.load_date || h.expected_ship_date;
    var loadDate = fmtDate(sheetDateRaw);
    var bookingRef =
      opts.bookingRef != null && String(opts.bookingRef).trim() !== ""
        ? String(opts.bookingRef).trim()
        : h.booking_ref || "";
    var halves = splitHalves(pageEntries);
    var continued = pageIndex > 0 ? " (continued)" : "";
    var eudrBlock =
      variant === "eudr" && pageIndex === 0
        ? '<div class="cm-eudr">EUDR manifest — extended fields and layout to be added.</div>'
        : "";

    var details =
      detailRow("CONTAINER", h.container_number || "") +
      detailRow("DELIVERY NOTE", h.delivery_note || "") +
      detailRow("TRANSPORTER", h.transporter || "") +
      detailRow("REG", h.tag_ref || "");
    if (bookingRef) {
      details += detailRow("BOOKING REF", bookingRef);
    }

    var totalsBlock =
      pageIndex === pageCount - 1
        ? '<div class="cm-totals">' +
          '<div class="cm-total-row"><span class="cm-total-lbl">QTY BAGS</span><span class="cm-total-val">' +
          (totals.qty_bags ? esc(totals.qty_bags) : "&nbsp;") +
          '</span><span class="cm-total-lbl">TOTAL</span><span class="cm-total-val">&nbsp;</span></div>' +
          '<div class="cm-total-row"><span class="cm-total-lbl">WEIGHT LOADED</span><span class="cm-total-val">' +
          (totals.weight_loaded ? esc(totals.weight_loaded) : "&nbsp;") +
          '</span><span class="cm-total-lbl">TOTAL</span><span class="cm-total-val">' +
          (totals.gross_total ? esc(totals.gross_total) : "&nbsp;") +
          "</span></div></div>"
        : "";

    return (
      '<section class="cm-sheet-page">' +
      '<h1 class="cm-title">CONTAINER LOAD SHEET' +
      (variant === "eudr" ? " (EUDR)" : "") +
      esc(continued) +
      "</h1>" +
      eudrBlock +
      (pageIndex === 0
        ? '<table class="cm-head"><tr><th>DATE</th><th>PRODUCT</th><th>TO</th></tr><tr><td>' +
          esc(loadDate) +
          "</td><td>" +
          esc(sheetProductDisplay(h)) +
          "</td><td>" +
          esc(h.ship_to || "") +
          "</td></tr></table>" +
          '<div class="cm-details">' +
          details +
          "</div>"
        : "") +
      '<div class="cm-main">' +
      renderLoadColumn(halves.left) +
      renderLoadColumn(halves.right) +
      '<div class="cm-side">' +
      (pageIndex === 0
        ? '<p class="cm-side-title">Loading Team</p><table class="cm-team"><thead><tr><th>NR</th><th>NAME</th></tr></thead><tbody>' +
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            .map(function (n) {
              return "<tr><td>" + n + "</td><td>&nbsp;</td></tr>";
            })
            .join("") +
          "</tbody></table>"
        : "") +
      totalsBlock +
      "</div></div></section>"
    );
  }

  function defaultSheetDateIso(header) {
    var h = header || {};
    var raw = h.load_date || h.expected_ship_date;
    if (raw) {
      var s = String(raw);
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    }
    if (h.released_for_loading_at) {
      try {
        var d = new Date(h.released_for_loading_at);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-CA", { timeZone: "Africa/Windhoek" });
        }
      } catch (e) { /* ignore */ }
    }
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Windhoek" });
  }

  function defaultPrintOpts(manifest) {
    var h = (manifest && manifest.header) || {};
    return {
      sheetDate: defaultSheetDateIso(h),
      bookingRef: h.booking_ref || "",
    };
  }

  function buildHtml(manifest, variant, printOpts) {
    var entries = loadingEntriesFromManifest(manifest);
    var pages = chunkPages(entries);
    var totals = computeTotals(manifest, entries);
    var body = "";
    for (var p = 0; p < pages.length; p++) {
      body += renderSheetPage(manifest, variant, printOpts, pages[p], p, pages.length, totals);
    }

    var title = (manifest.header && manifest.header.container_number) || "Container";
    return (
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>" +
      esc(title) +
      "</title><style>" +
      sheetStyles() +
      "</style></head><body>" +
      body +
      "</body></html>"
    );
  }

  CIS.buildContainerManifestHtml = buildHtml;
  CIS.containerSheetLoadingEntries = loadingEntriesFromManifest;
  CIS.containerSheetProductDisplay = sheetProductDisplay;

  function sheetVariantKey(variant) {
    return variant === "eudr" ? "eudr" : "general";
  }

  function sheetPdfFilename(manifest) {
    var num = ((manifest && manifest.header && manifest.header.container_number) || "container")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 40);
    return "ContainerSheet_" + num + ".pdf";
  }

  function sheetHtml(manifest, variant, printOpts) {
    var opts = Object.assign({}, defaultPrintOpts(manifest), printOpts || {});
    return buildHtml(manifest, sheetVariantKey(variant), opts);
  }

  CIS.downloadContainerSheetPdf = function (manifest, variant, printOpts) {
    if (!manifest || !manifest.header) {
      return Promise.reject(new Error("No manifest data to export."));
    }
    if (!CIS.downloadHtmlDocumentPdf) {
      return Promise.reject(new Error("Document output module not loaded."));
    }
    return CIS.downloadContainerSheetPdfFromHtml(
      sheetHtml(manifest, variant, printOpts),
      manifest
    );
  };

  CIS.downloadContainerSheetPdfFromHtml = function (html, manifest) {
    if (!html || !String(html).trim()) {
      return Promise.reject(new Error("No document content to export."));
    }
    if (!manifest || !manifest.header) {
      return Promise.reject(new Error("No manifest data to export."));
    }
    if (!CIS.downloadHtmlDocumentPdf) {
      return Promise.reject(new Error("Document output module not loaded."));
    }
    return CIS.downloadHtmlDocumentPdf(html, sheetPdfFilename(manifest));
  };

  CIS.showContainerSheetPreview = function (manifest, variant, printOpts) {
    if (!manifest || !manifest.header) {
      return Promise.reject(new Error("No manifest data to show."));
    }
    if (!CIS.showHtmlDocumentPreview) {
      return Promise.reject(new Error("Document output module not loaded."));
    }
    var frozenManifest = manifest;
    var opts = Object.assign({}, defaultPrintOpts(frozenManifest), printOpts || {});
    var h = frozenManifest.header || {};
    var lastRenderedHtml = "";

    var fields = document.createElement("div");
    fields.className = "cm-sheet-preview-fields";
    var dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = opts.sheetDate || defaultSheetDateIso(h);
    dateInput.className = "cm-sheet-preview-date";
    var bookingInput = document.createElement("input");
    bookingInput.type = "text";
    bookingInput.value = opts.bookingRef || "";
    bookingInput.placeholder = "Booking ref";
    bookingInput.autocomplete = "off";
    bookingInput.className = "cm-sheet-preview-booking";
    function addField(labelText, inputEl) {
      var lab = document.createElement("label");
      lab.className = "cm-sheet-preview-field";
      var span = document.createElement("span");
      span.className = "cm-sheet-preview-field-label";
      span.textContent = labelText;
      lab.appendChild(span);
      lab.appendChild(inputEl);
      fields.appendChild(lab);
    }
    addField("Date", dateInput);
    addField("Booking ref", bookingInput);

    function currentOpts() {
      return {
        sheetDate: dateInput.value,
        bookingRef: bookingInput.value.trim(),
      };
    }

    function buildCurrentHtml() {
      return sheetHtml(frozenManifest, sheetVariantKey(variant), currentOpts());
    }

    return CIS.showHtmlDocumentPreview({
      title: "Preview — Container Load Sheet · " + (h.container_number || "FCL"),
      pdfFilename: sheetPdfFilename(frozenManifest),
      closeLabel: "Back",
      printLabel: "Print",
      toolbar: fields,
      frameClassName: "a4-print-preview-overlay__frame cm-container-sheet-preview-frame",
      getHtml: function () {
        var html = buildCurrentHtml();
        if (!html || !String(html).trim()) {
          throw new Error("Container sheet is empty.");
        }
        lastRenderedHtml = html;
        return html;
      },
      downloadPdf: function () {
        var html = lastRenderedHtml || buildCurrentHtml();
        return CIS.downloadContainerSheetPdfFromHtml(html, frozenManifest);
      },
      onMount: function (api) {
        var refreshTimer = null;
        function scheduleRefresh() {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(function () {
            api.refreshPreview().catch(function (e) {
              api.showErr(e.message || String(e));
            });
          }, 200);
        }
        dateInput.addEventListener("change", scheduleRefresh);
        bookingInput.addEventListener("input", scheduleRefresh);
        bookingInput.addEventListener("change", scheduleRefresh);
      },
    }).then(function () {
      return { closed: true };
    });
  };

  CIS.printContainerManifest = function (manifest, variant, printOpts) {
    return CIS.showContainerSheetPreview(manifest, variant, printOpts);
  };

  CIS.openContainerManifestPrintDialog = function (manifest, variant) {
    return CIS.showContainerSheetPreview(manifest, variant, defaultPrintOpts(manifest));
  };
})();
