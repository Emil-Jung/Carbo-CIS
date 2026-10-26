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

  function pdfCaptureTargetsFromDoc(doc) {
    if (!doc || !doc.body) return [];
    var pages = doc.querySelectorAll(".cm-sheet-page");
    if (pages.length) {
      return Array.prototype.slice.call(pages);
    }
    return [doc.body];
  }

  var CLIENT_PDF_OPT = {
    margin: [PDF_PAGE_MARGIN_MM, PDF_PAGE_MARGIN_MM, PDF_PAGE_MARGIN_MM, PDF_PAGE_MARGIN_MM],
    image: { type: "jpeg", quality: 0.96 },
    html2canvas: PDF_CANVAS_OPTS,
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"], after: ".cm-sheet-page", avoid: "tr" },
  };

  function savePdfFromDocumentTargets(html2pdf, doc, filename) {
    var targets = pdfCaptureTargetsFromDoc(doc);
    if (!targets.length) {
      return Promise.reject(new Error("Could not render document for PDF."));
    }
    if (targets.length <= 1) {
      return html2pdf()
        .set(Object.assign({}, CLIENT_PDF_OPT, { filename: filename }))
        .from(targets[0])
        .save();
    }
    var baseOpt = Object.assign({}, CLIENT_PDF_OPT);
    var chain = html2pdf().set(baseOpt).from(targets[0]).toPdf();
    for (var i = 1; i < targets.length; i++) {
      chain = chain
        .get("pdf")
        .then(function (pdf) {
          pdf.addPage();
        })
        .from(targets[i])
        .toContainer()
        .toCanvas()
        .toPdf();
    }
    return chain.set({ filename: filename }).save();
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
    msg.textContent = "Generating PDF on Traceability…";
    dialog.appendChild(msg);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    return {
      close: function closePdfWorkingModal() {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      },
      setMessage: function (text) {
        msg.textContent = text || "";
        msg.className = "td-doc-busy-message";
      },
      showError: function (text) {
        msg.textContent = text || "PDF download failed.";
        msg.className = "td-doc-busy-message error-box";
      },
    };
  }

  function saveBlobAsDownload(blob, filename) {
    if (!blob || blob.size < 32) {
      throw new Error("PDF file was empty.");
    }
    if (window.navigator && typeof window.navigator.msSaveOrOpenBlob === "function") {
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 3000);
  }

  function traceabilityApiBaseUrl() {
    if (CIS.traceabilityApiBase) return CIS.traceabilityApiBase;
    if (CIS.api && CIS.api.traceability) {
      return "/traceability/api/v1";
    }
    return "/traceability/api/v1";
  }

  function downloadPdfViaTraceabilityServer(html, filename) {
    if (CIS.api && CIS.api.traceabilityBlob) {
      return CIS.api
        .traceabilityBlob("/documents/render-html-pdf", {
          body: { html: html, filename: filename },
          defaultFilename: filename,
        })
        .then(function (res) {
          if (!res.blob || res.blob.size < 64) {
            throw new Error("PDF from server was empty.");
          }
          var name = res.filename || filename;
          saveBlobAsDownload(res.blob, name);
          return { ok: true, filename: name };
        });
    }

    var base = traceabilityApiBaseUrl();
    var token = CIS.getToken && CIS.getToken();
    var headers = {
      "Content-Type": "application/json",
      Accept: "application/pdf",
    };
    if (token) headers.Authorization = "Bearer " + token;

    return fetch(base + "/documents/render-html-pdf", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ html: html, filename: filename }),
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (text) {
          var detail = "HTTP " + res.status;
          if (text) {
            try {
              var j = JSON.parse(text);
              if (j.detail != null) {
                detail =
                  typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
              }
            } catch (e) {
              detail = text.slice(0, 400);
            }
          }
          var err = new Error(detail);
          err.status = res.status;
          throw err;
        });
      }
      var name = filename;
      var cd = res.headers.get("Content-Disposition") || "";
      var m = /filename=\"?([^\";]+)\"?/i.exec(cd);
      if (m && m[1]) name = m[1].trim();
      return res.blob().then(function (blob) {
        saveBlobAsDownload(blob, name);
        return { ok: true, filename: name };
      });
    });
  }

  /** Last resort when WeasyPrint is not installed — screenshot-style PDF. */
  function downloadPdfClientRaster(html, filename) {
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
          filename
        );
      })
      .finally(function () {
        if (renderIframe && renderIframe.parentNode) {
          renderIframe.parentNode.removeChild(renderIframe);
        }
      })
      .then(function () {
        return { ok: true, filename: filename };
      });
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

    var modal = showPdfWorkingModal();

    return downloadPdfViaTraceabilityServer(html, safeName)
      .catch(function (err) {
        if (err.status === 401) {
          throw new Error("Session expired — sign in again, then retry PDF download.");
        }
        modal.setMessage(
          "Server PDF unavailable — using local export (update Traceability for best quality)…"
        );
        return downloadPdfClientRaster(html, safeName);
      })
      .catch(function (err) {
        modal.showError(err.message || String(err));
        return new Promise(function (resolve, reject) {
          setTimeout(function () {
            reject(err);
          }, 3500);
        });
      })
      .finally(function () {
        modal.close();
      });
  };

  /** @deprecated Use downloadHtmlDocumentPdf(html, filename) with getHtml() from preview. */
  CIS.downloadHtmlDocumentPdfFromPreviewIframe = function (iframe, filename) {
    if (!iframe || !iframe.contentDocument || !iframe.contentDocument.documentElement) {
      return Promise.reject(new Error("Print preview is not ready."));
    }
    var html = "<!DOCTYPE html>\n" + iframe.contentDocument.documentElement.outerHTML;
    return CIS.downloadHtmlDocumentPdf(html, filename);
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
   * @param {boolean} [opts.autoPrintAfterLoad] invoke iframe print after first render
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
          run = Promise.resolve().then(function () {
            return opts.downloadPdf();
          });
        } else {
          run = refreshPreview().then(function () {
            return CIS.downloadHtmlDocumentPdf(opts.getHtml(), opts.pdfFilename);
          });
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

      refreshPreview()
        .then(function () {
          if (opts.autoPrintAfterLoad) {
            return afterLayoutPaint().then(function () {
              invokeNativePrint(iframe);
            });
          }
        })
        .catch(function (e) {
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
