/* Charcoal Tracker — Deliveries register (read-only, management). PJ edits in Delivery Confirmations. */

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

  /** Same columns as 2026 xlsb sheet "Deliveries" row 1 (A–U + Remarks). */
  var COLS = [
    { key: "booking_date", label: "Booking Date" },
    { key: "supplier", label: "Supplier" },
    { key: "contact_number", label: "Contact Number" },
    { key: "fsc_flag", label: "F" },
    { key: "grn", label: "GRN" },
    { key: "permit_no", label: "Permit No." },
    { key: "transporter", label: "Transporter" },
    { key: "truck_reg", label: "Truck Reg. No." },
    { key: "distance_km", label: "Distance from Factory (Km)" },
    { key: "weight_ton", label: "Weight (ton)", ton: true },
    { key: "sand_ash_ton", label: "Sand & Ash", ton: true },
    { key: "unburned_wood_ton", label: "Unburned Wood", ton: true },
    { key: "fines_ton", label: "Fines", ton: true },
    { key: "lumpwood_ton", label: "Lumpwood", ton: true },
    { key: "restaurant_ton", label: "Restaurant", ton: true },
    { key: "shortage_on_tonnage", label: "Shortage on Tonnage", ton: true },
    { key: "pct_restaurant", label: "% Restaurant", pct: true },
    { key: "pct_lumpwood", label: "% Lumpwood", pct: true },
    { key: "pct_fines", label: "% Fines", pct: true },
    { key: "pct_sand_ash", label: "% Sand & Ash", pct: true },
    { key: "pct_unburned_wood", label: "% Unburned Wood", pct: true },
    { key: "remarks", label: "Remarks" },
  ];

  var TOTAL_LABELS = {
    weight_ton: "Weight (ton)",
    sand_ash_ton: "Sand & Ash",
    unburned_wood_ton: "Unburned Wood",
    fines_ton: "Fines",
    lumpwood_ton: "Lumpwood",
    restaurant_ton: "Restaurant",
    shortage_on_tonnage: "Shortage on Tonnage",
  };

  function fmtTon(v) {
    if (v == null || v === "") return "";
    return Number(v).toFixed(3);
  }

  function fmtPct(v) {
    if (v == null || v === "") return "";
    return Number(v).toFixed(2);
  }

  function cellText(row, col) {
    var val = row[col.key];
    if (col.ton) return fmtTon(val);
    if (col.pct) return fmtPct(val);
    if (val == null || val === "") return "";
    return String(val);
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

  function renderTotalsPanel(ui, totals, yearSel, monthSel) {
    if (!totals) return ui.el("div");
    var wrap = ui.el("div", { class: "deliveries-register-totals" });
    var periodTitle =
      monthSel.value !== "all"
        ? "Totals — " + (MONTH_NAMES[Number(monthSel.value)] || monthSel.value)
        : yearSel.value !== "all"
          ? "Totals — " + yearSel.value + " (full year)"
          : "Totals — filtered rows";
    wrap.appendChild(ui.el("h3", { class: "deliveries-register-totals-title" }, [periodTitle]));

    var grid = ui.el("div", { class: "deliveries-register-totals-grid" });
    var keys = Object.keys(TOTAL_LABELS);
    keys.forEach(function (key) {
      var v = totals.period && totals.period[key];
      grid.appendChild(ui.el("div", { class: "deliveries-register-totals-cell" }, [
        ui.el("span", { class: "deliveries-register-totals-label" }, [TOTAL_LABELS[key]]),
        ui.el("strong", {}, [v != null ? fmtTon(v) : "—"]),
      ]));
    });
    wrap.appendChild(grid);

    if (totals.ytd && yearSel.value !== "all") {
      var ytdTitle =
        monthSel.value !== "all"
          ? "Accrued YTD (Jan–" + (MONTH_NAMES[Number(monthSel.value)] || monthSel.value) + " " + yearSel.value + ")"
          : "Accrued YTD (" + yearSel.value + ")";
      wrap.appendChild(ui.el("h3", { class: "deliveries-register-totals-title deliveries-register-totals-title--ytd" }, [ytdTitle]));
      var ytdGrid = ui.el("div", { class: "deliveries-register-totals-grid" });
      keys.forEach(function (key) {
        var v = totals.ytd[key];
        ytdGrid.appendChild(ui.el("div", { class: "deliveries-register-totals-cell" }, [
          ui.el("span", { class: "deliveries-register-totals-label" }, [TOTAL_LABELS[key]]),
          ui.el("strong", {}, [v != null ? fmtTon(v) : "—"]),
        ]));
      });
      wrap.appendChild(ytdGrid);
    }
    return wrap;
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content deliveries-register-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Charcoal deliveries (load sheet)"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Deliveries sheet — same column headers as the Charcoal Tracker workbook. Filter by supplier and month; ",
      "totals match the filtered rows (YTD when a calendar year is selected). PJ edits in Traceability → Delivery Confirmations.",
    ]));

    var toolbar = ui.el("div", { class: "toolbar deliveries-register-toolbar" });
    toolbar.appendChild(ui.el("label", { for: "deliveries-register-year" }, ["Year"]));
    var yearSel = ui.el("select", { id: "deliveries-register-year" });
    toolbar.appendChild(yearSel);
    toolbar.appendChild(ui.el("label", { for: "deliveries-register-month" }, ["Month"]));
    var monthSel = ui.el("select", { id: "deliveries-register-month" });
    toolbar.appendChild(monthSel);
    toolbar.appendChild(ui.el("label", { for: "deliveries-register-supplier" }, ["Supplier"]));
    var supplierSel = ui.el("select", { id: "deliveries-register-supplier" });
    supplierSel.style.maxWidth = "280px";
    toolbar.appendChild(supplierSel);
    var dlBtn = ui.el("button", { type: "button", class: "btn-sm delivery-conf-export-btn" }, [
      "Download Excel (Deliveries sheet)",
    ]);
    toolbar.appendChild(dlBtn);
    container.appendChild(toolbar);

    var status = ui.el("p", { class: "muted deliveries-register-status" }, ["Loading…"]);
    container.appendChild(status);
    var totalsHost = ui.el("div", { class: "deliveries-register-totals-host" });
    container.appendChild(totalsHost);
    var tableHost = ui.el("div", { class: "deliveries-register-table-wrap" });
    container.appendChild(tableHost);

    function registerQuery() {
      var q =
        "?year=" +
        encodeURIComponent(yearSel.value) +
        "&month=" +
        encodeURIComponent(monthSel.value) +
        "&supplier=" +
        encodeURIComponent(supplierSel.value || "");
      return q;
    }

    function renderTable(rows) {
      tableHost.innerHTML = "";
      if (!rows.length) {
        tableHost.appendChild(ui.el("p", { class: "muted" }, ["No delivery rows for this filter."]));
        return;
      }
      var table = ui.el("table", {
        class: "delivery-conf-tracker-table deliveries-register-table",
      });
      var thead = ui.el("thead");
      var hr = ui.el("tr");
      COLS.forEach(function (c) {
        var thClass = c.key === "fsc_flag" ? "delivery-conf-th--f" : "";
        hr.appendChild(ui.el("th", { class: thClass }, [c.label]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      rows.forEach(function (row) {
        var tr = ui.el("tr");
        COLS.forEach(function (c) {
          var tdClass = "";
          if (c.ton || c.pct || c.key === "distance_km") tdClass = "delivery-conf-td--num";
          if (c.key === "fsc_flag") tdClass = "delivery-conf-td--f";
          if (c.key === "remarks") tdClass = "delivery-conf-td--remarks";
          tr.appendChild(ui.el("td", { class: tdClass }, [cellText(row, c)]));
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
        var f = await ctx.api.qualityReports(
          "/deliveries-register/filters?year=" + encodeURIComponent(yearSel.value)
        );
        fillYearOptions(yearSel, f.available_years, yearSel.value || "2026");
        fillMonthOptions(monthSel, f.available_months, monthSel.value);
        fillSupplierOptions(supplierSel, f.suppliers, supplierSel.value);
      } catch (e) {
        fillYearOptions(yearSel, [2026, 2025], "2026");
        fillMonthOptions(monthSel, [], "all");
        fillSupplierOptions(supplierSel, [], "");
      }
    }

    async function loadData() {
      status.textContent = "Loading…";
      status.style.display = "";
      tableHost.innerHTML = "";
      totalsHost.innerHTML = "";
      try {
        var data = await ctx.api.qualityReports("/deliveries-register" + registerQuery());
        if (data.filters) {
          fillYearOptions(yearSel, data.filters.available_years, yearSel.value);
          fillMonthOptions(monthSel, data.filters.available_months, monthSel.value);
          fillSupplierOptions(supplierSel, data.filters.suppliers, supplierSel.value);
        }
        status.textContent =
          (data.count != null ? data.count + " rows" : "") +
          (data.date_min && data.date_max ? " · " + data.date_min + " → " + data.date_max : "") +
          (data.through_date ? " · through " + data.through_date : "");
        totalsHost.appendChild(renderTotalsPanel(ui, data.totals, yearSel, monthSel));
        renderTable(data.rows || []);
      } catch (e) {
        status.textContent = "";
        tableHost.appendChild(ui.error(String(e.message || e)));
      }
    }

    async function downloadXlsx() {
      var base = (ctx.config && ctx.config.qualityReportsApiBase) || "/quality/reports/api";
      var url = base + "/deliveries-register/export.xlsx" + registerQuery();
      status.textContent = "Preparing Excel…";
      try {
        var res = await fetch(url, {
          headers: { Authorization: "Bearer " + (CIS.getToken && CIS.getToken()) },
        });
        if (!res.ok) throw new Error("Export failed (" + res.status + ")");
        var blob = await res.blob();
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "charcoal-deliveries-" + yearSel.value + ".xlsx";
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
      void loadData();
    });
    supplierSel.addEventListener("change", function () {
      void loadData();
    });
    dlBtn.addEventListener("click", function () {
      void downloadXlsx();
    });

    yearSel.value = "2026";
    await loadFilters();
    await loadData();
  }

  CIS.modules.push({
    id: "deliveries_register",
    title: "Charcoal deliveries",
    section: "Production",
    kind: "lookup",
    order: 14,
    icon: "quality",
    description: "Load sheet — read-only Deliveries tracker + Excel download",
    requires: "production.deliveries_register",
    render: render,
  });
})();
