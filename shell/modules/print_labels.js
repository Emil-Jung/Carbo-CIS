/* Print Labels — production ZT231 bag identity labels (server-allocated Bag IDs). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];
  var ZPL = window.CIS_LABEL_ZPL;

  var LS = "cis_print_labels_v4";
  var CHUNK = 50;
  var MAX_QUANTITY = 10000;
  var SERIAL_RE = /^BAG-\d{4}-\d{6,}$/;

  function loadSettings() {
    var s = {
      connection: "network",
      printerName: "",
      printerNameManual: "",
      printerHost: "",
      printerPort: 9100,
    };
    try {
      var raw = localStorage.getItem(LS);
      if (raw) Object.assign(s, JSON.parse(raw));
    } catch (e) {}
    s.connection = s.connection === "network" ? "network" : "usb";
    return s;
  }

  function saveSettings(s) {
    localStorage.setItem(LS, JSON.stringify(s));
  }

  function desktopBridge() {
    return window.pywebview && window.pywebview.api ? window.pywebview.api : null;
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
    p.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, [title]));
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

  function canonicalSerial(year, seq) {
    var y = parseInt(year, 10);
    var n = parseInt(seq, 10);
    if (!y || !n) return "";
    var pad = String(n);
    while (pad.length < 6) pad = "0" + pad;
    return "BAG-" + y + "-" + pad;
  }

  function parseSerialToken(token, defaultYear) {
    var t = (token || "").trim();
    if (!t) return null;
    if (SERIAL_RE.test(t)) return t;
    if (/^\d+$/.test(t)) {
      return canonicalSerial(defaultYear, parseInt(t, 10));
    }
    return null;
  }

  /** Expand "321-330", "BAG-2026-000321 - 000330", etc. */
  function expandReprintRange(raw, defaultYear) {
    var text = (raw || "").trim();
    if (!text) return { error: "Enter a range, e.g. 321-330 or BAG-2026-000321 - BAG-2026-000330." };
    var m = text.match(/^(.+?)\s*(?:-|–|to)\s*(.+)$/i);
    if (!m) {
      var one = parseSerialToken(text, defaultYear);
      if (!one) return { error: "Could not parse range. Use 321-330 or full Bag IDs." };
      return { value: [one] };
    }
    var start = parseSerialToken(m[1], defaultYear);
    var end = parseSerialToken(m[2], defaultYear);
    if (!start || !end) return { error: "Could not parse range endpoints." };
    var sm = start.match(SERIAL_RE);
    var em = end.match(SERIAL_RE);
    if (!sm || !em) return { error: "Invalid Bag ID in range." };
    var year = parseInt(sm[1], 10);
    if (parseInt(em[1], 10) !== year) {
      return { error: "Range must be within the same year." };
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

  function render(container, ctx) {
    if (!ZPL) {
      container.textContent = "Label module failed to load (label_zpl.js).";
      return;
    }
    var ui = CIS.ui;
    var saved = loadSettings();
    var bridge = desktopBridge();
    var isDesktop = !!(bridge && (bridge.send_zpl_usb || bridge.send_zpl));
    var pendingRun = null;
    var pendingLabels = [];
    var pendingMode = null;
    var pendingRecovery = false;

    container.innerHTML = "";
    container.className = "module-content print-labels-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Print Labels"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Production bag identity labels · ZT231 · 54 × 25 mm · 203 dpi · Bag IDs allocated by the server.",
    ]));

    var layout = ui.el("div", { class: "print-labels-layout" });
    var mainCol = ui.el("div", { class: "print-labels-main" });
    var sideCol = ui.el("div", { class: "print-labels-side" });
    layout.appendChild(mainCol);
    layout.appendChild(sideCol);
    container.appendChild(layout);

    var printerPanel = panel(ui, "Printer");
    mainCol.appendChild(printerPanel.root);
    if (!isDesktop) {
      printerPanel.body.appendChild(ui.el("p", { class: "print-labels-field-hint" }, [
        "Browser CIS — you can prepare a run and download ZPL. Physical printing requires desktop CIS on Windows.",
      ]));
    } else {
      printerPanel.body.appendChild(ui.el("p", { class: "print-labels-field-hint" }, [
        "Network (IP) is the normal path. Use USB (Windows spooler) only if the printer is not reachable on the LAN.",
      ]));
    }
    var connEl = ui.el("select", {}, [
      ui.el("option", { value: "network", selected: saved.connection === "network" }, ["Network (IP)"]),
      ui.el("option", { value: "usb", selected: saved.connection !== "network" }, ["USB (Windows)"]),
    ]);
    var printerEl = ui.el("select", {}, [ui.el("option", { value: "" }, ["— Refresh list —"])]);
    var refreshBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Refresh list"]);
    var usbRow = ui.el("div", { class: "print-labels-printer-row" });
    usbRow.appendChild(printerEl);
    usbRow.appendChild(refreshBtn);
    var printerManualEl = ui.el("input", {
      type: "text",
      placeholder: "Exact Windows printer name",
      value: saved.printerNameManual || saved.printerName || "",
    });
    var hostEl = ui.el("input", { type: "text", placeholder: "192.168.x.x", value: saved.printerHost || "" });
    var portEl = ui.el("input", { type: "number", min: "1", max: "65535", value: String(saved.printerPort || 9100) });
    var networkWrap = ui.el("div", { class: "print-labels-network-fields" });
    networkWrap.appendChild(field(ui, "Printer IP", hostEl));
    networkWrap.appendChild(field(ui, "Port", portEl));
    var usbField = field(ui, "Windows printer (USB)", usbRow,
      "Select your Zebra from the Windows printer list (USB mode only).");
    var manualField = field(ui, "Or type printer name", printerManualEl,
      "USB mode only — exact name from Windows Printers.");
    printerPanel.body.appendChild(field(ui, "Connection", connEl));
    printerPanel.body.appendChild(usbField);
    printerPanel.body.appendChild(manualField);
    printerPanel.body.appendChild(networkWrap);

    var runPanel = panel(ui, "Print run");
    mainCol.appendChild(runPanel.root);
    var sequenceEl = ui.el("div", { class: "print-labels-sequence muted" }, ["Loading sequence…"]);
    runPanel.body.appendChild(sequenceEl);
    var qtyEl = ui.el("input", {
      type: "text",
      inputmode: "numeric",
      autocomplete: "off",
      placeholder: "Enter quantity",
      value: "",
    });
    var noteEl = ui.el("input", { type: "text", placeholder: "Optional note", value: "" });
    runPanel.body.appendChild(field(ui, "Quantity", qtyEl,
      "Required — no default. Maximum " + MAX_QUANTITY + " labels per run."));
    runPanel.body.appendChild(field(ui, "Note", noteEl));
    var prepareBtn = ui.el("button", { class: "btn-primary", type: "button" }, ["Continue"]);
    runPanel.body.appendChild(prepareBtn);
    var runStatus = ui.el("p", { class: "print-labels-status print-labels-run-status muted" }, [""]);
    runPanel.body.appendChild(runStatus);

    var reprintPanel = panel(ui, "Reprint labels");
    mainCol.appendChild(reprintPanel.root);
    var reprintRunEl = ui.el("select", {}, [ui.el("option", { value: "" }, ["Loading print runs…"])]);
    var reprintManualEl = ui.el("input", {
      type: "text",
      placeholder: "BAG-2026-000137 or 137",
      value: "",
      autocomplete: "off",
    });
    var reprintManualBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Add label"]);
    var reprintManualRow = ui.el("div", { class: "print-labels-printer-row" });
    reprintManualRow.appendChild(reprintManualEl);
    reprintManualRow.appendChild(reprintManualBtn);
    var reprintRangeEl = ui.el("input", {
      type: "text",
      placeholder: "e.g. 321-330 or BAG-2026-000321 - BAG-2026-000330",
      value: "",
      autocomplete: "off",
    });
    var reprintRangeBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Apply range"]);
    var reprintRangeRow = ui.el("div", { class: "print-labels-printer-row" });
    reprintRangeRow.appendChild(reprintRangeEl);
    reprintRangeRow.appendChild(reprintRangeBtn);
    var reprintListEl = ui.el("div", { class: "print-labels-reprint-list muted" }, ["Select a print run above."]);
    var reprintToolbar = ui.el("div", { class: "print-labels-reprint-toolbar" });
    var reprintSelectAllBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Select all"]);
    var reprintClearBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Clear"]);
    var reprintCountEl = ui.el("span", { class: "print-labels-reprint-count muted" }, ["0 selected"]);
    reprintToolbar.appendChild(reprintSelectAllBtn);
    reprintToolbar.appendChild(reprintClearBtn);
    reprintToolbar.appendChild(reprintCountEl);
    var reprintReasonEl = ui.el("input", { type: "text", placeholder: "Optional reason", value: "" });
    reprintPanel.body.appendChild(field(ui, "Bag ID", reprintManualRow,
      "Smudged or misprinted — enter one Bag ID and Add (no print run needed)."));
    reprintPanel.body.appendChild(field(ui, "Print run", reprintRunEl,
      "Optional — pick a failed/completed run to tick many labels, or use range below."));
    reprintPanel.body.appendChild(field(ui, "Range", reprintRangeRow,
      "Within the selected run — e.g. 321-330, then Apply range."));
    reprintPanel.body.appendChild(reprintToolbar);
    reprintPanel.body.appendChild(reprintListEl);
    reprintPanel.body.appendChild(field(ui, "Reason", reprintReasonEl));
    var reprintBtn = ui.el("button", { class: "btn-secondary", type: "button" }, ["Prepare reprint batch"]);
    reprintPanel.body.appendChild(reprintBtn);

    var reprintCatalog = [];
    var reprintDefaultYear = new Date().getFullYear();
    var reprintSelected = {};

    var inventoryPanel = panel(ui, "Label inventory (server)");
    mainCol.appendChild(inventoryPanel.root);
    var inventoryEl = ui.el("div", { class: "print-labels-inventory muted" }, ["Loading…"]);
    inventoryPanel.body.appendChild(inventoryEl);

    var historyPanel = panel(ui, "Print run history");
    mainCol.appendChild(historyPanel.root);
    var historyWrap = ui.el("div", { class: "print-labels-history-wrap" });
    var historyTable = ui.el("table", { class: "print-labels-history" });
    historyWrap.appendChild(historyTable);
    historyPanel.body.appendChild(historyWrap);
    var refreshHistoryBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Refresh history"]);
    historyPanel.body.appendChild(refreshHistoryBtn);

    var previewPanel = panel(ui, "Preview");
    previewPanel.root.classList.add("print-labels-panel--preview");
    sideCol.appendChild(previewPanel.root);
    var preview = ui.el("div", { class: "print-labels-preview-stock" });
    previewPanel.body.appendChild(preview);
    var summary = ui.el("div", { class: "cards print-labels-summary" });
    previewPanel.body.appendChild(summary);
    var progressWrap = ui.el("div", { class: "bag-labels-progress" });
    progressWrap.appendChild(ui.el("div", { class: "bag-labels-progress-bar" }));
    previewPanel.body.appendChild(progressWrap);
    var progressBar = progressWrap.firstChild;
    progressWrap.style.display = "none";
    var status = ui.el("p", { class: "print-labels-status muted" }, [""]);
    previewPanel.body.appendChild(status);

    var oldModal = document.querySelector(".print-labels-modal-backdrop");
    if (oldModal) oldModal.remove();

    container.appendChild(ui.el("button", {
      class: "btn-ghost btn-sm hub-back",
      type: "button",
      onclick: function () { if (CIS.openModule) CIS.openModule("traceability"); },
    }, ["Back to Traceability"]));

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
    modal.appendChild(modalTitle);
    modal.appendChild(modalBody);
    modal.appendChild(modalActions);
    modalBackdrop.appendChild(modal);
    document.body.appendChild(modalBackdrop);

    function readSaved() {
      return {
        connection: connEl.value === "network" ? "network" : "usb",
        printerName: printerEl.value,
        printerNameManual: printerManualEl.value.trim(),
        printerHost: hostEl.value.trim(),
        printerPort: parseInt(portEl.value, 10) || 9100,
      };
    }

    function resolvedPrinterName(s) {
      s = s || readSaved();
      return (s.printerName || s.printerNameManual || "").trim();
    }

    function persistForm() {
      saveSettings(readSaved());
    }

    function labelSpec() {
      return ZPL.productionSpec();
    }

    function syncConnectionUi() {
      var net = connEl.value === "network";
      usbField.style.display = net ? "none" : "";
      manualField.style.display = net ? "none" : "";
      networkWrap.style.display = net ? "" : "none";
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
      reprintBtn.disabled = busy;
      refreshBtn.disabled = busy;
      refreshHistoryBtn.disabled = busy;
      modalPrintBtn.disabled = busy;
      modalCancelBtn.disabled = busy;
      modalDownloadBtn.disabled = busy;
    }

    function fitPreviewFrame(frame, canvas, labelW, labelH) {
      var fw = frame.clientWidth;
      if (!fw || !labelW) return;
      var scale = fw / labelW;
      canvas.style.transform = "scale(" + scale + ")";
      frame.style.height = Math.ceil(labelH * scale) + "px";
    }

    function paintPreview(serial) {
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
          var hm = String(data.next_serial).match(SERIAL_RE);
          if (hm) reprintDefaultYear = parseInt(hm[1], 10);
        } else if (data.year) {
          reprintDefaultYear = parseInt(data.year, 10);
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
      var s = readSaved();
      if (s.connection === "network") {
        return !!(bridge && bridge.send_zpl && s.printerHost);
      }
      return !!(bridge && bridge.send_zpl_usb && resolvedPrinterName(s));
    }

    function showModal(title, htmlBody, printLabel, showDownload) {
      modalTitle.textContent = title;
      modalBody.innerHTML = "";
      var extra = canPhysicalPrint()
        ? ""
        : "<p class=\"print-labels-field-hint\">Physical printing needs desktop CIS on Windows with a configured printer. You can download ZPL instead.</p>";
      modalBody.appendChild(ui.el("div", { html: htmlBody + extra }));
      modalPrintBtn.textContent = printLabel;
      var canPrint = canPhysicalPrint();
      modalPrintBtn.disabled = !canPrint;
      // Download ZPL is for web CIS / troubleshooting — hide when desktop can print directly.
      modalDownloadBtn.style.display = showDownload && !canPrint ? "" : "none";
      modalBackdrop.classList.remove("hidden");
    }

    function printerSummary() {
      var s = readSaved();
      if (s.connection === "network") {
        return (s.printerHost || "Network printer") + (s.printerPort ? ":" + s.printerPort : "");
      }
      return resolvedPrinterName(s) || "USB printer";
    }

    async function refreshPrinters() {
      if (!bridge || !bridge.list_printers) return;
      refreshBtn.disabled = true;
      try {
        var res = await bridge.list_printers();
        var names = (res && res.printers) || [];
        var sel = resolvedPrinterName(saved);
        printerEl.innerHTML = "";
        if (!names.length) {
          printerEl.appendChild(ui.el("option", { value: "" }, ["No printers in Windows"]));
          return;
        }
        var pick = sel;
        if (!pick) {
          names.forEach(function (n) {
            if (/zebra|zdesigner|zt231/i.test(n)) pick = n;
          });
        }
        names.forEach(function (name) {
          printerEl.appendChild(ui.el("option", { value: name, selected: name === pick }, [name]));
        });
        if (pick) printerManualEl.value = pick;
      } finally {
        refreshBtn.disabled = false;
      }
    }

    async function sendZpl(zpl) {
      var s = readSaved();
      if (s.connection === "network") {
        if (!bridge || !bridge.send_zpl) throw new Error("Network print needs desktop CIS.");
        if (!s.printerHost) throw new Error("Enter printer IP.");
        return bridge.send_zpl(s.printerHost, s.printerPort, zpl);
      }
      if (!bridge || !bridge.send_zpl_usb) throw new Error("USB print needs desktop CIS on Windows.");
      var name = resolvedPrinterName(s);
      if (!name) throw new Error("Select or enter the Windows printer name.");
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
        inventoryEl.textContent =
          "Available to use: " + (inv.available_to_use != null ? inv.available_to_use : c.available || 0) +
          " · Allocated (pending print): " + (c.allocated || 0) +
          " · Used: " + (c.used || 0) +
          " · Void: " + (c.void || 0);
      } catch (e) {
        inventoryEl.textContent = "Could not load inventory: " + (e.message || e);
      }
    }

    async function loadHistory() {
      if (!ctx.api.traceability) return;
      try {
        var data = await ctx.api.traceability("/labels/print-runs?limit=50");
        var runs = (data && data.print_runs) || [];
        historyTable.innerHTML = "";
        var thead = ui.el("thead");
        var hr = ui.el("tr");
        ["Run", "When", "User", "Qty", "First ID", "Last ID", "Printer", "Status"].forEach(function (h) {
          hr.appendChild(ui.el("th", {}, [h]));
        });
        thead.appendChild(hr);
        historyTable.appendChild(thead);
        var tbody = ui.el("tbody");
        if (!runs.length) {
          var empty = ui.el("tr");
          empty.appendChild(ui.el("td", { colspan: "8", class: "muted" }, ["No print runs yet."]));
          tbody.appendChild(empty);
        } else {
          runs.forEach(function (run) {
            var tr = ui.el("tr");
            tr.appendChild(ui.el("td", {}, ["#" + run.print_run_id + (run.run_type === "reprint" ? " R" : "")]));
            tr.appendChild(ui.el("td", {}, [run.created_at ? run.created_at.replace("T", " ").replace("Z", "") : ""]));
            tr.appendChild(ui.el("td", {}, [run.operator_login || ""]));
            tr.appendChild(ui.el("td", {}, [String(run.quantity)]));
            tr.appendChild(ui.el("td", {}, [run.first_serial || ""]));
            tr.appendChild(ui.el("td", {}, [run.last_serial || ""]));
            tr.appendChild(ui.el("td", {}, [run.printer_name || ""]));
            tr.appendChild(ui.el("td", {}, [run.status || ""]));
            tbody.appendChild(tr);
          });
        }
        historyTable.appendChild(tbody);
      } catch (e) {
        setStatus("Could not load history: " + (e.message || e), true);
      }
    }

    function confirmHtml(run, mode) {
      var qty = run.quantity;
      var printer = run.printer_name || printerSummary();
      if (mode === "reprint") {
        var n = qty || 1;
        var title = pendingRecovery
          ? "You are about to print missing label(s) from a failed run"
          : "You are about to reprint " + n + " label" + (n === 1 ? "" : "s");
        if (n === 1) {
          return (
            "<p><strong>" + title + "</strong></p>" +
            "<p>Bag ID:<br><code>" + run.first_serial + "</code></p>" +
            "<p>Printer:<br><strong>" + printer + "</strong></p>"
          );
        }
        return (
          "<p><strong>" + title + "</strong></p>" +
          "<p>Bag IDs:<br><code>" + run.first_serial + "</code><br>to<br><code>" + run.last_serial + "</code></p>" +
          "<p>Printer:<br><strong>" + printer + "</strong></p>"
        );
      }
      return (
        "<p><strong>You are about to print:</strong><br>" + qty + " label" + (qty === 1 ? "" : "s") + "</p>" +
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
      persistForm();
      setBusy(true);
      progressWrap.style.display = "block";
      progressBar.style.width = "0%";
      var runId = pendingRun.print_run_id;
      var serials = pendingLabels.map(function (l) { return l.serial; });
      var spec = labelSpec();
      var isReprint = pendingMode === "reprint";
      try {
        if (isReprint) {
          await ctx.api.traceability("/labels/print-runs/" + runId + "/start", { method: "POST" });
        } else {
          await ctx.api.traceability("/labels/print-runs/" + runId + "/start", { method: "POST" });
        }
        setStatus("Printing…");
        var sent = 0;
        for (var i = 0; i < serials.length; i++) {
          var one = serials[i];
          var res = await sendZpl(ZPL.zplOneLabel(one, spec));
          if (!res || !res.ok) {
            throw new Error((res && res.error) || ("Printer error on " + one));
          }
          if (!isReprint) {
            await ctx.api.traceability("/labels/print-runs/" + runId + "/label-printed", {
              method: "POST",
              body: { serial: one },
            });
          }
          sent += 1;
          progressBar.style.width = Math.round((sent / serials.length) * 100) + "%";
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
      var name = serials.length === 1
        ? serials[0] + ".zpl"
        : serials[0] + "_" + serials[serials.length - 1] + ".zpl";
      downloadText(name, ZPL.zplBatch(serials, labelSpec()));
      setStatus("ZPL downloaded for " + serials.length + " label(s).");
    }

    async function prepareBatch() {
      persistForm();
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
        var body = {
          quantity: parsed.value,
          printer_name: resolvedPrinterName() || null,
          printer_connection: readSaved().connection,
        };
        var note = noteEl.value.trim();
        if (note) body.note = note;
        var data = await ctx.api.traceability("/labels/print-runs/prepare", { method: "POST", body: body });
        pendingRun = data.print_run;
        pendingLabels = data.labels || [];
        pendingMode = "batch";
        if (pendingLabels.length) paintPreview(pendingLabels[0].serial);
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

    async function addManualReprintSerial() {
      if (!ctx.api.traceability) {
        setStatus("Traceability API not configured.", true);
        return;
      }
      var serial = parseSerialToken(reprintManualEl.value, reprintDefaultYear);
      if (!serial || !SERIAL_RE.test(serial)) {
        setStatus("Enter a valid Bag ID (BAG-YYYY-NNNNNN or sequence number).", true);
        return;
      }
      if (reprintCatalog.some(function (item) { return item.serial === serial; })) {
        reprintSelected[serial] = true;
        reprintManualEl.value = "";
        renderReprintChecklist();
        setStatus("Selected " + serial + " (already in list).");
        return;
      }
      try {
        var label = await ctx.api.traceability("/labels/" + encodeURIComponent(serial));
        var recovery = label.status === "allocated";
        if (!reprintOkStatus(label.status, recovery)) {
          setStatus(
            serial + " is " + label.status + " — only available, used, or recovery (allocated) labels can be reprinted.",
            true
          );
          return;
        }
        reprintCatalog.push({
          serial: label.serial,
          status: label.status,
          recovery: recovery,
          reprint_ok: true,
          manual: true,
        });
        reprintSelected[serial] = true;
        reprintManualEl.value = "";
        renderReprintChecklist();
        setStatus("Added " + serial + " for reprint.");
      } catch (e) {
        setStatus("Could not look up " + serial + ": " + apiErrorMessage(e), true);
      }
    }

    function setReprintSelection(serials, on) {
      (serials || []).forEach(function (s) {
        if (on) reprintSelected[s] = true;
        else delete reprintSelected[s];
      });
      renderReprintChecklist();
    }

    function applyReprintRangeSelection() {
      var expanded = expandReprintRange(reprintRangeEl.value, reprintDefaultYear);
      if (expanded.error) {
        setStatus(expanded.error, true);
        return;
      }
      var known = {};
      reprintCatalog.forEach(function (item) {
        if (item.reprint_ok) known[item.serial] = true;
      });
      var matched = expanded.value.filter(function (s) { return known[s]; });
      if (!matched.length) {
        setStatus("No labels in that range are on this print run (or not reprintable).", true);
        return;
      }
      setReprintSelection(matched, true);
      setStatus("Selected " + matched.length + " label(s) from range.");
    }

    async function loadReprintRuns() {
      if (!ctx.api.traceability) return;
      try {
        var data = await ctx.api.traceability("/labels/print-runs?limit=100");
        var runs = (data && data.print_runs) || [];
        reprintRunEl.innerHTML = "";
        reprintRunEl.appendChild(ui.el("option", { value: "" }, ["— Select print run —"]));
        runs.forEach(function (run) {
          if (run.status !== "failed" && run.status !== "completed") return;
          var label = "#" + run.print_run_id + " · " + run.status;
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
      persistForm();
      var serials = getSelectedReprintSerials();
      if (!serials.length) {
        setStatus("Select at least one label to reprint (tick boxes or use a range).", true);
        return;
      }
      if (serials.length > MAX_QUANTITY) {
        setStatus("Maximum reprint batch size is " + MAX_QUANTITY + ".", true);
        return;
      }
      if (!ctx.api.traceability) {
        setStatus("Traceability API not configured.", true);
        return;
      }
      setBusy(true);
      try {
        var body = {
          serials: serials,
          printer_name: resolvedPrinterName() || null,
          printer_connection: readSaved().connection,
        };
        var reason = reprintReasonEl.value.trim();
        if (reason) body.reason = reason;
        var data = await ctx.api.traceability("/labels/print-runs/reprint/prepare", { method: "POST", body: body });
        pendingRun = data.print_run;
        pendingLabels = data.labels || [];
        if (!pendingLabels.length && data.serial) {
          pendingLabels = [{ serial: data.serial }];
        }
        pendingMode = "reprint";
        pendingRecovery = !!(data.recovery || (data.recovery_count && data.recovery_count > 0));
        if (pendingLabels.length) paintPreview(pendingLabels[0].serial);
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
      } catch (e) {
        setStatus("Reprint prepare failed: " + apiErrorMessage(e), true);
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

    connEl.addEventListener("change", function () { syncConnectionUi(); persistForm(); });
    refreshBtn.addEventListener("click", refreshPrinters);
    prepareBtn.addEventListener("click", prepareBatch);
    reprintBtn.addEventListener("click", prepareReprint);
    reprintRunEl.addEventListener("change", function () {
      loadReprintForRun(reprintRunEl.value);
    });
    reprintManualBtn.addEventListener("click", addManualReprintSerial);
    reprintManualEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") addManualReprintSerial();
    });
    reprintRangeBtn.addEventListener("click", applyReprintRangeSelection);
    reprintRangeEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") applyReprintRangeSelection();
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
    [printerEl, printerManualEl, hostEl, portEl].forEach(function (el) {
      el.addEventListener("change", persistForm);
      el.addEventListener("input", persistForm);
    });

    syncConnectionUi();
    paintPreview(null);
    setStatus("Enter a quantity and click Continue. Bag IDs come from the server — nothing prints until you confirm.");
    loadInventory();
    loadHistory();
    loadSequence();
    loadReprintRuns();
    if (bridge && bridge.list_printers && saved.connection !== "network") refreshPrinters();
  }

  CIS.modules.push({
    id: "print_labels",
    title: "Print Labels",
    kind: "app",
    icon: "labels",
    description: "Allocate and print bag identity labels",
    requires: "traceability.labels.print",
    render: render,
  });
})();
