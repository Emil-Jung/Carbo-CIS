/* Print Labels — ZT231 54×25 mm bag identity labels (QR + serial). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];
  var ZPL = window.CIS_LABEL_ZPL;

  var LS = "cis_print_labels_v3";
  var CHUNK = 50;

  function loadSettings() {
    var d = ZPL ? ZPL.DEFAULT_SPEC : {};
    var s = {
      connection: "usb",
      printerName: "",
      printerNameManual: "",
      printerHost: "",
      printerPort: 9100,
      labelCount: 1,
      marginMm: d.marginMm,
      qrMag: d.qrMag || 0,
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

  function labelSpec(saved) {
    return {
      dpi: 203,
      widthMm: 54,
      heightMm: 25,
      marginMm: parseFloat(saved.marginMm) || 2.5,
      gapMm: 1.5,
      textReserveMm: 22,
      qrMag: parseInt(saved.qrMag, 10) || 0,
      symbol: "qr",
    };
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

  function serialsOf(batch) {
    return batch.map(function (l) { return l.serial; });
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

  function render(container, ctx) {
    if (!ZPL) {
      container.textContent = "Label module failed to load (label_zpl.js).";
      return;
    }
    var ui = CIS.ui;
    var batch = [];
    var saved = loadSettings();
    var bridge = desktopBridge();
    var isDesktop = !!(bridge && bridge.send_zpl_usb);

    container.innerHTML = "";
    container.className = "module-content print-labels-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Print Labels"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "ZT231 · 54 × 25 mm · 203 dpi · QR encodes the Bag ID only (no GS1 yet).",
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
      printerPanel.body.appendChild(ui.el("p", { class: "error-box" }, [
        "You are in browser CIS — USB printers cannot be listed here. ",
        "Close this tab and run desktop CIS: Carbo-CIS\\desktop\\RUN-CIS.cmd",
      ]));
    } else {
      printerPanel.body.appendChild(ui.el("p", { class: "print-labels-field-hint" }, [
        "Desktop CIS — USB printing is available when Windows sees the Zebra as a printer.",
      ]));
    }
    var connEl = ui.el("select", {}, [
      ui.el("option", { value: "usb", selected: saved.connection !== "network" }, ["USB (Windows)"]),
      ui.el("option", { value: "network", selected: saved.connection === "network" }, ["Network (IP)"]),
    ]);
    var printerEl = ui.el("select", {}, [ui.el("option", { value: "" }, ["— Refresh after USB connect —"])]);
    var refreshBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Refresh list"]);
    var usbRow = ui.el("div", { class: "print-labels-printer-row" });
    usbRow.appendChild(printerEl);
    usbRow.appendChild(refreshBtn);
    var printerManualEl = ui.el("input", {
      type: "text",
      placeholder: "Exact name from Windows Settings → Printers",
      value: saved.printerNameManual || saved.printerName || "",
    });
    var hostEl = ui.el("input", { type: "text", placeholder: "192.168.x.x", value: saved.printerHost || "" });
    var portEl = ui.el("input", { type: "number", min: "1", max: "65535", value: String(saved.printerPort || 9100) });
    var networkWrap = ui.el("div", { class: "print-labels-network-fields" });
    networkWrap.appendChild(field(ui, "Printer IP", hostEl));
    networkWrap.appendChild(field(ui, "Port", portEl));
    printerPanel.body.appendChild(field(ui, "Connection", connEl));
    printerPanel.body.appendChild(field(ui, "Windows printer", usbRow, "Refresh after USB is plugged in and driver installed."));
    printerPanel.body.appendChild(field(ui, "Or type printer name", printerManualEl,
      "Use if the dropdown is empty — copy the name exactly from Windows."));
    printerPanel.body.appendChild(networkWrap);

    var tunePanel = panel(ui, "Layout tuning");
    mainCol.appendChild(tunePanel.root);
    var marginEl = ui.el("input", { type: "number", min: "1", max: "6", step: "0.5", value: String(saved.marginMm || 2.5) });
    var qrMagEl = ui.el("input", { type: "number", min: "0", max: "10", step: "1", value: String(saved.qrMag || 0) });
    var tuneGrid = ui.el("div", { class: "print-labels-grid" });
    tuneGrid.appendChild(field(ui, "Safe margin (mm)", marginEl, "From each edge; default 2.5"));
    tuneGrid.appendChild(field(ui, "QR magnification", qrMagEl, "0 = auto from 54×25 mm"));
    tunePanel.body.appendChild(tuneGrid);
    tunePanel.body.appendChild(ui.el("p", { class: "print-labels-field-hint" }, [
      "Printer: darkness 30, speed 4. Adjust margin or QR mag after the physical test scan.",
    ]));

    var testPanel = panel(ui, "Physical test (non-production)");
    mainCol.appendChild(testPanel.root);
    testPanel.body.appendChild(ui.el("p", { class: "muted", style: "margin:0 0 10px" }, [
      "Uses ",
      ui.el("code", {}, ["TEST-000001"]),
      " … ",
      ui.el("code", {}, ["TEST-000010"]),
      " only. QR payload matches the printed text. Never allocated or written to traceability.",
    ]));
    testPanel.body.appendChild(ui.el("p", { class: "print-labels-field-hint", style: "margin:0 0 10px" }, [
      "QR is ~2–3 mm larger than the previous single-label test; margins and centring unchanged.",
    ]));
    var testBtn = ui.el("button", { class: "btn-secondary", type: "button" }, ["Print one test label"]);
    var run10Btn = ui.el("button", { class: "btn-primary", type: "button" }, ["Print 10-label alignment test"]);
    var testActions = ui.el("div", { class: "print-labels-actions" });
    testActions.appendChild(testBtn);
    testActions.appendChild(run10Btn);
    testPanel.body.appendChild(testActions);

    var jobPanel = panel(ui, "Production run");
    mainCol.appendChild(jobPanel.root);
    var countEl = ui.el("input", { type: "number", min: "1", max: "10000", value: String(saved.labelCount || 1) });
    var yearEl = ui.el("input", { type: "number", min: "2020", max: "2100", value: String(new Date().getFullYear()) });
    var noteEl = ui.el("input", { type: "text", placeholder: "Optional", value: "" });
    var jobGrid = ui.el("div", { class: "print-labels-grid print-labels-grid--job" });
    jobGrid.appendChild(field(ui, "Labels", countEl));
    jobGrid.appendChild(field(ui, "Year", yearEl));
    jobGrid.appendChild(field(ui, "Note", noteEl));
    jobPanel.body.appendChild(jobGrid);
    var allocBtn = ui.el("button", { class: "btn-primary", type: "button" }, ["Allocate serials"]);
    jobPanel.body.appendChild(allocBtn);

    var previewPanel = panel(ui, "Preview");
    sideCol.appendChild(previewPanel.root);
    var preview = ui.el("div", { class: "print-labels-preview-stock" });
    previewPanel.body.appendChild(preview);
    var summary = ui.el("div", { class: "cards print-labels-summary" });
    previewPanel.body.appendChild(summary);
    var actions = ui.el("div", { class: "print-labels-actions" });
    var printBtn = ui.el("button", { class: "btn-primary", type: "button", disabled: true }, ["Print batch"]);
    var dlBtn = ui.el("button", { class: "btn-secondary", type: "button", disabled: true }, ["Download ZPL"]);
    var markBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button", disabled: true }, ["Mark printed"]);
    actions.appendChild(printBtn);
    actions.appendChild(dlBtn);
    actions.appendChild(markBtn);
    previewPanel.body.appendChild(actions);
    var progressWrap = ui.el("div", { class: "bag-labels-progress" });
    progressWrap.appendChild(ui.el("div", { class: "bag-labels-progress-bar" }));
    previewPanel.body.appendChild(progressWrap);
    var progressBar = progressWrap.firstChild;
    var status = ui.el("p", { class: "print-labels-status muted" }, [""]);
    previewPanel.body.appendChild(status);

    container.appendChild(ui.el("button", {
      class: "btn-ghost btn-sm hub-back",
      type: "button",
      onclick: function () { if (CIS.openModule) CIS.openModule("traceability"); },
    }, ["Back to Traceability"]));

    function readSaved() {
      return {
        connection: connEl.value === "network" ? "network" : "usb",
        printerName: printerEl.value,
        printerNameManual: printerManualEl.value.trim(),
        printerHost: hostEl.value.trim(),
        printerPort: parseInt(portEl.value, 10) || 9100,
        labelCount: parseInt(countEl.value, 10) || 1,
        marginMm: parseFloat(marginEl.value) || 2.5,
        qrMag: parseInt(qrMagEl.value, 10) || 0,
      };
    }

    function resolvedPrinterName(s) {
      s = s || readSaved();
      return (s.printerName || s.printerNameManual || "").trim();
    }

    function persistForm() {
      saveSettings(readSaved());
    }

    function currentSpec() {
      return labelSpec(readSaved());
    }

    function previewSpec() {
      return ZPL.physicalTestSpec(currentSpec());
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
      testBtn.disabled = busy;
      run10Btn.disabled = busy;
      allocBtn.disabled = busy;
      printBtn.disabled = busy || !batch.length;
      dlBtn.disabled = busy || !batch.length;
      markBtn.disabled = busy || !batch.length;
    }

    function paintPreview(serial) {
      preview.innerHTML = "";
      summary.innerHTML = "";
      if (!serial) return;
      var lay = ZPL.layoutLabel(serial, previewSpec());
      var card = ui.el("div", { class: "card" });
      card.appendChild(ui.el("div", { class: "label" }, ["Serial"]));
      card.appendChild(ui.el("div", { class: "value" }, [serial]));
      summary.appendChild(card);
      var card2 = ui.el("div", { class: "card" });
      card2.appendChild(ui.el("div", { class: "label" }, ["QR mag (dots)"]));
      card2.appendChild(ui.el("div", { class: "value" }, [String(lay.mag) + " · ~" + lay.qrSize + " dots"]));
      summary.appendChild(card2);

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
      preview.appendChild(ui.el("p", { class: "print-labels-field-hint" }, [
        "Screen preview — trust the printed label for scan margin and size (432×200 dots).",
      ]));
    }

    async function refreshPrinters() {
      if (!bridge || !bridge.list_printers) {
        setStatus("Printer list needs desktop CIS (RUN-CIS.cmd), not the browser.", true);
        return;
      }
      refreshBtn.disabled = true;
      try {
        var res = await bridge.list_printers();
        var names = (res && res.printers) || [];
        var sel = resolvedPrinterName(saved);
        printerEl.innerHTML = "";
        if (!names.length) {
          printerEl.appendChild(ui.el("option", { value: "" }, ["No printers in Windows"]));
          setStatus(
            (res && res.error) ||
            "Windows reports no printers. Check: USB cable · power on · Zebra driver installed · printer visible in Settings → Printers. Then type the name manually above.",
            true
          );
          return;
        }
        var pick = sel;
        if (!pick && res.default_printer) pick = res.default_printer;
        if (!pick) {
          names.forEach(function (n) {
            if (/zebra|zdesigner|zt231/i.test(n)) pick = n;
          });
        }
        names.forEach(function (name) {
          printerEl.appendChild(ui.el("option", { value: name, selected: name === pick }, [name]));
        });
        if (pick) printerManualEl.value = pick;
        setStatus("Found " + names.length + " printer(s). " + (pick ? "Selected: " + pick : "Select your Zebra."));
      } catch (e) {
        setStatus(String(e.message || e), true);
      } finally {
        refreshBtn.disabled = false;
      }
    }

    async function sendZpl(zpl) {
      var s = readSaved();
      if (s.connection === "network") {
        if (!bridge || !bridge.send_zpl) throw new Error("Network print needs installed CIS.");
        if (!s.printerHost) throw new Error("Enter printer IP.");
        return bridge.send_zpl(s.printerHost, s.printerPort, zpl);
      }
      if (!bridge || !bridge.send_zpl_usb) throw new Error("USB print needs desktop CIS (RUN-CIS.cmd).");
      var name = resolvedPrinterName(s);
      if (!name) throw new Error("Select a printer from the list or type its Windows name exactly.");
      return bridge.send_zpl_usb(name, zpl);
    }

    async function printTestLabel() {
      persistForm();
      setBusy(true);
      setStatus("Sending test label " + ZPL.TEST_SERIAL + "…");
      paintPreview(ZPL.TEST_SERIAL);
      try {
        var res = await sendZpl(ZPL.zplTestLabel(currentSpec()));
        if (!res || !res.ok) throw new Error((res && res.error) || "Printer error");
        setStatus("Test label sent. Inspect print and scan before the 10-label run.");
      } catch (e) {
        setStatus("Test print failed: " + (e.message || e), true);
      } finally {
        setBusy(false);
      }
    }

    async function printPhysicalAlignmentTest() {
      persistForm();
      var serials = ZPL.physicalTestSerials();
      setBusy(true);
      progressWrap.style.display = "block";
      progressBar.style.width = "0%";
      paintPreview(serials[0]);
      setStatus("Sending 10 non-production labels (" + serials[0] + " … " + serials[serials.length - 1] + ")…");
      try {
        var res = await sendZpl(ZPL.zplPhysicalTestBatch(currentSpec()));
        if (!res || !res.ok) throw new Error((res && res.error) || "Printer error");
        progressBar.style.width = "100%";
        setStatus(
          "10 TEST labels sent. STOP — inspect alignment, drift, QR scan on every label before any layout changes."
        );
      } catch (e) {
        setStatus("10-label test failed: " + (e.message || e), true);
      } finally {
        setBusy(false);
        progressWrap.style.display = "none";
      }
    }

    async function allocate() {
      persistForm();
      var count = parseInt(countEl.value, 10);
      var y = parseInt(yearEl.value, 10);
      if (!count || count < 1 || count > 10000) {
        setStatus("Count must be 1–10000.", true);
        return;
      }
      if (!ctx.api.traceability) {
        setStatus("Traceability API not configured.", true);
        return;
      }
      setBusy(true);
      try {
        var body = { count: count, year: y };
        var note = noteEl.value.trim();
        if (note) body.note = note;
        var data = await ctx.api.traceability("/labels/allocate", { method: "POST", body: body });
        batch = data.labels || [];
        setStatus("Allocated " + batch.length + " serial(s).");
        if (batch.length) paintPreview(batch[0].serial);
      } catch (e) {
        setStatus("Allocate failed: " + (e.message || e), true);
      } finally {
        setBusy(false);
      }
    }

    async function markPrinted() {
      if (!batch.length) return;
      setBusy(true);
      try {
        var data = await ctx.api.traceability("/labels/mark-printed", {
          method: "POST",
          body: { serials: serialsOf(batch) },
        });
        setStatus("Marked " + (data.updated != null ? data.updated : batch.length) + " printed.");
      } catch (e) {
        setStatus(e.message || String(e), true);
      } finally {
        setBusy(false);
      }
    }

    async function printRoll() {
      persistForm();
      if (!batch.length) return;
      var serials = serialsOf(batch);
      var spec = currentSpec();
      setBusy(true);
      progressWrap.style.display = serials.length > 1 ? "block" : "none";
      progressBar.style.width = "0%";
      var sent = 0;
      try {
        for (var i = 0; i < serials.length; i += CHUNK) {
          var chunk = serials.slice(i, i + CHUNK);
          var res = await sendZpl(ZPL.zplBatch(chunk, spec));
          if (!res || !res.ok) throw new Error((res && res.error) || "Printer error");
          sent += chunk.length;
          if (serials.length > 1) progressBar.style.width = Math.round((sent / serials.length) * 100) + "%";
        }
        var marked = await ctx.api.traceability("/labels/mark-printed", {
          method: "POST",
          body: { serials: serials },
        });
        setStatus("Printed and marked " + (marked.updated != null ? marked.updated : sent) + ".");
      } catch (e) {
        setStatus("Print failed: " + (e.message || e), true);
      } finally {
        setBusy(false);
        progressWrap.style.display = "none";
      }
    }

    function download() {
      persistForm();
      if (!batch.length) return;
      var serials = serialsOf(batch);
      downloadText(
        serials.length === 1 ? serials[0] + ".zpl" : serials[0] + "_" + serials[serials.length - 1] + ".zpl",
        ZPL.zplBatch(serials, currentSpec())
      );
      setStatus("ZPL downloaded.");
    }

    connEl.addEventListener("change", function () { syncConnectionUi(); persistForm(); });
    refreshBtn.addEventListener("click", refreshPrinters);
    [marginEl, qrMagEl, printerEl, printerManualEl].forEach(function (el) {
      el.addEventListener("change", function () {
        persistForm();
        paintPreview(batch.length ? batch[0].serial : ZPL.TEST_SERIAL);
      });
    });
    testBtn.addEventListener("click", printTestLabel);
    run10Btn.addEventListener("click", printPhysicalAlignmentTest);
    allocBtn.addEventListener("click", allocate);
    printBtn.addEventListener("click", printRoll);
    dlBtn.addEventListener("click", download);
    markBtn.addEventListener("click", markPrinted);

    syncConnectionUi();
    paintPreview(ZPL.TEST_SERIAL);
    setStatus(isDesktop
      ? "Run the 10-label alignment test when ready. TEST-* IDs never enter production."
      : "Use installed CIS on Windows for USB print, or Download ZPL.");
    if (isDesktop && saved.connection !== "network") refreshPrinters();
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
