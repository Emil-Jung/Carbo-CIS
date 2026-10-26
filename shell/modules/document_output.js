/* Shared HTML → PDF download and in-app print preview (Traceability Documentation). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var html2pdfLoadPromise = null;

  var PDF_CANVAS_OPTS = {
    scale: 2.5,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
  };

  var PDF_PAGE_MARGIN_MM = 10;

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

  function afterLayoutPaint() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setTimeout(resolve, 100);
        });
      });
    });
  }

  function createPdfDocument() {
    var J = window.jspdf && window.jspdf.jsPDF;
    if (!J) {
      throw new Error("PDF engine not ready.");
    }
    return new J({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: false,
    });
  }

  function pdfCaptureTargetsFromDoc(doc) {
    if (!doc || !doc.body) return [];
    var pages = doc.querySelectorAll(".cm-sheet-page");
    if (pages.length) {
      return Array.prototype.slice.call(pages);
    }
    return [doc.body];
  }

  function elementToCanvas(html2pdf, el) {
    return html2pdf()
      .set({
        html2canvas: PDF_CANVAS_OPTS,
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(el)
      .toCanvas();
  }

  function addCanvasAsPdfPage(pdf, canvas, isFirstPage) {
    if (!isFirstPage) pdf.addPage();
    var pageW = pdf.internal.pageSize.getWidth();
    var pageH = pdf.internal.pageSize.getHeight();
    var m = PDF_PAGE_MARGIN_MM;
    var maxW = pageW - 2 * m;
    var maxH = pageH - 2 * m;
    var drawW = maxW;
    var drawH = (canvas.height * drawW) / canvas.width;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = (canvas.width * drawH) / canvas.height;
    }
    var x = m + (maxW - drawW) / 2;
    var y = m;
    var img = canvas.toDataURL("image/png");
    pdf.addImage(img, "PNG", x, y, drawW, drawH, undefined, "SLOW");
  }

  function savePdfFromDocumentTargets(html2pdf, doc, filename) {
    var targets = pdfCaptureTargetsFromDoc(doc);
    if (!targets.length) {
      return Promise.reject(new Error("Could not render document for PDF."));
    }
    var pdf = createPdfDocument();
    var chain = Promise.resolve();
    targets.forEach(function (el, idx) {
      chain = chain.then(function () {
        return elementToCanvas(html2pdf, el).then(function (canvas) {
          addCanvasAsPdfPage(pdf, canvas, idx === 0);
        });
      });
    });
    return chain.then(function () {
      pdf.save(filename);
    });
  }

  /** Same layout as print preview — full HTML document inside a paintable iframe. */
  function buildPdfRenderIframe(html) {
    var iframe = document.createElement("iframe");
    iframe.className = "cis-pdf-render-iframe";
    iframe.setAttribute("title", "PDF render");
    document.body.appendChild(iframe);
    return writeHtmlToIframe(iframe, html).then(function () {
      var doc = iframe.contentDocument;
      if (doc && doc.documentElement) {
        doc.documentElement.style.background = "#ffffff";
        doc.documentElement.style.colorScheme = "only light";
      }
      if (doc && doc.body) {
        doc.body.style.background = "#ffffff";
        doc.body.style.margin = "0";
        doc.body.style.webkitFontSmoothing = "antialiased";
      }
      return iframe;
    });
  }

  function showPdfWorkingModal() {
    var backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop cis-pdf-working-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-busy", "true");
    var dialog = document.createElement("div");
    dialog.className = "modal td-doc-busy-dialog";
    var title = document.createElement("h3");
    title.className = "cm-print-dialog-title td-doc-busy-title";
    title.textContent = "Creating PDF";
    dialog.appendChild(title);
    var msg = document.createElement("p");
    msg.className = "td-doc-busy-message";
    msg.textContent = "Rendering pages (same layout as preview)…";
    dialog.appendChild(msg);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    return function closePdfWorkingModal() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    };
  }

  /**
   * @param {string} html full document HTML
   * @param {string} filename e.g. "ContainerSheet_ABCD.pdf"
   */
  CIS.downloadHtmlDocumentPdf = function (html, filename) {
    if (!html || !String(html).trim()) {
      return Promise.reject(new Error("No document content to export."));
    }
    var safeName = String(filename || "document.pdf").replace(/[^\w.\- ]+/g, "_");
    if (!/\.pdf$/i.test(safeName)) safeName += ".pdf";

    var closeModal = showPdfWorkingModal();
    var renderIframe = null;

    return buildPdfRenderIframe(html)
      .then(function (iframe) {
        renderIframe = iframe;
        return afterLayoutPaint();
      })
      .then(function () {
        return ensureHtml2Pdf();
      })
      .then(function (html2pdf) {
        if (!renderIframe || !renderIframe.contentDocument) {
          throw new Error("Could not render document for PDF.");
        }
        return savePdfFromDocumentTargets(
          html2pdf,
          renderIframe.contentDocument,
          safeName
        );
      })
      .then(function () {
        return { ok: true, filename: safeName };
      })
      .finally(function () {
        closeModal();
        if (renderIframe && renderIframe.parentNode) {
          renderIframe.parentNode.removeChild(renderIframe);
        }
      });
  };

  /**
   * PDF from the preview iframe (pixel match to what you see before Print).
   * @param {HTMLIFrameElement} iframe
   * @param {string} filename
   */
  CIS.downloadHtmlDocumentPdfFromPreviewIframe = function (iframe, filename) {
    if (!iframe || !iframe.contentDocument) {
      return Promise.reject(new Error("Print preview is not ready."));
    }
    var safeName = String(filename || "document.pdf").replace(/[^\w.\- ]+/g, "_");
    if (!/\.pdf$/i.test(safeName)) safeName += ".pdf";
    var closeModal = showPdfWorkingModal();
    return afterLayoutPaint()
      .then(function () {
        return ensureHtml2Pdf();
      })
      .then(function (html2pdf) {
        return savePdfFromDocumentTargets(
          html2pdf,
          iframe.contentDocument,
          safeName
        );
      })
      .then(function () {
        return { ok: true, filename: safeName };
      })
      .finally(function () {
        closeModal();
      });
  };

  /**
   * @param {object} opts
   * @param {string} opts.title overlay title
   * @param {function} opts.getHtml () => html string
   * @param {string} opts.pdfFilename
   * @param {function} [opts.downloadPdf] optional () => Promise
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
        var run;
        if (typeof opts.downloadPdf === "function") {
          run = opts.downloadPdf();
        } else if (CIS.downloadHtmlDocumentPdfFromPreviewIframe) {
          run = refreshPreview().then(function () {
            return CIS.downloadHtmlDocumentPdfFromPreviewIframe(
              iframe,
              opts.pdfFilename
            );
          });
        } else {
          run = CIS.downloadHtmlDocumentPdf(opts.getHtml(), opts.pdfFilename);
        }
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
        opts.onMount({ refreshPreview: refreshPreview, showErr: showErr, iframe: iframe });
      }
    });
  };

  CIS._documentOutput = {
    writeHtmlToIframe: writeHtmlToIframe,
    invokeNativePrint: invokeNativePrint,
    ensureHtml2Pdf: ensureHtml2Pdf,
    buildPdfRenderIframe: buildPdfRenderIframe,
  };
})();
