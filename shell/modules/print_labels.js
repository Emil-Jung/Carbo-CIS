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
      connection: "usb",
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
        "Browser CIS — you can prepare a run and download ZPL. USB printing requires desktop CIS on Windows.",
      ]));
    }
    var connEl = ui.el("select", {}, [
      ui.el("option", { value: "usb", selected: saved.connection !== "network" }, ["USB (Windows)"]),
      ui.el("option", { value: "network", selected: saved.connection === "network" }, ["Network (IP)"]),
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
    printerPanel.body.appendChild(field(ui, "Connection", connEl));
    printerPanel.body.appendChild(field(ui, "Windows printer", usbRow));
    printerPanel.body.appendChild(field(ui, "Or type printer name", printerManualEl));
    printerPanel.body.appendChild(networkWrap);

    var runPanel = panel(ui, "Print run");
    mainCol.appendChild(runPanel.root);
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

    var reprintPanel = panel(ui, "Reprint label");
    mainCol.appendChild(reprintPanel.root);
    var reprintSerialEl = ui.el("input", {
      type: "text",
      placeholder: "BAG-2026-000137",
      value: "",
      autocomplete: "off",
    });
    var reprintReasonEl = ui.el("input", { type: "text", placeholder: "Optional reason", value: "" });
    reprintPanel.body.appendChild(field(ui, "Bag ID", reprintSerialEl, "Reprints the same Bag ID — never mints a new one."));
    reprintPanel.body.appendChild(field(ui, "Reason", reprintReasonEl));
    var reprintBtn = ui.el("button", { class: "btn-secondary", type: "button" }, ["Prepare reprint"]);
    reprintPanel.body.appendChild(reprintBtn);

    var historyPanel = panel(ui, "Print run history");
    mainCol.appendChild(historyPanel.root);
    var historyWrap = ui.el("div", { class: "print-labels-history-wrap" });
    var historyTable = ui.el("table", { class: "print-labels-history" });
    historyWrap.appendChild(historyTable);
    historyPanel.body.appendChild(historyWrap);
    var refreshHistoryBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Refresh history"]);
    historyPanel.body.appendChild(refreshHistoryBtn);

    var previewPanel = panel(ui, "Preview");
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
    container.appendChild(modalBackdrop);

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
      if (usbRow.parentElement) usbRow.parentElement.style.display = net ? "none" : "";
      networkWrap.style.display = net ? "" : "none";
    }

    function setStatus(msg, isError) {
      status.textContent = msg || "";
      status.className = "print-labels-status " + (isError ? "error-box" : "muted");
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
      var stock = ui.el("div", { class: "print-labels-preview-inner" });
      var qrBox = ui.el("div", { class: "print-labels-preview-qr" });
      if (typeof qrcode === "function") {
        var qr = qrcode(0, "M");
        qr.addData(serial);
        qr.make();
        qrBox.appendChild(ui.el("div", { html: qr.createSvgTag(3, 0) }));
      }
      stock.appendChild(qrBox);
      stock.appendChild(ui.el("div", { class: "print-labels-preview-text" }, [serial]));
      preview.appendChild(stock);
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
      modalPrintBtn.disabled = !canPhysicalPrint();
      modalDownloadBtn.style.display = showDownload ? "" : "none";
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
        return (
          "<p><strong>You are about to reprint 1 label</strong></p>" +
          "<p>Bag ID:<br><code>" + run.first_serial + "</code></p>" +
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
      } catch (e) {
        setStatus("Cancel failed: " + (e.message || e), true);
      }
      pendingRun = null;
      pendingLabels = [];
      pendingMode = null;
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
        for (var i = 0; i < serials.length; i += CHUNK) {
          var chunk = serials.slice(i, i + CHUNK);
          var res = await sendZpl(ZPL.zplBatch(chunk, spec));
          if (!res || !res.ok) throw new Error((res && res.error) || "Printer error");
          sent += chunk.length;
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
      } catch (e) {
        try {
          await ctx.api.traceability("/labels/print-runs/" + runId + "/fail", {
            method: "POST",
            body: { error: String(e.message || e) },
          });
        } catch (ignore) {}
        setStatus("Print failed: " + (e.message || e) + " — Bag IDs remain reserved; check Print run history.", true);
        await loadHistory();
      } finally {
        pendingRun = null;
        pendingLabels = [];
        pendingMode = null;
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
        setStatus("Prepare failed: " + (e.message || e), true);
      } finally {
        setBusy(false);
      }
    }

    async function prepareReprint() {
      persistForm();
      var serial = reprintSerialEl.value.trim();
      if (!SERIAL_RE.test(serial)) {
        setStatus("Enter a valid Bag ID (BAG-YYYY-NNNNNN).", true);
        return;
      }
      if (!ctx.api.traceability) {
        setStatus("Traceability API not configured.", true);
        return;
      }
      setBusy(true);
      try {
        var body = {
          serial: serial,
          printer_name: resolvedPrinterName() || null,
          printer_connection: readSaved().connection,
        };
        var reason = reprintReasonEl.value.trim();
        if (reason) body.reason = reason;
        var data = await ctx.api.traceability("/labels/print-runs/reprint/prepare", { method: "POST", body: body });
        pendingRun = data.print_run;
        pendingLabels = [{ serial: data.serial }];
        pendingMode = "reprint";
        paintPreview(data.serial);
        showModal(
          "Confirm reprint",
          confirmHtml(pendingRun, "reprint"),
          "Reprint label",
          true
        );
        setStatus("Reprint prepared — confirm or cancel.");
      } catch (e) {
        setStatus("Reprint prepare failed: " + (e.message || e), true);
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
    refreshHistoryBtn.addEventListener("click", loadHistory);
    [printerEl, printerManualEl].forEach(function (el) {
      el.addEventListener("change", persistForm);
    });

    syncConnectionUi();
    paintPreview(null);
    setStatus("Enter a quantity and click Continue. Nothing prints until you confirm.");
    loadHistory();
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
