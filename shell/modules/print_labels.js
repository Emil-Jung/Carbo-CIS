/* Print Labels — allocate bag serials and print QR identity labels on a Zebra ZT231. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var LS = "cis_print_labels_v1";
  var CHUNK = 50;
  var DEFAULTS = {
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

  function readForm(settings) {
    return {
      printerHost: settings.hostEl.value.trim(),
      printerPort: settings.portEl.value,
      dpi: settings.dpiEl.value,
      bandLeading: settings.bandEl.value === "leading",
      mediaWmm: settings.mediaWEl.value,
      mediaHmm: settings.mediaHEl.value,
      bandMm: settings.bandMmEl.value,
      qrMag: settings.qrMagEl.value,
      labelCount: settings.countEl.value,
    };
  }

  function render(container, ctx) {
    var ui = CIS.ui;
    var batch = [];
    var saved = loadSettings();

    container.innerHTML = "";
    container.className = "module-content bag-labels-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Print Labels"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Allocate bag identity serials centrally, then print QR labels on the Zebra. ",
      "The kiosk scans these labels — it never mints an ID.",
    ]));

    var form = ui.el("div", { class: "bag-labels-form" });

    var hostEl = ui.el("input", { type: "text", placeholder: "192.168.x.x", value: saved.printerHost });
    var portEl = ui.el("input", { type: "number", min: "1", max: "65535", value: String(saved.printerPort) });
    var dpiEl = ui.el("select", {}, [
      ui.el("option", { value: "203", selected: saved.dpi !== 300 }, ["203 dpi"]),
      ui.el("option", { value: "300", selected: saved.dpi === 300 }, ["300 dpi"]),
    ]);
    var bandEl = ui.el("select", {}, [
      ui.el("option", { value: "leading", selected: saved.bandLeading }, ["Blue tab leading (feed)"]),
      ui.el("option", { value: "trailing", selected: !saved.bandLeading }, ["Blue tab trailing"]),
    ]);
    var mediaWEl = ui.el("input", { type: "number", min: "20", max: "120", step: "0.1", value: String(saved.mediaWmm) });
    var mediaHEl = ui.el("input", { type: "number", min: "10", max: "80", step: "0.1", value: String(saved.mediaHmm) });
    var bandMmEl = ui.el("input", { type: "number", min: "0", max: "20", step: "0.1", value: String(saved.bandMm) });
    var qrMagEl = ui.el("input", {
      type: "number",
      min: "0",
      max: "12",
      step: "1",
      value: String(saved.qrMag || 0),
      title: "0 = auto (6 at 203 dpi, 8 at 300 dpi)",
    });
    var countEl = ui.el("input", { type: "number", min: "1", max: "10000", value: String(saved.labelCount) });
    var yearEl = ui.el("input", { type: "number", min: "2020", max: "2100", value: String(new Date().getFullYear()) });
    var noteEl = ui.el("input", { type: "text", placeholder: "Optional note", value: "" });

    function field(label, input) {
      var w = ui.el("label", {}, [label]);
      w.appendChild(input);
      form.appendChild(w);
    }

    field("Zebra IP / host", hostEl);
    field("Port (RAW)", portEl);
    field("Printhead DPI", dpiEl);
    field("Label orientation", bandEl);
    field("Label width (mm)", mediaWEl);
    field("Label height / pitch (mm)", mediaHEl);
    field("Blue tab width (mm)", bandMmEl);
    field("QR magnification (0 = auto)", qrMagEl);
    field("How many labels", countEl);
    field("Year", yearEl);
    field("Note", noteEl);
    container.appendChild(form);

    var actions = ui.el("div", { class: "module-actions" });
    var allocBtn = ui.el("button", { class: "btn-primary", type: "button" }, ["Allocate"]);
    var printBtn = ui.el("button", { class: "btn-primary", type: "button", disabled: true }, ["Print to Zebra"]);
    var dlBtn = ui.el("button", { class: "btn-secondary", type: "button", disabled: true }, ["Download ZPL"]);
    var markBtn = ui.el("button", { class: "btn-secondary", type: "button", disabled: true }, ["Mark printed"]);
    actions.appendChild(allocBtn);
    actions.appendChild(printBtn);
    actions.appendChild(dlBtn);
    actions.appendChild(markBtn);
    container.appendChild(actions);

    var status = ui.el("p", { class: "muted" }, [
      desktopBridge()
        ? "Installed CIS can send ZPL to the printer on port 9100."
        : "Browser CIS cannot reach a LAN printer — use Download ZPL, or open Print Labels in the installed CIS desktop app.",
    ]);
    container.appendChild(status);

    var progressWrap = ui.el("div", { class: "bag-labels-progress" });
    var progressBar = ui.el("div", { class: "bag-labels-progress-bar" });
    progressWrap.appendChild(progressBar);
    container.appendChild(progressWrap);

    var summary = ui.el("div", { class: "cards" });
    container.appendChild(summary);

    var preview = ui.el("div", { class: "bag-labels-preview" });
    container.appendChild(preview);

    container.appendChild(ui.el("button", {
      class: "btn-ghost btn-sm hub-back",
      type: "button",
      onclick: function () {
        if (CIS.openModule) CIS.openModule("traceability");
      },
    }, ["Back to Traceability"]));

    var refs = {
      hostEl: hostEl, portEl: portEl, dpiEl: dpiEl, bandEl: bandEl,
      mediaWEl: mediaWEl, mediaHEl: mediaHEl, bandMmEl: bandMmEl, qrMagEl: qrMagEl,
      countEl: countEl,
    };

    function persistForm() {
      saveSettings(readForm(refs));
    }

    function printCfg() {
      var s = readForm(refs);
      return {
        dpi: parseInt(s.dpi, 10) === 300 ? 300 : 203,
        bandLeading: s.bandLeading,
        mediaWmm: parseFloat(s.mediaWmm) || DEFAULTS.mediaWmm,
        mediaHmm: parseFloat(s.mediaHmm) || DEFAULTS.mediaHmm,
        bandMm: parseFloat(s.bandMm) || DEFAULTS.bandMm,
        qrMag: parseInt(s.qrMag, 10) || 0,
      };
    }

    function setStatus(msg, isError) {
      status.textContent = msg || "";
      status.className = isError ? "error-box" : "muted";
    }

    function setBusy(busy) {
      allocBtn.disabled = busy;
      printBtn.disabled = busy || !batch.length;
      dlBtn.disabled = busy || !batch.length;
      markBtn.disabled = busy || !batch.length;
    }

    function paintBatch() {
      summary.innerHTML = "";
      preview.innerHTML = "";
      if (!batch.length) {
        printBtn.disabled = true;
        dlBtn.disabled = true;
        markBtn.disabled = true;
        return;
      }
      printBtn.disabled = false;
      dlBtn.disabled = false;
      markBtn.disabled = false;
      var cfg = printCfg();
      var first = batch[0].serial;
      var last = batch[batch.length - 1].serial;
      function card(label, value) {
        var c = ui.el("div", { class: "card" });
        c.appendChild(ui.el("div", { class: "label" }, [label]));
        c.appendChild(ui.el("div", { class: "value" }, [value]));
        return c;
      }
      summary.appendChild(card("Count", String(batch.length)));
      summary.appendChild(card("First", first));
      summary.appendChild(card("Last", last));
      summary.appendChild(card("QR mag", String(cfg.qrMag > 0 ? cfg.qrMag : defaultQrMag(cfg.dpi))));

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
      preview.appendChild(ui.el("p", { class: "muted" }, [
        "Preview of the first label. Adjust QR magnification or label dimensions if the code does not fit on stock.",
      ]));
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
        setStatus("Traceability API base is not configured.", true);
        return;
      }
      setBusy(true);
      setStatus("Allocating " + count + " serial" + (count === 1 ? "" : "s") + "…");
      try {
        var body = { count: count, year: y };
        var note = noteEl.value.trim();
        if (note) body.note = note;
        var data = await ctx.api.traceability("/labels/allocate", { method: "POST", body: body });
        batch = data.labels || [];
        setStatus(
          "Allocated " + batch.length + " serial" + (batch.length === 1 ? "" : "s") +
          " (" + batch[0].serial + (batch.length > 1 ? " … " + batch[batch.length - 1].serial : "") + "). Print, then mark printed."
        );
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
      setStatus("Marking printed…");
      try {
        var data = await ctx.api.traceability("/labels/mark-printed", {
          method: "POST",
          body: { serials: serialsOf(batch) },
        });
        setStatus("Marked " + (data.updated != null ? data.updated : batch.length) + " label(s) printed.");
      } catch (e) {
        setStatus("Mark printed failed: " + (e.message || e), true);
      } finally {
        setBusy(false);
      }
    }

    async function printRoll() {
      persistForm();
      if (!batch.length) return;
      var bridge = desktopBridge();
      if (!bridge || !bridge.send_zpl) {
        setStatus("Print to Zebra needs the installed CIS desktop app. Use Download ZPL from the browser, or open CIS on a PC on the factory LAN.", true);
        return;
      }
      var host = hostEl.value.trim();
      var port = parseInt(portEl.value, 10) || 9100;
      if (!host) {
        setStatus("Enter the Zebra printer IP address.", true);
        return;
      }
      var serials = serialsOf(batch);
      var cfg = printCfg();
      setBusy(true);
      progressWrap.style.display = batch.length > 1 ? "block" : "none";
      progressBar.style.width = "0%";
      var sent = 0;
      try {
        for (var i = 0; i < serials.length; i += CHUNK) {
          var chunk = serials.slice(i, i + CHUNK);
          var zpl = zplBatch(chunk, cfg);
          var res = await bridge.send_zpl(host, port, zpl);
          if (!res || !res.ok) throw new Error((res && res.error) || "Printer did not accept ZPL");
          sent += chunk.length;
          if (serials.length > 1) {
            progressBar.style.width = Math.round((sent / serials.length) * 100) + "%";
          }
          setStatus("Printed " + sent + " of " + serials.length + "…");
        }
        setStatus("Printed " + sent + " label(s). Marking printed…");
        var marked = await ctx.api.traceability("/labels/mark-printed", {
          method: "POST",
          body: { serials: serials },
        });
        setStatus(
          "Printed and marked " + (marked.updated != null ? marked.updated : sent) + " label(s). " +
          (serials.length === 1 ? "Serial: " + serials[0] + "." : "First " + serials[0] + " — last " + serials[serials.length - 1] + ".")
        );
      } catch (e) {
        setStatus("Print stopped after " + sent + " label(s): " + (e.message || e) + ". Not marked printed.", true);
      } finally {
        setBusy(false);
        progressWrap.style.display = sent === serials.length ? "none" : "block";
      }
    }

    function download() {
      persistForm();
      if (!batch.length) return;
      var serials = serialsOf(batch);
      var zpl = zplBatch(serials, printCfg());
      var name = serials.length === 1
        ? serials[0] + ".zpl"
        : serials[0] + "_" + serials[serials.length - 1] + ".zpl";
      downloadText(name, zpl);
      setStatus("Downloaded ZPL for " + serials.length + " label(s). After the printer finishes, click Mark printed.");
    }

    allocBtn.addEventListener("click", allocate);
    printBtn.addEventListener("click", printRoll);
    dlBtn.addEventListener("click", download);
    markBtn.addEventListener("click", markPrinted);
    [dpiEl, bandEl, mediaWEl, mediaHEl, bandMmEl, qrMagEl].forEach(function (el) {
      el.addEventListener("change", function () {
        persistForm();
        if (batch.length) paintBatch();
      });
    });

    if (ctx.api && ctx.api.traceability) {
      ctx.api.traceability("/applications/print-labels").catch(function () {
        /* Permission already checked by openModule; ignore probe failure. */
      });
    }
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
