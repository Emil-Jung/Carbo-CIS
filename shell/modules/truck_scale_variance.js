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

  function fillYearOptions(sel, years, current) {
    sel.innerHTML = "";
    sel.appendChild(CIS.ui.el("option", { value: "all" }, ["All years"]));
    (years || []).forEach(function (y) {
      sel.appendChild(CIS.ui.el("option", { value: String(y) }, [String(y)]));
    });
    if (current) sel.value = current;
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
      "One row per truck with factory digital scale weights (Control Room / Fransina capture) compared to ",
      "Charcoal intake bag scans. Filters match ",
      ui.el("strong", {}, ["Charcoal deliveries"]),
      ". Truck-total compare adds digital sand & ash and unburned wood to the scanned side (investigation only). ",
      "|Δ| over ",
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
        "&supplier=" +
        encodeURIComponent(supplierSel.value || "") +
        "&flagged_only=" +
        (flaggedOnly.checked ? "true" : "false")
      );
    }

    function renderSummary(data) {
      summaryHost.innerHTML = "";
      var s = data.summary || {};
      var cards = ui.el("div", { class: "truck-scale-variance-cards" });
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Trucks in report"]),
        ui.el("strong", { class: "tsv-card-value" }, [String(data.count || 0)]),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card tsv-card--warn" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Flagged"]),
        ui.el("strong", { class: "tsv-card-value" }, [String(data.flagged_count || 0)]),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Σ truck variance"]),
        ui.el("strong", { class: "tsv-card-value" }, [fmtVar(s.variance_truck_total_kg)]),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Σ R / L / F variance"]),
        ui.el(
          "strong",
          { class: "tsv-card-value" },
          [
            fmtVar(s.variance_restaurant_kg) +
              " · " +
              fmtVar(s.variance_lumpwood_kg) +
              " · " +
              fmtVar(s.variance_fines_kg),
          ]
        ),
      ]));
      summaryHost.appendChild(cards);

      var barWrap = ui.el("div", { class: "tsv-bar-chart" });
      barWrap.appendChild(ui.el("h3", { class: "tsv-bar-title" }, ["Digital vs physical (compare) truck totals"]));
      var digital = Number(s.digital_truck_total_kg || 0);
      var physical = Number(s.physical_truck_compare_kg || 0);
      var max = Math.max(digital, physical, 1);
      ["Digital (scale)", "Scanned R/L/F + digital waste"].forEach(function (label, i) {
        var val = i === 0 ? digital : physical;
        var row = ui.el("div", { class: "tsv-bar-row" });
        row.appendChild(ui.el("span", { class: "tsv-bar-label" }, [label]));
        var track = ui.el("div", { class: "tsv-bar-track" });
        var fill = ui.el("div", {
          class: "tsv-bar-fill" + (i === 1 ? " tsv-bar-fill--physical" : ""),
          style: "width:" + Math.round((val / max) * 100) + "%",
        });
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(ui.el("span", { class: "tsv-bar-val" }, [fmtKg(val)]));
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
      var headers = [
        "Booking date",
        "Supplier",
        "GRN",
        "Truck",
        "Transporter",
        "Bags",
        "Digital R",
        "Scan R",
        "Δ R",
        "Digital L",
        "Scan L",
        "Δ L",
        "Digital F",
        "Scan F",
        "Δ F",
        "Dig. S&A",
        "Dig. unburned",
        "Digital truck",
        "Physical+cmp",
        "Δ truck",
        "Flags",
      ];
      var thead = ui.el("thead");
      var hr = ui.el("tr");
      headers.forEach(function (h) {
        hr.appendChild(ui.el("th", {}, [h]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      rows.forEach(function (row) {
        var tr = ui.el("tr", { class: row.flagged ? "tsv-row--flagged" : "" });
        var d = row.digital || {};
        var sc = row.scanned || {};
        var v = row.variance_kg || {};
        var scanF = Number(sc.fines_kg || 0) + Number(sc.bulk_fines_kg || 0);
        var cells = [
          row.booking_date || "",
          row.supplier || "",
          row.grn || "",
          row.truck_reg || "",
          row.transporter || "",
          String(row.bag_count != null ? row.bag_count : ""),
          fmtKg(d.restaurant_kg),
          fmtKg(sc.restaurant_kg),
          fmtVar(v.restaurant_kg),
          fmtKg(d.lumpwood_kg),
          fmtKg(sc.lumpwood_kg),
          fmtVar(v.lumpwood_kg),
          fmtKg(d.fines_kg),
          fmtKg(scanF),
          fmtVar(v.fines_kg),
          fmtKg(d.sand_ash_kg),
          fmtKg(d.unburned_kg),
          fmtKg(d.truck_total_kg),
          fmtKg(row.physical_truck_compare_kg),
          fmtVar(v.truck_total_kg),
          (row.flags || []).join(", "),
        ];
        cells.forEach(function (text, idx) {
          var cls = idx >= 6 && idx <= 19 ? "tsv-td--num delivery-conf-td--num" : "";
          if (idx >= 8 && idx <= 19 && (idx - 8) % 3 === 0) cls += " tsv-td--var";
          tr.appendChild(ui.el("td", { class: cls }, [text]));
        });
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
            encodeURIComponent(monthSel.value || "all")
        );
        fillYearOptions(yearSel, f.available_years, yearSel.value || "2026");
        fillMonthOptions(monthSel, f.available_months, monthSel.value);
        fillSupplierOptions(supplierSel, f.suppliers, supplierSel.value);
      } catch (e) {
        fillYearOptions(yearSel, [2026, 2025], yearSel.value || "2026");
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
      supplierSel.value = "";
      void loadFilters().then(loadData);
    });
    monthSel.addEventListener("change", function () {
      supplierSel.value = "";
      void loadFilters().then(loadData);
    });
    supplierSel.addEventListener("change", loadData);
    flaggedOnly.addEventListener("change", loadData);
    csvBtn.addEventListener("click", function () {
      void downloadCsv();
    });

    yearSel.value = "2026";
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
