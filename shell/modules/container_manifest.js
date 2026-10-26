/* Container load sheet — print layout (general + EUDR placeholder). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var html2pdfLoadPromise = null;
  var cmModuleBase = (function () {
    try {
      var cur = document.currentScript;
      if (cur && cur.src) return cur.src.replace(/[^/]+$/, "");
    } catch (e) { /* ignore */ }
    return "";
  })();

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
    var opts = printOpts || {};
    var h = manifest.header || {};
    var sum = manifest.summary || {};
    var cols = splitColumns(manifest.lines || []);
    var product = h.product_label || h.product_key || "";
    var sheetDateRaw =
      opts.sheetDate != null && opts.sheetDate !== ""
        ? opts.sheetDate
        : h.load_date || h.expected_ship_date;
    var loadDate = fmtDate(sheetDateRaw);
    var bookingRef =
      opts.bookingRef != null && String(opts.bookingRef).trim() !== ""
        ? String(opts.bookingRef).trim()
        : h.booking_ref || "";
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
      "<div><label>BOOKING REF</label>" +
      esc(bookingRef) +
      "</div>" +
      "<div><label>DELIVERY NOTE</label>" +
      esc(h.delivery_note || "") +
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
      "</body></html>"
    );
  }

  CIS.buildContainerManifestHtml = buildHtml;

  function sheetVariantKey(variant) {
    return variant === "eudr" ? "eudr" : "general";
  }

  function sheetPdfFilename(manifest) {
    var num = ((manifest && manifest.header && manifest.header.container_number) || "container")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 40);
    return "ContainerSheet_" + num + ".pdf";
  }

  function vendorScriptUrl(name) {
    if (cmModuleBase) {
      return cmModuleBase.replace(/modules\/$/, "vendor/") + name;
    }
    try {
      var link = document.querySelector('script[src*="container_manifest.js"]');
      if (link && link.src) {
        return link.src.replace(/modules\/[^/]+$/, "vendor/") + name;
      }
    } catch (e) { /* ignore */ }
    var root = "/cis/";
    try {
      if (document.location && document.location.pathname) {
        root = document.location.pathname.replace(/\/?index\.html?$/, "/");
        if (!root.endsWith("/")) root += "/";
      }
    } catch (e2) { /* ignore */ }
    return root + "vendor/" + name;
  }

  function ensureHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (html2pdfLoadPromise) return html2pdfLoadPromise;
    html2pdfLoadPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = vendorScriptUrl("html2pdf.bundle.min.js");
      s.async = true;
      s.onload = function () {
        if (window.html2pdf) resolve(window.html2pdf);
        else reject(new Error("PDF library failed to initialize."));
      };
      s.onerror = function () {
        reject(new Error("Could not load PDF export library (vendor/html2pdf.bundle.min.js)."));
      };
      document.head.appendChild(s);
    });
    return html2pdfLoadPromise;
  }

  function writeHtmlToIframe(iframe, html) {
    return new Promise(function (resolve, reject) {
      try {
        var win = iframe.contentWindow;
        if (!win) {
          reject(new Error("Could not render container sheet preview."));
          return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
        resolve(win);
      } catch (e) {
        reject(e);
      }
    });
  }

  function invokeNativePrint(iframe) {
    var win = iframe.contentWindow;
    if (!win) throw new Error("Print preview is not ready.");
    win.focus();
    win.print();
  }

  CIS.downloadContainerSheetPdf = function (manifest, variant, printOpts) {
    if (!manifest || !manifest.header) {
      return Promise.reject(new Error("No manifest data to export."));
    }
    var opts = Object.assign({}, defaultPrintOpts(manifest), printOpts || {});
    var html = buildHtml(manifest, sheetVariantKey(variant), opts);
    var iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Container sheet PDF render");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:0;visibility:hidden;";
    document.body.appendChild(iframe);
    return writeHtmlToIframe(iframe, html)
      .then(function () {
        return ensureHtml2Pdf();
      })
      .then(function (html2pdf) {
        var body = iframe.contentDocument && iframe.contentDocument.body;
        if (!body) throw new Error("Could not render sheet body for PDF.");
        return html2pdf()
          .set({
            margin: [8, 8, 8, 8],
            filename: sheetPdfFilename(manifest),
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          })
          .from(body)
          .save();
      })
      .then(function () {
        return { ok: true, filename: sheetPdfFilename(manifest) };
      })
      .finally(function () {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      });
  };

  CIS.showContainerSheetPreview = function (manifest, variant, printOpts) {
    if (!manifest || !manifest.header) {
      return Promise.reject(new Error("No manifest data to show."));
    }
    var opts = Object.assign({}, defaultPrintOpts(manifest), printOpts || {});
    var h = manifest.header || {};

    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "a4-print-preview-overlay cm-sheet-preview-overlay";
      var bar = document.createElement("div");
      bar.className = "a4-print-preview-overlay__bar";
      var title = document.createElement("span");
      title.className = "a4-print-preview-overlay__title";
      title.textContent =
        "Container sheet — " + (h.container_number || "FCL");

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
      var dateLab = document.createElement("label");
      dateLab.className = "cm-sheet-preview-field";
      var dateSpan = document.createElement("span");
      dateSpan.className = "cm-sheet-preview-field-label";
      dateSpan.textContent = "Date";
      dateLab.appendChild(dateSpan);
      dateLab.appendChild(dateInput);
      var bookLab = document.createElement("label");
      bookLab.className = "cm-sheet-preview-field";
      var bookSpan = document.createElement("span");
      bookSpan.className = "cm-sheet-preview-field-label";
      bookSpan.textContent = "Booking ref";
      bookLab.appendChild(bookSpan);
      bookLab.appendChild(bookingInput);
      fields.appendChild(dateLab);
      fields.appendChild(bookLab);

      var msg = document.createElement("p");
      msg.className = "error-box cm-sheet-preview-error";
      msg.hidden = true;

      var actions = document.createElement("div");
      actions.className = "a4-print-preview-overlay__actions";
      var pdfBtn = document.createElement("button");
      pdfBtn.type = "button";
      pdfBtn.className = "btn btn-sm";
      pdfBtn.textContent = "Download PDF";
      var printBtn = document.createElement("button");
      printBtn.type = "button";
      printBtn.className = "btn btn-sm";
      printBtn.textContent = "Print…";
      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "btn-ghost btn-sm";
      closeBtn.textContent = "Close";
      actions.appendChild(pdfBtn);
      actions.appendChild(printBtn);
      actions.appendChild(closeBtn);

      var barRight = document.createElement("div");
      barRight.className = "cm-sheet-preview-bar-right";
      barRight.appendChild(fields);
      barRight.appendChild(actions);

      bar.appendChild(title);
      bar.appendChild(barRight);

      var frameWrap = document.createElement("div");
      frameWrap.className = "a4-print-preview-overlay__frame";
      var iframe = document.createElement("iframe");
      iframe.setAttribute("title", "Container load sheet preview");
      frameWrap.appendChild(iframe);
      overlay.appendChild(bar);
      overlay.appendChild(msg);
      overlay.appendChild(frameWrap);
      document.body.appendChild(overlay);

      function currentOpts() {
        return {
          sheetDate: dateInput.value,
          bookingRef: bookingInput.value.trim(),
        };
      }

      function refreshPreview() {
        msg.hidden = true;
        var html = buildHtml(manifest, sheetVariantKey(variant), currentOpts());
        return writeHtmlToIframe(iframe, html);
      }

      function close() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve();
      }

      function showErr(text) {
        msg.textContent = text || "Operation failed.";
        msg.hidden = !text;
      }

      closeBtn.addEventListener("click", close);
      var refreshTimer = null;
      function scheduleRefresh() {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () {
          refreshPreview().catch(function (e) {
            showErr(e.message || String(e));
          });
        }, 200);
      }
      dateInput.addEventListener("change", scheduleRefresh);
      bookingInput.addEventListener("change", scheduleRefresh);

      printBtn.addEventListener("click", function () {
        showErr("");
        refreshPreview()
          .then(function () {
            invokeNativePrint(iframe);
          })
          .catch(function (e) {
            showErr(e.message || String(e));
          });
      });

      pdfBtn.addEventListener("click", function () {
        showErr("");
        pdfBtn.disabled = true;
        CIS.downloadContainerSheetPdf(manifest, variant, currentOpts())
          .catch(function (e) {
            showErr(e.message || String(e));
          })
          .finally(function () {
            pdfBtn.disabled = false;
          });
      });

      refreshPreview().catch(function (e) {
        showErr(e.message || String(e));
      });
    });
  };

  /** @deprecated Pop-up print — use showContainerSheetPreview or downloadContainerSheetPdf. */
  CIS.printContainerManifest = function (manifest, variant, printOpts) {
    return CIS.showContainerSheetPreview(manifest, variant, printOpts);
  };

  CIS.openContainerManifestPrintDialog = function (manifest, variant) {
    return CIS.showContainerSheetPreview(manifest, variant, defaultPrintOpts(manifest));
  };
})();
