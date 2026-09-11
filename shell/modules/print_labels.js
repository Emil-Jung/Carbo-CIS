/* Print Labels — allocate bag serials and print QR labels (USB or network Zebra). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var LS = "cis_print_labels_v2";
  var CHUNK = 50;
  var DEFAULTS = {
    connection: "usb",
    printerName: "",
    printerHost: "",
    printerPort: 9100,
    dpi: 203,
    bandLeading: true,
    mediaWmm: 60,
    mediaHmm: 25,
    bandMm: 6,
    qrMag: 0,
    labelCount: 1,
  };

  function loadSettings() {
    var s = Object.assign({}, DEFAULTS);
    try {
      var raw = localStorage.getItem(LS);
      if (raw) Object.assign(s, JSON.parse(raw));
    } catch (e) {}
    s.connection = s.connection === "network" ? "network" : "usb";
    s.printerPort = parseInt(s.printerPort, 10) || 9100;
    s.dpi = parseInt(s.dpi, 10) === 300 ? 300 : 203;
    s.bandLeading = s.bandLeading !== false;
    s.mediaWmm = parseFloat(s.mediaWmm) || DEFAULTS.mediaWmm;
    s.mediaHmm = parseFloat(s.mediaHmm) || DEFAULTS.mediaHmm;
    s.bandMm = parseFloat(s.bandMm) || DEFAULTS.bandMm;
    s.qrMag = parseInt(s.qrMag, 10) || 0;
    s.labelCount = parseInt(s.labelCount, 10) || 1;
    return s;
  }

  function saveSettings(s) {
    localStorage.setItem(LS, JSON.stringify({
      connection: s.connection === "network" ? "network" : "usb",
      printerName: s.printerName || "",
      printerHost: s.printerHost || "",
      printerPort: parseInt(s.printerPort, 10) || 9100,
      dpi: parseInt(s.dpi, 10) === 300 ? 300 : 203,
      bandLeading: !!s.bandLeading,
      mediaWmm: parseFloat(s.mediaWmm) || DEFAULTS.mediaWmm,
      mediaHmm: parseFloat(s.mediaHmm) || DEFAULTS.mediaHmm,
      bandMm: parseFloat(s.bandMm) || DEFAULTS.bandMm,
      qrMag: parseInt(s.qrMag, 10) || 0,
      labelCount: parseInt(s.labelCount, 10) || 1,
    }));
  }

  function dots(mm, dpi) {
    return Math.round((mm * dpi) / 25.4);
  }

  function defaultQrMag(dpi) {
    return dpi >= 300 ? 8 : 6;
  }

  function zplOne(serial, cfg) {
    var dpi = cfg.dpi;
    var mag = cfg.qrMag > 0 ? cfg.qrMag : defaultQrMag(dpi);
    var pw = dots(cfg.mediaWmm, dpi);
    var ll = dots(cfg.mediaHmm, dpi);
    var band = dots(cfg.bandMm, dpi);
    var margin = dots(1.2, dpi);
    var qrMods = 25;
    var qrSize = qrMods * mag;
    var originX = cfg.bandLeading ? band : 0;
    var qrX = originX + margin;
    var qrY = Math.max(0, Math.round((ll - qrSize) / 2));
    var textX = qrX + qrSize + dots(1.2, dpi);
    var fontH = dots(4.2, dpi);
    var fontW = dots(3.8, dpi);
    var textY = Math.max(margin, Math.round((ll - fontH) / 2));
    return (
      "^XA\n^CI28\n^PW" + pw + "\n^LL" + ll + "\n^LH0,0\n" +
      "^FO" + qrX + "," + qrY + "^BQN,2," + mag + "^FDQA," + serial + "^FS\n" +
      "^FO" + textX + "," + textY + "^A0N," + fontH + "," + fontW + "^FD" + serial + "^FS\n" +
      "^XZ\n"
    );
  }

  function zplBatch(serials, cfg) {
    return serials.map(function (s) { return zplOne(s, cfg); }).join("");
  }

  function qrSvg(serial) {
    if (typeof qrcode !== "function") return "";
    var qr = qrcode(0, "M");
    qr.addData(serial);
    qr.make();
    return qr.createSvgTag(4, 0);
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
    var ui = CIS.ui;
    var batch = [];
    var saved = loadSettings();
    var bridge = desktopBridge();
    var isDesktop = !!(bridge && bridge.send_zpl_usb);

    container.innerHTML = "";
    container.className = "module-content print-labels-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Print Labels"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Allocate a bag serial, print a QR label on the Zebra, then mark it printed.",
    ]));

    var layout = ui.el("div", { class: "print-labels-layout" });
    var mainCol = ui.el("div", { class: "print-labels-main" });
    var sideCol = ui.el("div", { class: "print-labels-side" });
    layout.appendChild(mainCol);
    layout.appendChild(sideCol);
    container.appendChild(layout);

    /* --- Printer --- */
    var printerPanel = panel(ui, "Printer");
    mainCol.appendChild(printerPanel.root);

    var connEl = ui.el("select", {}, [
      ui.el("option", { value: "usb", selected: saved.connection !== "network" }, ["USB (Windows)"]),
      ui.el("option", { value: "network", selected: saved.connection === "network" }, ["Network (IP)"]),
    ]);
    var printerEl = ui.el("select", {}, [ui.el("option", { value: "" }, ["— connect USB, then Refresh —"])]);
    var refreshBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Refresh list"]);
    var usbRow = ui.el("div", { class: "print-labels-printer-row" });
    usbRow.appendChild(printerEl);
    usbRow.appendChild(refreshBtn);

    var hostEl = ui.el("input", { type: "text", placeholder: "192.168.x.x", value: saved.printerHost });
    var portEl = ui.el("input", { type: "number", min: "1", max: "65535", value: String(saved.printerPort) });
    var networkWrap = ui.el("div", { class: "print-labels-network-fields" });
    networkWrap.appendChild(field(ui, "Printer IP", hostEl));
    networkWrap.appendChild(field(ui, "Port", portEl));

    printerPanel.body.appendChild(field(ui, "Connection", connEl));
    printerPanel.body.appendChild(field(ui, "Windows printer", usbRow, isDesktop
      ? "Install the Zebra driver, connect USB, then Refresh."
      : "USB printing uses the installed CIS desktop app on Windows."));
    printerPanel.body.appendChild(networkWrap);

    /* --- Label stock --- */
    var stockPanel = panel(ui, "Label stock");
    mainCol.appendChild(stockPanel.root);
    var stockGrid = ui.el("div", { class: "print-labels-grid" });

    var dpiEl = ui.el("select", {}, [
      ui.el("option", { value: "203", selected: saved.dpi !== 300 }, ["203 dpi"]),
      ui.el("option", { value: "300", selected: saved.dpi === 300 }, ["300 dpi"]),
    ]);
    var bandEl = ui.el("select", {}, [
      ui.el("option", { value: "leading", selected: saved.bandLeading }, ["Tab first (feed)"]),
      ui.el("option", { value: "trailing", selected: !saved.bandLeading }, ["Tab last"]),
    ]);
    var mediaWEl = ui.el("input", { type: "number", min: "20", max: "120", step: "0.1", value: String(saved.mediaWmm) });
    var mediaHEl = ui.el("input", { type: "number", min: "10", max: "80", step: "0.1", value: String(saved.mediaHmm) });
    var bandMmEl = ui.el("input", { type: "number", min: "0", max: "20", step: "0.1", value: String(saved.bandMm) });
    var qrMagEl = ui.el("input", { type: "number", min: "0", max: "12", step: "1", value: String(saved.qrMag || 0) });

    stockGrid.appendChild(field(ui, "Printhead", dpiEl));
    stockGrid.appendChild(field(ui, "Orientation", bandEl));
    stockGrid.appendChild(field(ui, "Width (mm)", mediaWEl));
    stockGrid.appendChild(field(ui, "Pitch (mm)", mediaHEl));
    stockGrid.appendChild(field(ui, "Tab (mm)", bandMmEl));
    stockGrid.appendChild(field(ui, "QR size", qrMagEl, "0 = automatic"));
    stockPanel.body.appendChild(stockGrid);

    /* --- Job --- */
    var jobPanel = panel(ui, "This print job");
    mainCol.appendChild(jobPanel.root);
    var jobGrid = ui.el("div", { class: "print-labels-grid print-labels-grid--job" });
    var countEl = ui.el("input", { type: "number", min: "1", max: "10000", value: String(saved.labelCount) });
    var yearEl = ui.el("input", { type: "number", min: "2020", max: "2100", value: String(new Date().getFullYear()) });
    var noteEl = ui.el("input", { type: "text", placeholder: "Optional", value: "" });
    jobGrid.appendChild(field(ui, "Labels", countEl));
    jobGrid.appendChild(field(ui, "Year", yearEl));
    jobGrid.appendChild(field(ui, "Note", noteEl));
    jobPanel.body.appendChild(jobGrid);

    var allocBtn = ui.el("button", { class: "btn-primary", type: "button" }, ["Allocate serials"]);
    jobPanel.body.appendChild(allocBtn);

    /* --- Side: preview + actions --- */
    var previewPanel = panel(ui, "Preview");
    sideCol.appendChild(previewPanel.root);
    var preview = ui.el("div", { class: "bag-labels-preview" });
    previewPanel.body.appendChild(preview);
    var summary = ui.el("div", { class: "cards print-labels-summary" });
    previewPanel.body.appendChild(summary);

    var actions = ui.el("div", { class: "print-labels-actions" });
    var printBtn = ui.el("button", { class: "btn-primary", type: "button", disabled: true }, ["Print"]);
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

    function syncConnectionUi() {
      var net = connEl.value === "network";
      usbRow.parentElement.style.display = net ? "none" : "";
      networkWrap.style.display = net ? "" : "none";
    }

    function setStatus(msg, isError) {
      status.textContent = msg || "";
      status.className = "print-labels-status " + (isError ? "error-box" : "muted");
    }

    function readForm() {
      return {
        connection: connEl.value === "network" ? "network" : "usb",
        printerName: printerEl.value,
        printerHost: hostEl.value.trim(),
        printerPort: portEl.value,
        dpi: dpiEl.value,
        bandLeading: bandEl.value === "leading",
        mediaWmm: mediaWEl.value,
        mediaHmm: mediaHEl.value,
        bandMm: bandMmEl.value,
        qrMag: qrMagEl.value,
        labelCount: countEl.value,
      };
    }

    function persistForm() {
      saveSettings(readForm());
    }

    function printCfg() {
      var s = readForm();
      return {
        dpi: parseInt(s.dpi, 10) === 300 ? 300 : 203,
        bandLeading: s.bandLeading,
        mediaWmm: parseFloat(s.mediaWmm) || DEFAULTS.mediaWmm,
        mediaHmm: parseFloat(s.mediaHmm) || DEFAULTS.mediaHmm,
        bandMm: parseFloat(s.bandMm) || DEFAULTS.bandMm,
        qrMag: parseInt(s.qrMag, 10) || 0,
      };
    }

    function setBusy(busy) {
      allocBtn.disabled = busy;
      printBtn.disabled = busy || !batch.length;
      dlBtn.disabled = busy || !batch.length;
      markBtn.disabled = busy || !batch.length;
    }

    function updateStatusHint() {
      if (batch.length) return;
      if (isDesktop) {
        if (connEl.value === "usb") {
          setStatus("Connect the Zebra by USB, choose it in the list, allocate, then Print.");
        } else {
          setStatus("Enter the printer IP, allocate serials, then Print.");
        }
      } else {
        setStatus("Allocate here. For USB printing use the installed CIS app on Windows; or Download ZPL.");
      }
    }

    function paintBatch() {
      summary.innerHTML = "";
      preview.innerHTML = "";
      if (!batch.length) {
        updateStatusHint();
        return;
      }
      var cfg = printCfg();
      var first = batch[0].serial;
      function card(label, value) {
        var c = ui.el("div", { class: "card" });
        c.appendChild(ui.el("div", { class: "label" }, [label]));
        c.appendChild(ui.el("div", { class: "value" }, [value]));
        return c;
      }
      summary.appendChild(card("Serial", first));
      if (batch.length > 1) {
        summary.appendChild(card("Count", String(batch.length)));
        summary.appendChild(card("Last", batch[batch.length - 1].serial));
      }

      var stock = ui.el("div", {
        class: "bag-labels-stock " + (cfg.bandLeading ? "band-leading" : "band-trailing"),
      });
      stock.appendChild(ui.el("div", { class: "bag-labels-band" }));
      var white = ui.el("div", { class: "bag-labels-white" });
      var svg = qrSvg(first);
      if (svg) white.appendChild(ui.el("div", { html: svg }));
      white.appendChild(ui.el("div", { class: "bag-labels-serial" }, [first]));
      stock.appendChild(white);
      preview.appendChild(stock);
    }

    async function refreshPrinters() {
      if (!bridge || !bridge.list_printers) {
        setStatus("Printer list is only available in the installed CIS app.", true);
        return;
      }
      refreshBtn.disabled = true;
      try {
        var res = await bridge.list_printers();
        var names = (res && res.printers) || [];
        var sel = saved.printerName;
        printerEl.innerHTML = "";
        if (!names.length) {
          printerEl.appendChild(ui.el("option", { value: "" }, ["No printers found — connect USB"]));
          setStatus((res && res.error) || "No Windows printers found.", true);
          return;
        }
        names.forEach(function (name) {
          printerEl.appendChild(ui.el("option", {
            value: name,
            selected: name === sel,
          }, [name]));
        });
        setStatus("Found " + names.length + " printer(s). Select your Zebra.");
      } catch (e) {
        setStatus(String(e.message || e), true);
      } finally {
        refreshBtn.disabled = false;
      }
    }

    async function sendZpl(zpl) {
      var s = readForm();
      if (s.connection === "network") {
        if (!bridge || !bridge.send_zpl) {
          throw new Error("Network print needs the installed CIS desktop app.");
        }
        if (!s.printerHost) throw new Error("Enter the printer IP address.");
        return bridge.send_zpl(s.printerHost, parseInt(s.printerPort, 10) || 9100, zpl);
      }
      if (!bridge || !bridge.send_zpl_usb) {
        throw new Error("USB print needs the installed CIS desktop app on Windows.");
      }
      if (!s.printerName) throw new Error("Select a Windows printer (Refresh list after connecting USB).");
      return bridge.send_zpl_usb(s.printerName, zpl);
    }

    async function allocate() {
      persistForm();
      var count = parseInt(countEl.value, 10);
      var y = parseInt(yearEl.value, 10);
      if (!count || count < 1 || count > 10000) {
        setStatus("Label count must be between 1 and 10 000.", true);
        return;
      }
      if (!ctx.api.traceability) {
        setStatus("Traceability API is not configured.", true);
        return;
      }
      setBusy(true);
      setStatus("Allocating…");
      try {
        var body = { count: count, year: y };
        var note = noteEl.value.trim();
        if (note) body.note = note;
        var data = await ctx.api.traceability("/labels/allocate", { method: "POST", body: body });
        batch = data.labels || [];
        setStatus("Allocated " + batch.length + " serial(s). Ready to print.");
        paintBatch();
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
        setStatus("Mark printed failed: " + (e.message || e), true);
      } finally {
        setBusy(false);
      }
    }

    async function printRoll() {
      persistForm();
      if (!batch.length) return;
      var serials = serialsOf(batch);
      var cfg = printCfg();
      setBusy(true);
      progressWrap.style.display = serials.length > 1 ? "block" : "none";
      progressBar.style.width = "0%";
      var sent = 0;
      try {
        for (var i = 0; i < serials.length; i += CHUNK) {
          var chunk = serials.slice(i, i + CHUNK);
          var res = await sendZpl(zplBatch(chunk, cfg));
          if (!res || !res.ok) throw new Error((res && res.error) || "Printer did not accept ZPL");
          sent += chunk.length;
          if (serials.length > 1) {
            progressBar.style.width = Math.round((sent / serials.length) * 100) + "%";
          }
        }
        var marked = await ctx.api.traceability("/labels/mark-printed", {
          method: "POST",
          body: { serials: serials },
        });
        setStatus("Printed and marked " + (marked.updated != null ? marked.updated : sent) + ". " + serials[0]);
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
      downloadText(serials.length === 1 ? serials[0] + ".zpl" : serials[0] + "_" + serials[serials.length - 1] + ".zpl", zplBatch(serials, printCfg()));
      setStatus("ZPL downloaded. Send to the printer, then Mark printed.");
    }

    connEl.addEventListener("change", function () {
      syncConnectionUi();
      persistForm();
      updateStatusHint();
    });
    refreshBtn.addEventListener("click", refreshPrinters);
    [dpiEl, bandEl, mediaWEl, mediaHEl, bandMmEl, qrMagEl, printerEl].forEach(function (el) {
      el.addEventListener("change", function () {
        persistForm();
        if (batch.length) paintBatch();
      });
    });
    allocBtn.addEventListener("click", allocate);
    printBtn.addEventListener("click", printRoll);
    dlBtn.addEventListener("click", download);
    markBtn.addEventListener("click", markPrinted);

    syncConnectionUi();
    updateStatusHint();
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
