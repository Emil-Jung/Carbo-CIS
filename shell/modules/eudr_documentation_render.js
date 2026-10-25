/* EUDR documentation — print HTML, CSV, and GeoJSON zip download. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  function esc(s) {
    if (s == null || s === "") return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDateIso(iso) {
    if (!iso) return "";
    try {
      var p = String(iso).split("-");
      if (p.length === 3) {
        var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
        return d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
      }
    } catch (e) { /* ignore */ }
    return String(iso);
  }

  function defaultShipmentDate(pack) {
    var best = "";
    (pack.containers || []).forEach(function (c) {
      var raw = c.expected_ship_date || c.load_date;
      if (raw && (!best || String(raw) > best)) best = String(raw);
    });
    return fmtDateIso(best) || fmtDateIso(new Date().toISOString().slice(0, 10));
  }

  CIS.formatEudrMissingFarmBlock = function (pack) {
    var rows = pack.missing_farm_information || [];
    if (!rows.length) {
      return "";
    }
    var html =
      "<h3>Farm information gaps (not omitted — review before submission)</h3>" +
      "<table class=\"gaps\"><thead><tr><th>Supplier / farm</th><th>Containers</th><th>Issue</th></tr></thead><tbody>";
    rows.forEach(function (row) {
      var issues = (row.information_gaps || [])
        .map(function (g) {
          return esc(g.message || g.code || "");
        })
        .join("<br/>");
      html +=
        "<tr><td>" +
        esc(row.supplier_name || "") +
        "<br/><span class=\"muted\">" +
        esc(row.farm_display || "") +
        "</span></td><td>" +
        esc((row.container_numbers || []).join(", ")) +
        "</td><td>" +
        issues +
        "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  };

  function openPrintHtml(html, title) {
    var w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      alert("Allow pop-ups to print this document.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    if (title) {
      try {
        w.document.title = title;
      } catch (e) { /* ignore */ }
    }
  }

  CIS.buildEudrDueDiligenceHtml = function (pack, fields) {
    var f = fields || {};
    var ship = pack.shipment || {};
    var containers = pack.containers || [];
    var numbers = (ship.container_numbers || []).join(", ");
    var netMass = ship.net_mass_kg != null ? Number(ship.net_mass_kg).toLocaleString() + " kg" : "—";

    var rows = [
      ["Internal reference / Client", f.client || ""],
      ["Container(s)", numbers || "—"],
      ["Carbo reference", f.carbo_ref || ""],
      ["Destination", f.destination || ""],
      ["Shipment date", f.shipment_date || defaultShipmentDate(pack)],
      ["Operator", f.operator || "Carbo Namibia"],
      ["Operator address", f.operator_address || ""],
      ["EORI number", f.eori || ""],
      ["Product", f.product || "Hardwood charcoal"],
      ["HS Code", f.hs_code || "4402 — Charcoal, whether or not agglomerated"],
      ["Trade description", f.trade_description || "Hardwood lump charcoal for retail / food-service use"],
      ["Wood species", f.wood_species || ""],
      ["Net mass (loaded)", netMass],
      ["Total bags (loaded)", ship.total_bags != null ? String(ship.total_bags) : "—"],
      ["Country of production", f.country || "Namibia"],
      [
        "Production geolocation",
        f.geolocation_note ||
          "See accompanying location sheet — farm GPS from the Producers register (homestead coordinates).",
      ],
      ["DDS reference (EU IS)", f.dds_reference || ""],
    ];

    var tableRows = rows
      .map(function (pair) {
        return (
          "<tr><th scope=\"row\">" +
          esc(pair[0]) +
          "</th><td>" +
          (pair[1] ? esc(pair[1]) : "<span class=\"blank\">&nbsp;</span>") +
          "</td></tr>"
        );
      })
      .join("");

    var missingBlock = CIS.formatEudrMissingFarmBlock(pack);
    var missingWarn = missingBlock
      ? "<p class=\"warn\"><strong>Some farms in this shipment have incomplete register data.</strong> Details below.</p>"
      : "";
    if (pack.registry_error) {
      missingWarn +=
        "<p class=\"warn\">Producer registry was unavailable — farm GPS may be incomplete (" +
        esc(pack.registry_error) +
        ").</p>";
    }

    return (
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>EUDR Due Diligence Statement</title><style>" +
      "body{font-family:Georgia,'Times New Roman',serif;font-size:12pt;margin:18mm;color:#111;max-width:180mm;}" +
      "h1{font-size:16pt;text-align:center;margin:0 0 4mm;letter-spacing:0.06em;}" +
      "h2{font-size:11pt;text-align:center;font-weight:normal;margin:0 0 10mm;color:#333;}" +
      "table.meta{width:100%;border-collapse:collapse;margin:8mm 0;}" +
      "table.meta th{text-align:left;width:42%;padding:3mm 2mm;border-bottom:1px solid #ccc;font-weight:600;vertical-align:top;}" +
      "table.meta td{padding:3mm 2mm;border-bottom:1px solid #eee;vertical-align:top;}" +
      ".blank{color:#999;}" +
      "h3{font-size:12pt;margin:10mm 0 3mm;}" +
      "ul{margin:0 0 8mm 5mm;padding:0;}" +
      "blockquote{font-size:10.5pt;line-height:1.45;margin:8mm 0;padding:4mm 5mm;border-left:3px solid #333;background:#f9f9f9;}" +
      ".sign{margin-top:12mm;}" +
      ".warn{font-size:10pt;color:#7a2e00;background:#fff4e6;padding:3mm;border:1px solid #e6c89a;}" +
      "table.gaps{width:100%;border-collapse:collapse;font-size:9.5pt;margin:4mm 0;}" +
      "table.gaps th,table.gaps td{border:1px solid #ccc;padding:2mm;vertical-align:top;}" +
      "table.gaps .muted{color:#555;font-size:9pt;}" +
      "@media print{body{margin:12mm;}}" +
      "</style></head><body>" +
      "<h1>CARBO NAMIBIA</h1>" +
      "<h2>EUDR DUE DILIGENCE STATEMENT</h2>" +
      "<table class=\"meta\">" +
      tableRows +
      "</table>" +
      "<h3>Accompanying traceability package</h3>" +
      "<ul>" +
      "<li>Container sheet(s) — one per FCL listed above</li>" +
      "<li>Accompanying location sheet — producers and farm GPS per container</li>" +
      "<li>Optional polygon GeoJSON evidence bundle — when configured on the server</li>" +
      "</ul>" +
      missingWarn +
      missingBlock +
      "<h3>Declaration</h3>" +
      "<blockquote>By submitting this due diligence statement the operator confirms that due diligence in accordance with Regulation (EU) 2023/1115 was carried out and that no or only a negligible risk was found that the relevant products do not comply with Article 3, point (a) or (b), of that Regulation.</blockquote>" +
      "<div class=\"sign\">" +
      "<p>Signed for and on behalf of: <strong>" +
      esc(f.operator || "Carbo Namibia") +
      "</strong></p>" +
      "<p>Date: " +
      esc(f.statement_date || f.shipment_date || defaultShipmentDate(pack)) +
      "</p>" +
      "<p>Name and function: " +
      (f.signatory ? esc(f.signatory) : "<span class=\"blank\">&nbsp;</span>") +
      "</p>" +
      "<p>Signature: <span class=\"blank\">&nbsp;</span></p>" +
      "</div>" +
      "<script>window.onload=function(){window.print();}</script>" +
      "</body></html>"
    );
  };

  CIS.printEudrDueDiligence = function (pack, fields) {
    openPrintHtml(CIS.buildEudrDueDiligenceHtml(pack, fields), "EUDR Due Diligence Statement");
  };

  CIS.buildEudrLocationSheetCsv = function (pack) {
    var lines = [
      "Container,FCL Number,SUPPLIER NAME,FARM NAME & NR,GPS COORDINATES,Bag count,Weight kg,Information gaps",
    ];
    (pack.containers || []).forEach(function (c) {
      var fcl = c.container_number || "";
      (c.producers || []).forEach(function (p) {
        var gapText = (p.information_gaps || [])
          .map(function (g) {
            return g.message || g.code || "";
          })
          .join("; ");
        lines.push(
          [
            fcl,
            fcl,
            (p.supplier_name || "").replace(/"/g, '""'),
            (p.farm_display || "").replace(/"/g, '""'),
            (p.gps_coordinates || "").replace(/"/g, '""'),
            p.bag_count != null ? String(p.bag_count) : "",
            p.weight_kg != null ? String(p.weight_kg) : "",
            gapText.replace(/"/g, '""'),
          ]
            .map(function (cell) {
              var s = String(cell);
              return /[",\n]/.test(s) ? '"' + s + '"' : s;
            })
            .join(",")
        );
      });
    });
    return lines.join("\r\n");
  };

  CIS.buildEudrLocationSheetHtml = function (pack) {
    var bodyRows = "";
    (pack.containers || []).forEach(function (c) {
      var fcl = esc(c.container_number || "");
      (c.producers || []).forEach(function (p) {
        bodyRows +=
          "<tr><td>" +
          fcl +
          "</td><td>" +
          fcl +
          "</td><td>" +
          esc(p.supplier_name || "—") +
          "</td><td>" +
          esc(p.farm_display || "—") +
          "</td><td>" +
          esc(p.gps_coordinates || "—") +
          "</td><td class=\"num\">" +
          esc(p.bag_count != null ? String(p.bag_count) : "") +
          "</td><td class=\"num\">" +
          esc(p.weight_kg != null ? String(p.weight_kg) : "") +
          "</td></tr>";
      });
    });
    if (!bodyRows) {
      bodyRows = "<tr><td colspan=\"7\">No loaded bags in the selected containers.</td></tr>";
    }
    var ship = pack.shipment || {};
    return (
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>EUDR Location Sheet</title><style>" +
      "body{font-family:Arial,Helvetica,sans-serif;font-size:10px;margin:10mm;}" +
      "h1{font-size:13px;margin:0 0 6px;}" +
      "p.meta{margin:0 0 8px;color:#333;}" +
      "table{width:100%;border-collapse:collapse;}" +
      "th,td{border:1px solid #000;padding:3px 4px;vertical-align:top;}" +
      "th{background:#eee;font-size:9px;}" +
      "td.num{text-align:right;}" +
      "table.gaps{width:100%;border-collapse:collapse;margin-top:8px;font-size:9px;}" +
      "table.gaps th,table.gaps td{border:1px solid #999;padding:2px 3px;}" +
      "@media print{body{margin:8mm;}}" +
      "</style></head><body>" +
      "<h1>EUDR Accompanying Location Sheet</h1>" +
      "<p class=\"meta\">Containers: " +
      esc((ship.container_numbers || []).join(", ")) +
      " · Net loaded mass: " +
      esc(ship.net_mass_kg != null ? ship.net_mass_kg + " kg" : "—") +
      " · GPS = farm register coordinates (not EUDR polygon GeoJSON).</p>" +
      "<table><thead><tr>" +
      "<th>Container</th><th>FCL Number</th><th>SUPPLIER NAME</th><th>FARM NAME &amp; NR</th>" +
      "<th>GPS COORDINATES</th><th>Bags</th><th>Weight kg</th>" +
      "</tr></thead><tbody>" +
      bodyRows +
      "</tbody></table>" +
      CIS.formatEudrMissingFarmBlock(pack) +
      "<script>window.onload=function(){window.print();}</script>" +
      "</body></html>"
    );
  };

  CIS.printEudrLocationSheet = function (pack) {
    openPrintHtml(CIS.buildEudrLocationSheetHtml(pack), "EUDR Location Sheet");
  };

  CIS.downloadEudrLocationSheetCsv = function (pack) {
    var csv = CIS.buildEudrLocationSheetCsv(pack);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eudr-location-sheet.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };

  CIS.downloadEudrGeojsonZip = async function (ctx, body) {
    var base = (ctx.config && ctx.config.traceabilityApiBase) || "/traceability/api/v1";
    var token = CIS.getToken && CIS.getToken();
    var headers = { "Content-Type": "application/json", Accept: "application/zip" };
    if (token) headers.Authorization = "Bearer " + token;
    var res = await fetch(base + "/containers/eudr-documentation-pack/geojson-zip", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      var text = await res.text();
      var detail = text;
      try {
        var j = JSON.parse(text);
        detail = j.detail || text;
      } catch (e) { /* ignore */ }
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    var missing = res.headers.get("X-Eudr-Geojson-Missing") || "0";
    var included = res.headers.get("X-Eudr-Geojson-Included") || "0";
    var blob = await res.blob();
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eudr-geojson-bundle.zip";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    return { included: Number(included), missing: Number(missing) };
  };

  CIS.openEudrDueDiligenceDialog = function (pack, onPrint) {
    var ship = pack.shipment || {};
    var first = (pack.containers && pack.containers[0]) || {};
    var backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop cm-print-dialog-backdrop";
    var dialog = document.createElement("div");
    dialog.className = "modal cm-print-dialog cm-print-dialog--wide";
    dialog.setAttribute("role", "dialog");

    var title = document.createElement("h3");
    title.textContent = "Due diligence statement — optional fields";
    dialog.appendChild(title);

    var hint = document.createElement("p");
    hint.className = "muted cm-print-dialog-hint";
    hint.textContent =
      "Net mass and container list come from Traceability. Fill or adjust any fields below before printing.";
    dialog.appendChild(hint);

    function field(labelText, inputEl) {
      var lab = document.createElement("label");
      lab.className = "ct-field cm-print-field";
      var span = document.createElement("span");
      span.className = "ct-field-label";
      span.textContent = labelText;
      lab.appendChild(span);
      lab.appendChild(inputEl);
      return lab;
    }

    var client = document.createElement("input");
    client.type = "text";
    client.value = first.ship_to || "";
    dialog.appendChild(field("Client / internal reference", client));

    var carboRef = document.createElement("input");
    carboRef.type = "text";
    carboRef.placeholder = "Optional";
    dialog.appendChild(field("Carbo reference", carboRef));

    var destination = document.createElement("input");
    destination.type = "text";
    destination.value = first.ship_to || "";
    dialog.appendChild(field("Destination", destination));

    var shipDate = document.createElement("input");
    shipDate.type = "text";
    shipDate.value = defaultShipmentDate(pack);
    dialog.appendChild(field("Shipment date (display)", shipDate));

    var wood = document.createElement("input");
    wood.type = "text";
    wood.placeholder = "Common and scientific name if known";
    dialog.appendChild(field("Wood species", wood));

    var dds = document.createElement("input");
    dds.type = "text";
    dds.placeholder = "After EU IS submission";
    dialog.appendChild(field("DDS reference", dds));

    var signatory = document.createElement("input");
    signatory.type = "text";
    dialog.appendChild(field("Name and function (signature block)", signatory));

    var summary = document.createElement("p");
    summary.className = "muted";
    summary.textContent =
      "Containers: " +
      (ship.container_numbers || []).join(", ") +
      " · Net loaded " +
      (ship.net_mass_kg != null ? ship.net_mass_kg + " kg" : "—");
    dialog.appendChild(summary);

    var actions = document.createElement("div");
    actions.className = "cm-print-dialog-actions";
    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-sm";
    cancelBtn.textContent = "Cancel";
    var printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "btn";
    printBtn.textContent = "Print statement";
    actions.appendChild(cancelBtn);
    actions.appendChild(printBtn);
    dialog.appendChild(actions);

    function close() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    cancelBtn.addEventListener("click", close);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) close();
    });
    printBtn.addEventListener("click", function () {
      var fields = {
        client: client.value.trim(),
        carbo_ref: carboRef.value.trim(),
        destination: destination.value.trim(),
        shipment_date: shipDate.value.trim(),
        wood_species: wood.value.trim(),
        dds_reference: dds.value.trim(),
        signatory: signatory.value.trim(),
        statement_date: shipDate.value.trim(),
      };
      if (onPrint) onPrint(fields);
      else CIS.printEudrDueDiligence(pack, fields);
      close();
    });

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    client.focus();
  };
})();
