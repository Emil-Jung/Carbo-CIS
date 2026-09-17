/* Bags Movement — day/producer summary with drill-down to bag detail (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function fmt(n, d) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString(undefined, {
      minimumFractionDigits: d || 0,
      maximumFractionDigits: d || 0,
    });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + " " + monthShort(parts[1]) + " " + parts[0];
  }

  function monthShort(m) {
    var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return names[parseInt(m, 10) - 1] || m;
  }

  function float(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function summaryKey(row) {
    return String(row.recorded_date || "") + "\0" + String(row.producer_name || "Unknown producer").trim();
  }

  function buildSummaryRows(rows) {
    var map = {};
    rows.forEach(function (row) {
      var key = summaryKey(row);
      if (!map[key]) {
        map[key] = {
          key: key,
          recorded_date: row.recorded_date,
          producer_name: row.producer_name || "Unknown producer",
          bags: 0,
          restaurant: 0,
          lumpwood: 0,
          fines: 0,
          kg: 0,
          detail_rows: [],
        };
      }
      var g = map[key];
      g.bags += 1;
      g.kg += float(row.net_weight_kg);
      if (row.product_stream === "restaurant") g.restaurant += 1;
      else if (row.product_stream === "lumpwood") g.lumpwood += 1;
      else if (row.product_stream === "fines") g.fines += 1;
      g.detail_rows.push(row);
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) {
      var da = a.recorded_date || "";
      var db = b.recorded_date || "";
      if (da !== db) return db.localeCompare(da);
      return (a.producer_name || "").localeCompare(b.producer_name || "", undefined, { sensitivity: "base" });
    });
    list.forEach(function (g) {
      g.kg = Math.round(g.kg * 1000) / 1000;
      g.detail_rows.sort(function (x, y) {
        var sx = x.product_stream || "";
        var sy = y.product_stream || "";
        if (sx !== sy) return sx.localeCompare(sy);
        return String(x.serial || "").localeCompare(String(y.serial || ""));
      });
    });
    return list;
  }

  function timerText(row) {
    if (row.effective_status === "in_storage_weathering") {
      return String(row.days_remaining) + " days left";
    }
    if (row.effective_status === "in_storage" && row.weathered) return "Weathered";
    if (row.weathered) return "Weathered";
    return "—";
  }

  function renderDetailTable(rows, ui) {
    var table = ui.el("table", { class: "data bags-movement-table bags-movement-table--compact" });
    table.innerHTML =
      "<thead><tr><th>#</th><th>Stream</th><th>Net kg</th><th>Weathering end</th>" +
      "<th>Timer</th><th>Status</th><th>Tag</th></tr></thead>";
    var tbody = ui.el("tbody");
    rows.forEach(function (row, i) {
      var tr = ui.el("tr");
      tr.innerHTML =
        "<td>" + ui.escape(String(i + 1)) + "</td>" +
        "<td>" + ui.escape(row.product_stream || "—") + "</td>" +
        "<td>" + fmt(row.net_weight_kg, 0) + "</td>" +
        "<td>" + ui.escape(fmtDate(row.weathering_end_date)) + "</td>" +
        "<td>" + ui.escape(timerText(row)) + "</td>" +
        "<td>" + ui.escape(row.effective_status_display || row.storage_status_display || "—") + "</td>" +
        "<td class='bags-movement-tag'>" + ui.escape(row.serial || "—") + "</td>";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function renderSummaryTable(summaryRows, ui, onDrillDown) {
    var table = ui.el("table", { class: "data bags-movement-table bm-summary-table" });
    table.innerHTML =
      "<thead><tr><th>Date</th><th>Producer</th><th>Bags</th><th>R</th><th>L</th><th>F</th><th>Total kg</th></tr></thead>";
    var tbody = ui.el("tbody");
    summaryRows.forEach(function (group) {
      var tr = ui.el("tr", {
        class: "bm-summary-row",
        title: "Double-click to view individual bags",
      });
      tr.innerHTML =
        "<td>" + ui.escape(fmtDate(group.recorded_date)) + "</td>" +
        "<td>" + ui.escape(group.producer_name) + "</td>" +
        "<td>" + fmt(group.bags) + "</td>" +
        "<td>" + fmt(group.restaurant) + "</td>" +
        "<td>" + fmt(group.lumpwood) + "</td>" +
        "<td>" + fmt(group.fines) + "</td>" +
        "<td>" + fmt(group.kg, 0) + "</td>";
      tr.addEventListener("dblclick", function () {
        onDrillDown(group);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function paintReport(body, data, ui, drillDown, onDrillDown, onDrillBack) {
    body.innerHTML = "";
    var allRows = data.rows || [];

    if (drillDown) {
      var panel = ui.el("div", { class: "bm-drill-panel" });
      var returnBar = ui.el("div", { class: "bm-return-bar" });
      var backBtn = ui.el("button", {
        type: "button",
        class: "bm-return-btn",
      }, ["← Return to producer summary"]);
      backBtn.addEventListener("click", onDrillBack);
      returnBar.appendChild(backBtn);
      returnBar.appendChild(
        ui.el("p", { class: "bm-return-hint" }, [
          "Use this button to stay in Bags Movement. The Back control at the top of CIS returns to the main menu.",
        ])
      );
      panel.appendChild(returnBar);

      var titleParts = [drillDown.producer_name];
      if (drillDown.recorded_date) {
        titleParts.push(fmtDate(drillDown.recorded_date));
      }
      panel.appendChild(
        ui.el("h3", { class: "bm-drill-title" }, [
          titleParts.join(" · ") + " — " + fmt(drillDown.bags) + " bag(s) · " + fmt(drillDown.kg, 0) + " kg",
        ])
      );
      panel.appendChild(renderDetailTable(drillDown.detail_rows || [], ui));
      body.appendChild(panel);
      return;
    }

    body.appendChild(
      ui.el("p", { class: "bm-totals-line" }, [
        fmt(data.bag_count) + " bags · " + fmt(data.total_kg, 0) + " kg total",
      ])
    );
    body.appendChild(
      ui.el("p", { class: "muted bm-hint" }, ["Double-click a row to open bag detail for that producer and day."])
    );

    var summaryRows = buildSummaryRows(allRows);
    if (!summaryRows.length) {
      body.appendChild(ui.el("p", { class: "muted" }, ["No bags recorded yet."]));
    } else {
      body.appendChild(renderSummaryTable(summaryRows, ui, onDrillDown));
    }
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var lastData = null;
    var drillDown = null;

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Bags Movement"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "All recorded bags, grouped by scan date and producer.",
    ]));

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    container.appendChild(status);
    var body = ui.el("div", { class: "report-body bm-report-body" });
    container.appendChild(body);

    function repaint() {
      if (!lastData) return;
      if (drillDown) {
        var refreshed = buildSummaryRows(lastData.rows || []);
        var match = refreshed.find(function (g) { return g.key === drillDown.key; });
        drillDown = match || null;
      }
      paintReport(
        body,
        lastData,
        ui,
        drillDown,
        function (group) {
          drillDown = group;
          repaint();
        },
        function () {
          drillDown = null;
          repaint();
        }
      );
    }

    async function loadReport() {
      status.textContent = "Loading…";
      status.style.display = "";
      body.innerHTML = "";
      drillDown = null;
      if (!ctx.api.traceability) {
        status.style.display = "none";
        body.appendChild(ui.error("Traceability API is not configured in CIS."));
        return;
      }
      try {
        lastData = await ctx.api.traceability("/reports/bags-movement?scope=all");
        status.style.display = "none";
        repaint();
      } catch (e) {
        lastData = null;
        status.textContent = "";
        body.appendChild(ui.error("Could not load report: " + (e.message || e)));
      }
    }

    await loadReport();
  }

  CIS.modules.push({
    id: "bags_movement_report",
    title: "Bags Movement",
    section: "Production",
    kind: "lookup",
    order: 16,
    icon: "bags",
    description: "Bag stock by day and producer — drill down to individual bags",
    requires: "traceability.bags_movement",
    requiresAny: ["traceability.bags_movement", "traceability.stock.view"],
    render: render,
  });
})();
