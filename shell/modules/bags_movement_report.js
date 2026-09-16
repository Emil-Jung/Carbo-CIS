/* Bags Movement — cumulative bag stock + optional single-day view (CIS). */
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

  var STATUS_FILTERS = [
    { id: "all", label: "All statuses" },
    { id: "in_storage", label: "In storage" },
    { id: "sold", label: "Sold / weathered" },
    { id: "on_truck_walvisbay", label: "On truck Walvis Bay" },
    { id: "storage_walvisbay", label: "Storage Walvis Bay" },
    { id: "in_container", label: "In container" },
  ];

  var STATUS_COUNTER_KEYS = [
    { id: "in_storage", label: "In storage" },
    { id: "sold", label: "Sold / weathered" },
    { id: "on_truck_walvisbay", label: "On truck WB" },
    { id: "storage_walvisbay", label: "Storage WB" },
    { id: "in_container", label: "In container" },
  ];

  var STREAM_TITLES = {
    restaurant: "Restaurant",
    lumpwood: "Lumpwood",
    fines: "Fines",
  };

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

  function renderTable(rows, ui, showScannedDate) {
    var table = ui.el("table", { class: "data bags-movement-table" });
    var head =
      "<thead><tr><th>#</th><th>Producer</th>" +
      (showScannedDate ? "<th>Scanned</th>" : "") +
      "<th>Net kg</th><th>Weathering start</th><th>Weathering end</th><th>Timer</th>" +
      "<th>Status</th><th>Tag</th></tr></thead>";
    table.innerHTML = head;
    var tbody = ui.el("tbody");
    rows.forEach(function (row, i) {
      var tr = ui.el("tr");
      var timerText;
      if (row.effective_status === "sold" && row.status_is_computed) {
        timerText = "Sold (weathered)";
      } else if (row.weathered) {
        timerText = "Weathered";
      } else {
        timerText = String(row.days_remaining) + " days left";
      }
      var daysClass = row.weathered ? "bags-movement-days bags-movement-days--done" : "bags-movement-days";
      var html =
        "<td>" + ui.escape(String(i + 1)) + "</td>" +
        "<td>" + ui.escape(row.producer_name || "—") + "</td>";
      if (showScannedDate) {
        html += "<td>" + ui.escape(fmtDate(row.recorded_date)) + "</td>";
      }
      html +=
        "<td>" + fmt(row.net_weight_kg, 0) + "</td>" +
        "<td>" + ui.escape(fmtDate(row.weathering_start_date)) + "</td>" +
        "<td>" + ui.escape(fmtDate(row.weathering_end_date)) + "</td>" +
        "<td class='" + daysClass + "'>" + ui.escape(timerText) + "</td>" +
        "<td>" + ui.escape(row.effective_status_display || row.storage_status_display || "—") + "</td>" +
        "<td class='bags-movement-tag'>" + ui.escape(row.serial || "—") + "</td>";
      tr.innerHTML = html;
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

  function paintReport(body, data, ui, streamFilter, statusFilter, onStatusCardClick) {
    body.innerHTML = "";
    var streams = data.streams || {};
    var sections = data.stream_sections || [];
    var totals = data.status_totals || {};
    var isAll = data.scope === "all";

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

    body.appendChild(ui.el("h3", { class: "bm-subheading" }, ["By status (click to filter list)"]));
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

    var any = false;
    sections.forEach(function (section) {
      if (streamFilter !== "all" && section.stream !== streamFilter) return;
      var rows = (section.rows || []).filter(function (row) {
        return rowMatchesFilters(row, "all", statusFilter);
      });
      if (!rows.length) return;
      any = true;
      var title = STREAM_TITLES[section.stream] || section.stream;
      body.appendChild(
        ui.el("h3", { class: "bm-stream-heading bm-stream-heading--" + section.stream }, [
          title + " — " + rows.length + " bag(s) · " +
            fmt(rows.reduce(function (s, r) { return s + (r.net_weight_kg || 0); }, 0), 0) + " kg",
        ])
      );
      body.appendChild(renderTable(rows, ui, isAll));
    });

    if (!any) {
      body.appendChild(ui.el("p", { class: "muted" }, ["No bags match the selected filters."]));
    }

    body.appendChild(
      ui.el("p", { class: "muted" }, [
        isAll
          ? "Showing all recorded bags. Counters are cumulative across every scan date. "
          : "Showing bags scanned on " + fmtDate(data.date) + ". ",
        "After " + String(data.weathering_days || 21) +
          " days weathering, in-storage bags count as Sold / weathered until scanned to a new location.",
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

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Bags Movement"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Cumulative bag stock with status counters. Switch to single day to see only bags scanned on that date.",
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

    var statusFilterUi = buildFilterBar(ui, STATUS_FILTERS, statusFilter, "bm-status-filters");
    statusFilterUi.bar.insertBefore(ui.el("span", { class: "bm-filter-label" }, ["Status:"]), statusFilterUi.btns);
    container.appendChild(statusFilterUi.bar);

    function setScope(next) {
      scope = next;
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
      statusFilterUi.btns.querySelectorAll(".bm-filter-btn").forEach(function (btn) {
        btn.classList.toggle("bm-filter-btn--active", btn.getAttribute("data-filter-id") === statusFilter);
      });
    }

    function repaint() {
      if (!lastData) return;
      paintReport(body, lastData, ui, streamFilter, statusFilter, function (nextStatus) {
        statusFilter = nextStatus;
        syncFilterButtons();
        repaint();
      });
    }

    streamFilterUi.btns.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".bm-filter-btn");
      if (!btn) return;
      streamFilter = btn.getAttribute("data-filter-id") || "all";
      syncFilterButtons();
      repaint();
    });
    statusFilterUi.btns.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".bm-filter-btn");
      if (!btn) return;
      statusFilter = btn.getAttribute("data-filter-id") || "all";
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
    description: "Cumulative bag stock — stream and status counters",
    requires: "traceability.bags_movement",
    requiresAny: ["traceability.bags_movement", "traceability.stock.view"],
    render: render,
  });
})();
