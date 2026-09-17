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

  var STREAM_ORDER = { restaurant: 0, lumpwood: 1, fines: 2 };

  function streamSortRank(stream) {
    var key = String(stream || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(STREAM_ORDER, key) ? STREAM_ORDER[key] : 99;
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
        var rx = streamSortRank(x.product_stream);
        var ry = streamSortRank(y.product_stream);
        if (rx !== ry) return rx - ry;
        return String(x.serial || "").localeCompare(String(y.serial || ""));
      });
    });
    return list;
  }

  var SUPPLIER_MODE_FSC = {
    carbo_fsc: "FSC Carbo",
    noncarbo_fsc: "FSC Other",
    non_fsc: "Non-FSC",
    unknown: "Unknown",
  };

  function normalizeFscLabel(raw) {
    var text = String(raw || "").trim();
    if (!text || text === "—") return "";
    var key = text.toUpperCase().replace(/[\s-]+/g, "_");
    if (key === "FSC_CARBO" || (key.indexOf("FSC") >= 0 && key.indexOf("CARBO") >= 0)) return "FSC Carbo";
    if (key === "FSC_OTHER" || (key.indexOf("FSC") >= 0 && key.indexOf("OTHER") >= 0)) return "FSC Other";
    if (key === "NON_FSC" || key === "NONFSC" || text.toLowerCase().replace(/-/g, " ") === "non fsc") {
      return "Non-FSC";
    }
    return text;
  }

  function fscText(row) {
    var label = normalizeFscLabel(row.fsc_status);
    if (label) return label;
    label = normalizeFscLabel(row.fsc_classification);
    if (label) return label;
    var snap = row.producer_snapshot;
    if (snap && typeof snap === "string") {
      try { snap = JSON.parse(snap); } catch (e) { snap = null; }
    }
    if (snap && snap.classification) {
      label = normalizeFscLabel(snap.classification);
      if (label) return label;
    }
    var mode = String(row.supplier_mode || "").toLowerCase();
    if (SUPPLIER_MODE_FSC[mode]) return SUPPLIER_MODE_FSC[mode];
    if (row.is_fsc === true) return "FSC";
    if (row.is_fsc === false) return "Non-FSC";
    return "—";
  }

  function groupFscText(group) {
    var labels = {};
    (group.detail_rows || []).forEach(function (row) {
      var label = fscText(row);
      if (label && label !== "—") labels[label] = true;
    });
    var unique = Object.keys(labels).sort();
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) return unique.join(", ");
    return "—";
  }

  function timerText(row) {
    if (row.effective_status === "in_storage_weathering") {
      return String(row.days_remaining) + " days left";
    }
    if (row.effective_status === "in_storage" && row.weathered) return "Weathered";
    if (row.weathered) return "Weathered";
    return "—";
  }

  var SUMMARY_COLGROUP =
    "<colgroup>" +
    "<col class='bm-col-producer'>" +
    "<col class='bm-col-fsc'>" +
    "<col class='bm-col-num'>" +
    "<col class='bm-col-num'>" +
    "<col class='bm-col-num'>" +
    "<col class='bm-col-num'>" +
    "<col class='bm-col-kg'>" +
    "</colgroup>";

  var DETAIL_COLGROUP =
    "<colgroup>" +
    "<col class='bm-col-seq'>" +
    "<col class='bm-col-stream'>" +
    "<col class='bm-col-kg'>" +
    "<col class='bm-col-date'>" +
    "<col class='bm-col-timer'>" +
    "<col class='bm-col-status'>" +
    "<col class='bm-col-fsc'>" +
    "<col class='bm-col-tag'>" +
    "</colgroup>";

  function renderDetailTable(rows, ui) {
    var table = ui.el("table", { class: "data bags-movement-table bags-movement-table--compact bm-detail-table" });
    table.innerHTML =
      DETAIL_COLGROUP +
      "<thead><tr>" +
      "<th class='bm-num'>#</th><th>Stream</th><th class='bm-num'>Net kg</th><th>Weathering end</th>" +
      "<th>Timer</th><th>Status</th><th>FSC</th><th>Tag</th></tr></thead>";
    var tbody = ui.el("tbody");
    rows.forEach(function (row, i) {
      var tr = ui.el("tr");
      tr.innerHTML =
        "<td class='bm-num'>" + ui.escape(String(i + 1)) + "</td>" +
        "<td>" + ui.escape(row.product_stream || "—") + "</td>" +
        "<td class='bm-num'>" + fmt(row.net_weight_kg, 0) + "</td>" +
        "<td>" + ui.escape(fmtDate(row.weathering_end_date)) + "</td>" +
        "<td>" + ui.escape(timerText(row)) + "</td>" +
        "<td>" + ui.escape(row.effective_status_display || row.storage_status_display || "—") + "</td>" +
        "<td class='bm-fsc'>" + ui.escape(fscText(row)) + "</td>" +
        "<td class='bags-movement-tag bm-col-tag'>" + ui.escape(row.serial || "—") + "</td>";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  var BM_UI_VERSION = "1.4.9";

  var RETURN_BTN_STYLE =
    "display:block;width:100%;margin:0 0 10px;padding:18px 22px;font-size:1.25rem;font-weight:700;" +
    "line-height:1.3;color:#1a1200;cursor:pointer;text-align:center;" +
    "background:linear-gradient(180deg,#e4c04a,#c9a227);border:2px solid #8a7420;border-radius:10px;" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.25);";

  function openDrillDown(group, onDrillDown) {
    if (group) onDrillDown(group);
  }

  function buildDaySections(summaryRows) {
    var byDay = {};
    summaryRows.forEach(function (group) {
      var day = group.recorded_date || "";
      if (!byDay[day]) {
        byDay[day] = { date: day, producers: [], bags: 0, kg: 0 };
      }
      var section = byDay[day];
      section.producers.push(group);
      section.bags += group.bags;
      section.kg += group.kg;
    });
    var sections = Object.keys(byDay).map(function (k) {
      var s = byDay[k];
      s.kg = Math.round(s.kg * 1000) / 1000;
      s.producers.sort(function (a, b) {
        return (a.producer_name || "").localeCompare(b.producer_name || "", undefined, { sensitivity: "base" });
      });
      return s;
    });
    sections.sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });
    return sections;
  }

  function renderProducerTable(producers, ui, onDrillDown) {
    var table = ui.el("table", { class: "data bags-movement-table bm-summary-table" });
    table.innerHTML =
      SUMMARY_COLGROUP +
      "<thead><tr>" +
      "<th>Producer</th><th>FSC</th>" +
      "<th class='bm-num' title='Bag count'>Bags</th>" +
      "<th class='bm-num' title='Restaurant'>R</th>" +
      "<th class='bm-num' title='Lumpwood'>L</th>" +
      "<th class='bm-num' title='Fines'>Fn</th>" +
      "<th class='bm-num'>Total kg</th>" +
      "</tr></thead>";
    var tbody = ui.el("tbody");
    producers.forEach(function (group) {
      var tr = ui.el("tr", {
        class: "bm-summary-row",
        title: "Click to view individual bags",
      });
      tr.style.cursor = "pointer";
      tr.innerHTML =
        "<td class='bm-producer'>" + ui.escape(group.producer_name) + "</td>" +
        "<td class='bm-fsc'>" + ui.escape(groupFscText(group)) + "</td>" +
        "<td class='bm-num'>" + fmt(group.bags) + "</td>" +
        "<td class='bm-num'>" + fmt(group.restaurant) + "</td>" +
        "<td class='bm-num'>" + fmt(group.lumpwood) + "</td>" +
        "<td class='bm-num'>" + fmt(group.fines) + "</td>" +
        "<td class='bm-num'>" + fmt(group.kg, 0) + "</td>";
      Array.from(tr.children).forEach(function (td) {
        td.style.cursor = "pointer";
      });
      tr.addEventListener("click", function () {
        openDrillDown(group, onDrillDown);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function renderDaySections(summaryRows, ui, onDrillDown) {
    var wrap = ui.el("div", { class: "bm-day-sections" });
    buildDaySections(summaryRows).forEach(function (section) {
      var block = ui.el("section", { class: "bm-day-section" });
      block.appendChild(
        ui.el("h3", { class: "bm-day-heading" }, [
          fmtDate(section.date) +
            " — " + fmt(section.bags) + " bag(s) · " +
            fmt(section.producers.length) + " producer(s) · " +
            fmt(section.kg, 0) + " kg",
        ])
      );
      block.appendChild(renderProducerTable(section.producers, ui, onDrillDown));
      wrap.appendChild(block);
    });
    return wrap;
  }

  function paintDrillHeader(slot, drillDown, ui, onDrillBack) {
    slot.innerHTML = "";
    slot.style.display = "none";
    if (!drillDown) return;

    slot.style.display = "block";
    var backBtn = ui.el("button", {
      type: "button",
      class: "bm-return-btn",
    }, ["← Return to producer summary"]);
    backBtn.setAttribute("style", RETURN_BTN_STYLE);
    backBtn.addEventListener("click", onDrillBack);
    slot.appendChild(backBtn);
    slot.appendChild(
      ui.el("p", { class: "bm-return-hint" }, [
        "This returns to the day/producer list. The Back button at the top of CIS goes to the main menu.",
      ])
    );
    try {
      slot.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch (e) {
      slot.scrollIntoView(true);
    }
  }

  function paintReport(body, data, ui, drillDown, onDrillDown) {
    body.innerHTML = "";
    var allRows = data.rows || [];

    if (drillDown) {
      var panel = ui.el("div", { class: "bm-drill-panel" });
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
      ui.el("p", { class: "muted bm-hint" }, ["Click a row to open bag detail for that producer and day."])
    );

    var summaryRows = buildSummaryRows(allRows);
    if (!summaryRows.length) {
      body.appendChild(ui.el("p", { class: "muted" }, ["No bags recorded yet."]));
    } else {
      body.appendChild(renderDaySections(summaryRows, ui, onDrillDown));
    }
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var lastData = null;
    var drillDown = null;

    var drillHeader = ui.el("div", { class: "bm-drill-header", style: "display:none" });
    container.insertBefore(drillHeader, container.firstChild);

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Bags Movement"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "All recorded bags, grouped by scan date and producer. UI " + BM_UI_VERSION + ".",
    ]));

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    container.appendChild(status);
    var body = ui.el("div", { class: "report-body bm-report-body" });
    container.appendChild(body);

    function onDrillBack() {
      drillDown = null;
      repaint();
    }

    function repaint() {
      if (!lastData) return;
      if (drillDown) {
        var refreshed = buildSummaryRows(lastData.rows || []);
        var match = refreshed.find(function (g) { return g.key === drillDown.key; });
        drillDown = match || null;
      }
      paintDrillHeader(drillHeader, drillDown, ui, onDrillBack);
      paintReport(
        body,
        lastData,
        ui,
        drillDown,
        function (group) {
          drillDown = group;
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
