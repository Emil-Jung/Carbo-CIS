/* Print Labels — production ZT231 bag identity labels (server-allocated Bag IDs). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];
  var ZPL = window.CIS_LABEL_ZPL;

  var LS = "cis_print_labels_v6";
  var LS_LEGACY = "cis_print_labels_v4";
  var CHUNK = 50;
  var MAX_QUANTITY = 10000;
  var SERIAL_RE = /^BAG-\d{4}-\d{6,}$/i;
  /** Capture year + sequence — SERIAL_RE alone has no groups (do not use match[1] on it). */
  var BAG_ID_PARTS = /^BAG-(\d{4})-(\d+)$/i;
  var ZEBRA_STOCK_6128 = "6128";
  var ZEBRA_STOCK_5425 = "5425";
  var PL_RELEASE_ID = "20261020-reprint-stable";
  var PL_UI_VERSION = "1.9.12";
  var STOCK_PROFILES = {
    "6128": {
      code: "6128",
      title: "62 × 28 mm standard stock",
      short: "62×28",
      warnSmall: false,
    },
    "5425": {
      code: "5425",
      title: "54 × 25 mm legacy SMALL stock",
      short: "54×25",
      warnSmall: true,
    },
  };
  CIS.printLabelsUiVersion = PL_UI_VERSION;
  CIS.printLabelsReleaseId = PL_RELEASE_ID;
  var DISPLAY_TZ = "Africa/Windhoek";
  var HISTORY_LIMIT = 300;

  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function localDateParts(iso) {
    if (!iso) return null;
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: DISPLAY_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      var y = "";
      var m = "";
      var day = "";
      parts.forEach(function (p) {
        if (p.type === "year") y = p.value;
        if (p.type === "month") m = p.value;
        if (p.type === "day") day = p.value;
      });
      return {
        y: parseInt(y, 10),
        m: parseInt(m, 10),
        d: parseInt(day, 10),
        iso: y + "-" + m + "-" + day,
      };
    } catch (e) {
      return null;
    }
  }

  function mondayIso(y, m, d) {
    var dt = new Date(Date.UTC(y, m - 1, d));
    var dow = dt.getUTCDay();
    var shift = dow === 0 ? -6 : 1 - dow;
    dt.setUTCDate(dt.getUTCDate() + shift);
    return dt.toISOString().slice(0, 10);
  }

  function weekKeyFromRun(run) {
    var parts = localDateParts(run.created_at);
    if (!parts) return "unknown";
    return mondayIso(parts.y, parts.m, parts.d);
  }

  function fmtWeekLabel(weekStartIso) {
    if (!weekStartIso || weekStartIso === "unknown") return "Unknown week";
    var p = weekStartIso.split("-");
    if (p.length !== 3) return weekStartIso;
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10);
    var d = parseInt(p[2], 10);
    var end = new Date(Date.UTC(y, m - 1, d + 6));
    return (
      "Week " + d + " " + MONTH_SHORT[m - 1] + " – " +
      end.getUTCDate() + " " + MONTH_SHORT[end.getUTCMonth()] + " " + end.getUTCFullYear()
    );
  }

  function groupRunsByWeek(runs) {
    var map = {};
    (runs || []).forEach(function (run) {
      var key = weekKeyFromRun(run);
      if (!map[key]) map[key] = { weekStart: key, runs: [] };
      map[key].runs.push(run);
    });
    return Object.keys(map).sort().reverse().map(function (key) {
      var group = map[key];
      var qty = group.runs.reduce(function (sum, run) {
        return sum + (parseInt(run.quantity, 10) || 0);
      }, 0);
      group.count = group.runs.length;
      group.quantity = qty;
      group.label = fmtWeekLabel(group.weekStart);
      return group;
    });
  }

  function loadSettings(ctx) {
    var cfg = (ctx && ctx.config) || {};
    var s = {
      zebraPrinterName: "",
      a4PrinterName: "",
      labelFormat: "zebra",
      zebraStock: ZEBRA_STOCK_6128,
      zebraPrintMode: "windows",
      zebraHost: cfg.zebraPrinterHost || "192.168.8.73",
      zebraPort: cfg.zebraPrinterPort != null ? cfg.zebraPrinterPort : 9100,
    };
    try {
      var raw = localStorage.getItem(LS);
      if (!raw) raw = localStorage.getItem("cis_print_labels_v5");
      if (!raw) raw = localStorage.getItem(LS_LEGACY);
      var parsed = null;
      if (raw) {
        parsed = JSON.parse(raw);
        if (parsed.zebraPrinterName) s.zebraPrinterName = parsed.zebraPrinterName;
        if (parsed.a4PrinterName) s.a4PrinterName = parsed.a4PrinterName;
        if (parsed.zebraHost) s.zebraHost = parsed.zebraHost;
        if (parsed.zebraPort != null) s.zebraPort = parsed.zebraPort;
        if (parsed.zebraStock) s.zebraStock = parsed.zebraStock;
      }
      var stockOk = s.zebraStock === ZEBRA_STOCK_5425 || s.zebraStock === ZEBRA_STOCK_6128;
      if (!stockOk) {
        var cfgStock = (cfg.zebraLabelStockDefault || "").trim();
        if (cfgStock === ZEBRA_STOCK_5425 || cfgStock === ZEBRA_STOCK_6128) {
          s.zebraStock = cfgStock;
        } else {
          s.zebraStock = ZEBRA_STOCK_6128;
        }
      }
      if (cfg.zebraLabelStockStandardOnly) {
        s.zebraStock = ZEBRA_STOCK_6128;
      }
    } catch (e) {}
    if (!s.zebraPrinterName && s.printerName) s.zebraPrinterName = s.printerName;
    if (!s.zebraPrinterName && s.printerNameManual) s.zebraPrinterName = s.printerNameManual;
    s.zebraPrintMode = "windows";
    s.labelFormat = "zebra";
    var port = parseInt(s.zebraPort, 10);
    s.zebraPort = port >= 1 && port <= 65535 ? port : 9100;
    s.zebraHost = (s.zebraHost || "").trim();
    return s;
  }

  function qrSvgForSerial(serial) {
    if (typeof qrcode !== "function" || !serial) return "";
    var qr = qrcode(0, "M");
    qr.addData(serial);
    qr.make();
    return qr.createSvgTag(6, 0);
  }

  /** A4 pallet QR print size (mm) — keep in sync with desktop/a4_label_pdf.py */
  var A4_QR_SIZE_MM = 135;

  function buildA4PrintDocument(serials) {
    var pages = (serials || []).map(function (serial) {
      var qr = qrSvgForSerial(serial);
      return (
        "<section class=\"a4-pallet-page\">" +
        "<div class=\"a4-pallet-qr\">" + qr + "</div>" +
        "<div class=\"a4-pallet-id\">" + serial + "</div>" +
        "</section>"
      );
    }).join("");
    return (
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Pallet labels</title>" +
      "<style>" +
      "@page { size: A4 portrait; margin: 15mm; }" +
      "html, body { margin: 0; padding: 0; }" +
      "html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }" +
      "body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }" +
      ".a4-pallet-page { box-sizing: border-box; min-height: 267mm; page-break-after: always; background: #fff; " +
      "display: flex; flex-direction: column; align-items: center; justify-content: flex-start; " +
      "padding-top: 52mm; gap: 10mm; }" +
      ".a4-pallet-page:last-child { page-break-after: auto; }" +
      ".a4-pallet-qr svg { width: " + A4_QR_SIZE_MM + "mm; height: " + A4_QR_SIZE_MM + "mm; display: block; }" +
      ".a4-pallet-qr svg path, .a4-pallet-qr svg rect { fill: #000 !important; stroke: none; }" +
      ".a4-pallet-id { font-size: 26pt; font-weight: 700; letter-spacing: 0.04em; text-align: center; }" +
      "</style></head><body>" + pages + "</body></html>"
    );
  }

  function openA4PrintViaIframe(html, autoPrint) {
    return new Promise(function (resolve, reject) {
      var iframe = document.createElement("iframe");
      iframe.setAttribute("title", "A4 pallet labels");
      iframe.setAttribute("aria-hidden", autoPrint ? "true" : "false");
      iframe.style.position = "fixed";
      iframe.style.left = "-10000px";
      iframe.style.top = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      var win;
      try {
        win = iframe.contentWindow;
        var doc = win.document;
        doc.open();
        doc.write(html);
        doc.close();
      } catch (e) {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        reject(e);
        return;
      }

      function cleanup() {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }

      function runPrint() {
        try {
          win.focus();
          win.print();
          if (autoPrint) setTimeout(cleanup, 120000);
          resolve();
        } catch (e) {
          cleanup();
          reject(e);
        }
      }

      setTimeout(function () {
        if (autoPrint) runPrint();
        else resolve();
      }, 350);
    });
  }

  function showA4PreviewOverlay(html, serials, printerName) {
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "a4-print-preview-overlay";
      var bar = document.createElement("div");
      bar.className = "a4-print-preview-overlay__bar";
      var title = document.createElement("span");
      title.className = "a4-print-preview-overlay__title";
      title.textContent = "A4 pallet label preview";
      var actions = document.createElement("div");
      actions.className = "a4-print-preview-overlay__actions";
      var printBtn = document.createElement("button");
      printBtn.type = "button";
      printBtn.className = "btn-primary btn-sm";
      printBtn.textContent = "Print…";
      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "btn-ghost btn-sm";
      closeBtn.textContent = "Close";
      actions.appendChild(printBtn);
      actions.appendChild(closeBtn);
      bar.appendChild(title);
      bar.appendChild(actions);
      var frameWrap = document.createElement("div");
      frameWrap.className = "a4-print-preview-overlay__frame";
      var iframe = document.createElement("iframe");
      iframe.setAttribute("title", "A4 pallet label preview");
      frameWrap.appendChild(iframe);
      overlay.appendChild(bar);
      overlay.appendChild(frameWrap);
      document.body.appendChild(overlay);

      var win = iframe.contentWindow;
      win.document.open();
      win.document.write(html);
      win.document.close();

      function close() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve();
      }
      closeBtn.addEventListener("click", close);
      printBtn.addEventListener("click", function () {
        var bridge = desktopBridge();
        if (bridge && bridge.print_a4_labels && printerName && serials && serials.length) {
          bridge.print_a4_labels(serials, printerName).then(function (res) {
            if (!res || !res.ok) {
              window.alert((res && res.error) || "A4 print failed.");
            }
          }).catch(function (e) {
            window.alert((e && e.message) || String(e));
          });
          return;
        }
        try {
          win.focus();
          win.print();
        } catch (e) { /* ignore */ }
      });
    });
  }

  var a4PdfBusyOverlayEl = null;

  function hideA4PdfBusyOverlay() {
    if (a4PdfBusyOverlayEl && a4PdfBusyOverlayEl.parentNode) {
      a4PdfBusyOverlayEl.parentNode.removeChild(a4PdfBusyOverlayEl);
    }
    a4PdfBusyOverlayEl = null;
  }

  function showA4PdfBusyOverlay(pageCount, titleText) {
    hideA4PdfBusyOverlay();
    var n = pageCount || 0;
    var overlay = document.createElement("div");
    overlay.className = "pl-a4-pdf-busy-overlay";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    var card = document.createElement("div");
    card.className = "pl-a4-pdf-busy-overlay__card";
    var title = document.createElement("p");
    title.className = "pl-a4-pdf-busy-overlay__title";
    title.textContent = titleText || "Creating PDF…";
    var sub = document.createElement("p");
    sub.className = "pl-a4-pdf-busy-overlay__sub";
    sub.textContent =
      n > 0
        ? "Preparing " + n + " A4 sheet" + (n === 1 ? "" : "s") + ". Please wait."
        : "Please wait.";
    var track = document.createElement("div");
    track.className = "pl-a4-pdf-busy-overlay__track";
    track.appendChild(document.createElement("div")).className = "pl-a4-pdf-busy-overlay__bar";
    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(track);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    a4PdfBusyOverlayEl = overlay;
  }

  function yieldForA4BusyPaint() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setTimeout(resolve, 50);
        });
      });
    });
  }

  function openA4PrintWindow(serials, options) {
    options = options || {};
    var autoPrint = options.autoPrint !== false;
    var printerName = (options.printerName || "").trim();
    var bridge = desktopBridge();
    var sheetCount = (serials && serials.length) || 0;

    if (autoPrint && bridge && bridge.print_a4_labels) {
      if (!printerName) {
        return Promise.reject(new Error("Select the A4 printer in the Printer panel."));
      }
      var busyTitle = /pdf/i.test(printerName) ? "Creating PDF…" : "Printing A4 sheets…";
      showA4PdfBusyOverlay(sheetCount, busyTitle);
      return yieldForA4BusyPaint()
        .then(function () {
          return bridge.print_a4_labels(serials, printerName);
        })
        .then(function (res) {
          if (!res || !res.ok) {
            throw new Error((res && res.error) || "A4 print failed.");
          }
          return res;
        })
        .finally(function () {
          hideA4PdfBusyOverlay();
        });
    }

    var html = buildA4PrintDocument(serials);
    if (!autoPrint && bridge && bridge.open_a4_print) {
      return bridge.open_a4_print(html, false).then(function (res) {
        if (!res || !res.ok) {
          throw new Error((res && res.error) || "Could not open A4 preview.");
        }
      });
    }

    if (autoPrint) {
      return openA4PrintViaIframe(html, true);
    }
    return showA4PreviewOverlay(html, serials, printerName);
  }

  function saveSettings(s) {
    var out = Object.assign({}, s);
    out.releaseId = PL_RELEASE_ID;
    out.uiVersion = PL_UI_VERSION;
    localStorage.setItem(LS, JSON.stringify(out));
  }

  function desktopBridge() {
    if (window.pywebview && window.pywebview.api) return window.pywebview.api;
    if (window.CIS && typeof CIS.pywebviewApi === "function") {
      var api = CIS.pywebviewApi();
      if (api) return api;
    }
    return null;
  }

  function printLabelsShellHost() {
    return (window.location.hostname || "").toLowerCase();
  }

  function printLabelsShellIsLocal() {
    var host = printLabelsShellHost();
    return host === "127.0.0.1" || host === "localhost" || host === "";
  }

  /** Legacy .exe loaded the website inside WebView (not a browser tab). Current builds use bundled UI only. */
  function printLabelsOutdatedDesktopHost() {
    return !printLabelsShellIsLocal() && !!(window.pywebview && window.pywebview.api);
  }

  function printLabelsRunningInBrowserTab() {
    return !printLabelsShellIsLocal() && !printLabelsOutdatedDesktopHost();
  }

  /** pywebview.api is injected after first paint when loading the remote shell — do not cache once at render. */
  function waitForDesktopBridge(timeoutMs) {
    return new Promise(function (resolve) {
      function ready() {
        var b = desktopBridge();
        if (b && (b.list_printers || b.send_zpl_usb || b.send_zpl)) return b;
        return null;
      }
      var immediate = ready();
      if (immediate) {
        resolve(immediate);
        return;
      }
      var deadline = Date.now() + (timeoutMs || 15000);
      var done = false;
      function finish() {
        if (done) return;
        var b = ready();
        if (b) {
          done = true;
          resolve(b);
          return;
        }
        if (Date.now() >= deadline) {
          done = true;
          resolve(null);
          return;
        }
        setTimeout(finish, 200);
      }
      window.addEventListener("pywebviewready", finish);
      setTimeout(finish, 200);
    });
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function panel(ui, title) {
    var p = ui.el("section", { class: "print-labels-panel" });
    if (title) p.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, [title]));
    var body = ui.el("div", { class: "print-labels-panel-body" });
    p.appendChild(body);
    return { root: p, body: body };
  }

  function field(ui, label, input, hint) {
    var w = ui.el("label", { class: "print-labels-field" });
    w.appendChild(ui.el("span", { class: "print-labels-field-label" }, [label]));
    w.appendChild(input);
    if (hint) w.appendChild(ui.el("span", { class: "print-labels-field-hint" }, [hint]));
    return w;
  }

  function labelYearDefault(raw) {
    var y = parseInt(raw, 10);
    if (y >= 2000 && y <= 2100) return y;
    return new Date().getFullYear();
  }

  function canonicalSerial(year, seq) {
    var y = labelYearDefault(year);
    var n = parseInt(seq, 10);
    if (!n) return "";
    var pad = String(n);
    while (pad.length < 6) pad = "0" + pad;
    return "BAG-" + y + "-" + pad;
  }

  function cleanSerialToken(raw) {
    var t = (raw || "").trim().replace(/[\u2010-\u2015\u2212]/g, "-");
    if (/bag/i.test(t)) {
      t = t.replace(/\s+/g, "");
      t = t.replace(/^bags?-/i, "BAG-");
    }
    return t;
  }

  /** Full Bag ID only — no sequence numbers or shortcuts. */
  function parseExactBagId(raw) {
    var t = cleanSerialToken(raw);
    if (!t) return null;
    var m = t.match(BAG_ID_PARTS);
    if (!m) return null;
    return canonicalSerial(m[1], m[2]);
  }

  function serialsFromExactEndpoints(startTok, endTok) {
    var start = parseExactBagId(startTok);
    var end = parseExactBagId(endTok);
    if (!start || !end) {
      return {
        error:
          "Type the full Bag ID in both boxes, exactly as on the label (BAG-YYYY-NNNNNN). Short numbers like 6071 are not accepted.",
      };
    }
    var sm = start.match(BAG_ID_PARTS);
    var em = end.match(BAG_ID_PARTS);
    if (!sm || !em) {
      return { error: "Invalid Bag ID in range." };
    }
    var year = parseInt(sm[1], 10);
    if (parseInt(em[1], 10) !== year) {
      return {
        error:
          "Start and end must be the same year (got BAG-" +
          sm[1] +
          "-… and BAG-" +
          em[1] +
          "-…).",
      };
    }
    var a = parseInt(sm[2], 10);
    var b = parseInt(em[2], 10);
    if (a > b) {
      var tmp = a;
      a = b;
      b = tmp;
    }
    if (b - a + 1 > MAX_QUANTITY) {
      return { error: "Range is too large (max " + MAX_QUANTITY + ")." };
    }
    var serials = [];
    for (var i = a; i <= b; i++) serials.push(canonicalSerial(year, i));
    return { value: serials };
  }

  function readReprintRangeFromFields(startRaw, endRaw) {
    var start = (startRaw || "").trim();
    var end = (endRaw || "").trim();
    if (!start || !end) {
      return {
        error: "Enter the first and last Bag ID (full BAG-YYYY-NNNNNN in each box).",
      };
    }
    return serialsFromExactEndpoints(start, end);
  }

  function parseQuantity(raw) {
    var t = (raw || "").trim();
    if (!t) return { error: "Enter the number of labels required." };
    if (!/^\d+$/.test(t)) return { error: "Quantity must be a whole number (no decimals or text)." };
    var n = parseInt(t, 10);
    if (n < 1) return { error: "Quantity must be at least 1." };
    if (n > MAX_QUANTITY) {
      return { error: "Maximum print run size is " + MAX_QUANTITY + " labels per job." };
    }
    return { value: n };
  }

  function renderCisLaunchStandalone(container, ctx) {
    var ui = CIS.ui;
    var cfg = (ctx && ctx.config) || {};
    var installer =
      (CIS.printLabelsInstallerUrl && CIS.printLabelsInstallerUrl(cfg)) ||
      "/cis/app/CarboPrintLabels-Setup.exe";
    container.innerHTML = "";
    container.className = "module-content print-labels-launcher-host";
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Print Labels"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Label printing runs in the separate Carbo Print Labels app (printers stay on your PC).",
    ]));
    var statusEl = ui.el("p", { class: "muted" }, ["Opening Carbo Print Labels…"]);
    container.appendChild(statusEl);
    var row = ui.el("div", { class: "print-labels-launcher-actions" });
    var openBtn = ui.el("button", { class: "btn", type: "button" }, ["Open Print Labels app"]);
    openBtn.addEventListener("click", function () {
      if (CIS.openPrintLabelsApp) CIS.openPrintLabelsApp(function (msg, err) {
        statusEl.textContent = msg || "";
        statusEl.className = err ? "error-box" : "muted";
      });
    });
    row.appendChild(openBtn);
    var installLink = ui.el("a", {
      class: "btn-ghost",
      href: installer,
      target: "_blank",
      rel: "noopener noreferrer",
    }, ["Download Print Labels installer"]);
    row.appendChild(installLink);
    container.appendChild(row);
    if (CIS.openPrintLabelsApp) {
      CIS.openPrintLabelsApp(function (msg, err) {
        statusEl.textContent = msg || "";
        statusEl.className = err ? "error-box" : "muted";
      });
    }
  }

  function render(container, ctx) {
    if (!ZPL) {
      container.textContent = "Label module failed to load (label_zpl.js).";
      return;
    }
    if (CIS.isPrintLabelsUtility && CIS.isPrintLabelsUtility()) {
      return renderPrintLabelsApp(container, ctx);
    }
    return renderCisLaunchStandalone(container, ctx);
  }

  function renderPrintLabelsApp(container, ctx) {
    var ui = CIS.ui;
    var cfg = (ctx && ctx.config) || {};
    var standardStockOnly = !!cfg.zebraLabelStockStandardOnly;
    var saved = loadSettings(ctx);
    var labelFormat = saved.labelFormat || "zebra";
    var pendingRun = null;
    var pendingLabels = [];
    var pendingMode = null;
    var pendingRecovery = false;
    var lastWindowsPrinterNames = [];

    container.innerHTML = "";
    container.className = "module-content print-labels-host";

    if (printLabelsOutdatedDesktopHost()) {
      container.appendChild(
        ui.el("div", { class: "error-box print-labels-browser-block" }, [
          ui.el("strong", {}, ["Reinstall Carbo Print Labels on this PC"]),
          ui.el("p", {}, [
            "This is an old desktop build that opened the website inside the window. ",
            "Use the current installer so the UI stays bundled and printers work.",
          ]),
          ui.el("p", {}, [
            "Run ",
            ui.el("strong", {}, ["CarboPrintLabels-Setup.exe"]),
            " (same version on all label PCs), then reopen from Start. ",
            "Footer should show ",
            ui.el("strong", {}, ["bundled installer"]),
            " and labels ",
            PL_UI_VERSION + ".",
          ]),
        ])
      );
    } else if (printLabelsRunningInBrowserTab()) {
      container.appendChild(
        ui.el("div", { class: "error-box print-labels-browser-block" }, [
          ui.el("strong", {}, ["Wrong place — no printers here"]),
          ui.el("p", {}, ["Use the Carbo Print Labels shortcut from the Start menu, not a browser tab."]),
        ])
      );
    }
    var actionsBar = ui.el("div", { class: "pl-actions-bar" });
    var openReprintDlgBtn = ui.el("button", { type: "button", class: "btn-secondary btn-sm" }, ["Reprint…"]);
    var openHistoryDlgBtn = ui.el("button", { type: "button", class: "btn-secondary btn-sm" }, ["History…"]);
    var openInventoryDlgBtn = ui.el("button", { type: "button", class: "btn-secondary btn-sm" }, ["Inventory…"]);
    actionsBar.appendChild(openReprintDlgBtn);
    actionsBar.appendChild(openHistoryDlgBtn);
    actionsBar.appendChild(openInventoryDlgBtn);
    container.appendChild(actionsBar);

    var workspace = ui.el("div", { class: "print-labels-workspace pl-main-grid" });
    container.appendChild(workspace);

    var printerPanel = panel(ui, "Printer");
    workspace.appendChild(printerPanel.root);
    var refreshBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Refresh printer list"]);
    var testZebraBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Test Zebra (USB)"]);
    var refreshRow = ui.el("div", { class: "print-labels-printer-row" });
    refreshRow.appendChild(refreshBtn);
    refreshRow.appendChild(testZebraBtn);
    var zebraModeEl = ui.el("input", { type: "hidden", value: "windows" });
    var zebraHostEl = ui.el("input", { type: "hidden", value: saved.zebraHost || "", autocomplete: "off" });
    var zebraPortEl = ui.el("input", { type: "hidden", value: "9100", autocomplete: "off" });
    var zebraNetworkRow = ui.el("div", { class: "print-labels-network-fields hidden", hidden: true, "aria-hidden": "true" });
    var zebraPrinterEl = ui.el("select", {}, [ui.el("option", { value: "" }, ["Loading printers…"])]);
    var a4PrinterEl = ui.el("select", {}, [ui.el("option", { value: "" }, ["Loading printers…"])]);
    var zebraRow = ui.el("div", { class: "print-labels-printer-row" });
    zebraRow.appendChild(zebraPrinterEl);
    var a4Row = ui.el("div", { class: "print-labels-printer-row" });
    a4Row.appendChild(a4PrinterEl);
    var zebraStockRow = ui.el("div", { class: "print-labels-printer-row" });
    var zebraStockEl;
    if (standardStockOnly) {
      zebraStockEl = ui.el("input", { type: "hidden", value: ZEBRA_STOCK_6128 });
      zebraStockRow.appendChild(zebraStockEl);
      zebraStockRow.appendChild(
        ui.el("div", { class: "print-labels-stock-locked" }, [
          ui.el("strong", {}, ["62 × 28 mm"]),
          " — standard stock (locked; not 54 × 25 mm)",
        ])
      );
    } else {
      zebraStockEl = ui.el("select", {}, [
        ui.el("option", {
          value: ZEBRA_STOCK_6128,
          selected: (saved.zebraStock || ZEBRA_STOCK_6128) !== ZEBRA_STOCK_5425,
        }, ["61 × 28 mm (standard stock)"]),
        ui.el("option", {
          value: ZEBRA_STOCK_5425,
          selected: saved.zebraStock === ZEBRA_STOCK_5425,
        }, ["54 × 25 mm (legacy small stock)"]),
      ]);
      zebraStockRow.appendChild(zebraStockEl);
    }
    var stockSizeBanner = ui.el("p", {
      class: "print-labels-stock-size-banner",
      "aria-live": "polite",
    }, [""]);
    printerPanel.body.appendChild(field(ui, "Label stock", zebraStockRow,
      standardStockOnly ? "62 × 28 mm standard." : "Must match roll in printer."));
    printerPanel.body.appendChild(stockSizeBanner);
    printerPanel.body.appendChild(field(ui, "Zebra", zebraRow, "Windows printer queue."));
    printerPanel.body.appendChild(field(ui, "A4 (optional)", a4Row, "Pallet sheets only."));
    printerPanel.body.appendChild(refreshRow);

    var labelsPanel = panel(ui, "Preview");
    labelsPanel.root.classList.add("print-labels-panel--labels-preview");
    workspace.appendChild(labelsPanel.root);
    var sequenceEl = ui.el("div", { class: "print-labels-sequence muted" }, ["Loading sequence…"]);
    labelsPanel.body.appendChild(sequenceEl);
    var previewBlock = ui.el("div", { class: "print-labels-preview-block" });
    var preview = ui.el("div", { class: "print-labels-preview-stock" });
    previewBlock.appendChild(preview);
    var summary = ui.el("div", { class: "cards print-labels-summary" });
    previewBlock.appendChild(summary);
    var progressWrap = ui.el("div", { class: "bag-labels-progress" });
    progressWrap.appendChild(ui.el("div", { class: "bag-labels-progress-bar" }));
    previewBlock.appendChild(progressWrap);
    var progressBar = progressWrap.firstChild;
    progressWrap.style.display = "none";
    var status = ui.el("p", { class: "print-labels-status muted" }, [""]);
    previewBlock.appendChild(status);
    labelsPanel.body.appendChild(previewBlock);

    var runPanel = panel(ui, "New print run");
    workspace.appendChild(runPanel.root);
    var formatEl = ui.el("select", {}, [
      ui.el("option", { value: "zebra", selected: true }, ["Zebra bag labels (62×28)"]),
      ui.el("option", { value: "a4_pallet", selected: false }, [
        "A4 — one pallet sheet per Bag ID",
      ]),
    ]);
    formatEl.value = "zebra";
    labelFormat = "zebra";
    var qtyEl = ui.el("input", {
      type: "text",
      inputmode: "numeric",
      autocomplete: "off",
      placeholder: "Enter quantity",
      value: "",
    });
    var noteEl = ui.el("input", { type: "text", placeholder: "Optional note", value: "" });
    runPanel.body.appendChild(field(ui, "Format", formatEl, ""));
    runPanel.body.appendChild(field(ui, "Quantity", qtyEl, "Max " + MAX_QUANTITY + " per run."));
    runPanel.body.appendChild(field(ui, "Note", noteEl));
    var prepareBtn = ui.el("button", { class: "btn-primary", type: "button" }, ["Continue"]);
    runPanel.body.appendChild(prepareBtn);
    var runStatus = ui.el("p", { class: "print-labels-status print-labels-run-status muted" }, [""]);
    runPanel.body.appendChild(runStatus);

    function plDialog(title) {
      var backdrop = ui.el("div", { class: "pl-dialog-backdrop hidden" });
      var box = ui.el("div", { class: "pl-dialog", role: "dialog" });
      var head = ui.el("div", { class: "pl-dialog__head" });
      head.appendChild(ui.el("h2", { class: "pl-dialog__title" }, [title]));
      var closeBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm pl-dialog__close" }, ["Close"]);
      head.appendChild(closeBtn);
      var body = ui.el("div", { class: "pl-dialog__body" });
      box.appendChild(head);
      box.appendChild(body);
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);
      function close() { backdrop.classList.add("hidden"); }
      function open() { backdrop.classList.remove("hidden"); }
      closeBtn.addEventListener("click", close);
      backdrop.addEventListener("click", function (ev) {
        if (ev.target === backdrop) close();
      });
      return { backdrop: backdrop, body: body, open: open, close: close };
    }

    var reprintCatalog = [];
    var reprintDefaultYear = new Date().getFullYear();
    var reprintSelected = {};
    var reprintReasonNote = "";

    var reprintHubDlg = plDialog("Reprint labels");
    reprintHubDlg.body.appendChild(
      ui.el("p", { class: "muted", style: "margin:0 0 12px 0;" }, [
        "Pick labels in one step. The reprint window closes before print confirmation.",
      ])
    );
    var reprintHubActions = ui.el("div", { class: "pl-reprint-hub" });
    var hubOneBtn = ui.el("button", { type: "button", class: "btn-primary" }, ["One Bag ID"]);
    var hubRangeBtn = ui.el("button", { type: "button", class: "btn-primary" }, ["Number range"]);
    var hubRunBtn = ui.el("button", { type: "button", class: "btn-secondary" }, ["From print run…"]);
    reprintHubActions.appendChild(hubOneBtn);
    reprintHubActions.appendChild(hubRangeBtn);
    reprintHubActions.appendChild(hubRunBtn);
    reprintHubDlg.body.appendChild(reprintHubActions);

    var reprintOneDlg = plDialog("Reprint one label");
    var reprintOneEl = ui.el("input", {
      type: "text",
      placeholder: "BAG-2026-006071",
      value: "",
      autocomplete: "off",
    });
    var reprintOneReasonEl = ui.el("input", { type: "text", placeholder: "Optional reason", value: "" });
    var reprintOneMsg = ui.el("p", { class: "print-labels-field-hint" }, [""]);
    var reprintOneActions = ui.el("div", { class: "pl-dialog-step-actions" });
    var reprintOneBackBtn = ui.el("button", { type: "button", class: "btn-ghost" }, ["Back"]);
    var reprintOneContinueBtn = ui.el("button", { type: "button", class: "btn-primary" }, ["Continue"]);
    reprintOneActions.appendChild(reprintOneBackBtn);
    reprintOneActions.appendChild(reprintOneContinueBtn);
    reprintOneDlg.body.appendChild(field(ui, "Bag ID", reprintOneEl, "Smudged or misprinted label."));
    reprintOneDlg.body.appendChild(field(ui, "Reason", reprintOneReasonEl));
    reprintOneDlg.body.appendChild(reprintOneMsg);
    reprintOneDlg.body.appendChild(reprintOneActions);

    var reprintStartEl = ui.el("input", {
      type: "text",
      placeholder: "BAG-2026-006071",
      value: "",
      autocomplete: "off",
    });
    var reprintEndEl = ui.el("input", {
      type: "text",
      placeholder: "BAG-2026-006080",
      value: "",
      autocomplete: "off",
    });
    var reprintRangeReasonEl = ui.el("input", { type: "text", placeholder: "Optional reason", value: "" });
    var reprintRangeMsg = ui.el("p", { class: "print-labels-field-hint" }, [""]);
    var reprintRangeDlg = plDialog("Reprint range");
    var reprintRangeRow = ui.el("div", { class: "print-labels-range-row" });
    reprintRangeRow.appendChild(reprintStartEl);
    reprintRangeRow.appendChild(reprintEndEl);
    var reprintRangeActions = ui.el("div", { class: "pl-dialog-step-actions" });
    var reprintRangeBackBtn = ui.el("button", { type: "button", class: "btn-ghost" }, ["Back"]);
    var reprintRangeContinueBtn = ui.el("button", { type: "button", class: "btn-primary" }, ["Continue"]);
    reprintRangeActions.appendChild(reprintRangeBackBtn);
    reprintRangeActions.appendChild(reprintRangeContinueBtn);
    reprintRangeDlg.body.appendChild(field(ui, "First / last Bag ID", reprintRangeRow,
      "Full ID in each box — same format as printed on the label."));
    reprintRangeDlg.body.appendChild(field(ui, "Reason", reprintRangeReasonEl));
    reprintRangeDlg.body.appendChild(reprintRangeMsg);
    reprintRangeDlg.body.appendChild(reprintRangeActions);

    var reprintRunDlg = plDialog("Reprint from print run");
    var reprintRunEl = ui.el("select", {}, [ui.el("option", { value: "" }, ["Loading print runs…"])]);
    var reprintListEl = ui.el("div", { class: "print-labels-reprint-list muted" }, ["Choose a print run."]);
    var reprintToolbar = ui.el("div", { class: "print-labels-reprint-toolbar" });
    var reprintSelectAllBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Select all"]);
    var reprintClearBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Clear"]);
    var reprintCountEl = ui.el("span", { class: "print-labels-reprint-count muted" }, ["0 selected"]);
    reprintToolbar.appendChild(reprintSelectAllBtn);
    reprintToolbar.appendChild(reprintClearBtn);
    reprintToolbar.appendChild(reprintCountEl);
    var reprintRunReasonEl = ui.el("input", { type: "text", placeholder: "Optional reason", value: "" });
    var reprintRunActions = ui.el("div", { class: "pl-dialog-step-actions" });
    var reprintRunBackBtn = ui.el("button", { type: "button", class: "btn-ghost" }, ["Back"]);
    var reprintRunContinueBtn = ui.el("button", { type: "button", class: "btn-primary" }, ["Continue"]);
    reprintRunActions.appendChild(reprintRunBackBtn);
    reprintRunActions.appendChild(reprintRunContinueBtn);
    reprintRunDlg.body.appendChild(field(ui, "Print run", reprintRunEl, "Completed, failed, or stuck printing runs."));
    reprintRunDlg.body.appendChild(reprintToolbar);
    reprintRunDlg.body.appendChild(reprintListEl);
    reprintRunDlg.body.appendChild(field(ui, "Reason", reprintRunReasonEl));
    reprintRunDlg.body.appendChild(reprintRunActions);

    var inventoryDlg = plDialog("Label inventory");
    var inventoryEl = ui.el("div", { class: "print-labels-inventory" }, ["Loading…"]);
    inventoryDlg.body.appendChild(inventoryEl);

    var historyDlg = plDialog("Print run history");
    var historyList = ui.el("div", { class: "print-labels-history-weeks" });
    historyDlg.body.appendChild(historyList);
    var refreshHistoryBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Refresh"]);
    historyDlg.body.appendChild(refreshHistoryBtn);

    function closeAllPlDialogs() {
      reprintHubDlg.close();
      reprintOneDlg.close();
      reprintRangeDlg.close();
      reprintRunDlg.close();
      historyDlg.close();
      inventoryDlg.close();
    }

    function closeAuxDialogs() {
      closeAllPlDialogs();
    }

    function openReprintHub() {
      closeAllPlDialogs();
      reprintHubDlg.open();
    }

    function openReprintOneStep() {
      closeAllPlDialogs();
      reprintOneMsg.textContent = "";
      reprintOneMsg.className = "print-labels-field-hint";
      reprintOneDlg.open();
      window.setTimeout(function () { reprintOneEl.focus(); }, 50);
    }

    function openReprintRangeStep() {
      closeAllPlDialogs();
      reprintRangeMsg.textContent = "";
      reprintRangeMsg.className = "print-labels-field-hint";
      reprintRangeDlg.open();
      window.setTimeout(function () { reprintStartEl.focus(); }, 50);
    }

    function openReprintRunStep() {
      closeAllPlDialogs();
      reprintRunDlg.open();
      loadReprintRuns();
    }

    var lastReprintPrepareError = "";

    openReprintDlgBtn.addEventListener("click", openReprintHub);
    hubOneBtn.addEventListener("click", openReprintOneStep);
    hubRangeBtn.addEventListener("click", openReprintRangeStep);
    hubRunBtn.addEventListener("click", openReprintRunStep);
    reprintOneBackBtn.addEventListener("click", openReprintHub);
    reprintRangeBackBtn.addEventListener("click", openReprintHub);
    reprintRunBackBtn.addEventListener("click", openReprintHub);

    openHistoryDlgBtn.addEventListener("click", function () {
      closeAllPlDialogs();
      historyDlg.open();
      loadHistory();
    });
    openInventoryDlgBtn.addEventListener("click", function () {
      closeAllPlDialogs();
      inventoryDlg.open();
      loadInventory();
    });

    var oldModal = document.querySelector(".print-labels-modal-backdrop");
    if (oldModal) oldModal.remove();

    var modalBackdrop = ui.el("div", { class: "print-labels-modal-backdrop hidden" });
    var modal = ui.el("div", { class: "print-labels-modal" });
    var modalTitle = ui.el("h3", {}, ["Confirm print run"]);
    var modalBody = ui.el("div", { class: "print-labels-modal-body" });
    var modalActions = ui.el("div", { class: "print-labels-modal-actions" });
    var modalCancelBtn = ui.el("button", { class: "btn-ghost", type: "button" }, ["Cancel"]);
    var modalPrintBtn = ui.el("button", { class: "btn-primary", type: "button" }, ["Print"]);
    var modalDownloadBtn = ui.el("button", { class: "btn-secondary", type: "button" }, ["Download ZPL"]);
    modalActions.appendChild(modalCancelBtn);
    modalActions.appendChild(modalDownloadBtn);
    modalActions.appendChild(modalPrintBtn);
    var modalPrinterWrap = ui.el("div", { class: "print-labels-modal-printer hidden" });
    var modalPrinterSelect = ui.el("select", { class: "print-labels-modal-printer-select" });
    modalPrinterWrap.appendChild(ui.el("span", { class: "print-labels-field-label" }, ["Printer"]));
    modalPrinterWrap.appendChild(modalPrinterSelect);
    modal.appendChild(modalTitle);
    modal.appendChild(modalBody);
    modal.appendChild(modalPrinterWrap);
    modal.appendChild(modalActions);
    modalBackdrop.appendChild(modal);
    document.body.appendChild(modalBackdrop);

    function pendingRunLabelFormat() {
      if (pendingRun && pendingRun.label_format === "a4_pallet") return "a4_pallet";
      if (pendingRun && pendingRun.label_format) return "zebra";
      return labelFormat;
    }

    function applyPendingRunLabelFormat() {
      if (!pendingRun || !pendingRun.label_format) return;
      formatEl.value = pendingRun.label_format === "a4_pallet" ? "a4_pallet" : "zebra";
      syncLabelFormat();
    }

    function optionValuesFromSelect(selectEl) {
      var names = [];
      for (var i = 0; i < selectEl.options.length; i++) {
        var v = (selectEl.options[i].value || "").trim();
        if (v) names.push(v);
      }
      return names;
    }

    function populateModalPrinterSelect() {
      var isA4 = pendingRunLabelFormat() === "a4_pallet";
      var src = isA4 ? a4PrinterEl : zebraPrinterEl;
      var names = lastWindowsPrinterNames.length
        ? lastWindowsPrinterNames.slice()
        : optionValuesFromSelect(src);
      var savedName = isA4 ? resolvedA4Printer() : resolvedZebraPrinter();
      fillPrinterSelect(
        modalPrinterSelect,
        names,
        savedName,
        isA4 ? /a4|office|laser|hp |brother|canon|xerox|ricoh|pdf/i : /zebra|zdesigner|zt231|carbo/i,
        isA4 ? /zebra|zdesigner|zt231/i : null
      );
      var hasPrinters = names.length > 0 && modalPrinterSelect.value;
      modalPrinterWrap.classList.toggle("hidden", !desktopBridge() || !hasPrinters);
      return hasPrinters;
    }

    function syncModalPrinterToPanel() {
      if (modalPrinterWrap.classList.contains("hidden")) return;
      var v = (modalPrinterSelect.value || "").trim();
      if (!v) return;
      if (pendingRunLabelFormat() === "a4_pallet") a4PrinterEl.value = v;
      else zebraPrinterEl.value = v;
      persistForm();
    }

    function readSaved() {
      var port = parseInt(zebraPortEl.value, 10);
      return {
        zebraPrinterName: (zebraPrinterEl.value || "").trim(),
        a4PrinterName: (a4PrinterEl.value || "").trim(),
        labelFormat: formatEl.value === "a4_pallet" ? "a4_pallet" : "zebra",
        zebraStock: zebraStockEl.value === ZEBRA_STOCK_5425 ? ZEBRA_STOCK_5425 : ZEBRA_STOCK_6128,
        zebraPrintMode: "windows",
        zebraHost: (zebraHostEl.value || "").trim(),
        zebraPort: port >= 1 && port <= 65535 ? port : 9100,
      };
    }

    function zebraUsesNetwork() {
      return false;
    }

    function zebraNetworkEndpoint(s) {
      s = s || readSaved();
      return (s.zebraHost || "") + ":" + (s.zebraPort || 9100);
    }

    function zebraPrinterConnection() {
      return "windows";
    }

    function syncZebraConnectionUi() {
      var net = zebraUsesNetwork();
      zebraNetworkRow.style.display = net ? "" : "none";
      zebraRow.style.display = net ? "none" : "";
    }

    function syncLabelFormat() {
      labelFormat = readSaved().labelFormat;
    }

    /** Server value — always read from the Label format dropdown at prepare time. */
    function apiLabelFormat() {
      return formatEl.value === "a4_pallet" ? "a4_pallet" : "zebra_bag";
    }

    function formatDisplayName(fmt) {
      if (fmt === "a4_pallet") return "A4 pallet sheet";
      return activeStockCode() === ZEBRA_STOCK_5425 ? "Zebra 54×25 mm" : "Zebra 62×28 mm";
    }

    function resolvedZebraPrinter(s) {
      s = s || readSaved();
      return (s.zebraPrinterName || "").trim();
    }

    function resolvedA4Printer(s) {
      s = s || readSaved();
      return (s.a4PrinterName || "").trim();
    }

    function resolvedPrinterForFormat(s) {
      s = s || readSaved();
      return s.labelFormat === "a4_pallet" ? resolvedA4Printer(s) : resolvedZebraPrinter(s);
    }

    function persistForm() {
      saveSettings(readSaved());
    }

    function activeStockCode() {
      var raw = readSaved().zebraStock;
      if (standardStockOnly) return ZEBRA_STOCK_6128;
      return raw === ZEBRA_STOCK_5425 ? ZEBRA_STOCK_5425 : ZEBRA_STOCK_6128;
    }

    function stockProfile(code) {
      return STOCK_PROFILES[code || activeStockCode()] || STOCK_PROFILES[ZEBRA_STOCK_6128];
    }

    function labelSpec() {
      return activeStockCode() === ZEBRA_STOCK_5425
        ? ZPL.productionSpec()
        : ZPL.productionSpec6128();
    }

    function zplStockSummary() {
      var spec = labelSpec();
      var dim = ZPL.labelDimensions(spec);
      var prof = stockProfile(activeStockCode());
      return {
        profile: prof,
        widthMm: dim.widthMm,
        heightMm: dim.heightMm,
        pw: dim.pw,
        ll: dim.ll,
      };
    }

    function refreshStockSizeBanner() {
      if (!stockSizeBanner) return;
      var sum = zplStockSummary();
      var prof = sum.profile;
      stockSizeBanner.innerHTML = "";
      stockSizeBanner.appendChild(
        ui.el("strong", {}, ["ZPL layout: " + prof.title])
      );
      stockSizeBanner.appendChild(document.createTextNode(
        " — ^PW" + sum.pw + " ^LL" + sum.ll + " (203 dpi). " +
          (prof.warnSmall
            ? "Confirm the SMALL 54×25 roll is loaded before printing."
            : "Load 61×28 mm stock in the printer — not legacy 54×25.")
      ));
      stockSizeBanner.className = "print-labels-stock-size-banner" +
        (prof.warnSmall ? " print-labels-stock-size-banner--small" : " print-labels-stock-size-banner--standard");
    }

    function assertZebraStockMatchesZpl() {
      if (labelFormat === "a4_pallet") return zplStockSummary();
      var code = activeStockCode();
      var spec = labelSpec();
      var dim = ZPL.labelDimensions(spec);
      var expect = code === ZEBRA_STOCK_5425
        ? { widthMm: 54, heightMm: 25 }
        : { widthMm: 62, heightMm: 28 };
      if (dim.widthMm !== expect.widthMm || dim.heightMm !== expect.heightMm) {
        throw new Error("Label layout size mismatch — reload the app or contact IT.");
      }
      if (standardStockOnly && code === ZEBRA_STOCK_5425) {
        throw new Error("This site uses 61 × 28 mm stock only — 54 × 25 layout is disabled.");
      }
      return zplStockSummary();
    }

    function stockConfirmHtml() {
      if (pendingRunLabelFormat() === "a4_pallet") return "";
      var sum = assertZebraStockMatchesZpl();
      return (
        "<p>Physical label / ZPL size:<br><strong>" + sum.profile.title + "</strong><br>" +
        "<span class=\"muted\">^PW" + sum.pw + " · ^LL" + sum.ll + " · " +
        sum.widthMm + "×" + sum.heightMm + " mm</span></p>" +
        (sum.profile.warnSmall
          ? "<p><strong>Small-stock warning:</strong> 54×25 layout — do not use on 61×28 rolls.</p>"
          : "<p>Confirm <strong>61×28 mm</strong> stock is loaded (not 54×25).</p>")
      );
    }

    function apiErrorMessage(err) {
      var msg = (err && err.message) || String(err || "Unknown error");
      if (/not found/i.test(msg)) {
        return msg + " — the traceability API route is missing on the server (nginx may need the /traceability/api/v1/ block; ask ops to reload nginx).";
      }
      return msg;
    }

    function setStatus(msg, isError) {
      var cls = "print-labels-status " + (isError ? "error-box" : "muted");
      status.textContent = msg || "";
      status.className = cls;
      runStatus.textContent = msg || "";
      runStatus.className = "print-labels-status print-labels-run-status " + (isError ? "error-box" : "muted");
      if (isError && runStatus.scrollIntoView) {
        runStatus.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    function setBusy(busy) {
      prepareBtn.disabled = busy;
      if (!busy) {
        reprintOneContinueBtn.disabled = false;
        reprintRangeContinueBtn.disabled = false;
        reprintRunContinueBtn.disabled = false;
      }
      refreshBtn.disabled = busy;
      refreshHistoryBtn.disabled = busy;
      if (busy) {
        modalPrintBtn.disabled = true;
        modalCancelBtn.disabled = true;
        modalDownloadBtn.disabled = true;
      } else {
        modalCancelBtn.disabled = false;
        modalDownloadBtn.disabled = false;
      }
    }

    function fitPreviewFrame(frame, canvas, labelW, labelH) {
      var fw = frame.clientWidth;
      if (!fw || !labelW) return;
      var scale = fw / labelW;
      canvas.style.transform = "scale(" + scale + ")";
      frame.style.height = Math.ceil(labelH * scale) + "px";
    }

    function paintA4Preview(serial) {
      preview.innerHTML = "";
      summary.innerHTML = "";
      if (!serial) {
        preview.appendChild(ui.el("p", { class: "muted" }, ["Enter a quantity to preview the first A4 pallet sheet."]));
        return;
      }
      var card = ui.el("div", { class: "card" });
      card.appendChild(ui.el("div", { class: "label" }, ["A4 pallet label · Bag ID"]));
      card.appendChild(ui.el("div", { class: "value" }, [serial]));
      summary.appendChild(card);

      var frame = ui.el("div", { class: "print-labels-preview-frame print-labels-preview-frame--a4" });
      var sheet = ui.el("div", { class: "print-labels-a4-preview-sheet" });
      var qrBox = ui.el("div", { class: "print-labels-a4-preview-qr" });
      var qrHtml = qrSvgForSerial(serial);
      if (qrHtml) qrBox.appendChild(ui.el("div", { html: qrHtml }));
      sheet.appendChild(qrBox);
      var idEl = ui.el("div", { class: "print-labels-a4-preview-id" }, [serial]);
      sheet.appendChild(idEl);
      frame.appendChild(sheet);
      preview.appendChild(frame);
    }

    function paintPreview(serial) {
      if (labelFormat === "a4_pallet") {
        paintA4Preview(serial);
        return;
      }
      preview.innerHTML = "";
      summary.innerHTML = "";
      if (!serial) {
        preview.appendChild(ui.el("p", { class: "muted" }, ["Enter a quantity to preview the first label."]));
        return;
      }
      var lay = ZPL.layoutLabel(serial, labelSpec());
      var card = ui.el("div", { class: "card" });
      card.appendChild(ui.el("div", { class: "label" }, ["Bag ID"]));
      card.appendChild(ui.el("div", { class: "value" }, [serial]));
      summary.appendChild(card);

      var labelW = lay.dots.pw;
      var labelH = lay.dots.ll;
      var frame = ui.el("div", { class: "print-labels-preview-frame" });
      var canvas = ui.el("div", { class: "print-labels-preview-canvas" });
      canvas.style.width = labelW + "px";
      canvas.style.height = labelH + "px";

      var qrBox = ui.el("div", { class: "print-labels-preview-qr-abs" });
      qrBox.style.left = lay.qrX + "px";
      qrBox.style.top = lay.qrY + "px";
      qrBox.style.width = lay.qrSize + "px";
      qrBox.style.height = lay.qrSize + "px";
      if (typeof qrcode === "function") {
        var qr = qrcode(0, "M");
        qr.addData(serial);
        qr.make();
        qrBox.appendChild(ui.el("div", { html: qr.createSvgTag(3, 0) }));
      }
      canvas.appendChild(qrBox);

      var textEl = ui.el("div", { class: "print-labels-preview-text-abs" }, [serial]);
      textEl.style.left = lay.textX + "px";
      textEl.style.top = lay.textY + "px";
      textEl.style.width = lay.textAreaW + "px";
      textEl.style.fontSize = lay.fontH + "px";
      textEl.style.lineHeight = lay.fontH + "px";
      canvas.appendChild(textEl);

      frame.appendChild(canvas);
      preview.appendChild(frame);

      function refit() {
        fitPreviewFrame(frame, canvas, labelW, labelH);
      }
      requestAnimationFrame(refit);
      if (typeof ResizeObserver !== "undefined") {
        var ro = new ResizeObserver(refit);
        ro.observe(frame);
      }
    }

    async function loadSequence() {
      if (!ctx.api.traceability) {
        sequenceEl.textContent = "Traceability API not configured.";
        return;
      }
      try {
        var data = await ctx.api.traceability("/labels/sequence");
        var parts = [];
        if (data.last_allocated_serial) {
          parts.push(
            "Last in system: <code>" + data.last_allocated_serial + "</code>" +
            (data.last_allocated_status ? " (" + data.last_allocated_status + ")" : "")
          );
        } else {
          parts.push("No Bag IDs allocated for " + data.year + " yet.");
        }
        if (data.last_completed_print_serial) {
          parts.push(
            "Last completed print run ended at: <code>" + data.last_completed_print_serial + "</code>"
          );
        }
        if (data.next_serial) {
          var hm = String(data.next_serial).match(/^BAG-(\d{4})-\d{6,}$/i);
          if (hm) reprintDefaultYear = parseInt(hm[1], 10);
        } else if (data.year) {
          reprintDefaultYear = labelYearDefault(data.year);
        }
        sequenceEl.innerHTML = parts.join("<br>") +
          "<div class=\"print-labels-sequence-next\">Next new run starts at: <code>" +
          (data.next_serial || "—") + "</code></div>";
      } catch (e) {
        sequenceEl.textContent = "Could not load sequence: " + (e.message || e);
      }
    }

    function hideModal() {
      modalBackdrop.classList.add("hidden");
    }

    function canPhysicalPrint() {
      var bridge = desktopBridge();
      if (!bridge) return false;
      if (pendingRunLabelFormat() === "a4_pallet") {
        var a4Name = modalPrinterWrap.classList.contains("hidden")
          ? resolvedA4Printer()
          : (modalPrinterSelect.value || "").trim() || resolvedA4Printer();
        return !!(bridge.print_a4_labels && a4Name);
      }
      var zebraName = modalPrinterWrap.classList.contains("hidden")
        ? resolvedZebraPrinter()
        : (modalPrinterSelect.value || "").trim() || resolvedZebraPrinter();
      return !!(bridge.send_zpl_usb && zebraName);
    }

    function showModal(title, htmlBody, printLabel, showDownload) {
      closeAuxDialogs();
      applyPendingRunLabelFormat();
      modalTitle.textContent = title;
      if (!htmlBody || !String(htmlBody).trim()) {
        var q = (pendingRun && pendingRun.quantity) || (pendingLabels && pendingLabels.length) || "?";
        var fs = pendingRun && pendingRun.first_serial;
        var ls = pendingRun && pendingRun.last_serial;
        htmlBody =
          "<p><strong>Confirm print</strong></p><p>Quantity: " + q + "</p>" +
          (fs ? "<p>From <code>" + fs + "</code>" + (ls && ls !== fs ? " to <code>" + ls + "</code>" : "") + "</p>" : "");
      }
      var isA4 = pendingRunLabelFormat() === "a4_pallet";
      var hasModalPrinter = populateModalPrinterSelect();
      var extra = hasModalPrinter
        ? (isA4
          ? "<p class=\"pl-confirm-hint\">One A4 sheet per Bag ID.</p>"
          : "<p class=\"pl-confirm-hint\">Labels send to the Zebra queue selected below.</p>")
        : (canPhysicalPrint()
          ? ""
          : "<p class=\"pl-confirm-hint\">Select a printer below, or use the Printer panel on the main screen.</p>");
      modalBody.innerHTML = htmlBody + extra;
      modalPrintBtn.disabled = !canPhysicalPrint();
      modalPrinterSelect.onchange = function () {
        modalPrintBtn.disabled = !canPhysicalPrint();
      };
      var modalPrintLabel = printLabel;
      if (isA4) {
        var qtyMatch = printLabel.match(/^Print\s+(\d+)\s+labels?/i);
        if (qtyMatch) {
          modalPrintLabel = "Print " + qtyMatch[1] + " A4 sheet" + (qtyMatch[1] === "1" ? "" : "s");
        } else if (/^Reprint/i.test(printLabel)) {
          modalPrintLabel = printLabel.replace(/^Reprint/i, "Reprint A4");
        } else {
          modalPrintLabel = "Print A4";
        }
      }
      modalPrintBtn.textContent = modalPrintLabel;
      if (isA4) {
        modalDownloadBtn.style.display = showDownload ? "" : "none";
        modalDownloadBtn.textContent = "Open print preview";
      } else {
        modalDownloadBtn.textContent = "Download ZPL";
        modalDownloadBtn.style.display = showDownload && !canPhysicalPrint() ? "" : "none";
      }
      document.body.appendChild(modalBackdrop);
      modalBackdrop.classList.remove("hidden");
    }

    function printerSummary() {
      if (labelFormat === "a4_pallet") {
        return resolvedA4Printer() || "A4 printer (Windows)";
      }
      return resolvedZebraPrinter() || "Zebra printer (USB)";
    }

    function fillPrinterSelect(selectEl, names, savedName, guessRe, avoidRe) {
      selectEl.innerHTML = "";
      if (!names.length) {
        selectEl.appendChild(ui.el("option", { value: "" }, ["No printers in Windows — add printers in Settings"]));
        return;
      }
      var pick = savedName || "";
      if (!pick && guessRe) {
        names.forEach(function (n) {
          if (guessRe.test(n)) pick = n;
        });
      }
      if (!pick && avoidRe) {
        names.forEach(function (n) {
          if (!avoidRe.test(n)) pick = n;
        });
      }
      selectEl.appendChild(ui.el("option", { value: "" }, ["— Select printer —"]));
      names.forEach(function (name) {
        selectEl.appendChild(ui.el("option", { value: name, selected: name === pick }, [name]));
      });
    }

    async function refreshPrinters() {
      refreshBtn.disabled = true;
      try {
        setStatus("Reading Windows printers…", false);
        var bridge = await waitForDesktopBridge(15000);
        if (!bridge || !bridge.list_printers) {
          setStatus(
            printLabelsOutdatedDesktopHost()
              ? "This PC has an old Print Labels build. Run CarboPrintLabels-Setup.exe, reopen from Start, then Refresh."
              : printLabelsRunningInBrowserTab()
                ? "Open Carbo Print Labels from the Start menu shortcut — not a browser tab."
                : "Printer bridge not ready. Quit the app completely and reopen from Start, then Refresh.",
            true
          );
          fillPrinterSelect(zebraPrinterEl, [], "", null, null);
          fillPrinterSelect(a4PrinterEl, [], "", null, null);
          return;
        }
        var res = await bridge.list_printers();
        if (res && res.error) {
          setStatus("Could not read Windows printers: " + res.error, true);
        }
        var names = (res && res.printers) || [];
        lastWindowsPrinterNames = names.slice();
        fillPrinterSelect(
          zebraPrinterEl,
          names,
          saved.zebraPrinterName,
          /zebra|zdesigner|zt231|carbo/i,
          null
        );
        fillPrinterSelect(
          a4PrinterEl,
          names,
          saved.a4PrinterName,
          /a4|office|laser|hp |brother|canon|xerox|ricoh/i,
          /zebra|zdesigner|zt231/i
        );
        if (!names.length) {
          setStatus(
            "No printers in Windows. Install the Zebra USB driver, add the printer in Settings, then Refresh.",
            true
          );
        } else {
          setStatus("Found " + names.length + " printer(s) in Windows.");
        }
      } catch (e) {
        setStatus("Refresh failed: " + ((e && e.message) || e), true);
      } finally {
        refreshBtn.disabled = false;
      }
    }

    async function sendZpl(zpl) {
      var bridge = desktopBridge();
      if (!bridge) throw new Error("Printing needs Carbo Print Labels on Windows.");
      if (!bridge.send_zpl_usb) throw new Error("Printing needs Carbo Print Labels on Windows.");
      var name = resolvedZebraPrinter();
      if (!name) throw new Error("Select the Zebra USB printer in the Printer panel.");
      return bridge.send_zpl_usb(name, zpl);
    }

    async function loadInventory() {
      if (!ctx.api.traceability) {
        inventoryEl.textContent = "Traceability API not configured.";
        return;
      }
      try {
        var inv = await ctx.api.traceability("/labels/inventory");
        var c = (inv && inv.counts) || {};
        var parked = inv.parked || 0;
        var fenced = inv.fenced_serial != null ? inv.fenced_serial : (inv.fenced || c.fenced || 0);
        inventoryEl.textContent =
          "Total produced: " + (inv.total || 0) +
          " · Available: " + (inv.available_to_use != null ? inv.available_to_use : inv.available || c.available || 0) +
          (parked ? " · Parked: " + parked : "") +
          (fenced ? " · Fenced (serial): " + fenced : "") +
          " · Allocated (pending print): " + (c.allocated || 0) +
          " · Used: " + (c.used || 0) +
          " · Void: " + (c.void || 0);
      } catch (e) {
        inventoryEl.textContent = "Could not load inventory: " + (e.message || e);
      }
    }

    function renderHistoryTable(runs) {
      var table = ui.el("table", { class: "print-labels-history" });
      var thead = ui.el("thead");
      var hr = ui.el("tr");
      ["Run", "Format", "When", "User", "Qty", "First ID", "Last ID", "Printer", "Status"].forEach(function (h) {
        hr.appendChild(ui.el("th", {}, [h]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      (runs || []).forEach(function (run) {
        var tr = ui.el("tr");
        tr.appendChild(ui.el("td", {}, ["#" + run.print_run_id + (run.run_type === "reprint" ? " R" : "")]));
        tr.appendChild(ui.el("td", {}, [
          run.run_type === "reprint"
            ? "—"
            : formatDisplayName(run.label_format || "zebra_bag"),
        ]));
        tr.appendChild(ui.el("td", {}, [run.created_at ? run.created_at.replace("T", " ").replace("Z", "") : ""]));
        tr.appendChild(ui.el("td", {}, [run.operator_login || ""]));
        tr.appendChild(ui.el("td", {}, [String(run.quantity)]));
        tr.appendChild(ui.el("td", {}, [run.first_serial || ""]));
        tr.appendChild(ui.el("td", {}, [run.last_serial || ""]));
        tr.appendChild(ui.el("td", {}, [run.printer_name || ""]));
        var statusTd = ui.el("td", { class: "print-labels-history-status" });
        statusTd.appendChild(document.createTextNode(run.status || ""));
        if (run.status === "printing") {
          statusTd.appendChild(document.createTextNode(" "));
          var failBtn = ui.el("button", {
            type: "button",
            class: "btn-ghost btn-sm print-labels-history-fail-btn",
          }, ["Mark failed"]);
          failBtn.addEventListener("click", function () {
            void markStuckPrintRunFailed(run.print_run_id);
          });
          statusTd.appendChild(failBtn);
        }
        tr.appendChild(statusTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      var wrap = ui.el("div", { class: "print-labels-history-wrap" });
      wrap.appendChild(table);
      return wrap;
    }

    async function markStuckPrintRunFailed(runId) {
      if (!ctx.api.traceability || !runId) return;
      if (!window.confirm(
        "Mark print run #" + runId + " as failed?\n\n" +
          "Use this when the app hung on Printing and the run never finished. " +
          "You can then Reprint from that run (recovery)."
      )) {
        return;
      }
      try {
        await ctx.api.traceability("/labels/print-runs/" + runId + "/fail", {
          method: "POST",
          body: { error: "Marked failed — print run stuck in printing (operator)" },
        });
        setStatus("Print run #" + runId + " marked failed. Use Reprint from print run to recover.");
        await loadHistory();
        await loadInventory();
        await loadSequence();
        await loadReprintRuns();
      } catch (e) {
        setStatus("Could not mark run failed: " + (e.message || e), true);
      }
    }

    async function loadHistory() {
      if (!ctx.api.traceability) return;
      try {
        var data = await ctx.api.traceability("/labels/print-runs?limit=" + HISTORY_LIMIT);
        var runs = (data && data.print_runs) || [];
        historyList.innerHTML = "";
        if (!runs.length) {
          historyList.appendChild(ui.el("p", { class: "muted" }, ["No print runs yet."]));
          return;
        }
        groupRunsByWeek(runs).forEach(function (group) {
          var details = ui.el("details", { class: "print-labels-history-week" });
          var summary = ui.el("summary", { class: "print-labels-history-week__summary" });
          summary.appendChild(ui.el("span", { class: "print-labels-history-week__label" }, [group.label]));
          summary.appendChild(ui.el("span", { class: "print-labels-history-week__meta" }, [
            group.count + (group.count === 1 ? " run" : " runs") + " · " + group.quantity + " labels",
          ]));
          details.appendChild(summary);
          details.appendChild(renderHistoryTable(group.runs));
          historyList.appendChild(details);
        });
      } catch (e) {
        historyList.innerHTML = "";
        historyList.appendChild(ui.el("p", { class: "error-box" }, [
          "Could not load history: " + (e.message || e),
        ]));
        setStatus("Could not load history: " + (e.message || e), true);
      }
    }

    function confirmHtml(run, mode) {
      var qty = run.quantity;
      var isA4Run = run && run.label_format === "a4_pallet";
      var printer = isA4Run
        ? (resolvedA4Printer() || "Choose A4 printer below")
        : (run.printer_name || printerSummary());
      if (mode === "reprint") {
        var n = qty || 1;
        var title = pendingRecovery
          ? "You are about to print missing label(s) from a failed run"
          : "You are about to reprint " + n + " label" + (n === 1 ? "" : "s");
        if (n === 1) {
          return (
            "<p><strong>" + title + "</strong></p>" +
            stockConfirmHtml() +
            "<p>Bag ID:<br><code>" + run.first_serial + "</code></p>" +
            "<p>Printer:<br><strong>" + printer + "</strong></p>"
          );
        }
        return (
          "<p><strong>" + title + "</strong></p>" +
          stockConfirmHtml() +
          "<p>Bag IDs:<br><code>" + run.first_serial + "</code><br>to<br><code>" + run.last_serial + "</code></p>" +
          "<p>Printer:<br><strong>" + printer + "</strong></p>"
        );
      }
      var fmtName = formatDisplayName(run.label_format || apiLabelFormat());
      return (
        "<p><strong>You are about to print:</strong><br>" + qty + " label" + (qty === 1 ? "" : "s") + "</p>" +
        "<p>Label format:<br><strong>" + fmtName + "</strong></p>" +
        stockConfirmHtml() +
        "<p>Bag IDs:<br><code>" + run.first_serial + "</code><br>to<br><code>" + run.last_serial + "</code></p>" +
        "<p>Printer:<br><strong>" + printer + "</strong></p>"
      );
    }

    async function cancelPending() {
      if (!pendingRun || !ctx.api.traceability) return;
      try {
        await ctx.api.traceability("/labels/print-runs/" + pendingRun.print_run_id + "/cancel", {
          method: "POST",
        });
        await loadSequence();
        await loadInventory();
      } catch (e) {
        setStatus("Cancel failed: " + (e.message || e), true);
      }
      pendingRun = null;
      pendingLabels = [];
      pendingMode = null;
      pendingRecovery = false;
      hideModal();
    }

    async function executePrint() {
      if (!pendingRun || !pendingLabels.length) return;
      syncModalPrinterToPanel();
      persistForm();
      setBusy(true);
      progressWrap.style.display = "block";
      progressBar.style.width = "0%";
      var runId = pendingRun.print_run_id;
      var serials = pendingLabels.map(function (l) { return l.serial; });
      var spec = labelSpec();
      var isReprint = pendingMode === "reprint";
      var isA4 = pendingRunLabelFormat() === "a4_pallet";
      try {
        if (!isA4) assertZebraStockMatchesZpl();
        await ctx.api.traceability("/labels/print-runs/" + runId + "/start", { method: "POST" });
        setStatus(isA4 ? "Opening A4 print…" : "Printing…");
        var sent = 0;
        if (isA4) {
          hideModal();
          var a4Result = await openA4PrintWindow(serials, { printerName: resolvedA4Printer() });
          if (a4Result && a4Result.path) {
            setStatus("PDF saved: " + a4Result.path);
          }
          for (var j = 0; j < serials.length; j++) {
            if (!isReprint) {
              await ctx.api.traceability("/labels/print-runs/" + runId + "/label-printed", {
                method: "POST",
                body: { serial: serials[j] },
              });
            }
            sent += 1;
            progressBar.style.width = Math.round((sent / serials.length) * 100) + "%";
          }
        } else {
          for (var off = 0; off < serials.length; off += CHUNK) {
            var chunk = serials.slice(off, off + CHUNK);
            var res = await sendZpl(ZPL.zplBatch(chunk, spec));
            if (!res || !res.ok) {
              throw new Error((res && res.error) || ("Printer error near " + chunk[0]));
            }
            for (var ci = 0; ci < chunk.length; ci++) {
              if (!isReprint) {
                await ctx.api.traceability("/labels/print-runs/" + runId + "/label-printed", {
                  method: "POST",
                  body: { serial: chunk[ci] },
                });
              }
              sent += 1;
              progressBar.style.width = Math.round((sent / serials.length) * 100) + "%";
            }
          }
        }
        if (isReprint) {
          await ctx.api.traceability("/labels/print-runs/reprint/" + runId + "/complete", { method: "POST" });
        } else {
          await ctx.api.traceability("/labels/print-runs/" + runId + "/complete", { method: "POST" });
        }
        setStatus("Print run #" + runId + " completed (" + sent + " label" + (sent === 1 ? "" : "s") + ").");
        qtyEl.value = "";
        noteEl.value = "";
        await loadHistory();
        await loadInventory();
        await loadSequence();
        if (reprintRunEl.value) loadReprintForRun(reprintRunEl.value);
      } catch (e) {
        try {
          await ctx.api.traceability("/labels/print-runs/" + runId + "/fail", {
            method: "POST",
            body: { error: String(e.message || e) },
          });
        } catch (ignore) {}
        setStatus(
          "Print failed: " + (e.message || e) +
          " - labels already printed are saved. Use Reprint label for any missing Bag ID (e.g. from a failed run).",
          true
        );
        await loadHistory();
        await loadInventory();
        await loadSequence();
      } finally {
        pendingRun = null;
        pendingLabels = [];
        pendingMode = null;
        pendingRecovery = false;
        hideModal();
        setBusy(false);
        progressWrap.style.display = "none";
      }
    }

    function downloadPendingZpl() {
      if (!pendingLabels.length) return;
      var serials = pendingLabels.map(function (l) { return l.serial; });
      if (labelFormat === "a4_pallet") {
        openA4PrintWindow(serials, {
          autoPrint: false,
          printerName: resolvedA4Printer(),
        }).then(function () {
          setStatus("A4 print preview opened for " + serials.length + " sheet(s).");
        }).catch(function (e) {
          setStatus((e && e.message) || String(e), true);
        });
        return;
      }
      var name = serials.length === 1
        ? serials[0] + ".zpl"
        : serials[0] + "_" + serials[serials.length - 1] + ".zpl";
      downloadText(name, ZPL.zplBatch(serials, labelSpec()));
      setStatus("ZPL downloaded for " + serials.length + " label(s).");
    }

    async function prepareBatch() {
      syncLabelFormat();
      persistForm();
      if (labelFormat !== "a4_pallet") {
        try {
          assertZebraStockMatchesZpl();
        } catch (sizeErr) {
          setStatus(sizeErr.message || String(sizeErr), true);
          return;
        }
      }
      var parsed = parseQuantity(qtyEl.value);
      if (parsed.error) {
        setStatus(parsed.error, true);
        return;
      }
      if (!ctx.api.traceability) {
        setStatus("Traceability API not configured.", true);
        return;
      }
      setBusy(true);
      try {
        var fmt = apiLabelFormat();
        var body = {
          quantity: parsed.value,
          label_format: fmt,
          printer_name: fmt === "a4_pallet"
            ? (resolvedA4Printer() || null)
            : (resolvedZebraPrinter() || null),
          printer_connection: fmt === "a4_pallet" ? "windows" : zebraPrinterConnection(),
        };
        var note = noteEl.value.trim();
        if (note) body.note = note;
        var data = await ctx.api.traceability("/labels/print-runs/prepare", { method: "POST", body: body });
        pendingRun = data.print_run;
        pendingLabels = data.labels || [];
        pendingMode = "batch";
        applyPendingRunLabelFormat();
        if (pendingLabels.length) paintPreview(pendingLabels[0].serial);
        closeAllPlDialogs();
        showModal(
          "Confirm print run",
          confirmHtml(pendingRun, "batch"),
          "Print " + pendingRun.quantity + " labels",
          true
        );
        setStatus("Bag IDs reserved — confirm or cancel before printing.");
      } catch (e) {
        setStatus("Prepare failed: " + apiErrorMessage(e), true);
      } finally {
        setBusy(false);
      }
    }

    function updateReprintCount() {
      var n = Object.keys(reprintSelected).filter(function (k) { return reprintSelected[k]; }).length;
      reprintCountEl.textContent = n + " selected";
    }

    function renderReprintChecklist() {
      reprintListEl.innerHTML = "";
      reprintListEl.className = "print-labels-reprint-list";
      if (!reprintCatalog.length) {
        reprintListEl.className = "print-labels-reprint-list muted";
        reprintListEl.textContent = "No reprintable labels for this run.";
        updateReprintCount();
        return;
      }
      reprintCatalog.forEach(function (item) {
        if (!item.reprint_ok) return;
        var row = ui.el("label", { class: "print-labels-reprint-row" });
        var cb = ui.el("input", { type: "checkbox", value: item.serial });
        cb.checked = !!reprintSelected[item.serial];
        cb.addEventListener("change", function () {
          if (cb.checked) reprintSelected[item.serial] = true;
          else delete reprintSelected[item.serial];
          updateReprintCount();
        });
        row.appendChild(cb);
        var tag = item.recovery ? "recovery" : item.status;
        if (item.manual) tag += " · added";
        row.appendChild(ui.el("span", { class: "print-labels-reprint-serial" }, [item.serial]));
        row.appendChild(ui.el("span", { class: "print-labels-reprint-tag muted" }, [" · " + tag]));
        reprintListEl.appendChild(row);
      });
      updateReprintCount();
    }

    function getSelectedReprintSerials() {
      return Object.keys(reprintSelected)
        .filter(function (s) { return reprintSelected[s]; })
        .sort();
    }

    function reprintOkStatus(status, recovery) {
      if (recovery) return true;
      return status === "available" || status === "used";
    }

    function setOneStepMsg(text, isError) {
      reprintOneMsg.textContent = text || "";
      reprintOneMsg.className = isError ? "error-box" : "print-labels-field-hint";
    }

    async function continueReprintOneLabel() {
      if (!ctx.api.traceability) {
        setOneStepMsg("Traceability API not configured.", true);
        return;
      }
      var serial = parseExactBagId(reprintOneEl.value);
      if (!serial || !SERIAL_RE.test(serial)) {
        setOneStepMsg("Enter the full Bag ID as printed (BAG-YYYY-NNNNNN).", true);
        return;
      }
      reprintOneContinueBtn.disabled = true;
      setOneStepMsg("Preparing reprint…", false);
      reprintReasonNote = reprintOneReasonEl.value.trim();
      reprintCatalog = [{
        serial: serial,
        status: "manual",
        reprint_ok: true,
        manual: true,
      }];
      reprintSelected = {};
      reprintSelected[serial] = true;
      var ok = await prepareReprint();
      if (ok) {
        reprintOneEl.value = "";
        setOneStepMsg("", false);
        reprintOneDlg.close();
      } else {
        setOneStepMsg(lastReprintPrepareError || "Could not prepare reprint.", true);
      }
      reprintOneContinueBtn.disabled = false;
    }

    function setReprintSelection(serials, on) {
      (serials || []).forEach(function (s) {
        if (on) reprintSelected[s] = true;
        else delete reprintSelected[s];
      });
      renderReprintChecklist();
    }

    function reprintRangeMessage(text, isError) {
      reprintRangeMsg.textContent = text || "";
      reprintRangeMsg.className = isError ? "error-box" : "print-labels-field-hint";
      setStatus(text, isError);
    }

    async function continueReprintRange() {
      var expanded = readReprintRangeFromFields(reprintStartEl.value, reprintEndEl.value);
      if (expanded.error) {
        reprintRangeMessage(expanded.error, true);
        return;
      }
      reprintRangeContinueBtn.disabled = true;
      reprintRangeMessage("Preparing reprint…", false);
      reprintReasonNote = reprintRangeReasonEl.value.trim();
      reprintCatalog = expanded.value.map(function (serial) {
        return {
          serial: serial,
          status: "manual",
          reprint_ok: true,
          manual: true,
        };
      });
      reprintSelected = {};
      expanded.value.forEach(function (serial) {
        reprintSelected[serial] = true;
      });
      var ok = await prepareReprint();
      if (ok) {
        reprintRangeDlg.close();
      } else {
        reprintRangeMessage(lastReprintPrepareError || "Could not prepare reprint.", true);
      }
      reprintRangeContinueBtn.disabled = false;
    }

    async function continueReprintFromRun() {
      reprintReasonNote = reprintRunReasonEl.value.trim();
      var serials = getSelectedReprintSerials();
      if (!serials.length) {
        setStatus("Select at least one label in the list.", true);
        return;
      }
      reprintRunContinueBtn.disabled = true;
      var ok = await prepareReprint();
      if (ok) {
        reprintRunDlg.close();
      } else {
        setStatus(lastReprintPrepareError || "Could not prepare reprint.", true);
      }
      reprintRunContinueBtn.disabled = false;
    }

    async function loadReprintRuns() {
      if (!ctx.api.traceability) return;
      try {
        var data = await ctx.api.traceability("/labels/print-runs?limit=100");
        var runs = (data && data.print_runs) || [];
        reprintRunEl.innerHTML = "";
        reprintRunEl.appendChild(ui.el("option", { value: "" }, ["— Select print run —"]));
        runs.forEach(function (run) {
          if (run.status !== "failed" && run.status !== "completed" && run.status !== "printing") return;
          var label = "#" + run.print_run_id + " · " + run.status;
          if (run.status === "printing") label += " (stuck?)";
          if (run.first_serial && run.last_serial) {
            label += " · " + run.first_serial + " … " + run.last_serial;
          }
          if (run.run_type === "reprint") label += " (reprint)";
          reprintRunEl.appendChild(ui.el("option", { value: String(run.print_run_id) }, [label]));
        });
      } catch (e) {
        reprintRunEl.innerHTML = "";
        reprintRunEl.appendChild(ui.el("option", { value: "" }, ["Could not load print runs"]));
      }
    }

    async function loadReprintForRun(runId) {
      var manualItems = reprintCatalog.filter(function (item) { return item.manual; });
      var manualSel = {};
      manualItems.forEach(function (item) {
        if (reprintSelected[item.serial]) manualSel[item.serial] = true;
      });
      reprintCatalog = manualItems.slice();
      reprintSelected = manualSel;
      if (!runId || !ctx.api.traceability) {
        if (reprintCatalog.length) {
          renderReprintChecklist();
        } else {
          reprintListEl.className = "print-labels-reprint-list muted";
          reprintListEl.textContent = "Enter a Bag ID above, or select a print run.";
          updateReprintCount();
        }
        return;
      }
      reprintListEl.className = "print-labels-reprint-list muted";
      reprintListEl.textContent = "Loading labels…";
      try {
        var data = await ctx.api.traceability("/labels/print-runs/" + runId + "/labels");
        var runLabels = (data && data.labels) || [];
        runLabels.forEach(function (item) {
          if (!reprintCatalog.some(function (m) { return m.serial === item.serial; })) {
            reprintCatalog.push(item);
          }
        });
        reprintCatalog.forEach(function (item) {
          if (item.recovery) reprintSelected[item.serial] = true;
        });
        renderReprintChecklist();
        var auto = reprintCatalog.filter(function (i) { return i.recovery; }).length;
        if (auto) {
          setStatus("Print run #" + runId + ": " + auto + " recovery label(s) pre-selected.");
        }
      } catch (e) {
        reprintListEl.className = "print-labels-reprint-list muted";
        reprintListEl.textContent = "Could not load labels for run #" + runId + ". Deploy latest API if this is new.";
        setStatus(apiErrorMessage(e), true);
      }
    }

    async function prepareReprint() {
      lastReprintPrepareError = "";
      persistForm();
      var serials = getSelectedReprintSerials();
      if (!serials.length) {
        lastReprintPrepareError = "No Bag ID selected for reprint.";
        setStatus(lastReprintPrepareError, true);
        return false;
      }
      if (serials.length > MAX_QUANTITY) {
        lastReprintPrepareError = "Maximum reprint batch size is " + MAX_QUANTITY + ".";
        setStatus(lastReprintPrepareError, true);
        return false;
      }
      if (!ctx.api.traceability) {
        lastReprintPrepareError = "Traceability API not configured.";
        setStatus(lastReprintPrepareError, true);
        return false;
      }
      setBusy(true);
      try {
        var body = {
          serials: serials,
          printer_name: labelFormat === "a4_pallet"
            ? (resolvedA4Printer() || null)
            : (resolvedZebraPrinter() || null),
          printer_connection: labelFormat === "a4_pallet" ? "windows" : zebraPrinterConnection(),
        };
        var reason = (reprintReasonNote || "").trim();
        if (reason) body.reason = reason;
        var data = await ctx.api.traceability("/labels/print-runs/reprint/prepare", { method: "POST", body: body });
        pendingRun = data.print_run;
        pendingLabels = data.labels || [];
        if (!pendingLabels.length && data.serial) {
          pendingLabels = [{ serial: data.serial }];
        }
        if (!pendingRun) {
          throw new Error("Server did not return a print run.");
        }
        pendingMode = "reprint";
        pendingRecovery = !!(data.recovery || (data.recovery_count && data.recovery_count > 0));
        applyPendingRunLabelFormat();
        if (pendingLabels.length) paintPreview(pendingLabels[0].serial);
        closeAllPlDialogs();
        var n = pendingRun.quantity || pendingLabels.length || 1;
        showModal(
          pendingRecovery ? "Confirm recovery print" : "Confirm reprint batch",
          confirmHtml(pendingRun, "reprint"),
          pendingRecovery
            ? "Print " + n + " missing label" + (n === 1 ? "" : "s")
            : "Reprint " + n + " label" + (n === 1 ? "" : "s"),
          true
        );
        setStatus(pendingRecovery
          ? "Recovery batch prepared — confirm or cancel."
          : "Reprint batch prepared — confirm or cancel.");
        return true;
      } catch (e) {
        lastReprintPrepareError = "Reprint prepare failed: " + apiErrorMessage(e);
        setStatus(lastReprintPrepareError, true);
        return false;
      } finally {
        setBusy(false);
      }
    }

    modalCancelBtn.addEventListener("click", function () {
      cancelPending();
      setStatus("Print run cancelled — Bag IDs were not printed.");
    });
    modalPrintBtn.addEventListener("click", executePrint);
    modalDownloadBtn.addEventListener("click", downloadPendingZpl);
    modalBackdrop.addEventListener("click", function (ev) {
      if (ev.target === modalBackdrop) cancelPending();
    });

    formatEl.addEventListener("change", function () {
      syncLabelFormat();
      persistForm();
      paintPreview(null);
    });
    function onZebraStockChange() {
      if (!standardStockOnly && zebraStockEl.tagName === "SELECT" &&
          zebraStockEl.value === ZEBRA_STOCK_5425) {
        var ok = window.confirm(
          "54 × 25 mm is for LEGACY SMALL rolls only.\n\n" +
            "If the printer has 61 × 28 mm stock, cancel and keep standard size.\n\n" +
            "Continue with small-label layout?"
        );
        if (!ok) {
          zebraStockEl.value = ZEBRA_STOCK_6128;
        }
      }
      persistForm();
      refreshStockSizeBanner();
      paintPreview(null);
    }
    if (zebraStockEl.tagName === "SELECT") {
      zebraStockEl.addEventListener("change", onZebraStockChange);
    }
    async function testZebraConnection() {
      persistForm();
      if (!desktopBridge()) {
        setStatus("Open Carbo Print Labels on Windows to test the printer.", true);
        return;
      }
      var name = resolvedZebraPrinter();
      if (!name) {
        setStatus("Select the Zebra USB printer in the list first.", true);
        return;
      }
      setStatus("USB printer selected: " + name + ". Print one test label to confirm.");
    }

    refreshBtn.addEventListener("click", refreshPrinters);
    testZebraBtn.addEventListener("click", testZebraConnection);
    prepareBtn.addEventListener("click", prepareBatch);
    reprintOneContinueBtn.addEventListener("click", function () { void continueReprintOneLabel(); });
    reprintOneEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") void continueReprintOneLabel();
    });
    reprintRangeContinueBtn.addEventListener("click", function () { void continueReprintRange(); });
    reprintEndEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") void continueReprintRange();
    });
    reprintRunContinueBtn.addEventListener("click", function () { void continueReprintFromRun(); });
    reprintRunEl.addEventListener("change", function () {
      loadReprintForRun(reprintRunEl.value);
    });
    reprintSelectAllBtn.addEventListener("click", function () {
      setReprintSelection(
        reprintCatalog.filter(function (i) { return i.reprint_ok; }).map(function (i) { return i.serial; }),
        true
      );
    });
    reprintClearBtn.addEventListener("click", function () {
      reprintSelected = {};
      renderReprintChecklist();
    });
    refreshHistoryBtn.addEventListener("click", function () {
      loadHistory();
      loadReprintRuns();
    });
    [zebraPrinterEl, a4PrinterEl, zebraModeEl, zebraStockEl].forEach(function (el) {
      el.addEventListener("change", function () {
        syncZebraConnectionUi();
        persistForm();
      });
    });
    [zebraHostEl, zebraPortEl].forEach(function (el) {
      el.addEventListener("change", persistForm);
      el.addEventListener("blur", persistForm);
    });
    zebraModeEl.addEventListener("change", syncZebraConnectionUi);

    syncZebraConnectionUi();
    syncLabelFormat();
    if (standardStockOnly) persistForm();
    refreshStockSizeBanner();
    paintPreview(null);
    setStatus("Enter a quantity and click Continue. Bag IDs come from the server — nothing prints until you confirm.");
    loadInventory();
    loadHistory();
    loadSequence();
    loadReprintRuns();
    refreshPrinters();
    setTimeout(function () { refreshPrinters(); }, 2500);
  }

  CIS.modules.push({
    id: "print_labels",
    title: "Print Labels",
    kind: "app",
    icon: "labels",
    description: "Opens Carbo Print Labels app",
    requires: "traceability.labels.print",
    render: render,
  });
})();
