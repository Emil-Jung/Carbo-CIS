/* EUDR accompanying location sheet — producers & farm GPS per container (Excel layout). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function firstContainerFromPack(pack) {
    var list = (pack && pack.containers) || [];
    return list.length ? list[0] : null;
  }

  function formatCoord(v) {
    if (v === "" || v == null || v === undefined) return "";
    var n = Number(v);
    if (isNaN(n)) return String(v).trim();
    return String(Math.round(n * 1e6) / 1e6);
  }

  function producerGpsPair(p) {
    if (p.gps_latitude != null && p.gps_longitude != null) {
      return { lat: formatCoord(p.gps_latitude), lon: formatCoord(p.gps_longitude) };
    }
    var raw = String(p.gps_coordinates || "").trim();
    if (!raw) return { lat: "", lon: "" };
    var parts = raw.split(",").map(function (x) {
      return x.trim();
    });
    if (parts.length >= 2) {
      return { lat: formatCoord(parts[0]), lon: formatCoord(parts[1]) };
    }
    return { lat: formatCoord(raw), lon: "" };
  }

  function sortProducers(producers) {
    return (producers || []).slice().sort(function (a, b) {
      var sa = String(a.supplier_name || "");
      var sb = String(b.supplier_name || "");
      if (sa !== sb) return sa.localeCompare(sb);
      return String(a.farm_display || "").localeCompare(String(b.farm_display || ""));
    });
  }

  function sheetStyles() {
    return (
      "@page{size:A4 portrait;margin:14mm}" +
      "body{font-family:Calibri,Arial,Helvetica,sans-serif;font-size:11pt;color:#000;margin:0;padding:0}" +
      ".els-page{width:182mm;margin:0 auto;padding:4mm 0;box-sizing:border-box}" +
      "table.els-sheet{width:100%;border-collapse:collapse;table-layout:fixed}" +
      "table.els-sheet td,table.els-sheet th{border:1px solid #000;padding:4px 6px;vertical-align:middle;font-size:11pt}" +
      "table.els-sheet th{font-weight:700;text-align:center;background:#fff}" +
      "td.els-lbl{font-weight:700;white-space:nowrap;width:22mm}" +
      "td.els-ref{width:42mm}" +
      "td.els-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}" +
      ".els-foot{margin-top:10px;font-size:9pt;color:#444;line-height:1.4}" +
      ".els-warn{color:#8a4b00}"
    );
  }

  function locationSheetContext(pack) {
    var cont = firstContainerFromPack(pack);
    if (!cont) {
      throw new Error("Traceability pack did not return a container.");
    }
    var manifest = cont.manifest || {};
    var header = manifest.header || {};
    var containerNumber = String(
      header.container_number || cont.container_number || ""
    ).trim();
    var fclNumber = String(header.fcl_number || cont.fcl_number || "").trim();
    var producers = sortProducers(cont.producers || []);
    return {
      containerNumber: containerNumber,
      fclNumber: fclNumber,
      producers: producers,
    };
  }

  function renderLocationSheetTable(ctx) {
    var producers = ctx.producers;
    var html =
      '<table class="els-sheet">' +
      "<tr>" +
      '<td class="els-lbl"></td><td class="els-ref"></td>' +
      "<th>SUPPLIER NAME</th><th>FARM NAME &amp; NR</th>" +
      '<th colspan="2">GPS COORDINATES</th>' +
      "</tr>";

    if (!producers.length) {
      html +=
        "<tr>" +
        '<td class="els-lbl">Container</td>' +
        '<td class="els-ref">' +
        esc(ctx.containerNumber) +
        "</td>" +
        '<td colspan="4">No producers resolved — container may have no loaded bags or missing intake links.</td>' +
        "</tr>";
    } else {
      producers.forEach(function (p, idx) {
        var gps = producerGpsPair(p);
        html +=
          "<tr>" +
          '<td class="els-lbl">' +
          (idx === 0 ? "Container" : "&nbsp;") +
          "</td>" +
          '<td class="els-ref">' +
          (idx === 0 ? esc(ctx.containerNumber) : "&nbsp;") +
          "</td>" +
          "<td>" +
          esc(p.supplier_name || "—") +
          "</td><td>" +
          esc(p.farm_display || "—") +
          '</td><td class="els-num">' +
          esc(gps.lat || "—") +
          '</td><td class="els-num">' +
          esc(gps.lon || "—") +
          "</td></tr>";
      });
    }

    html +=
      "<tr>" +
      '<td class="els-lbl">FCL Number</td>' +
      '<td class="els-ref">' +
      esc(ctx.fclNumber || "—") +
      "</td>" +
      "<td></td><td></td><td></td><td></td>" +
      "</tr></table>";
    return html;
  }

  function missingGpsNotes(producers) {
    var notes = [];
    producers.forEach(function (p) {
      var gps = producerGpsPair(p);
      if (!gps.lat || !gps.lon) {
        notes.push(
          (p.supplier_name || "Producer") +
            " / " +
            (p.farm_display || "farm") +
            ": GPS not on file"
        );
      }
    });
    return notes;
  }

  CIS.buildEudrAccompanyingLocationSheetHtml = function (pack) {
    var ctx = locationSheetContext(pack);
    var notes = missingGpsNotes(ctx.producers);
    var foot =
      "Farm location GPS points from the Producers register / Producers API (manifest-linked farms). " +
      "Camp polygon GeoJSON files are not included on this sheet.";
    if (notes.length) {
      foot +=
        ' <span class="els-warn">Missing GPS: ' + esc(notes.join("; ")) + ".</span>";
    }
    var body =
      '<div class="els-page">' +
      renderLocationSheetTable(ctx) +
      '<p class="els-foot">' +
      foot +
      "</p></div>";

    return (
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>" +
      "<title>EUDR accompanying location sheet</title>" +
      "<style>" +
      sheetStyles() +
      "</style></head><body>" +
      body +
      "</body></html>"
    );
  };

  CIS.buildEudrAccompanyingLocationSheetCsv = function (pack) {
    var ctx = locationSheetContext(pack);
    function q(s) {
      var t = String(s == null ? "" : s);
      if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
      return t;
    }
    var lines = [
      ",,SUPPLIER NAME,FARM NAME & NR,LATITUDE,LONGITUDE",
    ];
    if (!ctx.producers.length) {
      lines.push(
        q("Container") +
          "," +
          q(ctx.containerNumber) +
          ",,,,"
      );
    } else {
      ctx.producers.forEach(function (p, idx) {
        var gps = producerGpsPair(p);
        lines.push(
          q(idx === 0 ? "Container" : "") +
            "," +
            q(idx === 0 ? ctx.containerNumber : "") +
            "," +
            q(p.supplier_name) +
            "," +
            q(p.farm_display) +
            "," +
            q(gps.lat) +
            "," +
            q(gps.lon)
        );
      });
    }
    lines.push(q("FCL Number") + "," + q(ctx.fclNumber));
    return lines.join("\r\n");
  };

  CIS.eudrLocationSheetPdfFilename = function (pack) {
    var cont = firstContainerFromPack(pack);
    var ref = ((cont && (cont.container_number || cont.fcl_number)) || "container")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 48);
    return "EUDR_Location_Sheet_" + ref + ".pdf";
  };

  CIS.eudrLocationSheetCsvFilename = function (pack) {
    var cont = firstContainerFromPack(pack);
    var ref = ((cont && (cont.container_number || cont.fcl_number)) || "container")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 48);
    return "EUDR_Location_Sheet_" + ref + ".csv";
  };

  CIS.fetchContainerTraceabilityPack = async function (api, containerId) {
    if (!containerId) throw new Error("Choose a container first.");
    if (!api || typeof api.traceability !== "function") {
      throw new Error("Traceability API is not available.");
    }
    return await api.traceability("/containers/eudr-documentation-pack", {
      method: "POST",
      body: { container_ids: [containerId] },
    });
  };

  CIS.showEudrAccompanyingLocationSheetPreview = async function (api, containerId, printOpts) {
    if (!CIS.showHtmlDocumentPreview) {
      throw new Error("Document output module not loaded.");
    }
    var pack = await CIS.fetchContainerTraceabilityPack(api, containerId);
    var ctx = locationSheetContext(pack);
    var label = ctx.containerNumber || "Container";
    var frozenPack = pack;
    return CIS.showHtmlDocumentPreview({
      title: "Preview — EUDR location sheet · " + label,
      frameClassName: "a4-print-preview-overlay__frame cm-container-sheet-preview-frame",
      pdfFilename: CIS.eudrLocationSheetPdfFilename(frozenPack),
      autoPrintAfterLoad: !!(printOpts && printOpts.autoPrint),
      getHtml: function () {
        return CIS.buildEudrAccompanyingLocationSheetHtml(frozenPack);
      },
      downloadPdf: function () {
        return CIS.downloadHtmlDocumentPdf(
          CIS.buildEudrAccompanyingLocationSheetHtml(frozenPack),
          CIS.eudrLocationSheetPdfFilename(frozenPack)
        );
      },
    });
  };

  CIS.downloadEudrAccompanyingLocationSheetCsv = async function (api, containerId) {
    var pack = await CIS.fetchContainerTraceabilityPack(api, containerId);
    var csv = CIS.buildEudrAccompanyingLocationSheetCsv(pack);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var name = CIS.eudrLocationSheetCsvFilename(pack);
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* Legacy aliases */
  CIS.buildContainerTraceabilitySummaryHtml = CIS.buildEudrAccompanyingLocationSheetHtml;
  CIS.containerTraceabilitySummaryPdfFilename = CIS.eudrLocationSheetPdfFilename;
  CIS.showContainerTraceabilitySummaryPreview = CIS.showEudrAccompanyingLocationSheetPreview;
})();
