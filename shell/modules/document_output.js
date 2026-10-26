/* Shared HTML → PDF download and in-app print preview (Traceability Documentation). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var html2pdfLoadPromise = null;

  function shellVendorUrl(name) {
    try {
      var cur = document.currentScript;
      if (cur && cur.src) {
        return cur.src.replace(/modules\/[^/]+$/, "vendor/") + name;
      }
    } catch (e) { /* ignore */ }
    try {
      var link = document.querySelector(
        'script[src*="document_output.js"],script[src*="container_manifest.js"]'
      );
      if (link && link.src) {
        return link.src.replace(/modules\/[^/]+$/, "vendor/") + name;
      }
    } catch (e2) { /* ignore */ }
    var root = "/cis/";
    try {
      if (document.location && document.location.pathname) {
        root = document.location.pathname.replace(/\/?index\.html?$/, "/");
        if (!root.endsWith("/")) root += "/";
      }
    } catch (e3) { /* ignore */ }
    return root + "vendor/" + name;
  }

  function ensureHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (html2pdfLoadPromise) return html2pdfLoadPromise;
    html2pdfLoadPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = shellVendorUrl("html2pdf.bundle.min.js");
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
          reject(new Error("Could not render document preview."));
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

  var defaultPdfSet = {
    margin: [8, 8, 8, 8],
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  };

  /** Off-screen but paintable — visibility:hidden breaks html2canvas in WebView2 (black PDF). */
  var PDF_RENDER_IFRAME_STYLE =
    "position:fixed;top:0;left:0;width:210mm;height:297mm;margin:0;padding:0;" +
    "border:0;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;";

  /**
   * @param {string} html full document HTML
   * @param {string} filename e.g. "ContainerSheet_ABCD.pdf"
   * @param {object} [pdfSet] html2pdf .set() overrides
   */
  CIS.downloadHtmlDocumentPdf = function (html, filename, pdfSet) {
    if (!html || !String(html).trim()) {
      return Promise.reject(new Error("No document content to export."));
    }
    var safeName = String(filename || "document.pdf").replace(/[^\w.\- ]+/g, "_");
    if (!/\.pdf$/i.test(safeName)) safeName += ".pdf";

    var iframe = document.createElement("iframe");
    iframe.setAttribute("title", "PDF render");
    iframe.style.cssText = PDF_RENDER_IFRAME_STYLE;
    document.body.appendChild(iframe);

    var setOpts = Object.assign({}, defaultPdfSet, pdfSet || {}, { filename: safeName });

    function afterIframePaint() {
      return new Promise(function (resolve) {
        requestAnimationFrame(function () {
          requestAnimationFrame(resolve);
        });
      });
    }

    return writeHtmlToIframe(iframe, html)
      .then(afterIframePaint)
      .then(function () {
        return ensureHtml2Pdf();
      })
      .then(function (html2pdf) {
        var body = iframe.contentDocument && iframe.contentDocument.body;
        if (!body) throw new Error("Could not render document body for PDF.");
        return html2pdf().set(setOpts).from(body).save();
      })
      .then(function () {
        return { ok: true, filename: safeName };
      })
      .finally(function () {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      });
  };

  /**
   * @param {object} opts
   * @param {string} opts.title overlay title
   * @param {function} opts.getHtml () => html string
   * @param {string} opts.pdfFilename
   * @param {function} [opts.downloadPdf] optional (getHtml) => Promise — defaults to downloadHtmlDocumentPdf
   * @param {HTMLElement} [opts.toolbar] optional fields row in the bar
   * @param {string} [opts.closeLabel] e.g. "Back"
   * @param {string} [opts.printLabel] e.g. "Print"
   */
  CIS.showHtmlDocumentPreview = function (opts) {
    opts = opts || {};
    if (typeof opts.getHtml !== "function") {
      return Promise.reject(new Error("Document preview is not configured."));
    }

    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "a4-print-preview-overlay cm-sheet-preview-overlay";
      var bar = document.createElement("div");
      bar.className = "a4-print-preview-overlay__bar";
      var titleEl = document.createElement("span");
      titleEl.className = "a4-print-preview-overlay__title";
      titleEl.textContent = opts.title || "Document preview";

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
      printBtn.textContent = opts.printLabel || "Print…";
      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "btn-ghost btn-sm";
      closeBtn.textContent = opts.closeLabel || "Close";
      actions.appendChild(pdfBtn);
      actions.appendChild(printBtn);
      actions.appendChild(closeBtn);

      var barRight = document.createElement("div");
      barRight.className = "cm-sheet-preview-bar-right";
      if (opts.toolbar) barRight.appendChild(opts.toolbar);
      barRight.appendChild(actions);

      bar.appendChild(titleEl);
      bar.appendChild(barRight);

      var frameWrap = document.createElement("div");
      frameWrap.className =
        opts.frameClassName || "a4-print-preview-overlay__frame";
      var iframe = document.createElement("iframe");
      iframe.setAttribute("title", "Document print preview");
      frameWrap.appendChild(iframe);
      overlay.appendChild(bar);
      overlay.appendChild(msg);
      overlay.appendChild(frameWrap);
      document.body.appendChild(overlay);

      function showErr(text) {
        msg.textContent = text || "Operation failed.";
        msg.hidden = !text;
      }

      function refreshPreview() {
        showErr("");
        var html = opts.getHtml();
        if (!html) throw new Error("Document is empty.");
        return writeHtmlToIframe(iframe, html);
      }

      function close() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve();
      }

      closeBtn.addEventListener("click", close);

      printBtn.addEventListener("click", function () {
        refreshPreview()
          .then(function () {
            invokeNativePrint(iframe);
          })
          .catch(function (e) {
            showErr(e.message || String(e));
          });
      });

      pdfBtn.addEventListener("click", function () {
        pdfBtn.disabled = true;
        var run =
          typeof opts.downloadPdf === "function"
            ? opts.downloadPdf()
            : CIS.downloadHtmlDocumentPdf(opts.getHtml(), opts.pdfFilename);
        Promise.resolve(run)
          .then(function (out) {
            if (out && out.ok === false) throw new Error("PDF was not created.");
          })
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

      if (typeof opts.onMount === "function") {
        opts.onMount({ refreshPreview: refreshPreview, showErr: showErr });
      }
    });
  };

  CIS._documentOutput = {
    writeHtmlToIframe: writeHtmlToIframe,
    invokeNativePrint: invokeNativePrint,
    ensureHtml2Pdf: ensureHtml2Pdf,
  };
})();
