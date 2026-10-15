/* Scale (Control Room) vs Charcoal intake (scanned bags) — truck-level variance report. */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var MONTH_NAMES = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function fmtKg(v) {
    if (v == null || v === "") return "—";
    return Number(v).toFixed(1) + " kg";
  }

  function fmtVar(v) {
    if (v == null || v === "") return "—";
    var n = Number(v);
    return (n >= 0 ? "+" : "") + n.toFixed(1) + " kg";
  }

  /**
   * Vs digital (storage scan vs pay weight): + kg = bags heavier than digital;
   * − kg = bags lighter. Computed as scan − digital (flip of digital − scan).
   */
  function vsDigitalKg(scanKg, digitalKg) {
    return Number(scanKg || 0) - Number(digitalKg || 0);
  }

  function rowVsDigital(row) {
    var d = row.digital || {};
    var sc = row.scanned || {};
    var scanF = Number(sc.fines_kg || 0) + Number(sc.bulk_fines_kg || 0);
    return {
      restaurant_kg: vsDigitalKg(sc.restaurant_kg, d.restaurant_kg),
      lumpwood_kg: vsDigitalKg(sc.lumpwood_kg, d.lumpwood_kg),
      fines_kg: vsDigitalKg(scanF, d.fines_kg),
    };
  }

  /** − red (investigate); + normal text; ~0 muted. */
  function varianceColorClass(kg) {
    if (kg == null || kg === "") return "";
    var n = Number(kg);
    if (!Number.isFinite(n)) return "";
    if (Math.abs(n) < 0.05) return "tsv-var--zero";
    if (n < 0) return "tsv-var--neg";
    return "tsv-var--pos";
  }

  /** Column bands for borders / header grouping (must match renderTable column order). */
  var TSV_TABLE_GROUPS = [
    { key: "meta", label: "Delivery", columns: ["Booking date", "Supplier", "GRN", "Truck", "Transporter", "Bags"] },
    {
      key: "r",
      label: "Restaurant (R)",
      columns: ["Digital R", "Scan R", "Vs digital"],
    },
    {
      key: "l",
      label: "Lumpwood (L)",
      columns: ["Digital L", "Scan L", "Vs digital"],
    },
    {
      key: "f",
      label: "Fines (F)",
      columns: ["Digital F", "Scan F", "Vs digital"],
    },
  ];

  function tsvCellGroupClass(groupKey, colInGroup) {
    var cls = "tsv-grp tsv-grp--" + groupKey;
    if (colInGroup === 0) cls += " tsv-grp-start";
    return cls;
  }

  /** Sum of |Δ R|+|Δ L|+|Δ F| across rows — stream gaps (table), not net truck total. */
  function sumAbsStreamVariance(rows) {
    var total = 0;
    (rows || []).forEach(function (row) {
      var v = rowVsDigital(row);
      total += Math.abs(v.restaurant_kg);
      total += Math.abs(v.lumpwood_kg);
      total += Math.abs(v.fines_kg);
    });
    return total;
  }

  function sumVsDigitalByStream(rows) {
    var r = 0;
    var l = 0;
    var f = 0;
    (rows || []).forEach(function (row) {
      var v = rowVsDigital(row);
      r += v.restaurant_kg;
      l += v.lumpwood_kg;
      f += v.fines_kg;
    });
    return { restaurant_kg: r, lumpwood_kg: l, fines_kg: f };
  }

  function sumDigitalAndScanRlf(rows) {
    var digital = 0;
    var scan = 0;
    (rows || []).forEach(function (row) {
      var d = row.digital || {};
      var sc = row.scanned || {};
      digital +=
        Number(d.restaurant_kg || 0) +
        Number(d.lumpwood_kg || 0) +
        Number(d.fines_kg || 0);
      scan +=
        Number(sc.restaurant_kg || 0) +
        Number(sc.lumpwood_kg || 0) +
        Number(sc.fines_kg || 0) +
        Number(sc.bulk_fines_kg || 0);
    });
    return { digital_kg: digital, scan_kg: scan, net_vs_digital_kg: scan - digital };
  }

  function fillBookingDateOptions(sel, dates, current) {
    sel.innerHTML = "";
    sel.appendChild(CIS.ui.el("option", { value: "" }, ["All booking dates"]));
    (dates || []).forEach(function (d) {
      sel.appendChild(CIS.ui.el("option", { value: String(d).slice(0, 10) }, [String(d).slice(0, 10)]));
    });
    if (current != null) sel.value = current;
  }

  function fillYearOptions(sel, years, current) {
    sel.innerHTML = "";
    sel.appendChild(CIS.ui.el("option", { value: "all" }, ["All years"]));
    var allowed = ["all"];
    (years || []).forEach(function (y) {
      var s = String(y);
      allowed.push(s);
      sel.appendChild(CIS.ui.el("option", { value: s }, [s]));
    });
    var want = current != null && current !== "" ? String(current) : "all";
    if (allowed.indexOf(want) < 0) want = "all";
    sel.value = want;
  }

  function fillMonthOptions(sel, months, current) {
    sel.innerHTML = "";
    sel.appendChild(CIS.ui.el("option", { value: "all" }, ["All months"]));
    (months || []).forEach(function (m) {
      sel.appendChild(
        CIS.ui.el("option", { value: String(m) }, [MONTH_NAMES[m] || String(m)])
      );
    });
    if (current) sel.value = current;
  }

  function fillSupplierOptions(sel, suppliers, current) {
    sel.innerHTML = "";
    sel.appendChild(CIS.ui.el("option", { value: "" }, ["All suppliers"]));
    (suppliers || []).forEach(function (s) {
      sel.appendChild(CIS.ui.el("option", { value: s }, [s]));
    });
    if (current != null) sel.value = current;
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content truck-scale-variance-host deliveries-register-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Scale vs intake variance"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      ui.el("strong", {}, ["Digital"]),
      " (Control Room) is what you pay on. ",
      ui.el("strong", {}, ["Vs digital"]),
      ": ",
      ui.el("strong", {}, ["− kg"]),
      " in ",
      ui.el("strong", {}, ["red"]),
      " = scans lighter than digital (stream/category errors). ",
      ui.el("strong", {}, ["+ kg"]),
      " in normal text = heavier at scan. Net total can look small while R/L/F still disagree. Filters match ",
      ui.el("strong", {}, ["Charcoal deliveries"]),
      ". |Vs digital| over ",
      ui.el("strong", {}, ["5 kg"]),
      " flags the row.",
    ]));

    var toolbar = ui.el("div", { class: "toolbar deliveries-register-toolbar truck-scale-variance-toolbar" });
    toolbar.appendChild(ui.el("label", { for: "tsv-year" }, ["Year"]));
    var yearSel = ui.el("select", { id: "tsv-year" });
    toolbar.appendChild(yearSel);
    toolbar.appendChild(ui.el("label", { for: "tsv-month" }, ["Month"]));
    var monthSel = ui.el("select", { id: "tsv-month" });
    toolbar.appendChild(monthSel);
    toolbar.appendChild(ui.el("label", { for: "tsv-booking-date" }, ["Booking date"]));
    var bookingDateSel = ui.el("select", { id: "tsv-booking-date" });
    bookingDateSel.style.maxWidth = "140px";
    toolbar.appendChild(bookingDateSel);
    toolbar.appendChild(ui.el("label", { for: "tsv-supplier" }, ["Supplier"]));
    var supplierSel = ui.el("select", { id: "tsv-supplier" });
    supplierSel.style.maxWidth = "280px";
    toolbar.appendChild(supplierSel);
    var flaggedOnly = ui.el("input", { type: "checkbox", id: "tsv-flagged-only" });
    toolbar.appendChild(ui.el("label", { for: "tsv-flagged-only" }, [flaggedOnly, " Flagged only"]));
    var csvBtn = ui.el("button", { type: "button", class: "btn-sm delivery-conf-export-btn" }, [
      "Download CSV (line report)",
    ]);
    toolbar.appendChild(csvBtn);
    container.appendChild(toolbar);

    var summaryHost = ui.el("div", { class: "truck-scale-variance-summary" });
    container.appendChild(summaryHost);
    var status = ui.el("p", { class: "muted truck-scale-variance-status deliveries-register-status" }, [
      "Loading…",
    ]);
    container.appendChild(status);
    container.appendChild(
      ui.el("h3", { class: "deliveries-register-totals-title" }, ["Line by line — one row per truck"])
    );
    var tableHost = ui.el("div", { class: "truck-scale-variance-table-wrap deliveries-register-table-wrap" });
    container.appendChild(tableHost);

    function queryString() {
      return (
        "?year=" +
        encodeURIComponent(yearSel.value || "all") +
        "&month=" +
        encodeURIComponent(monthSel.value || "all") +
        "&booking_date=" +
        encodeURIComponent(bookingDateSel.value || "") +
        "&supplier=" +
        encodeURIComponent(supplierSel.value || "") +
        "&flagged_only=" +
        (flaggedOnly.checked ? "true" : "false")
      );
    }

    function renderSummary(data) {
      summaryHost.innerHTML = "";
      var rows = data.rows || [];
      var streamSum = sumVsDigitalByStream(rows);
      var cards = ui.el("div", { class: "truck-scale-variance-cards" });
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Trucks in report"]),
        ui.el("strong", { class: "tsv-card-value" }, [String(data.count || 0)]),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card tsv-card--warn" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Flagged"]),
        ui.el("strong", { class: "tsv-card-value" }, [String(data.flagged_count || 0)]),
      ]));
      var absStream = sumAbsStreamVariance(rows);
      var rlfTotals = sumDigitalAndScanRlf(rows);
      var netAll =
        streamSum.restaurant_kg + streamSum.lumpwood_kg + streamSum.fines_kg;
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Σ net Vs digital (R+L+F)"]),
        ui.el(
          "strong",
          { class: "tsv-card-value " + varianceColorClass(netAll) },
          [fmtVar(netAll)]
        ),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Σ |Vs digital| (R+L+F)"]),
        ui.el("strong", { class: "tsv-card-value" }, [fmtKg(absStream)]),
      ]));
      var rlfCard = ui.el("div", { class: "tsv-card tsv-card--rlf" });
      rlfCard.appendChild(
        ui.el("span", { class: "tsv-card-label" }, ["Σ Vs digital by stream"])
      );
      var rlfVals = ui.el("div", { class: "tsv-card-rlf-lines" });
      [
        ["R", streamSum.restaurant_kg],
        ["L", streamSum.lumpwood_kg],
        ["F", streamSum.fines_kg],
      ].forEach(function (pair) {
        var line = ui.el("div", { class: "tsv-card-rlf-line" });
        line.appendChild(ui.el("span", { class: "tsv-card-rlf-key" }, [pair[0]]));
        line.appendChild(
          ui.el("strong", { class: "tsv-card-rlf-val " + varianceColorClass(pair[1]) }, [
            fmtVar(pair[1]),
          ])
        );
        rlfVals.appendChild(line);
      });
      rlfCard.appendChild(rlfVals);
      cards.appendChild(rlfCard);
      summaryHost.appendChild(cards);

      if (!rows.length) return;

      var netBar = rlfTotals.net_vs_digital_kg;
      var barWrap = ui.el("div", { class: "tsv-bar-chart" });
      var titleRow = ui.el("div", { class: "tsv-bar-head" });
      titleRow.appendChild(
        ui.el("h3", { class: "tsv-bar-title" }, ["Digital vs scanned R/L/F totals"])
      );
      titleRow.appendChild(
        ui.el("span", { class: "tsv-bar-variance " + varianceColorClass(netBar) }, [
          "Net Vs digital: ",
          fmtVar(netBar),
        ])
      );
      barWrap.appendChild(titleRow);
      barWrap.appendChild(
        ui.el("p", { class: "muted tsv-bar-help" }, [
          "Two bars = pay weight (digital) vs bag scans (physical) for the filtered trucks. Net can be near zero while ",
          fmtKg(absStream),
          " absolute kg still sits in R / L / F — operator or category mistakes offset in the total.",
        ])
      );
      var max = Math.max(rlfTotals.digital_kg, rlfTotals.scan_kg, 1);
      [
        ["Digital R+L+F (pay)", rlfTotals.digital_kg],
        ["Scanned R+L+F (bags)", rlfTotals.scan_kg],
      ].forEach(function (pair, i) {
        var row = ui.el("div", { class: "tsv-bar-row tsv-bar-row--compact" });
        row.appendChild(ui.el("span", { class: "tsv-bar-label" }, [pair[0]]));
        var track = ui.el("div", { class: "tsv-bar-track" });
        var fill = ui.el("div", {
          class: "tsv-bar-fill" + (i === 1 ? " tsv-bar-fill--physical" : ""),
          style: "width:" + Math.round((pair[1] / max) * 100) + "%",
        });
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(ui.el("span", { class: "tsv-bar-val" }, [fmtKg(pair[1])]));
        barWrap.appendChild(row);
      });
      summaryHost.appendChild(barWrap);
    }

    function renderTable(rows) {
      tableHost.innerHTML = "";
      if (!rows.length) {
        tableHost.appendChild(
          ui.el("p", { class: "muted" }, [
            "No trucks for this filter. Trucks need Control Room factory weights (digital scale POST) and Charcoal intake scans.",
          ])
        );
        return;
      }
      var table = ui.el("table", {
        class: "truck-scale-variance-table delivery-conf-tracker-table deliveries-register-table",
      });
      var thead = ui.el("thead");
      var groupHr = ui.el("tr", { class: "tsv-group-head-row" });
      TSV_TABLE_GROUPS.forEach(function (g) {
        groupHr.appendChild(
          ui.el(
            "th",
            {
              colspan: String(g.columns.length),
              class: "tsv-grp-head tsv-grp--" + g.key + " tsv-grp-start",
            },
            [g.label]
          )
        );
      });
      thead.appendChild(groupHr);
      var colHr = ui.el("tr", { class: "tsv-col-head-row" });
      TSV_TABLE_GROUPS.forEach(function (g) {
        g.columns.forEach(function (h, i) {
          colHr.appendChild(
            ui.el("th", { class: tsvCellGroupClass(g.key, i) }, [h])
          );
        });
      });
      thead.appendChild(colHr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      function appendTextTd(tr, text, groupKey, colInGroup) {
        tr.appendChild(ui.el("td", { class: tsvCellGroupClass(groupKey, colInGroup) }, [text]));
      }
      function appendNumTd(tr, text, groupKey, colInGroup, isVar, rawKg) {
        var cls = tsvCellGroupClass(groupKey, colInGroup) + " tsv-td--num delivery-conf-td--num";
        if (isVar) cls += " tsv-td--var " + varianceColorClass(rawKg);
        tr.appendChild(ui.el("td", { class: cls }, [text]));
      }

      rows.forEach(function (row) {
        var tr = ui.el("tr");
        var d = row.digital || {};
        var sc = row.scanned || {};
        var v = rowVsDigital(row);
        var scanF = Number(sc.fines_kg || 0) + Number(sc.bulk_fines_kg || 0);
        appendTextTd(tr, row.booking_date || "", "meta", 0);
        appendTextTd(tr, row.supplier || "", "meta", 1);
        appendTextTd(tr, row.grn || "", "meta", 2);
        appendTextTd(tr, row.truck_reg || "", "meta", 3);
        appendTextTd(tr, row.transporter || "", "meta", 4);
        appendTextTd(tr, String(row.bag_count != null ? row.bag_count : ""), "meta", 5);
        appendNumTd(tr, fmtKg(d.restaurant_kg), "r", 0, false);
        appendNumTd(tr, fmtKg(sc.restaurant_kg), "r", 1, false);
        appendNumTd(tr, fmtVar(v.restaurant_kg), "r", 2, true, v.restaurant_kg);
        appendNumTd(tr, fmtKg(d.lumpwood_kg), "l", 0, false);
        appendNumTd(tr, fmtKg(sc.lumpwood_kg), "l", 1, false);
        appendNumTd(tr, fmtVar(v.lumpwood_kg), "l", 2, true, v.lumpwood_kg);
        appendNumTd(tr, fmtKg(d.fines_kg), "f", 0, false);
        appendNumTd(tr, fmtKg(scanF), "f", 1, false);
        appendNumTd(tr, fmtVar(v.fines_kg), "f", 2, true, v.fines_kg);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      if (CIS.wrapDeliveryTrackerTable) {
        tableHost.appendChild(CIS.wrapDeliveryTrackerTable(ui, table));
      } else {
        tableHost.appendChild(table);
      }
    }

    async function loadFilters() {
      try {
        var f = await ctx.api.traceability(
          "/reports/scale-vs-intake-variance/filters?year=" +
            encodeURIComponent(yearSel.value || "all") +
            "&month=" +
            encodeURIComponent(monthSel.value || "all") +
            "&supplier=" +
            encodeURIComponent(supplierSel.value || "")
        );
        fillYearOptions(yearSel, f.available_years, yearSel.value || "all");
        fillMonthOptions(monthSel, f.available_months, monthSel.value);
        fillBookingDateOptions(
          bookingDateSel,
          f.available_booking_dates,
          bookingDateSel.value
        );
        fillSupplierOptions(supplierSel, f.suppliers, supplierSel.value);
      } catch (e) {
        fillYearOptions(yearSel, [], yearSel.value || "all");
        fillMonthOptions(monthSel, [], monthSel.value || "all");
        fillSupplierOptions(supplierSel, [], supplierSel.value || "");
      }
    }

    async function loadData() {
      status.textContent = "Loading…";
      status.style.display = "";
      tableHost.innerHTML = "";
      summaryHost.innerHTML = "";
      try {
        var data = await ctx.api.traceability("/reports/scale-vs-intake-variance" + queryString());
        if (data.filters) {
          fillYearOptions(yearSel, data.filters.available_years, yearSel.value);
          fillMonthOptions(monthSel, data.filters.available_months, monthSel.value);
          fillBookingDateOptions(
            bookingDateSel,
            data.filters.available_booking_dates,
            bookingDateSel.value
          );
          fillSupplierOptions(supplierSel, data.filters.suppliers, supplierSel.value);
        }
        status.textContent =
          (data.count != null ? data.count + " trucks" : "") +
          (data.flagged_count ? " · " + data.flagged_count + " flagged" : "") +
          (data.date_min && data.date_max ? " · " + data.date_min + " → " + data.date_max : "") +
          (data.eligible_truck_count != null && data.eligible_truck_count !== data.count
            ? " · " + data.eligible_truck_count + " eligible before flagged filter"
            : "");
        renderSummary(data);
        renderTable(data.rows || []);
      } catch (e) {
        status.textContent = "";
        tableHost.appendChild(ui.error(String(e.message || e)));
      }
    }

    async function downloadCsv() {
      var base = (ctx.config && ctx.config.traceabilityApiBase) || "/traceability/api/v1";
      var url = base + "/reports/scale-vs-intake-variance/export.csv" + queryString();
      status.textContent = "Preparing CSV…";
      try {
        var res = await fetch(url, {
          headers: { Authorization: "Bearer " + (CIS.getToken && CIS.getToken()) },
        });
        if (!res.ok) throw new Error("Export failed (" + res.status + ")");
        var blob = await res.blob();
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "scale-vs-intake-" + (yearSel.value || "all") + ".csv";
        a.click();
        URL.revokeObjectURL(a.href);
        status.textContent = "Download started.";
      } catch (e) {
        status.textContent = String(e.message || e);
      }
    }

    yearSel.addEventListener("change", function () {
      monthSel.value = "all";
      bookingDateSel.value = "";
      supplierSel.value = "";
      void loadFilters().then(loadData);
    });
    monthSel.addEventListener("change", function () {
      bookingDateSel.value = "";
      supplierSel.value = "";
      void loadFilters().then(loadData);
    });
    bookingDateSel.addEventListener("change", function () {
      void loadFilters().then(loadData);
    });
    supplierSel.addEventListener("change", loadData);
    flaggedOnly.addEventListener("change", loadData);
    csvBtn.addEventListener("click", function () {
      void downloadCsv();
    });

    yearSel.value = "all";
    monthSel.value = "all";
    await loadFilters();
    await loadData();
  }

  CIS.modules.push({
    id: "truck_scale_variance",
    title: "Scale vs intake variance",
    section: "Production",
    kind: "lookup",
    order: 15,
    icon: "quality",
    description: "Digital scale vs scanned intake — flagged truck variances",
    requires: "production.truck_scale_variance",
    render: render,
  });
})();
