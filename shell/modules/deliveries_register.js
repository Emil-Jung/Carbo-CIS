/* Charcoal Tracker — Deliveries register (read-only, management). PJ edits in Delivery Confirmations. */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var COLS = [
    { key: "booking_date", label: "Booking Date" },
    { key: "supplier", label: "Supplier" },
    { key: "grn", label: "GRN" },
    { key: "transporter", label: "Transporter" },
    { key: "weight_ton", label: "Weight (t)", ton: true },
    { key: "restaurant_ton", label: "Restaurant (t)", ton: true },
    { key: "pct_restaurant", label: "% Rest.", pct: true },
    { key: "pct_lumpwood", label: "% Lump", pct: true },
    { key: "pct_fines", label: "% Fines", pct: true },
  ];

  var YEAR_OPTIONS = [
    { value: "all", label: "All years" },
    { value: "2026", label: "2026" },
    { value: "2025", label: "2025" },
  ];

  function fmtTon(v) {
    if (v == null || v === "") return "—";
    return Number(v).toFixed(3);
  }

  function fmtPct(v) {
    if (v == null || v === "") return "—";
    return Number(v).toFixed(2);
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content deliveries-register-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Charcoal deliveries (load sheet)"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Read-only view of the factory Deliveries tracker — same columns as the spreadsheet. ",
      "PJ finalises rows in Traceability → Delivery Confirmations; this replaces WhatsApp screenshots. ",
      "Download Excel for finance or management.",
    ]));

    var toolbar = ui.el("div", { class: "toolbar deliveries-register-toolbar" });
    toolbar.appendChild(ui.el("label", { for: "deliveries-register-year" }, ["Year"]));
    var yearSel = ui.el("select", { id: "deliveries-register-year" });
    YEAR_OPTIONS.forEach(function (opt) {
      yearSel.appendChild(ui.el("option", { value: opt.value }, [opt.label]));
    });
    toolbar.appendChild(yearSel);
    var dlBtn = ui.el("button", { type: "button", class: "btn-sm delivery-conf-export-btn" }, [
      "Download Excel (Deliveries sheet)",
    ]);
    toolbar.appendChild(dlBtn);
    container.appendChild(toolbar);

    var status = ui.el("p", { class: "muted deliveries-register-status" }, ["Loading…"]);
    container.appendChild(status);
    var tableHost = ui.el("div", { class: "print-labels-history-wrap deliveries-register-table-wrap" });
    container.appendChild(tableHost);

    function renderTable(rows) {
      tableHost.innerHTML = "";
      if (!rows.length) {
        tableHost.appendChild(ui.el("p", { class: "muted" }, ["No delivery rows for this filter."]));
        return;
      }
      var table = ui.el("table", { class: "print-labels-history delivery-conf-history deliveries-register-table" });
      var thead = ui.el("thead");
      var hr = ui.el("tr");
      COLS.forEach(function (c) {
        hr.appendChild(ui.el("th", {}, [c.label]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      rows.forEach(function (row) {
        var tr = ui.el("tr");
        COLS.forEach(function (c) {
          var val = row[c.key];
          if (c.ton) val = fmtTon(val);
          else if (c.pct) val = fmtPct(val);
          else if (val == null || val === "") val = "—";
          tr.appendChild(ui.el("td", {}, [String(val)]));
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableHost.appendChild(table);
    }

    async function loadData() {
      status.textContent = "Loading…";
      status.style.display = "";
      tableHost.innerHTML = "";
      try {
        var path = "/deliveries-register?year=" + encodeURIComponent(yearSel.value);
        var data = await ctx.api.qualityReports(path);
        status.textContent =
          (data.count != null ? data.count + " rows" : "") +
          (data.date_min && data.date_max ? " · " + data.date_min + " → " + data.date_max : "") +
          (data.through_date ? " · through " + data.through_date : "");
        renderTable(data.rows || []);
      } catch (e) {
        status.textContent = "";
        tableHost.appendChild(ui.error(String(e.message || e)));
      }
    }

    async function downloadXlsx() {
      var base = (ctx.config && ctx.config.qualityReportsApiBase) || "/quality/reports/api";
      var url =
        base +
        "/deliveries-register/export.xlsx?year=" +
        encodeURIComponent(yearSel.value);
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
      void loadData();
    });
    dlBtn.addEventListener("click", function () {
      void downloadXlsx();
    });

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
