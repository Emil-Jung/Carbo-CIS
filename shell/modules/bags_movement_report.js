/* Bags Movement — day/producer summary with drill-down to bag detail (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var STREAM_FILTERS = [
    { id: "all", label: "All streams" },
    { id: "restaurant", label: "Restaurant" },
    { id: "lumpwood", label: "Lumpwood" },
    { id: "fines", label: "Fines" },
  ];

  var STATUS_COUNTER_KEYS = [
    { id: "in_storage_weathering", label: "In Storage — weathering" },
    { id: "in_storage", label: "In Storage (weathered)" },
    { id: "on_truck_walvisbay", label: "On truck WB" },
    { id: "storage_walvisbay", label: "Storage WB" },
    { id: "in_container", label: "In container" },
    { id: "sold", label: "Sold" },
  ];

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

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function shiftDate(iso, deltaDays) {
    var parts = String(iso).split("-");
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + deltaDays);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function card(ui, label, value, extraClass) {
    var c = ui.el("div", { class: "card" + (extraClass ? " " + extraClass : "") });
    c.appendChild(ui.el("div", { class: "label" }, [label]));
    c.appendChild(ui.el("div", { class: "value" }, [value]));
    return c;
  }

  function rowMatchesFilters(row, streamFilter, statusFilter) {
    if (streamFilter !== "all" && row.product_stream !== streamFilter) return false;
    if (statusFilter === "all") return true;
    var eff = row.effective_status || row.storage_status || "in_storage";
    return eff === statusFilter;
  }

  function summaryKey(row) {
    return String(row.recorded_date || "") + "\0" + String(row.producer_name || "Unknown producer").trim();
  }

  function buildSummaryRows(rows, streamFilter, statusFilter) {
    var map = {};
    rows.forEach(function (row) {
      if (!rowMatchesFilters(row, streamFilter, statusFilter)) return;
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

  function float(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
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
      var daysClass =
        row.effective_status === "in_storage_weathering"
          ? "bags-movement-days"
          : row.weathered
            ? "bags-movement-days bags-movement-days--done"
            : "bags-movement-days";
      tr.innerHTML =
        "<td>" + ui.escape(String(i + 1)) + "</td>" +
        "<td>" + ui.escape(row.product_stream || "—") + "</td>" +
        "<td>" + fmt(row.net_weight_kg, 0) + "</td>" +
        "<td>" + ui.escape(fmtDate(row.weathering_end_date)) + "</td>" +
        "<td class='" + daysClass + "'>" + ui.escape(timerText(row)) + "</td>" +
        "<td>" + ui.escape(row.effective_status_display || row.storage_status_display || "—") + "</td>" +
        "<td class='bags-movement-tag'>" + ui.escape(row.serial || "—") + "</td>";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function renderSummaryTable(summaryRows, ui, showDateCol, onDrillDown) {
    var table = ui.el("table", { class: "data bags-movement-table bm-summary-table" });
    var head =
      "<thead><tr>" +
      (showDateCol ? "<th>Date</th>" : "") +
      "<th>Producer</th><th>Bags</th><th>R</th><th>L</th><th>F</th><th>Total kg</th>" +
      "</tr></thead>";
    table.innerHTML = head;
    var tbody = ui.el("tbody");
    summaryRows.forEach(function (group) {
      var tr = ui.el("tr", {
        class: "bm-summary-row",
        title: "Double-click to view individual bags",
      });
      var html = "";
      if (showDateCol) {
        html += "<td>" + ui.escape(fmtDate(group.recorded_date)) + "</td>";
      }
      html +=
        "<td>" + ui.escape(group.producer_name) + "</td>" +
        "<td>" + fmt(group.bags) + "</td>" +
        "<td>" + fmt(group.restaurant) + "</td>" +
        "<td>" + fmt(group.lumpwood) + "</td>" +
        "<td>" + fmt(group.fines) + "</td>" +
        "<td>" + fmt(group.kg, 0) + "</td>";
      tr.innerHTML = html;
      tr.addEventListener("dblclick", function () {
        onDrillDown(group);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function statusCounterValue(totals, key) {
    var t = totals && totals[key];
    if (!t || !t.bags) return "0";
    return (
      fmt(t.bags) +
      " (R " + fmt(t.restaurant || 0) +
      " · L " + fmt(t.lumpwood || 0) +
      " · F " + fmt(t.fines || 0) + ")"
    );
  }

  function paintReport(body, data, ui, streamFilter, statusFilter, drillDown, onStatusCardClick, onDrillDown, onDrillBack) {
    body.innerHTML = "";
    var streams = data.streams || {};
    var totals = data.status_totals || {};
    var isAll = data.scope === "all";
    var allRows = data.rows || [];

    var cards = ui.el("div", { class: "cards" });
    cards.appendChild(
      card(ui, isAll ? "All bags" : "Bags this day", fmt(data.bag_count), "card--highlight")
    );
    cards.appendChild(
      card(ui, "Restaurant", fmt((streams.restaurant && streams.restaurant.bags) || 0) + " · " + fmt((streams.restaurant && streams.restaurant.kg) || 0, 0) + " kg")
    );
    cards.appendChild(
      card(ui, "Lumpwood", fmt((streams.lumpwood && streams.lumpwood.bags) || 0) + " · " + fmt((streams.lumpwood && streams.lumpwood.kg) || 0, 0) + " kg")
    );
    cards.appendChild(
      card(ui, "Fines", fmt((streams.fines && streams.fines.bags) || 0) + " · " + fmt((streams.fines && streams.fines.kg) || 0, 0) + " kg")
    );
    cards.appendChild(card(ui, "Total net kg", fmt(data.total_kg, 0) + " kg"));
    body.appendChild(cards);

    body.appendChild(ui.el("h3", { class: "bm-subheading" }, ["By status (click to filter)"]));
    var statusCards = ui.el("div", { class: "cards bm-status-cards" });
    STATUS_COUNTER_KEYS.forEach(function (item) {
      var active = statusFilter === item.id;
      var c = card(
        ui,
        item.label,
        statusCounterValue(totals, item.id),
        "bm-status-card" + (active ? " bm-status-card--active" : "")
      );
      c.setAttribute("role", "button");
      c.tabIndex = 0;
      c.addEventListener("click", function () {
        onStatusCardClick(statusFilter === item.id ? "all" : item.id);
      });
      statusCards.appendChild(c);
    });
    var totalBucket = totals.total || {};
    statusCards.appendChild(
      card(ui, "Total", fmt(totalBucket.bags || data.bag_count || 0), "bm-status-card bm-status-card--total")
    );
    body.appendChild(statusCards);

    if (drillDown) {
      var panel = ui.el("div", { class: "bm-drill-panel" });
      var backBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm bm-drill-back" }, ["← Back to summary"]);
      backBtn.addEventListener("click", onDrillBack);
      panel.appendChild(backBtn);
      var titleParts = [drillDown.producer_name];
      if (isAll && drillDown.recorded_date) {
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

    var summaryRows = buildSummaryRows(allRows, streamFilter, statusFilter);
    body.appendChild(
      ui.el("h3", { class: "bm-subheading" }, [
        isAll ? "Summary by day and producer" : "Summary by producer",
      ])
    );
    body.appendChild(
      ui.el("p", { class: "muted bm-hint" }, ["Double-click a row to open bag-level detail."])
    );

    if (!summaryRows.length) {
      body.appendChild(ui.el("p", { class: "muted" }, ["No bags match the selected filters."]));
    } else {
      body.appendChild(renderSummaryTable(summaryRows, ui, isAll, onDrillDown));
    }

    body.appendChild(
      ui.el("p", { class: "muted bm-footer-note" }, [
        isAll
          ? "All recorded bags grouped by scan date and producer. "
          : "Bags scanned on " + fmtDate(data.date) + ", grouped by producer. ",
        "Status filters apply to both the summary counts and drill-down detail.",
      ])
    );
  }

  function buildFilterBar(ui, items, activeId, className) {
    var bar = ui.el("div", { class: "toolbar bm-filter-bar " + (className || "") });
    var btns = ui.el("div", { class: "bm-filter-btns" });
    items.forEach(function (item) {
      btns.appendChild(ui.el("button", {
        type: "button",
        class: "btn-ghost btn-sm bm-filter-btn" + (item.id === activeId ? " bm-filter-btn--active" : ""),
        "data-filter-id": item.id,
      }, [item.label]));
    });
    bar.appendChild(btns);
    return { bar: bar, btns: btns };
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var scope = "all";
    var streamFilter = "all";
    var statusFilter = "all";
    var lastData = null;
    var drillDown = null;

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Bags Movement"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Bag stock by day and producer. Double-click a producer row to see individual bags.",
    ]));

    var scopeBar = ui.el("div", { class: "toolbar bm-scope-bar" });
    var scopeAllBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm bm-scope-btn bm-scope-btn--active", "data-scope": "all" }, ["All bags"]);
    var scopeDayBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm bm-scope-btn", "data-scope": "day" }, ["Single day"]);
    scopeBar.appendChild(scopeAllBtn);
    scopeBar.appendChild(scopeDayBtn);
    container.appendChild(scopeBar);

    var toolbar = ui.el("div", { class: "toolbar bm-toolbar" });
    toolbar.appendChild(ui.el("label", { for: "bags-movement-date" }, ["Date"]));
    var dateInput = ui.el("input", { id: "bags-movement-date", type: "date", value: todayIso(), disabled: true });
    toolbar.appendChild(dateInput);
    var prevBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm", id: "bm-prev", disabled: true }, ["Previous day"]);
    var nextBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm", id: "bm-next", disabled: true }, ["Next day"]);
    var todayBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm", id: "bm-today", disabled: true }, ["Today"]);
    toolbar.appendChild(prevBtn);
    toolbar.appendChild(nextBtn);
    toolbar.appendChild(todayBtn);
    container.appendChild(toolbar);

    var streamFilterUi = buildFilterBar(ui, STREAM_FILTERS, streamFilter, "bm-stream-filters");
    streamFilterUi.bar.insertBefore(ui.el("span", { class: "bm-filter-label" }, ["Stream:"]), streamFilterUi.btns);
    container.appendChild(streamFilterUi.bar);

    function setScope(next) {
      scope = next;
      drillDown = null;
      var dayMode = scope === "day";
      scopeAllBtn.classList.toggle("bm-scope-btn--active", !dayMode);
      scopeDayBtn.classList.toggle("bm-scope-btn--active", dayMode);
      dateInput.disabled = !dayMode;
      prevBtn.disabled = !dayMode;
      nextBtn.disabled = !dayMode;
      todayBtn.disabled = !dayMode;
      loadReport();
    }

    scopeAllBtn.addEventListener("click", function () { setScope("all"); });
    scopeDayBtn.addEventListener("click", function () { setScope("day"); });

    function syncFilterButtons() {
      streamFilterUi.btns.querySelectorAll(".bm-filter-btn").forEach(function (btn) {
        btn.classList.toggle("bm-filter-btn--active", btn.getAttribute("data-filter-id") === streamFilter);
      });
    }

    function repaint() {
      if (!lastData) return;
      if (drillDown) {
        var refreshed = buildSummaryRows(lastData.rows || [], streamFilter, statusFilter);
        var match = refreshed.find(function (g) { return g.key === drillDown.key; });
        drillDown = match || null;
      }
      paintReport(
        body,
        lastData,
        ui,
        streamFilter,
        statusFilter,
        drillDown,
        function (nextStatus) {
          statusFilter = nextStatus;
          drillDown = null;
          repaint();
        },
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

    streamFilterUi.btns.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".bm-filter-btn");
      if (!btn) return;
      streamFilter = btn.getAttribute("data-filter-id") || "all";
      drillDown = null;
      syncFilterButtons();
      repaint();
    });

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    container.appendChild(status);
    var body = ui.el("div", { class: "report-body" });
    container.appendChild(body);

    function reportUrl() {
      if (scope === "day") {
        return "/reports/bags-movement?scope=day&date=" + encodeURIComponent(dateInput.value || todayIso());
      }
      return "/reports/bags-movement?scope=all";
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
        lastData = await ctx.api.traceability(reportUrl());
        status.style.display = "none";
        repaint();
      } catch (e) {
        lastData = null;
        status.textContent = "";
        body.appendChild(ui.error("Could not load report: " + (e.message || e)));
      }
    }

    dateInput.addEventListener("change", function () {
      if (scope === "day") loadReport();
    });
    prevBtn.addEventListener("click", function () {
      dateInput.value = shiftDate(dateInput.value || todayIso(), -1);
      loadReport();
    });
    nextBtn.addEventListener("click", function () {
      dateInput.value = shiftDate(dateInput.value || todayIso(), 1);
      loadReport();
    });
    todayBtn.addEventListener("click", function () {
      dateInput.value = todayIso();
      loadReport();
    });

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
