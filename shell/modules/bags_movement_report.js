/* Bags Created — day/producer summary with drill-down to bag detail (CIS).
   Module id and permission keys stay bags_movement / stock.view so existing
   grants keep working; only the label changed. */
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

  var DISPLAY_TZ = "Africa/Windhoek";

  function fmtDate(iso) {
    if (!iso) return "—";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + " " + monthShort(parts[1]) + " " + parts[0];
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleTimeString("en-GB", {
        timeZone: DISPLAY_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch (e) {
      return "—";
    }
  }

  function detailRowsByRecorded(rows, newestFirst) {
    return (rows || []).slice().sort(function (a, b) {
      var ta = a.recorded_at || "";
      var tb = b.recorded_at || "";
      if (ta !== tb) return newestFirst ? tb.localeCompare(ta) : ta.localeCompare(tb);
      return String(a.serial || "").localeCompare(String(b.serial || ""));
    });
  }

  /** Latest bag scan in a producer/day group — drives summary table order. */
  function latestRecordedAt(group) {
    var latest = "";
    (group.detail_rows || []).forEach(function (row) {
      var t = row.recorded_at || "";
      if (t > latest) latest = t;
    });
    return latest;
  }

  function compareProducerGroupsByScanOrder(a, b) {
    var da = a.recorded_date || "";
    var db = b.recorded_date || "";
    if (da !== db) return db.localeCompare(da);
    return latestRecordedAt(b).localeCompare(latestRecordedAt(a));
  }

  function sievingTimeSpan(rows) {
    var stamps = detailRowsByRecorded(rows, false)
      .map(function (r) { return r.recorded_at; })
      .filter(Boolean);
    if (!stamps.length) return "";
    if (stamps.length === 1) return "Recorded " + fmtTime(stamps[0]);
    return "Sieving " + fmtTime(stamps[0]) + " \u2192 " + fmtTime(stamps[stamps.length - 1]);
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

  var STREAM_META = [
    { key: "restaurant", label: "Restaurant", color: "#e57373" },
    { key: "lumpwood", label: "Lumpwood", color: "#81c784" },
    { key: "fines", label: "Fines", color: "#ffb74d" },
  ];

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
    list.sort(compareProducerGroupsByScanOrder);
    list.forEach(function (g) {
      g.kg = Math.round(g.kg * 1000) / 1000;
      g.detail_rows = detailRowsByRecorded(g.detail_rows, true);
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
    "<col class='bm-col-time'>" +
    "<col class='bm-col-date'>" +
    "<col class='bm-col-timer'>" +
    "<col class='bm-col-status'>" +
    "<col class='bm-col-fsc'>" +
    "<col class='bm-col-tag'>" +
    "</colgroup>";

  function renderDetailTable(rows, ui) {
    var ordered = detailRowsByRecorded(rows, true);
    var table = ui.el("table", { class: "data bags-movement-table bags-movement-table--compact bm-detail-table" });
    table.innerHTML =
      DETAIL_COLGROUP +
      "<thead><tr>" +
      "<th class='bm-num'>#</th><th>Stream</th><th class='bm-num'>Net kg</th>" +
      "<th class='bm-num' title='Recorded time (Windhoek)'>Time</th><th>Weathering end</th>" +
      "<th>Timer</th><th>Status</th><th>FSC</th><th>Tag</th></tr></thead>";
    var tbody = ui.el("tbody");
    ordered.forEach(function (row, i) {
      var tr = ui.el("tr");
      tr.innerHTML =
        "<td class='bm-num'>" + ui.escape(String(i + 1)) + "</td>" +
        "<td>" + ui.escape(row.product_stream || "—") + "</td>" +
        "<td class='bm-num'>" + fmt(row.net_weight_kg, 0) + "</td>" +
        "<td class='bm-num bm-time'>" + ui.escape(fmtTime(row.recorded_at)) + "</td>" +
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

  var BM_UI_VERSION = "1.5.5";

  function summaryCard(ui, label, value, className) {
    var c = ui.el("div", { class: "card" + (className ? " " + className : "") });
    c.appendChild(ui.el("div", { class: "label" }, [label]));
    c.appendChild(ui.el("div", { class: "value" }, [value]));
    return c;
  }

  function renderLabelInventoryPanel(inv, ui) {
    if (!inv) return null;
    var panel = ui.el("section", { class: "bm-label-inventory-panel bm-cumulative-panel" });
    panel.appendChild(ui.el("h3", { class: "bm-panel-title" }, ["Bag label stock"]));
    panel.appendChild(
      ui.el("p", { class: "bm-panel-lead" }, [
        "Printed labels registered as available versus labels already used on recorded bags.",
      ])
    );
    var cards = ui.el("div", { class: "cards bm-status-cards" });
    cards.appendChild(
      summaryCard(ui, "Available (printed, unused)", fmt(inv.available), "card-ok")
    );
    cards.appendChild(
      summaryCard(ui, "Used (assigned to bags)", fmt(inv.used), "bm-status-card--total")
    );
    if ((inv.allocated || 0) > 0) {
      cards.appendChild(
        summaryCard(ui, "Allocated (awaiting print)", fmt(inv.allocated), "card-warn")
      );
    }
    if ((inv.void || 0) > 0) {
      cards.appendChild(summaryCard(ui, "Void", fmt(inv.void), "card-danger"));
    }
    panel.appendChild(cards);
    var available = inv.available || 0;
    var used = inv.used || 0;
    var active = available + used;
    if (active > 0) {
      var pct = Math.round((available / active) * 100);
      panel.appendChild(
        ui.el("p", { class: "muted bm-label-ratio" }, [
          fmt(available) + " of " + fmt(active) + " issued labels still unused (" + pct + "%).",
        ])
      );
    }
    if (inv.total != null) {
      panel.appendChild(
        ui.el("p", { class: "muted bm-label-total" }, [
          fmt(inv.total) + " labels allocated in the registry (all statuses).",
        ])
      );
    }
    return panel;
  }

  var RETURN_BTN_STYLE =
    "display:block;width:100%;margin:0 0 10px;padding:18px 22px;font-size:1.25rem;font-weight:700;" +
    "line-height:1.3;color:#1a1200;cursor:pointer;text-align:center;" +
    "background:linear-gradient(180deg,#e4c04a,#c9a227);border:2px solid #8a7420;border-radius:10px;" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.25);";

  function openDrillDown(group, onDrillDown) {
    if (group) onDrillDown(group);
  }

  function emptyStreamTotals() {
    return {
      restaurant: 0,
      lumpwood: 0,
      fines: 0,
      restaurant_kg: 0,
      lumpwood_kg: 0,
      fines_kg: 0,
    };
  }

  function addRowToStreamTotals(totals, row) {
    var stream = row.product_stream;
    var kg = float(row.net_weight_kg);
    if (stream === "restaurant") {
      totals.restaurant += 1;
      totals.restaurant_kg += kg;
    } else if (stream === "lumpwood") {
      totals.lumpwood += 1;
      totals.lumpwood_kg += kg;
    } else if (stream === "fines") {
      totals.fines += 1;
      totals.fines_kg += kg;
    }
  }

  function streamTotalsFromRows(rows) {
    var totals = emptyStreamTotals();
    (rows || []).forEach(function (row) {
      addRowToStreamTotals(totals, row);
    });
    totals.restaurant_kg = Math.round(totals.restaurant_kg * 1000) / 1000;
    totals.lumpwood_kg = Math.round(totals.lumpwood_kg * 1000) / 1000;
    totals.fines_kg = Math.round(totals.fines_kg * 1000) / 1000;
    return totals;
  }

  function streamBagTotal(totals) {
    return totals.restaurant + totals.lumpwood + totals.fines;
  }

  function polar(cx, cy, r, deg) {
    var rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function donutSegment(cx, cy, rOuter, rInner, startAngle, endAngle) {
    if (endAngle - startAngle >= 359.99) {
      endAngle = startAngle + 359.99;
    }
    var so = polar(cx, cy, rOuter, startAngle);
    var eo = polar(cx, cy, rOuter, endAngle);
    var si = polar(cx, cy, rInner, endAngle);
    var ei = polar(cx, cy, rInner, startAngle);
    var large = endAngle - startAngle > 180 ? 1 : 0;
    return (
      "M " + so.x + " " + so.y +
      " A " + rOuter + " " + rOuter + " 0 " + large + " 1 " + eo.x + " " + eo.y +
      " L " + si.x + " " + si.y +
      " A " + rInner + " " + rInner + " 0 " + large + " 0 " + ei.x + " " + ei.y +
      " Z"
    );
  }

  function renderStreamDonut(totals, ui, caption) {
    var wrap = ui.el("div", { class: "bm-donut-wrap" });
    var total = streamBagTotal(totals);
    if (!total) {
      wrap.appendChild(ui.el("p", { class: "muted bm-donut-empty" }, ["No bags"]));
      return wrap;
    }

    var cx = 54;
    var cy = 54;
    var rOuter = 46;
    var rInner = 28;
    var angle = 0;
    var svgParts = [
      "<rect width='108' height='108' fill='transparent'/>",
      "<circle cx='" + cx + "' cy='" + cy + "' r='" + rInner + "' fill='#1a1a1a'/>",
    ];

    STREAM_META.forEach(function (meta) {
      var count = totals[meta.key] || 0;
      if (!count) return;
      var sweep = (count / total) * 360;
      if (sweep <= 0) return;
      svgParts.push(
        "<path d='" + donutSegment(cx, cy, rOuter, rInner, angle, angle + sweep) +
          "' fill='" + meta.color + "' stroke='#111' stroke-width='1'/>"
      );
      angle += sweep;
    });

    svgParts.push(
      "<text x='" + cx + "' y='" + (cy - 2) + "' text-anchor='middle' fill='#f0f0f0' font-size='16' font-weight='700'>" +
        fmt(total) + "</text>"
    );
    svgParts.push(
      "<text x='" + cx + "' y='" + (cy + 12) + "' text-anchor='middle' fill='#aaa' font-size='9'>bags</text>"
    );

    var svg = ui.el("svg", {
      class: "bm-donut",
      viewBox: "0 0 108 108",
      role: "img",
      "aria-label": caption || "Bags by stream",
    });
    svg.innerHTML = svgParts.join("");

    var legend = ui.el("ul", { class: "bm-donut-legend" });
    STREAM_META.forEach(function (meta) {
      var count = totals[meta.key] || 0;
      if (!count) return;
      var kgKey = meta.key + "_kg";
      var li = ui.el("li", { class: "bm-legend-item bm-legend-item--" + meta.key });
      li.innerHTML =
        "<span class='bm-legend-swatch' style='background:" + meta.color + "'></span>" +
        "<span class='bm-legend-text'>" +
        ui.escape(meta.label) + " · " + fmt(count) + " bag(s) · " + fmt(totals[kgKey], 0) + " kg" +
        "</span>";
      legend.appendChild(li);
    });

    wrap.appendChild(svg);
    wrap.appendChild(legend);
    if (caption) {
      wrap.appendChild(ui.el("p", { class: "bm-donut-caption" }, [caption]));
    }
    return wrap;
  }

  function renderStreamCards(totals, ui) {
    var row = ui.el("div", { class: "bm-stream-cards" });
    STREAM_META.forEach(function (meta) {
      var kgKey = meta.key + "_kg";
      var card = ui.el("div", {
        class: "bm-stream-card bm-stream-card--" + meta.key,
      });
      card.innerHTML =
        "<div class='bm-stream-card__label'>" + ui.escape(meta.label) + "</div>" +
        "<div class='bm-stream-card__value'>" + fmt(totals[meta.key]) + "</div>" +
        "<div class='bm-stream-card__sub'>" + fmt(totals[kgKey], 0) + " kg</div>";
      row.appendChild(card);
    });
    return row;
  }

  function renderCumulativePanel(data, allRows, ui) {
    var panel = ui.el("section", { class: "bm-cumulative-panel" });
    panel.appendChild(ui.el("h3", { class: "bm-panel-title" }, ["Cumulative total (database)"]));
    panel.appendChild(
      ui.el("p", { class: "bm-panel-lead" }, [
        fmt(data.bag_count) + " bags · " + fmt(data.total_kg, 0) + " kg in the system",
      ])
    );
    panel.appendChild(
      ui.el("p", { class: "muted bm-backlog-note" }, [
        "Physical stock may be higher until backlog bags are entered. Totals rise as catch-up continues.",
      ])
    );
    var totals = streamTotalsFromRows(allRows);
    var body = ui.el("div", { class: "bm-cumulative-body" });
    body.appendChild(renderStreamDonut(totals, ui, "All streams — bag count"));
    body.appendChild(renderStreamCards(totals, ui));
    panel.appendChild(body);
    return panel;
  }

  function renderDayVisual(section, ui) {
    var panel = ui.el("div", { class: "bm-day-visual" });
    var headline = ui.el("div", { class: "bm-day-daily-total" });
    headline.appendChild(ui.el("span", { class: "bm-day-daily-label" }, ["Daily total"]));
    headline.appendChild(
      ui.el("span", { class: "bm-day-daily-value" }, [
        fmt(section.bags) + " bags · " + fmt(section.kg, 0) + " kg · " +
          fmt(section.producers.length) + " producer(s)",
      ])
    );
    panel.appendChild(headline);
    var body = ui.el("div", { class: "bm-day-visual-body" });
    body.appendChild(renderStreamDonut(section.streams, ui, "This day — bag count"));
    body.appendChild(renderStreamCards(section.streams, ui));
    panel.appendChild(body);
    return panel;
  }

  function buildDaySections(summaryRows) {
    var byDay = {};
    summaryRows.forEach(function (group) {
      var day = group.recorded_date || "";
      if (!byDay[day]) {
        byDay[day] = {
          date: day,
          producers: [],
          bags: 0,
          kg: 0,
          streams: emptyStreamTotals(),
        };
      }
      var section = byDay[day];
      section.producers.push(group);
      section.bags += group.bags;
      section.kg += group.kg;
      (group.detail_rows || []).forEach(function (row) {
        addRowToStreamTotals(section.streams, row);
      });
    });
    var sections = Object.keys(byDay).map(function (k) {
      var s = byDay[k];
      s.kg = Math.round(s.kg * 1000) / 1000;
      s.streams.restaurant_kg = Math.round(s.streams.restaurant_kg * 1000) / 1000;
      s.streams.lumpwood_kg = Math.round(s.streams.lumpwood_kg * 1000) / 1000;
      s.streams.fines_kg = Math.round(s.streams.fines_kg * 1000) / 1000;
      s.producers.sort(function (a, b) {
        return latestRecordedAt(b).localeCompare(latestRecordedAt(a));
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
        ui.el("h3", { class: "bm-day-heading" }, [fmtDate(section.date)])
      );
      block.appendChild(renderDayVisual(section, ui));
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
      var sieving = sievingTimeSpan(drillDown.detail_rows || []);
      if (sieving) {
        panel.appendChild(
          ui.el("p", { class: "bm-drill-sieving" }, [sieving + " (Windhoek)"])
        );
      }
      panel.appendChild(renderDetailTable(drillDown.detail_rows || [], ui));
      body.appendChild(panel);
      return;
    }

    var labelPanel = renderLabelInventoryPanel(data.label_inventory, ui);
    if (labelPanel) body.appendChild(labelPanel);
    body.appendChild(renderCumulativePanel(data, allRows, ui));
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

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Bags Created"]));
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
    title: "Bags Created",
    section: "Production",
    kind: "lookup",
    order: 16,
    icon: "bags",
    description: "Bags created by day and producer — drill down to individual bags",
    requires: "traceability.bags_movement",
    requiresAny: ["traceability.bags_movement", "traceability.stock.view"],
    render: render,
  });
})();
