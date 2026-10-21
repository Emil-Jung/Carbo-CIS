/* Bags Status — analytics dashboard: where bags are + 21-day weathering clock. */



(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];

  var BS_AUTO_REFRESH_MS = 45000;

  /** Drill-down requests — smaller API payload (`drill=1` on Traceability). */
  function bagsStatusDrillPath(statusKey, streamKey) {
    var q = ["drill=1"];
    if (statusKey) q.push("status=" + encodeURIComponent(statusKey));
    if (streamKey) q.push("stream=" + encodeURIComponent(streamKey));
    return "/reports/bags-status?" + q.join("&");
  }

  /** Scanner Create pallet button (bags-lookup). */
  var PALLET_MAGENTA = "#c2185b";

  /** Briquette bulk bags — charcoal accent (distinct from intake fines orange). */
  var BRIQUETTE_CHARCOAL = "#3D3935";

  var STREAM_LABELS = {

    restaurant: "Restaurant",

    lumpwood: "Lumpwood",

    fines: "Fines",

    briquettes: "Briquette bulk bags",

    pallet: "Pallets",

  };



  var STREAM_COLORS = {

    restaurant: "#4F46E5",

    lumpwood: "#059669",

    fines: "#EA580C",

    briquettes: BRIQUETTE_CHARCOAL,

    pallet: PALLET_MAGENTA,

  };



  var BUCKET_ACCENT = {

    ready: "#10B981",

    "1_3": "#EF4444",

    "4_7": "#F97316",

    "8_14": "#3B82F6",

    "15_21": "#8B5CF6",

  };



  /** All product streams on Bags Status charts, legends, and category tiles. */
  var DASHBOARD_STREAM_ORDER = ["restaurant", "lumpwood", "fines", "briquettes", "pallet"];

  var WX_STREAM_ORDER = DASHBOARD_STREAM_ORDER;



  var WX_BUCKET_STATUS = {

    in_storage_weathering: function (key) { return key !== "ready"; },

    in_storage: function (key) { return key === "ready"; },

  };



  function fmt(n, d) {

    if (n == null || isNaN(n)) return "—";

    return Number(n).toLocaleString(undefined, {

      minimumFractionDigits: d || 0,

      maximumFractionDigits: d || 0,

    });

  }



  function fmtReportGenerated(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (e) {
      return String(iso);
    }
  }

  function normalizeBagSearchSerial(raw) {
    var s = String(raw || "").trim().toUpperCase();
    if (!s) return "";
    if (s.indexOf("BAG-") !== 0 && /^[0-9]{4}-[0-9]+$/.test(s)) {
      s = "BAG-" + s;
    }
    return s;
  }

  function renderBagSearchBar(ui, bagSearch, onSubmit, onClear) {
    var wrap = ui.el("div", { class: "bs-dash-bag-search" });
    var form = ui.el("form", { class: "bs-dash-bag-search__form" });
    var input = ui.el("input", {
      class: "bs-dash-bag-search__input",
      type: "search",
      name: "bag_serial",
      placeholder: "BAG-2026-004661",
      autocomplete: "off",
      spellcheck: "false",
      "aria-label": "Search by BAG label code",
    });
    if (bagSearch && bagSearch.serial) input.value = bagSearch.serial;
    form.appendChild(input);
    form.appendChild(
      ui.el("button", { class: "bs-dash-bag-search__btn", type: "submit" }, ["Search"])
    );
    if (bagSearch && bagSearch.active) {
      form.appendChild(
        ui.el("button", {
          class: "bs-dash-bag-search__clear btn-ghost btn-sm",
          type: "button",
          onclick: onClear,
        }, ["Clear"])
      );
    }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      onSubmit(normalizeBagSearchSerial(input.value));
    });
    wrap.appendChild(form);
    wrap.appendChild(
      ui.el("p", { class: "bs-dash-bag-search__hint muted" }, [
        "Find any recorded BAG ID. Physical pallets — open the row or button to see source bulk bags (contributors).",
      ])
    );
    if (bagSearch && bagSearch.error) {
      wrap.appendChild(ui.el("p", { class: "error-box bs-dash-bag-search__err" }, [bagSearch.error]));
    }
    return wrap;
  }

  function fmtMass(kg, forceKg) {
    return CIS.formatMassFromKg(kg, forceKg ? { forceKg: true } : {});
  }

  function fmtKg(n) {
    var v = Number(n || 0);
    return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function bagsKgText(bags, kg) {
    return CIS.bagsAndMassText(bags, kg);
  }



  function fmtDate(iso) {

    if (!iso) return "—";

    var d;

    var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));

    if (parts) {

      d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));

    } else {

      d = new Date(iso);

    }

    if (isNaN(d.getTime())) return String(iso);

    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  }

  function fmtDateTime(iso, timeHm) {

    if (!iso) return "—";

    var datePart = fmtDate(iso);

    if (timeHm) return datePart + " · " + timeHm;

    var d = new Date(iso);

    if (isNaN(d.getTime())) return datePart;

    return datePart + " · " + d.toLocaleTimeString("en-GB", {

      hour: "2-digit",

      minute: "2-digit",

      hour12: false,

    });

  }

  /** Last storage-status change (API: storage_status_changed_at); intake scan if never moved. */
  function lastStatusChangeSortKey(row) {
    if (!row) return "";
    return String(row.status_changed_at || row.recorded_at || "");
  }

  function scanTimestampCell(row) {

    if (!row) return "—";

    if (row.status_changed_at) {

      return fmtDateTime(row.status_changed_at, row.status_changed_time);

    }

    if (row.recorded_at) {

      return fmtDateTime(row.recorded_at, row.recorded_time);

    }

    return fmtDate(row.recorded_date);

  }

  function sortRowsByLastStatusChangeNewestFirst(rows) {
    return (rows || []).slice().sort(function (a, b) {
      var da = lastStatusChangeSortKey(a);
      var db = lastStatusChangeSortKey(b);
      if (da !== db) return db.localeCompare(da);
      return String(b.serial || "").localeCompare(String(a.serial || ""));
    });
  }

  /** Production /cis/ (V1) only — V2 explorer-prototype leaves this unset. */
  function drillSortNewestFirstEnabled() {
    return window.CIS_BS_DRILL_SORT_NEWEST_FIRST === true;
  }

  function sortDrillRowsForDisplay(rows) {
    if (!drillSortNewestFirstEnabled()) return (rows || []).slice();
    return sortRowsByLastStatusChangeNewestFirst(rows);
  }

  function sortPalletFlattenedRows(rows) {
    rows = (rows || []).slice();
    if (drillSortNewestFirstEnabled()) return sortRowsByLastStatusChangeNewestFirst(rows);
    rows.sort(function (a, b) {
      var da = lastStatusChangeSortKey(a);
      var db = lastStatusChangeSortKey(b);
      if (da !== db) return String(da).localeCompare(String(db));
      return String(a.serial || "").localeCompare(String(b.serial || ""));
    });
    return rows;
  }

  function sortProducerGroupRows(rows) {
    rows = (rows || []).slice();
    if (drillSortNewestFirstEnabled()) return sortRowsByLastStatusChangeNewestFirst(rows);
    rows.sort(function (a, b) {
      return String(a.serial || "").localeCompare(String(b.serial || ""));
    });
    return rows;
  }

  function statusDetailCell(row) {
    if (!row) return "—";
    var status = row.status_display || row.effective_status || "—";
    var since = scanTimestampCell(row);
    if (!since || since === "—") return status;
    return status + " · since " + since;
  }

  function movementDetailCell(row) {
    if (!row) return "—";
    if (row.client_name) return row.client_name;
    if (row.container_number) return row.container_number;
    return "—";
  }



  function fmtDayHeading(iso) {

    if (!iso) return "Date unknown";

    var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));

    if (!parts) return fmtDate(iso);

    var d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));

    if (isNaN(d.getTime())) return String(iso);

    return d.toLocaleDateString("en-GB", {

      weekday: "short", day: "2-digit", month: "short", year: "numeric",

    });

  }



  function streamText(row) {

    return STREAM_LABELS[row.product_stream] || row.product_stream || "—";

  }



  function fmtWeatherEndDate(iso) {

    if (!iso) return "";

    return fmtDayHeading(String(iso).slice(0, 10));

  }



  function formatWeatheredAt(row) {

    if (row && row.weathered_at) return fmtDateTime(row.weathered_at);

    var endLabel = fmtWeatherEndDate(row && row.weathering_end_date);

    return endLabel ? endLabel + " · 00:00" : "—";

  }

  function weatherText(row) {

    var parts = [];


    var days = row.days_remaining;

    var isWeathered = !!(row && row.weathered) || (days !== null && days !== undefined && Number(days) <= 0);

    if (isWeathered) {
      parts.push("Weathered — " + formatWeatheredAt(row));
      return parts.join(" · ");
    }

    if (days === null || days === undefined) {
      return parts.length ? parts.join(" · ") : "—";
    }

    days = Number(days);

    if (days > 0) {
      parts.push(days + (days === 1 ? " day left" : " days left"));
    }

    var endLabel = fmtWeatherEndDate(row.weathering_end_date);
    if (endLabel) parts.push("ends " + endLabel);

    return parts.join(" · ");

  }



  function streamSplitText(streams) {

    var parts = [];

    DASHBOARD_STREAM_ORDER.forEach(function (key) {

      var n = (streams || {})[key] || 0;

      if (n > 0) parts.push(n + " " + STREAM_LABELS[key].toLowerCase());

    });

    return parts.join(" · ");

  }

  function appendStreamSplitFooter(card, streams, ui) {

    var stack = ui.el("div", { class: "bs-dash-status-card__streams bs-dash-status-card__streams--stacked" });

    var any = false;

    DASHBOARD_STREAM_ORDER.forEach(function (key) {

      var n = (streams || {})[key] || 0;

      if (!n) return;

      any = true;

      var row = ui.el("div", { class: "bs-dash-status-card__stream-row" });

      var part = ui.el("span", { class: "bs-dash-status-card__stream-part" });

      applyStyles(part, { color: STREAM_COLORS[key] });

      part.appendChild(document.createTextNode(n + " " + STREAM_LABELS[key].toLowerCase()));

      row.appendChild(part);

      stack.appendChild(row);

    });

    if (any) card.appendChild(stack);

  }



  function wxMaxKg(items, key) {

    var m = 0;

    (items || []).forEach(function (item) {

      m = Math.max(m, Number((key ? item[key] : item.kg) || 0));

    });

    return m || 1;

  }



  function createSvg(w, h, cls) {

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    svg.setAttribute("viewBox", "0 0 " + w + " " + h);

    svg.setAttribute("class", cls || "bs-dash-svg");

    svg.setAttribute("role", "img");

    return svg;

  }

  function applyStyles(el, styles) {
    if (!el || !styles) return el;
    Object.keys(styles).forEach(function (prop) {
      var val = styles[prop];
      if (prop.indexOf("--") === 0) el.style.setProperty(prop, val);
      else el.style[prop] = val;
    });
    return el;
  }

  function streamSwatch(key, className) {
    var el = document.createElement("span");
    el.className = className;
    el.style.background = STREAM_COLORS[key];
    return el;
  }



  function renderStreamLegend(ui) {

    var leg = ui.el("div", { class: "bs-dash-legend" });

    WX_STREAM_ORDER.forEach(function (key) {

      var item = ui.el("span", { class: "bs-dash-legend__item" });

      item.appendChild(streamSwatch(key, "bs-dash-legend__swatch"));

      item.appendChild(document.createTextNode(STREAM_LABELS[key]));

      leg.appendChild(item);

    });

    return leg;

  }



  function renderDonut(parent, streams, totalBags, ui) {

    var wrap = ui.el("div", { class: "bs-dash-donut-wrap" });

    var svg = createSvg(120, 120, "bs-dash-donut");

    var cx = 60;

    var cy = 60;

    var r = 44;

    var stroke = 14;

    var circumference = 2 * Math.PI * r;

    var offset = 0;

    var order = WX_STREAM_ORDER.filter(function (k) { return (streams || {})[k] > 0; });

    if (!order.length || !totalBags) {

      var bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");

      bg.setAttribute("cx", cx);

      bg.setAttribute("cy", cy);

      bg.setAttribute("r", r);

      bg.setAttribute("fill", "none");

      bg.setAttribute("stroke", "#E2E8F0");

      bg.setAttribute("stroke-width", stroke);

      svg.appendChild(bg);

    } else {

      order.forEach(function (key) {

        var n = (streams || {})[key] || 0;

        var frac = n / totalBags;

        var seg = document.createElementNS("http://www.w3.org/2000/svg", "circle");

        seg.setAttribute("cx", cx);

        seg.setAttribute("cy", cy);

        seg.setAttribute("r", r);

        seg.setAttribute("fill", "none");

        seg.setAttribute("stroke", STREAM_COLORS[key]);

        seg.setAttribute("stroke-width", stroke);

        seg.setAttribute("stroke-dasharray", (frac * circumference) + " " + circumference);

        seg.setAttribute("stroke-dashoffset", String(-offset * circumference + circumference * 0.25));

        seg.setAttribute("stroke-linecap", "butt");

        svg.appendChild(seg);

        offset += frac;

      });

    }

    var hole = document.createElementNS("http://www.w3.org/2000/svg", "text");

    hole.setAttribute("x", cx);

    hole.setAttribute("y", cy - 2);

    hole.setAttribute("text-anchor", "middle");

    hole.setAttribute("class", "bs-dash-donut__total");

    hole.textContent = String(totalBags || 0);

    svg.appendChild(hole);

    var sub = document.createElementNS("http://www.w3.org/2000/svg", "text");

    sub.setAttribute("x", cx);

    sub.setAttribute("y", cy + 14);

    sub.setAttribute("text-anchor", "middle");

    sub.setAttribute("class", "bs-dash-donut__sub");

    sub.textContent = "bags";

    svg.appendChild(sub);

    wrap.appendChild(svg);

    parent.appendChild(wrap);

  }



  function renderWxBarSegments(streamKg, totalKg, scaleMax, ui) {

    var track = ui.el("div", { class: "bs-dash-bar-track" });

    if (!totalKg) return track;

    track.style.width = Math.max((totalKg / scaleMax) * 100, 2) + "%";

    WX_STREAM_ORDER.forEach(function (key) {

      var kg = (streamKg || {})[key] || 0;

      if (!kg) return;

      track.appendChild(applyStyles(ui.el("div", { class: "bs-dash-bar-seg" }), {

        width: (kg / totalKg * 100) + "%",

        background: STREAM_COLORS[key],

      }));

    });

    return track;

  }



  function renderWeekChart(endWeeks, ui, onDrill) {

    var card = ui.el("div", { class: "bs-dash-card bs-dash-card--side" });

    card.appendChild(ui.el("div", { class: "bs-dash-card__head" }, [

      ui.el("h3", {}, ["Release calendar"]),

      ui.el("p", { class: "bs-dash-card__sub" }, ["By week — tap a bar"]),

    ]));

    var weeks = (endWeeks || []).filter(function (w) { return (w.bags || 0) > 0; }).slice(0, 6);

    if (!weeks.length) {

      card.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No upcoming releases on the clock."]));

      return card;

    }

    var maxBags = Math.max.apply(null, weeks.map(function (w) { return w.bags || 0; }));
    var hiddenWeeks = (endWeeks || []).filter(function (w) { return (w.bags || 0) > 0; }).length - weeks.length;

    var chart = ui.el("div", { class: "bs-dash-col-chart" });

    weeks.forEach(function (w, i) {

      var col = ui.el("button", {

        class: "bs-dash-col",

        type: "button",

        title: w.label + ": " + w.bags + " bags",

        onclick: function () {

          if (onDrill) onDrill({ week: w.key, label: w.label });

        },

      });

      var pct = Math.max(((w.bags || 0) / maxBags) * 100, 4);

      var bar = ui.el("div", { class: "bs-dash-col__bar" });

      bar.style.height = pct + "%";

      bar.style.background = i === 0 ? "#F97316" : "#3B82F6";

      col.appendChild(bar);

      col.appendChild(ui.el("span", { class: "bs-dash-col__val" }, [String(w.bags)]));
      col.appendChild(ui.el("span", { class: "bs-dash-col__kg" }, [fmtMass(w.kg)]));

      col.appendChild(ui.el("span", { class: "bs-dash-col__lbl" }, [w.label]));

      chart.appendChild(col);

    });

    card.appendChild(chart);

    if (hiddenWeeks > 0) {

      card.appendChild(ui.el("p", { class: "bs-dash-chart-more muted" }, [
        "+" + hiddenWeeks + " more week(s) — open weathering drill for full list",
      ]));

    }

    return card;

  }



  function pipelineYardBucket(wx, clock) {
    var pipe = (wx && wx.pipeline) || [];
    for (var i = 0; i < pipe.length; i++) {
      if (pipe[i].location === "in_storage") {
        return (pipe[i][clock] || {});
      }
    }
    return {};
  }

  function renderWxKpis(wx, ui) {
    var kpis = (wx && wx.kpis) || {};
    var yardReady = pipelineYardBucket(wx, "ready");
    var yardStill = pipelineYardBucket(wx, "still_weathering");
    var row = ui.el("div", { class: "bs-dash-wx-kpis" });

    [
      {
        bags: yardReady.bags,
        kg: yardReady.kg,
        label: "Factory yard — clock complete",
        hint: "Matches “In Storage” bulk bags below",
        tone: "green",
      },
      {
        bags: yardStill.bags,
        kg: yardStill.kg,
        label: "Factory yard — on clock",
        hint: "Matches “In Storage — weathering” below",
        tone: "blue",
      },
      {
        bags: (kpis.freeing_this_week || {}).bags,
        kg: (kpis.freeing_this_week || {}).kg,
        label: "Yard — freeing this week",
        hint: "End date in next 7 days",
        tone: "amber",
      },
      {
        bags: (kpis.at_packaging || {}).bags,
        kg: (kpis.at_packaging || {}).kg,
        label: "At packaging (on clock)",
        hint: "Bulk bags at plant, not factory yard tiles",
        tone: "purple",
      },
    ].forEach(function (item) {
      var card = ui.el("div", { class: "bs-dash-wx-kpi bs-dash-wx-kpi--" + item.tone });
      card.appendChild(ui.el("span", { class: "bs-dash-wx-kpi__label" }, [item.label]));
      card.appendChild(ui.el("div", { class: "bs-dash-wx-kpi__value" }, [String(item.bags || 0)]));
      card.appendChild(ui.el("div", { class: "bs-dash-wx-kpi__sub" }, [fmtMass(item.kg)]));
      if (item.hint) {
        card.appendChild(ui.el("div", { class: "bs-dash-wx-kpi__hint muted" }, [item.hint]));
      }
      row.appendChild(card);
    });

    return row;
  }



  function renderWeatheringPanel(wx, ui, onDrill) {

    if (!wx) return null;

    var card = ui.el("section", { class: "bs-dash-card bs-dash-card--weathering" });

    card.appendChild(ui.el("div", { class: "bs-dash-card__head" }, [

      ui.el("h3", {}, ["Weathering — 21-day clock"]),

      ui.el("p", { class: "bs-dash-card__sub" }, [

        "Bulk intake bags only — the 21-day clock at the factory yard. Physical pallets do not weather.",
        " “Ready now” and day buckets below are yard only (not Walvis Bay or packaging).",

      ]),

    ]));

    card.appendChild(renderWxKpis(wx, ui));



    var mixStrip = ui.el("div", { class: "bs-dash-mix-strip" });
    var mixRow = ui.el("div", { class: "bs-dash-mix-row" });
    var mixText = ui.el("div", { class: "bs-dash-mix-text" });
    var still = pipelineYardBucket(wx, "still_weathering");

    mixText.appendChild(ui.el("strong", { class: "bs-dash-mix-text__title" }, [
      "Stream mix — factory yard, still on clock",
    ]));

    DASHBOARD_STREAM_ORDER.filter(function (key) { return key !== "pallet"; }).forEach(function (key) {
      var n = (still.streams || {})[key] || 0;
      var kg = (still.stream_kg || {})[key] || 0;
      var line = ui.el("div", {
        class: "bs-dash-mix-line" + (n ? "" : " bs-dash-mix-line--empty"),
      });
      line.appendChild(streamSwatch(key, "bs-dash-mix-dot"));
      var count = ui.el("span", { class: "bs-dash-mix-line__count" });
      applyStyles(count, { color: n ? STREAM_COLORS[key] : "#94A3B8" });
      count.appendChild(document.createTextNode(String(n)));
      line.appendChild(count);
      line.appendChild(ui.el("span", { class: "bs-dash-mix-line__label" }, [
        STREAM_LABELS[key].toLowerCase(),
      ]));
      line.appendChild(ui.el("span", { class: "bs-dash-mix-line__kg" }, [fmtMass(kg)]));
      mixText.appendChild(line);
    });

    mixRow.appendChild(mixText);
    renderDonut(mixRow, still.streams, still.bags, ui);
    mixStrip.appendChild(mixRow);
    card.appendChild(mixStrip);



    var yardBuckets = yardDaysBuckets(wx);
    var scale = wxMaxKg(yardBuckets);

    var bars = ui.el("div", { class: "bs-dash-buckets" });

    var any = false;

    yardBuckets.forEach(function (b) {

      if (!(b.bags || 0)) return;

      any = true;

      var accent = BUCKET_ACCENT[b.key] || "#64748B";

      var row = ui.el("button", {

        class: "bs-dash-bucket-row",

        type: "button",

        style: { "--bucket-accent": accent },

        onclick: function () {
          onDrill({
            bucket: b.key,
            label: b.label + " (factory yard)",
            pipeline_location: "in_storage",
          });
        },

      });

      row.appendChild(ui.el("span", { class: "bs-dash-bucket-label" }, [b.label]));

      row.appendChild(renderWxBarSegments(b.stream_kg, b.kg, scale, ui));

      row.appendChild(ui.el("span", { class: "bs-dash-bucket-meta" }, [

        b.bags + " bags · " + fmtMass(b.kg),

      ]));

      bars.appendChild(row);

    });

    if (!any) {

      card.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No bags on the clock."]));

    } else {

      card.appendChild(bars);

    }

    return card;

  }



  function renderLabelChip(inv, ui) {

    if (!inv) return null;

    var chip = ui.el("div", { class: "bs-dash-label-chip" });

    chip.appendChild(ui.el("span", { class: "bs-dash-label-chip__title" }, ["Printed labels"]));

    var line = ui.el("div", { class: "bs-dash-label-chip__line" });

    function addPart(value, suffix, tone) {

      var p = ui.el("span", { class: "bs-dash-label-chip__part bs-dash-label-chip__part--" + tone });

      p.appendChild(ui.el("strong", {}, [fmt(value)]));

      p.appendChild(document.createTextNode(" " + suffix));

      line.appendChild(p);

    }

    if (inv.by_format_ok === false) {
      chip.title = inv.by_format_error || "Zebra vs A4 split unavailable";
      chip.classList.add("bs-dash-label-chip--degraded");
    }
    if (inv.by_format && inv.by_format.length >= 2) {
      inv.by_format.forEach(function (block, idx) {
        if (idx > 0) {
          line.appendChild(ui.el("span", { class: "bs-dash-label-chip__sep" }, [" · "]));
        }
        var short =
          block.format === "a4_pallet" ? "A4 ready" : block.format === "zebra_bag" ? "Bag ready" : "ready";
        addPart(block.available, short, block.format === "a4_pallet" ? "a4" : "ready");
      });
    } else {
      addPart(inv.available != null ? inv.available : inv.available_to_use, "ready", "ready");
    }

    if ((inv.parked || 0) > 0) addPart(inv.parked, "parked", "parked");

    if ((inv.fenced || inv.fenced_serial || 0) > 0) {
      addPart(inv.fenced_serial != null ? inv.fenced_serial : inv.fenced, "fenced", "fenced");
    }

    addPart(inv.used, "on bags", "used");

    if ((inv.void || 0) > 0) addPart(inv.void, "void", "void");

    chip.appendChild(line);

    return chip;

  }



  function renderSummaryCards(data, ui) {

    var row = ui.el("div", { class: "bs-dash-kpi-row" });

    [

      { label: "Active in system", value: data.in_system, tone: "blue", sub: true },

      { label: "End of life", value: data.closed, tone: "slate", sub: true },

      {
        label: "All bags in system",
        value: {
          bags: data.bag_count,
          kg: (Number((data.in_system && data.in_system.kg) || 0)
            + Number((data.closed && data.closed.kg) || 0)),
        },
        tone: "indigo",
        sub: true,
      },

    ].forEach(function (item) {

      var card = ui.el("div", { class: "bs-dash-kpi bs-dash-kpi--" + item.tone });

      card.appendChild(ui.el("span", { class: "bs-dash-kpi__label" }, [item.label]));

      card.appendChild(ui.el("div", { class: "bs-dash-kpi__value" }, [

        String((item.value && item.value.bags) || 0),

      ]));

      if (item.sub && item.value && item.value.kg !== undefined) {

        card.appendChild(ui.el("span", { class: "bs-dash-kpi__sub" }, [fmtMass(item.value.kg)]));

      }

      row.appendChild(card);

    });

    var labelChip = renderLabelChip(data.label_inventory, ui);

    if (labelChip) row.appendChild(labelChip);

    return row;

  }



  var PALLET_BUCKET_ACCENT = {

    at_packaging: "#F59E0B",

    in_storage: PALLET_MAGENTA,

    in_transit: "#7C3AED",

    at_coast: "#0EA5E9",

    in_container: "#059669",

    dispatched: "#64748B",

    shipped: "#059669",

  };



  var FACTORY_STORAGE_STATUS_KEYS = {
    in_storage_weathering: true,
    in_storage: true,
  };

  function isFactoryStorageBagStatus(key) {
    return !!FACTORY_STORAGE_STATUS_KEYS[key];
  }

  /** Weathering drill — intake streams × FSC split (not pallets). */
  var WX_DRILL_GROUP_STREAMS = ["restaurant", "lumpwood", "fines", "briquettes"];

  function wxDrillRowsAreAllPallets(rows) {
    rows = rows || [];
    if (!rows.length) return false;
    return rows.every(function (r) {
      return String(r.product_stream || "").toLowerCase() === "pallet";
    });
  }

  function yardDaysBuckets(wx) {
    if (wx && wx.yard_days_buckets && wx.yard_days_buckets.length) {
      return wx.yard_days_buckets;
    }
    return wx && wx.days_buckets ? wx.days_buckets : [];
  }

  function factoryStoragePipelineDrillSel(st) {
    if (!st || !isFactoryStorageBagStatus(st.key)) return null;
    if (st.key === "in_storage") {
      return {
        pipeline_location: "in_storage",
        pipeline_clock: "ready",
        label: st.label,
      };
    }
    if (st.key === "in_storage_weathering") {
      return {
        pipeline_location: "in_storage",
        pipeline_clock: "still_weathering",
        label: st.label,
      };
    }
    return null;
  }

  function factoryStorageWxDrillNote(statusKey, wx) {
    if (!isFactoryStorageBagStatus(statusKey) || !wx) return null;
    if (statusKey === "in_storage") {
      return (
        "At factory — bulk bags in yard storage with the 21-day clock complete. "
        + "Matches “In Storage” and “Ready now” on the weathering board (bulk only; pallets are separate). "
        + "Bags at Walvis Bay or packaging are not listed here."
      );
    }
    if (statusKey === "in_storage_weathering") {
      return (
        "At factory — bulk bags still on the 21-day clock in yard storage. "
        + "Matches “In Storage — weathering” (bulk only)."
      );
    }
    return null;
  }

  function isNonFscForWxDrill(row) {
    return fscText(row) === "Non-FSC";
  }

  function summarizeWxDrillStreamFsc(rows) {
    var out = {};
    WX_DRILL_GROUP_STREAMS.forEach(function (stream) {
      out[stream] = {
        fsc: { bags: 0, kg: 0 },
        non_fsc: { bags: 0, kg: 0 },
      };
    });
    (rows || []).forEach(function (row) {
      var stream = (row.product_stream || "").toLowerCase();
      if (!out[stream]) return;
      var bucket = isNonFscForWxDrill(row) ? "non_fsc" : "fsc";
      out[stream][bucket].bags += 1;
      out[stream][bucket].kg += Number(row.net_weight_kg || 0);
    });
    WX_DRILL_GROUP_STREAMS.forEach(function (stream) {
      ["fsc", "non_fsc"].forEach(function (b) {
        out[stream][b].kg = Math.round(out[stream][b].kg * 10) / 10;
      });
    });
    return out;
  }

  function rowsForWxDrillSlice(rows, stream, fscGroup) {
    return (rows || []).filter(function (row) {
      if ((row.product_stream || "").toLowerCase() !== stream) return false;
      var non = isNonFscForWxDrill(row);
      return fscGroup === "non_fsc" ? non : !non;
    });
  }

  function bagsOnlyMetrics(st) {
    var total = st.bags || 0;
    var palletN = (st.streams && st.streams.pallet) || 0;
    var bagN = Math.max(0, total - palletN);
    var kg = st.kg || 0;
    var bagKg = total > 0 ? (kg * bagN) / total : 0;
    return { bags: bagN, kg: Math.round(bagKg * 1000) / 1000 };
  }

  function statusForBagsOnlyDisplay(st) {
    var m = bagsOnlyMetrics(st);
    var streams = {};
    if (st.streams) {
      Object.keys(st.streams).forEach(function (k) {
        if (k !== "pallet") streams[k] = st.streams[k];
      });
    }
    return {
      key: st.key,
      label: st.label,
      bags: m.bags,
      kg: m.kg,
      streams: streams,
      kind: st.kind || "factory_bag_status",
    };
  }

  function partitionFactoryStatuses(statuses) {
    var storage = [];
    var other = [];
    (statuses || []).forEach(function (st) {
      if (FACTORY_STORAGE_STATUS_KEYS[st.key]) storage.push(st);
      else other.push(st);
    });
    return { storage: storage, other: other };
  }

  function palletInStorageBucket(palletSummary) {
    var buckets = (palletSummary && palletSummary.buckets) || [];
    for (var i = 0; i < buckets.length; i++) {
      if (buckets[i].key === "in_storage") return buckets[i];
    }
    return { key: "in_storage", label: "Pallets in storage", bags: 0, kg: 0 };
  }

  function filterEventSectionsToIntakeBags(sections) {
    return (sections || [])
      .map(function (sec) {
        var rows = (sec.rows || []).filter(function (r) {
          return (r.product_stream || "").toLowerCase() !== "pallet";
        });
        var kg = 0;
        rows.forEach(function (r) {
          kg += Number(r.net_weight_kg) || 0;
        });
        return Object.assign({}, sec, {
          rows: rows,
          bags: rows.length,
          kg: Math.round(kg * 1000) / 1000,
        });
      })
      .filter(function (sec) {
        return sec.bags > 0;
      });
  }

  var PALLET_DRILL_STATUS = {

    at_packaging: "at_packaging_plant",

    in_storage: "in_storage,in_storage_weathering",

    in_transit: "on_truck_walvisbay",

    storage_walvisbay: "storage_walvisbay",

    at_coast: "storage_agl",

    in_container: "in_container",

    dispatched: "dispatched",

    shipped: "shipped",

  };



  function renderPalletBasketPanel(palletBasket, ui) {

    var b = palletBasket || {};

    var section = ui.el("section", { class: "bs-dash-location bs-dash-location--amber" });

    section.appendChild(ui.el("div", { class: "bs-dash-location__head" }, [

      ui.el("h3", {}, ["Pallet basket"]),

      ui.el("span", { class: "bs-dash-location__count muted" }, [

        "Material waiting to become physical pallets",

      ]),

    ]));

    var dl = ui.el("dl", { class: "bs-dash-basket-dl" });

    [

      ["Available for palletisation", fmtMass(b.available_kg)],

      ["Pallet equivalent", b.pallet_equivalent != null ? Number(b.pallet_equivalent).toFixed(2) : "—"],

      ["Source bags", String(b.source_bags != null ? b.source_bags : 0)],

    ].forEach(function (pair) {

      dl.appendChild(ui.el("dt", {}, [pair[0]]));

      dl.appendChild(ui.el("dd", {}, [pair[1]]));

    });

    section.appendChild(dl);

    var sub = ui.el("div", { class: "bs-dash-basket-products" });

    (b.by_product || []).forEach(function (row) {

      var line =
        row.product_code + ": " + fmtMass(row.available_kg) + " · "
          + (row.pallet_equivalent != null ? Number(row.pallet_equivalent).toFixed(2) : "—")
          + " pallet equiv";
      if (Number(row.available_kg) > 0.001) {
        line += " · " + String(row.source_bag_count || 0) + " source bag(s)";
      }
      sub.appendChild(ui.el("p", { class: "bs-dash-basket-product muted" }, [line]));

    });

    if ((b.by_product_retired || []).length) {

      sub.appendChild(ui.el("p", { class: "bs-dash-basket-product muted bs-dash-basket-product--retired" }, [
        "Retired SKU pool: "
          + b.by_product_retired.map(function (row) {
            return row.product_code + " " + fmtMass(row.available_kg);
          }).join(" · "),
      ]));

    }

    if (sub.childNodes.length) section.appendChild(sub);

    return section;

  }



  function renderPalletLocationDrill(buckets, ui, onOpenBucket) {

    var wrap = ui.el("div", { class: "bs-dash-basket-drill" });

    var grid = ui.el("div", { class: "bs-dash-status-grid" });

    (buckets || []).forEach(function (bucket) {

      if (!(bucket.bags || 0)) return;

      var accent = PALLET_BUCKET_ACCENT[bucket.key] || "#64748B";

      var drillStatus = PALLET_DRILL_STATUS[bucket.key];

      var card = drillStatus

        ? ui.el("button", {

          class: "bs-dash-status-card bs-dash-status-card--pallet bs-dash-status-card--pallet-magenta",

          type: "button",

          style: { "--card-accent": accent },

          onclick: function () { onOpenBucket(bucket, drillStatus); },

        })

        : ui.el("div", { class: "bs-dash-status-card bs-dash-status-card--static", style: { "--card-accent": accent } });

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__label" }, [bucket.label]));

      card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(bucket.bags)]));

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtMass(bucket.kg)]));

      grid.appendChild(card);

    });

    if (!grid.childNodes.length) {

      wrap.appendChild(ui.el("p", { class: "bs-dash-empty muted" }, ["No physical pallets created yet."]));

    } else {

      wrap.appendChild(grid);

    }

    return wrap;

  }



  function renderWxBucketCards(buckets, ui, onOpen) {

    var wrap = ui.el("div", { class: "bs-dash-status-grid" });

    buckets.forEach(function (b) {

      var accent = BUCKET_ACCENT[b.key] || "#64748B";

      var card = ui.el("button", {

        class: "bs-dash-status-card",

        type: "button",

        style: { "--card-accent": accent },

        onclick: function () { onOpen({ bucket: b.key, label: b.label }); },

      });

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__label" }, [b.label]));

      card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(b.bags)]));

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtMass(b.kg)]));

      wrap.appendChild(card);

    });

    return wrap;

  }



  function wxBucketsForStatus(statusKey, wx) {

    var fn = WX_BUCKET_STATUS[statusKey];

    if (!fn || !wx) return [];

    return yardDaysBuckets(wx).filter(function (b) {

      return (b.bags || 0) > 0 && fn(b.key);

    });

  }



  var GROUP_TONE = {

    factory: "blue",

    in_transit: "amber",

    coast: "teal",

    walvis_bay: "teal",

    closed: "slate",

    packaging_outputs: "amber",

  };



  var WALVIS_STORAGE_STATUS = "storage_walvisbay";
  var WALVIS_TRANSIT_STATUS = "on_truck_walvisbay";

  function isWalvisStorageStatus(key) {
    return key === WALVIS_STORAGE_STATUS;
  }

  function palletWalvisStorageBucket(palletSummary) {
    var buckets = (palletSummary && palletSummary.buckets) || [];
    for (var i = 0; i < buckets.length; i++) {
      if (buckets[i].key === WALVIS_STORAGE_STATUS) return buckets[i];
    }
    return {
      key: WALVIS_STORAGE_STATUS,
      label: "Pallets in storage — Carbo Yard",
      bags: 0,
      kg: 0,
    };
  }

  function flattenEventRows(sections) {
    var rows = [];
    (sections || []).forEach(function (sec) {
      rows = rows.concat(sec.rows || []);
    });
    if (drillSortNewestFirstEnabled()) return sortRowsByLastStatusChangeNewestFirst(rows);
    return rows;
  }

  var BS_STREAM_KEYS = ["restaurant", "lumpwood", "fines", "briquettes", "pallet"];

  function relabelStatusTiles(statuses, labelByKey) {
    return (statuses || []).map(function (st) {
      var next = labelByKey[st.key];
      return next ? Object.assign({}, st, { label: next }) : st;
    });
  }

  function statusTileFromTotals(statusKey, label, totals) {
    var bucket = (totals && totals[statusKey]) || { bags: 0, kg: 0 };
    var tile = {
      key: statusKey,
      label: label,
      bags: Number(bucket.bags) || 0,
      kg: Number(bucket.kg) || 0,
      streams: {},
    };
    BS_STREAM_KEYS.forEach(function (stream) {
      if (bucket[stream] != null) tile.streams[stream] = Number(bucket[stream]) || 0;
    });
    return tile;
  }

  /** Split movement (in transit) from stationary coast stock — bag status is canonical. */
  function layoutTransitAndWalvisGroups(groups, statusTotals) {
    groups = groups || [];

    var transit = null;
    var walvis = null;
    var coast = null;
    var insertIdx = -1;

    groups.forEach(function (g, i) {
      if (g.key === "in_transit") {
        transit = g;
        if (insertIdx < 0) insertIdx = i;
      }
      if (g.key === "walvis_storage") {
        walvis = g;
        if (insertIdx < 0) insertIdx = i;
      }
      if (g.key === "coast") {
        coast = g;
        if (insertIdx < 0) insertIdx = i;
      }
    });

    if (!transit && !walvis && !coast) return groups;

    var out = groups.filter(function (g) {
      return g.key !== "in_transit" && g.key !== "coast" && g.key !== "walvis_storage";
    });

    var at = groups.slice(0, insertIdx).filter(function (g) {
      return g.key !== "in_transit" && g.key !== "coast" && g.key !== "walvis_storage";
    }).length;

    var inserts = [];

    if (transit) {
      inserts.push({
        key: "in_transit",
        label: transit.label || "In transit",
        note:
          "On the road — not at a yard. Truck scans from Grootfontein show here as In transit — Walvis Bay.",
        bags: transit.bags,
        kg: transit.kg,
        statuses: relabelStatusTiles(transit.statuses, {
          on_truck_walvisbay: "In transit — Walvis Bay",
        }),
      });
    }

    if (walvis || coast) {
      var carboTiles = relabelStatusTiles(walvis && walvis.statuses, {
        storage_walvisbay: "In storage — Carbo Yard",
      });
      var aglTiles = relabelStatusTiles(coast && coast.statuses, {
        storage_agl: "In storage — AGL",
      });
      var intoTile = statusTileFromTotals("in_container", "Into container", statusTotals);

      var sections = [];
      if (walvis) {
        sections.push({
          key: "walvis_storage",
          label: "In storage — Carbo Yard",
          statuses: carboTiles.length
            ? carboTiles
            : [
                {
                  key: "storage_walvisbay",
                  label: "In storage — Carbo Yard",
                  bags: 0,
                  kg: 0,
                  streams: {},
                },
              ],
        });
      }
      if (coast) {
        sections.push({
          key: "coast",
          label: "In storage — AGL",
          statuses: aglTiles.length
            ? aglTiles
            : [{ key: "storage_agl", label: "In storage — AGL", bags: 0, kg: 0, streams: {} }],
        });
      }
      sections.push({
        key: "into_container",
        label: "Into container",
        statuses: [intoTile],
      });

      var wbBags =
        (walvis ? Number(walvis.bags) || 0 : 0) +
        (coast ? Number(coast.bags) || 0 : 0) +
        (intoTile.bags || 0);
      var wbKg =
        (walvis ? Number(walvis.kg) || 0 : 0) +
        (coast ? Number(coast.kg) || 0 : 0) +
        (intoTile.kg || 0);

      inserts.push({
        key: "walvis_bay",
        label: "Walvis Bay",
        note:
          "Stationary at the coast — Carbo yard, AGL, or scanned into an export container. Not in transit on a truck.",
        bags: wbBags,
        kg: Math.round(wbKg * 1000) / 1000,
        sections: sections,
      });
    }

    out.splice.apply(out, [at, 0].concat(inserts));
    return out;
  }



  var DASHBOARD_GROUP_ORDER = [
    "factory",
    "packaging_outputs",
    "in_transit",
    "walvis_bay",
    "closed",
  ];



  function orderDashboardGroups(groups) {

    groups = (groups || []).slice();

    groups.sort(function (a, b) {

      var ai = DASHBOARD_GROUP_ORDER.indexOf(a.key);

      var bi = DASHBOARD_GROUP_ORDER.indexOf(b.key);

      if (ai < 0) ai = DASHBOARD_GROUP_ORDER.length;

      if (bi < 0) bi = DASHBOARD_GROUP_ORDER.length;

      return ai - bi;

    });

    return groups;

  }



  function appendStatusCards(parent, statuses, ui, selectedStatus, onSelect, gridClass) {

    var cards = ui.el("div", { class: "bs-dash-status-grid" + (gridClass ? " " + gridClass : "") });

    (statuses || []).forEach(function (st) {

      var cls = "bs-dash-status-card";

      if (st.key === selectedStatus) cls += " bs-dash-status-card--active";

      if (st.kind === "pallet_basket") cls += " bs-dash-status-card--basket";

      if (st.kind === "physical_pallets" || st.kind === "factory_pallets_in_storage") {
        cls += " bs-dash-status-card--pallet bs-dash-status-card--pallet-magenta";
      }

      if (st.key === "sold_ch10_historical") {
        cls += " bs-dash-status-card--ch10-historical";
      }

      var card = ui.el("button", { class: cls, type: "button", onclick: function () { onSelect(st); } });

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__label" }, [st.label]));

      if (st.kind === "pallet_basket") {

        var equiv = st.pallet_equivalent != null ? Number(st.pallet_equivalent).toFixed(2) : "0.00";

        card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [equiv]));

        card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [
          fmtMass(st.kg)
            + " · "
            + String(st.bags != null ? st.bags : 0)
            + " source bags consumed",
        ]));

        var withKg = (st.by_product || []).filter(function (row) {
          return Number(row.available_kg) > 0.001;
        });
        var skuLine = withKg.length
          ? withKg.map(function (row) { return row.product_code; }).join(", ")
          : (st.by_product || []).map(function (row) { return row.product_code; }).join(", ");
        if (skuLine) {
          card.appendChild(ui.el("span", { class: "bs-dash-status-card__streams" }, [
            "Active catalog: " + skuLine,
          ]));
        }
        if ((st.by_product_retired || []).length) {
          card.appendChild(ui.el("span", { class: "bs-dash-status-card__streams muted" }, [
            "Retired pool: "
              + st.by_product_retired.map(function (row) { return row.product_code; }).join(", "),
          ]));
        }

      } else if (st.kind === "physical_pallets") {

        card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(st.bags || 0)]));

        card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [
          fmtMass(st.kg) + " · in stock after A4 QR label scan at wrap",
        ]));

      } else if (st.kind === "factory_pallets_in_storage") {

        card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(st.bags || 0)]));

        card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [
          fmtMass(st.kg) + " · drill down by location",
        ]));

      } else if (st.kind === "walvis_dispatch_select") {

        card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(st.bags || 0)]));

        var walvisSub = st.receivedLabel || fmtMass(st.kg);
        if (st.receivedLabel && st.kg) {
          walvisSub = st.receivedLabel + " · " + fmtMass(st.kg);
        }
        card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [walvisSub]));

      } else {

        card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(st.bags)]));

        card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtMass(st.kg)]));

        appendStreamSplitFooter(card, st.streams, ui);

      }

      cards.appendChild(card);

    });

    parent.appendChild(cards);

  }



  function renderFactoryStorageSplit(block, storageStatuses, palletSummary, ui, selectedStatus, onSelect) {
    var row = ui.el("div", { class: "bs-dash-factory-storage-split" });

    var bagsCol = ui.el("div", { class: "bs-dash-factory-storage-split__col" });
    bagsCol.appendChild(ui.el("h4", { class: "bs-dash-location__subhead" }, ["Bags in storage"]));
    bagsCol.appendChild(
      ui.el("p", { class: "bs-dash-location__note bs-dash-location__note--compact muted" }, [
        "Weathering and weathered — intake bags only (not pallets).",
      ])
    );
    var bagCards = (storageStatuses || []).map(statusForBagsOnlyDisplay);
    appendStatusCards(bagsCol, bagCards, ui, selectedStatus, onSelect, "bs-dash-status-grid--inline");

    var palCol = ui.el("div", { class: "bs-dash-factory-storage-split__col" });
    palCol.appendChild(ui.el("h4", { class: "bs-dash-location__subhead" }, ["Pallets in storage"]));
    palCol.appendChild(
      ui.el("p", { class: "bs-dash-location__note bs-dash-location__note--compact muted" }, [
        "Physical pallet BAG IDs on the yard — same Create pallet flow as packaging.",
      ])
    );
    var inStore = palletInStorageBucket(palletSummary);
    appendStatusCards(
      palCol,
      [
        {
          key: "report:factory_pallets_in_storage",
          label: "Pallets in storage",
          kind: "factory_pallets_in_storage",
          bags: inStore.bags || 0,
          kg: inStore.kg || 0,
          streams: {},
        },
      ],
      ui,
      selectedStatus,
      onSelect,
      "bs-dash-status-grid--inline"
    );

    row.appendChild(bagsCol);
    row.appendChild(palCol);
    block.appendChild(row);
  }

  function walvisDispatchDisplayLabel(d) {
    if (!d) return "Dispatch";
    if (d.display_label) return d.display_label;
    var idx =
      d.dispatch_day_index != null && d.dispatch_day_index !== ""
        ? d.dispatch_day_index
        : d.dispatch_number;
    if (d.opened_at) {
      try {
        var dt = new Date(d.opened_at);
        var wd = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Windhoek",
          weekday: "short",
        }).format(dt);
        var day = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Windhoek",
          day: "2-digit",
        }).format(dt);
        var mon = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Windhoek",
          month: "2-digit",
        }).format(dt);
        var yr = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Windhoek",
          year: "2-digit",
        }).format(dt);
        return "Dispatch " + wd + " " + day + "-" + mon + "-" + yr + " #" + idx;
      } catch (e) {
        /* fall through */
      }
    }
    return "Dispatch #" + (d.dispatch_number != null ? d.dispatch_number : "?");
  }

  function walvisDispatchReceivedLabel(d) {
    if (!d || !d.manifest_received_day_min) return "";
    if (
      d.manifest_received_day_max &&
      d.manifest_received_day_max !== d.manifest_received_day_min
    ) {
      return "Received " + d.manifest_received_day_min + " – " + d.manifest_received_day_max;
    }
    return "Received " + d.manifest_received_day_min;
  }

  function walvisDispatchTileBags(d) {
    var inStore = d.bags_in_storage || 0;
    if (inStore > 0) return inStore;
    if (d.status === "open" && (d.loaded_bags || 0) > 0) return d.loaded_bags;
    if (d.loading_at_grootfontein && (d.loaded_bags || 0) > 0) return d.loaded_bags;
    return inStore;
  }

  function walvisDispatchTileBagsInTransit(d) {
    var onTruck = d.bags_in_transit || 0;
    if (onTruck > 0) return onTruck;
    if (d.status === "open" && (d.loaded_bags || 0) > 0) return d.loaded_bags;
    if (d.loading_at_grootfontein && (d.loaded_bags || 0) > 0) return d.loaded_bags;
    return onTruck;
  }

  function renderWalvisStorageDispatchHub(parent, report, palletBucket, ui, onSelect) {
    report = report || { dispatches: [], unassigned: {}, pallets: {} };
    parent.appendChild(
      ui.el("p", { class: "bs-dash-drill-note" }, [
        "One tile per truck dispatch — tap for categories and bag list. In transit is separate on the main dashboard.",
      ])
    );

    var dispatches = report.dispatches || [];
    if (dispatches.length) {
      parent.appendChild(ui.el("h4", { class: "bs-dash-location__subhead" }, ["By truck dispatch"]));
      appendStatusCards(
        parent,
        dispatches.map(function (d) {
          return {
            key: "walvis:dispatch:" + d.id,
            kind: "walvis_dispatch_select",
            label: walvisDispatchDisplayLabel(d),
            receivedLabel: walvisDispatchReceivedLabel(d),
            bags: walvisDispatchTileBags(d),
            kg: d.kg_in_storage || 0,
            streams: {},
            dispatch: d,
          };
        }),
        ui,
        null,
        onSelect,
        "bs-dash-status-grid--inline"
      );
    } else {
      parent.appendChild(
        ui.el("p", { class: "bs-dash-empty" }, ["No bulk bags in Carbo yard storage linked to a dispatch manifest yet."])
      );
    }

    var un = report.unassigned || {};
    if ((un.bags_in_storage || 0) > 0) {
      parent.appendChild(ui.el("h4", { class: "bs-dash-location__subhead" }, ["Not on a dispatch manifest"]));
      appendStatusCards(
        parent,
        [
          {
            key: "walvis:unassigned",
            kind: "walvis_unassigned",
            label: "Unassigned bulk bags",
            bags: un.bags_in_storage || 0,
            kg: un.kg_in_storage || 0,
            streams: {},
            unassigned: un,
          },
        ],
        ui,
        null,
        onSelect,
        "bs-dash-status-grid--inline"
      );
    }

    var palFromReport = report.pallets || {};
    var pal = palletBucket || { bags: 0, kg: 0 };
    var palBags = Math.max(pal.bags || 0, palFromReport.bags_in_storage || 0);
    var palKg = Math.max(pal.kg || 0, palFromReport.kg_in_storage || 0);
    if (palBags > 0) {
      parent.appendChild(ui.el("h4", { class: "bs-dash-location__subhead" }, ["Pallets in storage"]));
      parent.appendChild(
        ui.el("p", { class: "bs-dash-location__note bs-dash-location__note--compact muted" }, [
          "Physical pallet BAG IDs — tap for product mix and source producers (not tied to GF truck dispatches).",
        ])
      );
      appendStatusCards(
        parent,
        [
          {
            key: "walvis:pallets",
            label: "Pallets in storage",
            kind: "walvis_pallets",
            bags: palBags,
            kg: palKg,
            streams: {},
          },
        ],
        ui,
        null,
        onSelect,
        "bs-dash-status-grid--inline"
      );
    }
  }

  function renderWalvisStorageDispatchCategories(parent, dispatch, ui, onSelect) {
    parent.appendChild(
      ui.el("p", { class: "bs-dash-drill-note" }, [
        walvisDispatchDisplayLabel(dispatch) +
          " — " +
          String(dispatch.bags_in_storage || 0) +
          " bag(s) in Carbo yard storage. Tap a category for detail.",
      ])
    );
    var cats = dispatch.categories || [];
    if (!cats.length) {
      parent.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No categories for this dispatch."]));
      return;
    }
    appendStatusCards(
      parent,
      cats.map(function (cat) {
        var streamKey = cat.product_stream || "unknown";
        return {
          key: "walvis:cat:" + dispatch.id + ":" + streamKey,
          kind: "walvis_dispatch_category",
          label: STREAM_LABELS[streamKey] || streamKey,
          bags: cat.bags || 0,
          kg: cat.kg || 0,
          streams: {},
          rows: cat.rows || [],
          dispatch: dispatch,
        };
      }),
      ui,
      null,
      onSelect,
      "bs-dash-status-grid--inline"
    );
  }

  function renderWalvisTransitDispatchHub(parent, report, ui, onSelect) {
    report = report || { dispatches: [], unassigned: {}, pallets: {} };
    parent.appendChild(
      ui.el("p", { class: "bs-dash-drill-note" }, [
        "One tile per truck dispatch — tap a dispatch for product categories, then the bag list for that truck only.",
      ])
    );

    var dispatches = report.dispatches || [];
    if (dispatches.length) {
      parent.appendChild(ui.el("h4", { class: "bs-dash-location__subhead" }, ["By truck dispatch"]));
      appendStatusCards(
        parent,
        dispatches.map(function (d) {
          return {
            key: "walvis:transit:dispatch:" + d.id,
            kind: "walvis_dispatch_select",
            transit: true,
            label: walvisDispatchDisplayLabel(d),
            receivedLabel: d.truck_registration || d.transporter || "",
            bags: walvisDispatchTileBagsInTransit(d),
            kg: d.kg_in_transit || 0,
            streams: {},
            dispatch: d,
          };
        }),
        ui,
        null,
        onSelect,
        "bs-dash-status-grid--inline"
      );
    } else {
      parent.appendChild(
        ui.el("p", { class: "bs-dash-empty" }, ["No bags in transit on a dispatch manifest right now."])
      );
    }

    var un = report.unassigned || {};
    if ((un.bags_in_transit || 0) > 0) {
      parent.appendChild(ui.el("h4", { class: "bs-dash-location__subhead" }, ["Not on a dispatch manifest"]));
      appendStatusCards(
        parent,
        [
          {
            key: "walvis:transit:unassigned",
            kind: "walvis_unassigned",
            transit: true,
            label: "Unassigned — in transit",
            bags: un.bags_in_transit || 0,
            kg: un.kg_in_transit || 0,
            streams: {},
            unassigned: un,
          },
        ],
        ui,
        null,
        onSelect,
        "bs-dash-status-grid--inline"
      );
    }

    var palFromReport = report.pallets || {};
    if ((palFromReport.bags_in_transit || 0) > 0) {
      parent.appendChild(ui.el("h4", { class: "bs-dash-location__subhead" }, ["Pallets in transit"]));
      appendStatusCards(
        parent,
        [
          {
            key: "walvis:transit:pallets",
            kind: "walvis_transit_pallets",
            label: "Pallets on trucks",
            bags: palFromReport.bags_in_transit || 0,
            kg: palFromReport.kg_in_transit || 0,
            streams: {},
            rows: palFromReport.rows || [],
          },
        ],
        ui,
        null,
        onSelect,
        "bs-dash-status-grid--inline"
      );
    }
  }

  function renderWalvisTransitDispatchCategories(parent, dispatch, ui, onSelect) {
    parent.appendChild(
      ui.el("p", { class: "bs-dash-drill-note" }, [
        walvisDispatchDisplayLabel(dispatch) +
          " — " +
          String(dispatch.bags_in_transit || walvisDispatchTileBagsInTransit(dispatch) || 0) +
          " bag(s) on this truck. Tap a category for the bag list.",
      ])
    );
    var cats = dispatch.categories || [];
    if (!cats.length) {
      parent.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No scanned bags on this dispatch yet."]));
      return;
    }
    appendStatusCards(
      parent,
      cats.map(function (cat) {
        var streamKey = cat.product_stream || "unknown";
        return {
          key: "walvis:transit:cat:" + dispatch.id + ":" + streamKey,
          kind: "walvis_dispatch_category",
          transit: true,
          label: STREAM_LABELS[streamKey] || streamKey,
          bags: cat.bags || 0,
          kg: cat.kg || 0,
          streams: {},
          rows: cat.rows || [],
          dispatch: dispatch,
        };
      }),
      ui,
      null,
      onSelect,
      "bs-dash-status-grid--inline"
    );
  }

  function renderGroup(group, ui, selectedStatus, onSelect, dashboardSummary) {

    var tone = GROUP_TONE[group.key] || "indigo";

    var block = ui.el("section", { class: "bs-dash-location bs-dash-location--" + tone });

    var headCountText = bagsKgText(group.bags, group.kg);
    if (group.key === "packaging_outputs") {
      var equiv =
        group.pallet_basket_equivalent != null
          ? Number(group.pallet_basket_equivalent).toFixed(2)
          : "0.00";
      var wrapped = group.physical_pallet_count != null ? group.physical_pallet_count : 0;
      headCountText =
        equiv + " pallet-equiv in basket · " + wrapped + " wrapped · " + fmtMass(group.pallet_basket_kg != null ? group.pallet_basket_kg : group.kg);
    }
    block.appendChild(ui.el("div", { class: "bs-dash-location__head" }, [

      ui.el("h3", {}, [group.label]),

      ui.el("span", { class: "bs-dash-location__count" }, [
        headCountText,
      ]),

    ]));

    if (group.note) {

      block.appendChild(ui.el("p", { class: "bs-dash-location__note" }, [group.note]));

    }

    if (group.key === "packaging_outputs" && dashboardSummary && dashboardSummary.packing_activity_today) {
      var actToday = dashboardSummary.packing_activity_today;
      block.appendChild(
        ui.el("p", { class: "bs-dash-location__note bs-dash-location__note--compact" }, [
          "Today (Windhoek): ",
          ui.el("strong", {}, [String(actToday.consumes != null ? actToday.consumes : 0)]),
          " bulk consume scans · ",
          ui.el("strong", {}, [String(actToday.wraps != null ? actToday.wraps : 0)]),
          " A4 wrap scans (physical pallet BAG IDs). Consume adds to basket; wrap moves basket → Pallets.",
        ])
      );
    }

    if (group.sections && group.sections.length) {

      var row = ui.el("div", { class: "bs-dash-location__inline-row" });

      group.sections.forEach(function (section, idx) {

        if (idx > 0) row.appendChild(ui.el("div", { class: "bs-dash-location__vdivider", "aria-hidden": "true" }));

        var part = ui.el("div", { class: "bs-dash-location__inline-part" });

        part.appendChild(ui.el("h4", { class: "bs-dash-location__subhead" }, [section.label]));

        appendStatusCards(part, section.statuses, ui, selectedStatus, onSelect, "bs-dash-status-grid--inline");

        row.appendChild(part);

      });

      block.appendChild(row);

    } else if (group.key === "factory") {

      var parts = partitionFactoryStatuses(group.statuses || []);

      renderFactoryStorageSplit(
        block,
        parts.storage,
        dashboardSummary && dashboardSummary.pallet_summary,
        ui,
        selectedStatus,
        onSelect
      );

      appendStatusCards(block, parts.other, ui, selectedStatus, onSelect);

    } else {

      appendStatusCards(block, group.statuses || [], ui, selectedStatus, onSelect);

    }

    return block;

  }



  function renderPalletBasketDrill(basket, ui) {

    var b = basket || {};

    var wrap = ui.el("div", { class: "bs-dash-basket-drill" });

    wrap.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
      "Bulk bags consumed at packing — kg waiting for an A4 pallet QR label scan at wrapping. "
        + "Not a physical pallet BAG ID until Create pallet.",
    ]));

    var dl = ui.el("dl", { class: "bs-dash-basket-dl" });

    [

      ["Available for palletisation", fmtMass(b.available_kg)],

      ["Pallet equivalent", b.pallet_equivalent != null ? Number(b.pallet_equivalent).toFixed(2) : "—"],

      ["Source bags consumed", String(b.source_bags != null ? b.source_bags : 0)],

    ].forEach(function (pair) {

      dl.appendChild(ui.el("dt", {}, [pair[0]]));

      dl.appendChild(ui.el("dd", {}, [pair[1]]));

    });

    wrap.appendChild(dl);

    (b.by_product || []).forEach(function (row) {

      var block = ui.el("div", { class: "bs-dash-basket-product-block" });

      block.appendChild(ui.el("h4", {}, [
        row.product_code + (row.name ? " — " + row.name : "") + " (active catalog)",
      ]));

      var cfg = ui.el("dl", { class: "bs-dash-basket-dl bs-dash-basket-dl--compact" });

      [

        ["Available", fmtMass(row.available_kg)],

        ["Pallet equivalent", row.pallet_equivalent != null ? Number(row.pallet_equivalent).toFixed(2) : "—"],

        ["Production target / pallet", row.production_target_kg != null ? fmtMass(row.production_target_kg, true) : "—"],

        ["Commercial pallet", row.commercial_pallet_weight_kg != null ? fmtMass(row.commercial_pallet_weight_kg, true) : "—"],

        ["Retail units / pallet", row.bags_per_pallet != null ? String(row.bags_per_pallet) : "—"],

        ["Source bags", String(row.source_bag_count || 0)],

      ].forEach(function (pair) {

        cfg.appendChild(ui.el("dt", {}, [pair[0]]));

        cfg.appendChild(ui.el("dd", {}, [pair[1]]));

      });

      block.appendChild(cfg);

      wrap.appendChild(block);

    });

    (b.by_product_retired || []).forEach(function (row) {

      var block = ui.el("div", { class: "bs-dash-basket-product-block bs-dash-basket-product-block--retired" });

      block.appendChild(ui.el("h4", {}, [
        row.product_code + (row.name ? " — " + row.name : "") + " (retired SKU — clear or re-wrap separately)",
      ]));

      var cfg = ui.el("dl", { class: "bs-dash-basket-dl bs-dash-basket-dl--compact" });

      [

        ["Available", fmtMass(row.available_kg)],

        ["Pallet equivalent", row.pallet_equivalent != null ? Number(row.pallet_equivalent).toFixed(2) : "—"],

        ["Source bags", String(row.source_bag_count || 0)],

      ].forEach(function (pair) {

        cfg.appendChild(ui.el("dt", {}, [pair[0]]));

        cfg.appendChild(ui.el("dd", {}, [pair[1]]));

      });

      block.appendChild(cfg);

      wrap.appendChild(block);

    });

    if (!(b.by_product || []).length && !(b.by_product_retired || []).length) {

      wrap.appendChild(ui.el("p", { class: "bs-dash-empty muted" }, ["No material in the pallet basket."]));

    }

    return wrap;

  }



  function renderPalletDetailDrill(serial, detail, ui) {

    var p = (detail && detail.pallet) || detail || {};

    var wrap = ui.el("div", { class: "bs-dash-basket-drill" });

    wrap.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
      "Physical pallet created when this A4 label was scanned at wrapping.",
    ]));

    var dl = ui.el("dl", { class: "bs-dash-basket-dl" });

    [

      ["Pallet BAG ID", serial || "—"],

      ["Product", (p.product_code || "—") + (p.product_name ? " — " + p.product_name : "")],

      ["Production weight", p.production_pallet_kg != null ? fmtMass(p.production_pallet_kg, true) : "—"],

      ["Retail units", p.retail_unit_count != null ? String(p.retail_unit_count) : "—"],

      ["Status", p.storage_status || "—"],

      ["SKU FSC rule", p.fsc_bag_policy_label || "—"],

      ["Source charcoal FSC", p.fsc_source_charcoal || p.fsc_status || "—"],

    ].forEach(function (pair) {

      dl.appendChild(ui.el("dt", {}, [pair[0]]));

      dl.appendChild(ui.el("dd", {}, [pair[1]]));

    });

    wrap.appendChild(dl);

    if (p.mixed_producers) {

      wrap.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
        "This pallet draws from more than one source bulk bag — kg below are packaging allocations.",
      ]));

    }

    var allocs = p.source_allocations || [];
    if (allocs.length || (p.input_bags || []).length) {

      wrap.appendChild(ui.el("h4", {}, ["Source bulk bag BAG IDs"]));

      var blist = ui.el("ul", { class: "bs-dash-pallet-sources" });

      if (allocs.length) {
        allocs.forEach(function (a) {
          var line = (a.serial || "—") + " · " + fmtMass(a.kg, true);
          if (a.fsc_status && a.fsc_status !== "—") line += " · " + a.fsc_status;
          blist.appendChild(ui.el("li", {}, [line]));
        });
      } else {
        p.input_bags.forEach(function (s) {
          blist.appendChild(ui.el("li", {}, [s]));
        });
      }

      wrap.appendChild(blist);

    }

    return wrap;

  }



  function renderFactoryPalletsDrill(detail, ui, onOpenProduct) {

    var wrap = ui.el("div", { class: "bs-dash-basket-drill" });

    wrap.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
      "Physical pallets created when an A4 pallet label was scanned at wrapping. Tap a product, then a BAG ID for lineage.",
    ]));

    var grid = ui.el("div", { class: "bs-dash-status-grid" });

    (detail.by_product || []).forEach(function (bucket) {

      if (!(bucket.bags || 0)) return;

      var card = ui.el("button", {

        class: "bs-dash-status-card bs-dash-status-card--pallet",

        type: "button",

        onclick: function () { onOpenProduct(bucket); },

      });

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__label" }, [
        bucket.product_code + (bucket.name ? " — " + bucket.name : ""),
      ]));

      card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(bucket.bags)]));

      var subParts = [fmtMass(bucket.kg)];
      if (bucket.fsc_bag_policy_label) subParts.push(bucket.fsc_bag_policy_label);
      card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [subParts.join(" · ")]));

      grid.appendChild(card);

    });

    if (!grid.childNodes.length) {

      wrap.appendChild(ui.el("p", { class: "bs-dash-empty muted" }, [
        "No physical pallets at packaging yet — scan an A4 pallet label at wrapping to create one.",
      ]));

    } else {

      wrap.appendChild(grid);

    }

    return wrap;

  }



  var SUPPLIER_MODE_FSC = {
    carbo_fsc: "FSC Carbo",
    noncarbo_fsc: "FSC Other",
    non_fsc: "Non-FSC",
  };

  var FSC_TONE = {
    "FSC Carbo": "carbo",
    "FSC Other": "other",
    "Non-FSC": "non",
    "Mixed FSC": "mixed",
    "FSC only": "fsc",
    "Non-FSC only": "non",
    FSC: "fsc",
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
    if (key === "NONCARBO_FSC" || key === "EXTERNAL_FSC" || key === "OTHER_FSC") {
      return "FSC Other";
    }
    return text;
  }

  function buildProductBucketsFromRows(rows) {
    var map = {};
    (rows || []).forEach(function (row) {
      var code = (row.product_code || "—").trim() || "—";
      if (!map[code]) {
        map[code] = { product_code: code, bags: 0, kg: 0, rows: [] };
      }
      map[code].bags += 1;
      map[code].kg += Number(row.net_weight_kg || 0);
      map[code].rows.push(row);
    });
    return Object.keys(map).sort().map(function (k) {
      var b = map[k];
      b.kg = Math.round(b.kg * 1000) / 1000;
      return b;
    });
  }

  function flattenPalletSectionRows(sections) {
    var rows = [];
    (sections || []).forEach(function (section) {
      (section.rows || []).forEach(function (row) {
        rows.push(row);
      });
    });
    return sortPalletFlattenedRows(rows);
  }

  function traceabilityColumnCell(row) {
    var stream = String(row.product_stream || "").toLowerCase();
    if (stream === "pallet") {
      if (row.content_traceability) return row.content_traceability;
      var code = (row.product_code || "").trim();
      var prefix = code ? code + " · " : "Pallet · ";
      if (row.mixed_producers) {
        var n = row.producer_mix && row.producer_mix.length;
        return prefix + (n ? "Mixed (" + n + " sources)" : "Mixed sources") + " — tap for split";
      }
      if (row.producer_name) return prefix + "1 source · " + row.producer_name;
      return prefix + "Tap bag for source bulk bags";
    }
    return (row.producer_name || "").trim() || "Unknown producer";
  }

  function traceabilityGroupLabel(row) {
    if (String(row.product_stream || "").toLowerCase() === "pallet") {
      return traceabilityColumnCell(row);
    }
    return (row.producer_name || "").trim() || "Unknown producer";
  }

  function producerSnapshotObj(row) {
    var snap = row && row.producer_snapshot;
    if (!snap) return null;
    if (typeof snap === "object") return snap;
    try {
      return JSON.parse(snap);
    } catch (e) {
      return null;
    }
  }

  function fscText(row) {
    var label = normalizeFscLabel(row.fsc_status);
    if (label && label !== "—") return label;
    label = normalizeFscLabel(row.fsc_classification);
    if (label) return label;
    var snap = producerSnapshotObj(row);
    if (snap) {
      label = normalizeFscLabel(snap.classification);
      if (label) return label;
    }
    var mode = String(row.supplier_mode || "").toLowerCase();
    if (SUPPLIER_MODE_FSC[mode]) return SUPPLIER_MODE_FSC[mode];
    if (row.is_fsc === true) return "FSC";
    if (row.is_fsc === false) return "Non-FSC";
    return "Unknown";
  }

  function isPalletBasketTile(st) {
    return st && (st.kind === "pallet_basket" || st.key === "report:pallet_basket");
  }

  function isPhysicalPalletsTile(st) {
    return st && (st.kind === "physical_pallets" || st.key === "report:physical_pallets");
  }

  function summarizeStreamCategories(rows) {
    var out = {};
    WX_STREAM_ORDER.forEach(function (key) {
      out[key] = { bags: 0, kg: 0 };
    });
    (rows || []).forEach(function (row) {
      var key = row.product_stream;
      if (!out[key]) return;
      out[key].bags += 1;
      out[key].kg += Number(row.net_weight_kg || 0);
    });
    Object.keys(out).forEach(function (key) {
      out[key].kg = Math.round(out[key].kg * 10) / 10;
    });
    return out;
  }

  function renderStreamCategorySummary(rows, ui) {
    var cats = summarizeStreamCategories(rows);
    var totalKg = 0;
    WX_STREAM_ORDER.forEach(function (key) { totalKg += cats[key].kg || 0; });
    var scale = totalKg || 1;
    var panel = ui.el("section", { class: "bs-dash-cat-summary" });
    panel.appendChild(ui.el("h4", { class: "bs-dash-cat-summary__title" }, ["Categories"]));
    var grid = ui.el("div", { class: "bs-dash-cat-grid" });
    WX_STREAM_ORDER.forEach(function (key) {
      var c = cats[key];
      if (!(c.bags || 0)) return;
      var card = ui.el("div", { class: "bs-dash-cat-card" });
      card.style.setProperty("--cat-color", STREAM_COLORS[key]);
      var labelRow = ui.el("div", { class: "bs-dash-cat-card__label-row" });
      labelRow.appendChild(streamSwatch(key, "bs-dash-cat-card__swatch"));
      labelRow.appendChild(ui.el("span", { class: "bs-dash-cat-card__label" }, [STREAM_LABELS[key]]));
      card.appendChild(labelRow);
      card.appendChild(ui.el("div", { class: "bs-dash-cat-card__value" }, [String(c.bags)]));
      card.appendChild(ui.el("span", { class: "bs-dash-cat-card__sub" }, [fmtMass(c.kg)]));
      var track = ui.el("div", { class: "bs-dash-cat-card__track" });
      track.appendChild(applyStyles(ui.el("div", { class: "bs-dash-cat-card__fill" }), {
        width: Math.max((c.kg / scale) * 100, 4) + "%",
        background: STREAM_COLORS[key],
      }));
      card.appendChild(track);
      grid.appendChild(card);
    });
    panel.appendChild(grid);
    return panel;
  }

  function groupRowsByProducerFsc(rows) {
    var map = {};
    (rows || []).forEach(function (row) {
      var producer = traceabilityGroupLabel(row);
      var fsc = fscText(row);
      var key = producer + "\0" + fsc;
      if (!map[key]) {
        map[key] = {
          producer: producer,
          fsc: fsc,
          bags: 0,
          kg: 0,
          rows: [],
        };
      }
      map[key].bags += 1;
      map[key].kg += Number(row.net_weight_kg || 0);
      map[key].rows.push(row);
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) {
      var pc = a.producer.localeCompare(b.producer);
      if (pc !== 0) return pc;
      return a.fsc.localeCompare(b.fsc);
    });
    list.forEach(function (g) {
      g.kg = Math.round(g.kg * 10) / 10;
      g.rows = sortProducerGroupRows(g.rows);
    });
    return list;
  }

  function renderFscPill(label, ui) {
    var tone = FSC_TONE[label] || "unknown";
    return ui.el("span", { class: "bs-dash-fsc-pill bs-dash-fsc-pill--" + tone }, [label]);
  }

  function fscTableCell(row, ui) {
    var td = ui.el("td", { class: "bs-dash-fsc-cell" });
    td.appendChild(renderFscPill(fscText(row), ui));
    return td;
  }

  function renderProducerBagTable(rows, ui, onRowClick) {
    rows = sortDrillRowsForDisplay(rows);
    var wrap = ui.el("div", { class: "bs-dash-table-wrap" });
    var table = ui.el("table", { class: "bs-dash-table bs-dash-table--compact" });
    var thead = ui.el("thead", {});
    var hr = ui.el("tr", {});
    ["Bag", "Stream", "FSC", "kg", "Status since", "Weathering", "Detail"].forEach(function (h) {
      hr.appendChild(ui.el("th", {}, [h]));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = ui.el("tbody", {});
    rows.forEach(function (row) {
      var tr = ui.el("tr", {});
      if (onRowClick && row.product_stream === "pallet") {
        tr.className = "bs-dash-table-row--clickable";
        tr.title = "View source bulk bags and producers";
        tr.addEventListener("click", function () { onRowClick(row); });
      }
      tr.appendChild(ui.el("td", {}, [row.serial || "—"]));
      var streamTd = ui.el("td", {});
      var streamKey = row.product_stream;
      if (streamKey && STREAM_COLORS[streamKey]) {
        streamTd.appendChild(ui.el("span", {
          class: "bs-dash-stream-pill",
          style: { background: STREAM_COLORS[streamKey] + "22", color: STREAM_COLORS[streamKey] },
        }, [streamText(row)]));
      } else {
        streamTd.appendChild(document.createTextNode(streamText(row)));
      }
      tr.appendChild(streamTd);
      tr.appendChild(fscTableCell(row, ui));
      tr.appendChild(ui.el("td", {}, [fmtMass(row.net_weight_kg, true)]));
      tr.appendChild(ui.el("td", {}, [scanTimestampCell(row)]));
      tr.appendChild(ui.el("td", {}, [weatherText(row)]));
      tr.appendChild(ui.el("td", { class: "bs-dash-muted" }, [movementDetailCell(row)]));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderDrillLoading(label, ui) {
    var panel = ui.el("div", { class: "bs-dash-drill-loading", role: "status" });
    panel.appendChild(ui.el("div", { class: "bs-dash-spinner", "aria-hidden": "true" }));
    panel.appendChild(ui.el("p", {}, ["Loading " + (label || "bags") + "…"]));
    return panel;
  }

  function renderWxProducerList(rows, ui, onRowClick) {
    var groups = groupRowsByProducerFsc(rows);
    var list = ui.el("div", { class: "bs-dash-producer-list" });
    groups.forEach(function (group) {
      var details = ui.el("details", {
        class: "bs-dash-producer-group",
      });
      var summary = ui.el("summary", { class: "bs-dash-producer-summary" });
      summary.appendChild(ui.el("span", { class: "bs-dash-producer-summary__name" }, [group.producer]));
      summary.appendChild(renderFscPill(group.fsc, ui));
      summary.appendChild(ui.el("span", { class: "bs-dash-producer-summary__meta" }, [
        bagsKgText(group.bags, group.kg),
      ]));
      details.appendChild(summary);
      details.appendChild(renderProducerBagTable(group.rows, ui, onRowClick));
      list.appendChild(details);
    });
    return list;
  }

  function renderWxDrillStreamFscGroups(rows, ui, onPickSlice) {
    var summary = summarizeWxDrillStreamFsc(rows);
    var panel = ui.el("section", { class: "bs-dash-wx-slice-board" });
    panel.appendChild(ui.el("h4", { class: "bs-dash-wx-slice-board__title" }, [
      "By category — FSC and non-FSC",
    ]));
    panel.appendChild(ui.el("p", { class: "bs-dash-wx-slice-board__lead muted" }, [
      "Pick a tile for producers in that stream and FSC group only.",
    ]));
    var grid = ui.el("div", { class: "bs-dash-wx-slice-grid" });
    WX_DRILL_GROUP_STREAMS.forEach(function (stream) {
      var cat = summary[stream];
      var totalBags = (cat.fsc.bags || 0) + (cat.non_fsc.bags || 0);
      if (!totalBags) return;
      var color = STREAM_COLORS[stream] || "#64748B";
      var box = ui.el("div", {
        class: "bs-dash-wx-slice-group",
        style: { "--wx-slice-color": color },
      });
      var head = ui.el("div", { class: "bs-dash-wx-slice-group__head" });
      head.appendChild(streamSwatch(stream, "bs-dash-wx-slice-group__swatch"));
      head.appendChild(ui.el("span", { class: "bs-dash-wx-slice-group__name" }, [STREAM_LABELS[stream]]));
      box.appendChild(head);
      var pair = ui.el("div", { class: "bs-dash-wx-slice-pair" });
      [
        { key: "fsc", label: STREAM_LABELS[stream] + " FSC", data: cat.fsc },
        { key: "non_fsc", label: STREAM_LABELS[stream] + " non-FSC", data: cat.non_fsc },
      ].forEach(function (slot) {
        if (!(slot.data.bags || 0)) return;
        var btn = ui.el("button", {
          type: "button",
          class: "bs-dash-wx-slice-tile",
          onclick: function () {
            onPickSlice({ stream: stream, fscGroup: slot.key, label: slot.label });
          },
        });
        btn.appendChild(ui.el("span", { class: "bs-dash-wx-slice-tile__label" }, [slot.label]));
        btn.appendChild(ui.el("div", { class: "bs-dash-wx-slice-tile__value" }, [String(slot.data.bags)]));
        btn.appendChild(ui.el("span", { class: "bs-dash-wx-slice-tile__sub" }, [fmtMass(slot.data.kg)]));
        pair.appendChild(btn);
      });
      box.appendChild(pair);
      grid.appendChild(box);
    });
    if (!grid.childNodes.length) {
      panel.appendChild(ui.el("p", { class: "bs-dash-empty muted" }, [
        "No restaurant, lumpwood, fines, or briquette bags in this selection.",
      ]));
    } else {
      panel.appendChild(grid);
    }
    return panel;
  }

  function renderWxDrillView(wxDrillState, ui, onRowClick, onSliceChange) {
    var wrap = ui.el("div", { class: "bs-dash-wx-drill" });
    var rows = (wxDrillState && wxDrillState.rows) || [];
    var slice = wxDrillState && wxDrillState.slice;
    if (slice) {
      var sliceRows = rowsForWxDrillSlice(rows, slice.stream, slice.fscGroup);
      wrap.appendChild(ui.el("h4", { class: "bs-dash-wx-slice-heading" }, [slice.label]));
      wrap.appendChild(ui.el("p", { class: "bs-dash-wx-slice-heading__meta muted" }, [
        sliceRows.length + " bags · " + fmtMass(sliceRows.reduce(function (s, r) {
          return s + (Number(r.net_weight_kg) || 0);
        }, 0)),
      ]));
      if (!sliceRows.length) {
        wrap.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No bags in this group."]));
      } else {
        wrap.appendChild(renderWxProducerList(sliceRows, ui, onRowClick));
      }
      return wrap;
    }
    wrap.appendChild(renderWxDrillStreamFscGroups(rows, ui, function (nextSlice) {
      if (onSliceChange) onSliceChange(nextSlice);
    }));
    return wrap;
  }

  function renderDrillTable(rows, ui, onRowClick) {
    rows = sortDrillRowsForDisplay(rows);

    var wrap = ui.el("div", { class: "bs-dash-table-wrap" });

    var table = ui.el("table", { class: "bs-dash-table" });

    var thead = ui.el("thead", {});

    var hr = ui.el("tr", {});

    ["#", "Bag", "Stream", "Source / traceability", "FSC", "kg", "Status since", "Weathering", "Detail"].forEach(function (h) {

      hr.appendChild(ui.el("th", {}, [h]));

    });

    thead.appendChild(hr);

    table.appendChild(thead);

    var tbody = ui.el("tbody", {});

    rows.forEach(function (row, i) {

      var tr = ui.el("tr", {});

      if (onRowClick && row.product_stream === "pallet") {

        tr.className = "bs-dash-table-row--clickable";

        tr.title = "View source bulk bags and producers";

        tr.addEventListener("click", function () { onRowClick(row); });

      }

      tr.appendChild(ui.el("td", { class: "bs-dash-muted" }, [String(i + 1)]));

      tr.appendChild(ui.el("td", {}, [row.serial || "—"]));

      var streamTd = ui.el("td", {});

      var streamKey = row.product_stream;

      if (streamKey && STREAM_COLORS[streamKey]) {

        streamTd.appendChild(ui.el("span", {

          class: "bs-dash-stream-pill",

          style: { background: STREAM_COLORS[streamKey] + "22", color: STREAM_COLORS[streamKey] },

        }, [streamText(row)]));

      } else {

        streamTd.appendChild(document.createTextNode(streamText(row)));

      }

      tr.appendChild(streamTd);

      tr.appendChild(ui.el("td", {}, [traceabilityColumnCell(row)]));

      tr.appendChild(fscTableCell(row, ui));

      tr.appendChild(ui.el("td", {}, [fmtMass(row.net_weight_kg, true)]));

      tr.appendChild(ui.el("td", {}, [statusDetailCell(row)]));

      tr.appendChild(ui.el("td", {}, [weatherText(row)]));

      tr.appendChild(ui.el("td", { class: "bs-dash-muted" }, [movementDetailCell(row)]));

      tbody.appendChild(tr);

    });

    table.appendChild(tbody);

    wrap.appendChild(table);

    return wrap;

  }



  function renderEventCards(sections, ui, onOpen) {

    var wrap = ui.el("div", { class: "bs-dash-status-grid" });

    sections.forEach(function (section) {

      var card = ui.el("button", {

        class: "bs-dash-status-card bs-dash-status-card--event",

        type: "button",

        onclick: function () { onOpen(section); },

      });

      var dayLabel = fmtDayHeading(section.date);
      card.appendChild(ui.el("span", { class: "bs-dash-status-card__label" }, [dayLabel]));

      card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(section.bags)]));

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtMass(section.kg)]));

      var dest = section.client_name || section.container_number;

      if (dest) card.appendChild(ui.el("span", { class: "bs-dash-status-card__dest" }, [dest]));

      appendStreamSplitFooter(card, section.streams, ui);

      wrap.appendChild(card);

    });

    return wrap;

  }



  async function render(container, ctx) {

    var ui = CIS.ui;

    container.innerHTML = "";
    container.className = "module-content bs-dashboard-host";



    var summary = null;

    var weathering = null;

    var selected = null;

    var selectedEvent = null;

    var wxDrill = null;
    var wxDrillToken = 0;
    var drillFetchToken = 0;
    /** Nav state to restore when Back is pressed during a drill API fetch. */
    var navSnapshotBeforeFetch = null;
    var walvisStorageReport = null;
    var walvisTransitReport = null;

    var bagSearch = null;



    var dash = ui.el("div", { class: "bs-dashboard" });

    var headerEl = ui.el("header", { class: "bs-dash-header" }, [

      ui.el("h2", { class: "bs-dash-title" }, ["Bags Status"]),

      ui.el("p", { class: "bs-dash-lead" }, [

        "Where bags are now, and how the 21-day weathering clock is running.",

      ]),

      renderStreamLegend(ui),

    ]);

    var bagSearchHost = ui.el("div", { class: "bs-dash-bag-search-host" });

    headerEl.appendChild(bagSearchHost);

    dash.appendChild(headerEl);

    container.appendChild(dash);



    var refreshNote = ui.el("p", { class: "bm-refresh-note muted", hidden: true }, [""]);

    dash.appendChild(refreshNote);

    var status = ui.el("p", { class: "bs-dash-loading" }, ["Loading…"]);

    dash.appendChild(status);

    var body = ui.el("div", { class: "bs-dash-body" });

    dash.appendChild(body);



    function buildWxDrillQuery(sel) {

      var q = [];

      if (sel.bucket) q.push("bucket=" + encodeURIComponent(sel.bucket));

      if (sel.week) q.push("week=" + encodeURIComponent(sel.week));

      if (sel.pipeline_location) {
        q.push("pipeline_location=" + encodeURIComponent(sel.pipeline_location));
      }

      if (sel.pipeline_clock) {
        q.push("pipeline_clock=" + encodeURIComponent(sel.pipeline_clock));
      }

      return "/reports/bags-weathering?" + q.join("&");

    }



    function goBackFromWxDrill() {
      if (wxDrill && wxDrill.slice) {
        wxDrill.slice = null;
        paint();
        return;
      }
      wxDrillToken += 1;
      var backTo = wxDrill && wxDrill.backTo;
      var backDispatch = wxDrill && wxDrill.backDispatch;
      wxDrill = null;
      if (backTo === "walvis_dispatch" && backDispatch) {
        selected = {
          key: WALVIS_STORAGE_STATUS,
          mode: "walvis_storage_dispatch",
          dispatch: backDispatch,
          walvisReport: walvisStorageReport,
        };
      } else if (backTo === "walvis_transit_dispatch" && backDispatch) {
        selected = {
          key: WALVIS_TRANSIT_STATUS,
          mode: "walvis_transit_dispatch",
          dispatch: backDispatch,
          walvisReport: walvisTransitReport,
        };
      } else if (backTo === "walvis_unassigned") {
        selected = {
          key: "walvis:unassigned",
          mode: "walvis_unassigned_hub",
          unassigned: (walvisStorageReport && walvisStorageReport.unassigned) || {},
          walvisReport: walvisStorageReport,
        };
      } else if (backTo === "walvis_transit_unassigned") {
        selected = {
          key: "walvis:transit:unassigned",
          mode: "walvis_transit_unassigned_hub",
          unassigned: (walvisTransitReport && walvisTransitReport.unassigned) || {},
          walvisReport: walvisTransitReport,
        };
      } else if (backTo === "walvis_transit_hub") {
        selected = {
          key: WALVIS_TRANSIT_STATUS,
          label: "In transit — Walvis Bay",
          mode: "walvis_transit_hub",
          walvisReport: walvisTransitReport,
        };
      }
      paint();
    }

    function repaintBagSearchBar() {
      bagSearchHost.innerHTML = "";
      bagSearchHost.appendChild(
        renderBagSearchBar(
          ui,
          bagSearch,
          function (serial) {
            void runBagSearch(serial);
          },
          function () {
            bagSearch = null;
            selected = null;
            wxDrill = null;
            selectedEvent = null;
            paint();
          }
        )
      );
    }

    async function runBagSearch(serial) {
      if (!serial) {
        bagSearch = { active: false, error: "Enter a BAG serial." };
        repaintBagSearchBar();
        return;
      }
      if (!ctx.api || !ctx.api.traceability) {
        bagSearch = { active: true, serial: serial, error: "Traceability API not configured." };
        repaintBagSearchBar();
        return;
      }
      bagSearch = { active: true, serial: serial, loading: true, error: null };
      selected = null;
      wxDrill = null;
      selectedEvent = null;
      repaintBagSearchBar();
      paint();
      try {
        var data = await ctx.api.traceability(
          "/reports/bags-status/lookup?serial=" + encodeURIComponent(serial)
        );
        bagSearch = {
          active: true,
          serial: serial,
          loading: false,
          data: data,
          error: null,
        };
      } catch (e) {
        bagSearch = {
          active: true,
          serial: serial,
          loading: false,
          error: e.message || String(e),
        };
      }
      repaintBagSearchBar();
      paint();
    }

    function captureNavState() {
      return {
        selected: selected,
        selectedEvent: selectedEvent,
        wxDrill: wxDrill,
        bagSearch: bagSearch,
      };
    }

    function restoreNavState(snap) {
      if (!snap) return;
      selected = snap.selected;
      selectedEvent = snap.selectedEvent;
      wxDrill = snap.wxDrill;
      bagSearch = snap.bagSearch;
    }

    function cancelDrillFetchAndRestore() {
      drillFetchToken += 1;
      wxDrillToken += 1;
      var snap = navSnapshotBeforeFetch;
      navSnapshotBeforeFetch = null;
      restoreNavState(snap);
      paint();
    }

    function finishDrillFetch(token) {
      if (token === drillFetchToken) {
        navSnapshotBeforeFetch = null;
      }
    }

    function syncFloatingNav() {
      if (!ctx.setFloatingBack) return;
      if (navSnapshotBeforeFetch) {
        ctx.setFloatingBack({
          onClick: cancelDrillFetchAndRestore,
        });
        if (ctx.releaseFloatBackCooldown) ctx.releaseFloatBackCooldown();
        return;
      }
      if (wxDrill) {
        ctx.setFloatingBack({ onClick: goBackFromWxDrill });
      } else if (selected) {
        if (selected.palletDetail) {
          ctx.setFloatingBack({
            onClick: function () {
              selected.palletDetail = null;
              selected.serial = null;
              if (selected.fromBagSearch) {
                selected = null;
              }
              paint();
            },
          });
        } else if (selectedEvent) {
          ctx.setFloatingBack({
            onClick: function () {
              selectedEvent = null;
              paint();
            },
          });
        } else if (selected.view === "by_location") {
          ctx.setFloatingBack({
            onClick: function () {
              selected.view = "locations";
              selected.label = selected.parentLabel || "Pallets";
              selected.sections = null;
              selected.detail = null;
              selected.count = selected.parentCount != null ? selected.parentCount : selected.count;
              paint();
            },
          });
        } else if (selected.view === "by_product") {
          ctx.setFloatingBack({
            onClick: function () {
              selected = null;
              paint();
            },
          });
        } else if (selected.mode === "walvis_storage_dispatch") {
          ctx.setFloatingBack({
            onClick: function () {
              selected = {
                key: WALVIS_STORAGE_STATUS,
                label: "In storage — Carbo Yard",
                mode: "walvis_storage_hub",
                walvisReport: walvisStorageReport,
              };
              paint();
            },
          });
        } else if (selected.mode === "walvis_unassigned_hub") {
          ctx.setFloatingBack({
            onClick: function () {
              selected = {
                key: WALVIS_STORAGE_STATUS,
                label: "In storage — Carbo Yard",
                mode: "walvis_storage_hub",
                walvisReport: walvisStorageReport,
              };
              paint();
            },
          });
        } else if (selected.mode === "walvis_transit_dispatch") {
          ctx.setFloatingBack({
            onClick: function () {
              selected = {
                key: WALVIS_TRANSIT_STATUS,
                label: "In transit — Walvis Bay",
                mode: "walvis_transit_hub",
                walvisReport: walvisTransitReport,
              };
              paint();
            },
          });
        } else if (selected.mode === "walvis_transit_unassigned_hub") {
          ctx.setFloatingBack({
            onClick: function () {
              selected = {
                key: WALVIS_TRANSIT_STATUS,
                label: "In transit — Walvis Bay",
                mode: "walvis_transit_hub",
                walvisReport: walvisTransitReport,
              };
              paint();
            },
          });
        } else {
          ctx.setFloatingBack({
            onClick: function () {
              selected = null;
              paint();
            },
          });
        }
      } else if (bagSearch && bagSearch.active) {
        ctx.setFloatingBack({
          onClick: function () {
            bagSearch = null;
            paint();
          },
        });
      } else {
        ctx.setFloatingBack(null);
      }
      if (ctx.releaseFloatBackCooldown) ctx.releaseFloatBackCooldown();
    }

    function showDrillLoadingPanel(title) {
      status.style.display = "none";
      body.innerHTML = "";
      body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [title || "Bags"]));
      body.appendChild(renderDrillLoading(title, ui));
      if (container && typeof container.scrollTop === "number") {
        container.scrollTop = 0;
      }
      syncFloatingNav();
    }

    function beginDrillFetch(title) {
      navSnapshotBeforeFetch = captureNavState();
      drillFetchToken += 1;
      var token = drillFetchToken;
      showDrillLoadingPanel(title);
      return token;
    }

    function drillFetchCancelled(token) {
      return token !== drillFetchToken;
    }

    async function openWxDrill(sel, opts) {
      opts = opts || {};
      navSnapshotBeforeFetch = captureNavState();
      var token = wxDrillToken + 1;
      wxDrillToken = token;
      wxDrill = null;
      if (!opts.keepSelected) {
        selected = null;
        selectedEvent = null;
      }
      showDrillLoadingPanel(sel.label || "Bags");

      try {
        var data = await ctx.api.traceability(buildWxDrillQuery(sel));
        if (token !== wxDrillToken) return;
        var wxRows = (data.drill && data.drill.rows) || [];
        if (selected && isFactoryStorageBagStatus(selected.key)) {
          wxRows = wxRows.filter(function (r) {
            return (r.product_stream || "").toLowerCase() !== "pallet";
          });
        }
        wxDrill = {
          label: sel.label,
          rows: wxRows,
          querySel: sel,
          backTo: opts.backTo || "main",
          note: opts.note || null,
          slice: null,
        };
        navSnapshotBeforeFetch = null;
        paint();
      } catch (e) {
        if (token !== wxDrillToken) return;
        navSnapshotBeforeFetch = null;
        body.innerHTML = "";
        body.appendChild(ui.error("Could not load bags: " + (e.message || e)));
        syncFloatingNav();
      }
    }



    function paint() {

      body.innerHTML = "";

      repaintBagSearchBar();

      if (!summary) return;



      if (selected && selected.palletDetail) {

        body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

          (selected.label || "Pallet") + " — " + selected.serial,

        ]));

        body.appendChild(renderPalletDetailDrill(selected.serial, selected.palletDetail, ui));

        syncFloatingNav();
        return;

      }

      if (bagSearch && bagSearch.active) {
        body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [
          "Search — " + (bagSearch.serial || "BAG ID"),
        ]));
        if (bagSearch.loading) {
          body.appendChild(renderDrillLoading("Looking up " + bagSearch.serial, ui));
          syncFloatingNav();
          return;
        }
        if (bagSearch.error && !bagSearch.data) {
          syncFloatingNav();
          return;
        }
        var hit = bagSearch.data;
        if (hit && hit.kind === "label_only" && hit.label) {
          body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
            "Label registered but no production/intake bag row yet — status: ",
            hit.label.status || "—",
            hit.label.note ? " · " + hit.label.note : "",
          ]));
          syncFloatingNav();
          return;
        }
        if (hit && hit.row) {
          body.appendChild(ui.el("p", { class: "bs-dash-drill-note bs-dash-bag-search__status" }, [
            ui.el("strong", {}, ["Bag status: "]),
            hit.row.status_display || hit.row.effective_status || hit.row.storage_status || "—",
          ]));
          if (hit.is_pallet) {
            body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
              "Physical pallet — tap the row or ",
              ui.el("strong", {}, ["View contributors"]),
              " for source bulk bags and kg.",
            ]));
            var openBtn = ui.el("button", {
              class: "bs-dash-bag-search__drill btn btn-sm",
              type: "button",
              onclick: function () {
                openPalletDetail(hit.row);
              },
            }, ["View contributors"]);
            body.appendChild(openBtn);
          }
          body.appendChild(renderDrillTable([hit.row], ui, openPalletDetail));
        } else if (!bagSearch.error) {
          body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No matching bag."]));
        }
        syncFloatingNav();
        return;
      }



      if (wxDrill) {

        var wxRows = wxDrill.rows || [];
        var wxPalletList =
          !wxDrill.slice &&
          (wxDrill.view === "pallet_table" || wxDrillRowsAreAllPallets(wxRows));
        var wxTitle = wxDrill.slice
          ? wxDrill.label + " — " + wxDrill.slice.label
          : wxPalletList
            ? wxDrill.label + " — " + wxRows.length + (wxRows.length === 1 ? " pallet" : " pallets")
            : wxDrill.label + " — " + wxRows.length + " bags";

        body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [wxTitle]));

        if (wxDrill.note && !wxDrill.slice) {
          body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [wxDrill.note]));
        }

        if (!wxRows.length) {

          body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No bags in this bucket."]));

        } else if (wxPalletList) {

          if (!wxDrill.note) {
            body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
              "Physical pallet BAG IDs — tap a row for product mix and source bulk bags.",
            ]));
          }
          body.appendChild(renderDrillTable(wxRows, ui, openPalletDetail));

        } else {

          body.appendChild(renderWxDrillView(wxDrill, ui, openPalletDetail, function (slice) {
            wxDrill.slice = slice;
            paint();
          }));

        }

        syncFloatingNav();
        return;

      }



      if (selected) {

        if (selected.key === "packed_into_pallet") {

          body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
            "These are source bulk bags consumed at packing — end of life. "
              + "They are not physical pallets. See Packing — pallet production below.",
          ]));

        }



        if (selected.mode === "walvis_storage_hub") {
          body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [selected.label || "In storage — Carbo Yard"]));
          if (selected.walvisReportLoading) {
            body.appendChild(renderDrillLoading("Carbo yard — by dispatch", ui));
            syncFloatingNav();
            return;
          }
          if (selected.walvisReportError) {
            body.appendChild(ui.error(selected.walvisReportError));
            syncFloatingNav();
            return;
          }
          renderWalvisStorageDispatchHub(
            body,
            selected.walvisReport || walvisStorageReport,
            selected.palletBucket,
            ui,
            openStatus
          );
          syncFloatingNav();
          return;
        }

        if (selected.mode === "walvis_transit_hub") {
          body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [selected.label || "In transit — Walvis Bay"]));
          if (selected.walvisReportLoading) {
            body.appendChild(renderDrillLoading("In transit — by dispatch", ui));
            syncFloatingNav();
            return;
          }
          if (selected.walvisReportError) {
            body.appendChild(ui.error(selected.walvisReportError));
            syncFloatingNav();
            return;
          }
          renderWalvisTransitDispatchHub(body, selected.walvisReport || walvisTransitReport, ui, openStatus);
          syncFloatingNav();
          return;
        }

        if (selected.mode === "walvis_storage_dispatch") {
          body.appendChild(
            ui.el("h3", { class: "bs-dash-drill-title" }, [
              selected.dispatch ? walvisDispatchDisplayLabel(selected.dispatch) : "Dispatch",
            ])
          );
          renderWalvisStorageDispatchCategories(body, selected.dispatch || {}, ui, openStatus);
          syncFloatingNav();
          return;
        }

        if (selected.mode === "walvis_transit_dispatch") {
          body.appendChild(
            ui.el("h3", { class: "bs-dash-drill-title" }, [
              selected.dispatch ? walvisDispatchDisplayLabel(selected.dispatch) : "Dispatch",
            ])
          );
          renderWalvisTransitDispatchCategories(body, selected.dispatch || {}, ui, openStatus);
          syncFloatingNav();
          return;
        }

        if (selected.mode === "walvis_unassigned_hub") {
          body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, ["Not on a dispatch manifest"]));
          body.appendChild(
            ui.el("p", { class: "bs-dash-drill-note" }, [
              "These bulk bags are in Carbo yard storage but were never linked to a GF truck manifest. Tap a category for detail.",
            ])
          );
          var unHub = selected.unassigned || {};
          appendStatusCards(
            body,
            (unHub.categories || []).map(function (cat) {
              var streamKey = cat.product_stream || "unknown";
              return {
                key: "walvis:unassigned:cat:" + streamKey,
                kind: "walvis_dispatch_category",
                label: STREAM_LABELS[streamKey] || streamKey,
                bags: cat.bags || 0,
                kg: cat.kg || 0,
                streams: {},
                rows: cat.rows || [],
                dispatch: null,
              };
            }),
            ui,
            null,
            openStatus,
            "bs-dash-status-grid--inline"
          );
          syncFloatingNav();
          return;
        }

        if (selected.mode === "walvis_transit_unassigned_hub") {
          body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, ["Not on a dispatch manifest"]));
          body.appendChild(
            ui.el("p", { class: "bs-dash-drill-note" }, [
              "These bags are in transit but were not linked to a GF truck manifest when scanned. Tap a category for detail.",
            ])
          );
          var unTransit = selected.unassigned || {};
          appendStatusCards(
            body,
            (unTransit.categories || []).map(function (cat) {
              var streamKey = cat.product_stream || "unknown";
              return {
                key: "walvis:transit:unassigned:cat:" + streamKey,
                kind: "walvis_dispatch_category",
                transit: true,
                label: STREAM_LABELS[streamKey] || streamKey,
                bags: cat.bags || 0,
                kg: cat.kg || 0,
                streams: {},
                rows: cat.rows || [],
                dispatch: null,
              };
            }),
            ui,
            null,
            openStatus,
            "bs-dash-status-grid--inline"
          );
          syncFloatingNav();
          return;
        }

        if (selected.mode === "pallet_basket") {

          body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [selected.label]));

          body.appendChild(renderPalletBasketDrill(summary.pallet_basket || selected.detail, ui));

          syncFloatingNav();
          return;

        }



        if (selected.mode === "physical_pallets" && !selectedEvent && !selected.palletDetail) {

          if (selected.view === "flat_list") {

            body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

              selected.label + " — " + selected.count + (selected.count === 1 ? " pallet" : " pallets"),

            ]));

            body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
              "All physical pallet BAG IDs — tap a row for source bulk bags and producer mix (kg and %).",
            ]));

            if (!(selected.rows || []).length) {

              body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No pallets found."]));

            } else {

              body.appendChild(renderDrillTable(selected.rows, ui, openPalletDetail));

            }

            syncFloatingNav();
            return;

          }

          if (selected.view === "locations") {

            body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

              selected.label + " — " + selected.count + (selected.count === 1 ? " pallet" : " pallets"),

            ]));

            body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
              "Physical pallet BAG IDs by location — tap a tile, then a BAG ID for source bulk bags and producers.",
            ]));

            body.appendChild(renderPalletLocationDrill(selected.locationBuckets, ui, openPalletBucket));

            syncFloatingNav();
            return;

          }

          if (selected.view === "by_product") {

            body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

              selected.label + " — " + selected.count + (selected.count === 1 ? " pallet" : " pallets"),

            ]));

            body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
              "Tap a product, then a pallet BAG ID for source bulk bags and producers.",
            ]));

            body.appendChild(renderFactoryPalletsDrill(selected.detail, ui, function (bucket) {

              selectedEvent = {

                key: bucket.product_code,

                date: null,

                client_name: bucket.product_code + (bucket.name ? " — " + bucket.name : ""),

                bags: bucket.bags,

                kg: bucket.kg,

                rows: bucket.rows || [],

              };

              paint();

            }));

            syncFloatingNav();
            return;

          }

          if (selected.sections && selected.sections.length) {

            body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

              selected.label + " — " + selected.count + (selected.count === 1 ? " pallet" : " pallets"),

            ]));

            body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
              "Tap a pallet BAG ID for source bulk bags and producers.",
            ]));

            body.appendChild(renderEventCards(selected.sections, ui, function (section) {

              selectedEvent = section;

              paint();

            }));

          } else {

            body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [selected.label]));

            body.appendChild(renderFactoryPalletsDrill(selected.detail, ui, function (bucket) {

              selectedEvent = {

                key: bucket.product_code,

                date: null,

                client_name: bucket.product_code + (bucket.name ? " — " + bucket.name : ""),

                bags: bucket.bags,

                kg: bucket.kg,

                rows: bucket.rows || [],

              };

              paint();

            }));

          }

          syncFloatingNav();
          return;

        }



        if (selected.mode === "physical_pallets" && selectedEvent && !selected.palletDetail) {

          body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

            selected.label + " — " + (selectedEvent.client_name || selectedEvent.key || "Pallets")

              + " — " + selectedEvent.bags + (selectedEvent.bags === 1 ? " pallet" : " pallets"),

          ]));

          if (!(selectedEvent.rows || []).length) {

            body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No pallets in this group."]));

          } else {

            body.appendChild(renderDrillTable(selectedEvent.rows, ui, openPalletDetail));

          }

          syncFloatingNav();
          return;

        }



        if (selected.mode === "weathering_buckets" && !selectedEvent) {

          body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

            selected.label + " — by days remaining",

          ]));

          body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [

            "Factory yard only — days left on the weathering clock. Matches the At factory In Storage tiles.",

          ]));

          if (!selected.buckets.length) {

            body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No bags in this status."]));

          } else {

            body.appendChild(renderWxBucketCards(selected.buckets, ui, function (bucketSel) {
              openWxDrill({
                bucket: bucketSel.bucket,
                label: bucketSel.label,
                pipeline_location: "in_storage",
              }, { backTo: "status_buckets", keepSelected: true });
            }));

          }

          syncFloatingNav();
          return;

        }



        if (selectedEvent) {

          var dest = selectedEvent.client_name || selectedEvent.container_number;

          body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

            selected.label + " — " + fmtDayHeading(selectedEvent.date)

              + (dest ? " — " + dest : "")

              + " — " + selectedEvent.bags + (selectedEvent.bags === 1 ? " bag" : " bags"),

          ]));

          if (!(selectedEvent.rows || []).length) {

            body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No bags in this event."]));

          } else {

            body.appendChild(renderDrillTable(selectedEvent.rows, ui, openPalletDetail));

          }

          syncFloatingNav();
          return;

        }



        body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

          selected.label + " — " + selected.count + (selected.count === 1 ? " bag" : " bags")

            + " across " + selected.sections.length

            + (selected.sections.length === 1 ? " date" : " dates"),

        ]));

        if (!selected.sections.length) {

          body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No bags are in this status."]));

        } else {

          body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [

            "Each date is one cluster — three loads to the same destination on the same day count as one event.",

          ]));

          body.appendChild(renderEventCards(selected.sections, ui, function (section) {

            selectedEvent = section;

            paint();

          }));

        }

        syncFloatingNav();
        return;

      }



      body.appendChild(renderSummaryCards(summary, ui));

      if (weathering) {

        var grid = ui.el("div", { class: "bs-dash-grid" });

        grid.appendChild(renderWeatheringPanel(weathering, ui, openWxDrill));

        var side = ui.el("div", { class: "bs-dash-grid__side" });

        side.appendChild(renderWeekChart(weathering.end_weeks, ui, openWxDrill));

        grid.appendChild(side);

        body.appendChild(grid);

      }



      orderDashboardGroups(
        layoutTransitAndWalvisGroups(summary.groups, summary.status_totals)
      ).forEach(function (group) {

        body.appendChild(renderGroup(group, ui, null, openStatus, summary));

      });

      syncFloatingNav();
    }



    async function openPalletDetail(row) {

      if (!row || !row.serial) return;

      var token = beginDrillFetch("Pallet lineage — " + row.serial);

      try {

        var data = await ctx.api.traceability(

          "/reports/pallet-detail?serial=" + encodeURIComponent(row.serial)

        );

        if (drillFetchCancelled(token)) return;

        if (!selected) {

          selected = { label: "Pallet", mode: "pallet_detail", key: "pallet" };

        }

        if (bagSearch && bagSearch.active) {
          selected.fromBagSearch = true;
          selected.label = "Pallet search";
        }

        selected.palletDetail = data;

        selected.serial = row.serial;

        if (!selected.label) selected.label = "Pallet";

        finishDrillFetch(token);
        paint();

      } catch (e) {

        if (drillFetchCancelled(token)) return;

        finishDrillFetch(token);
        body.innerHTML = "";

        body.appendChild(ui.error("Could not load pallet: " + (e.message || e)));

        syncFloatingNav();

      }

    }



    async function openPalletBucket(bucket, statusKey) {

      var token = beginDrillFetch(bucket.label || "Pallets");

      try {

        var data = await ctx.api.traceability(

          bagsStatusDrillPath(statusKey, "pallet")

        );

        if (drillFetchCancelled(token)) return;

        selectedEvent = null;

        wxDrill = null;

        var parent = selected || {};

        var locRows = flattenPalletSectionRows(data.event_sections || []);

        if (!locRows.length && data.physical_pallets && data.physical_pallets.by_product) {

          (data.physical_pallets.by_product || []).forEach(function (b) {

            (b.rows || []).forEach(function (row) { locRows.push(row); });

          });

        }

        locRows = sortPalletFlattenedRows(locRows);

        var locBuckets = buildProductBucketsFromRows(locRows);

        if (locBuckets.length > 1) {

          selected = {

            key: statusKey,

            label: bucket.label,

            mode: "physical_pallets",

            view: "by_product",

            parentLabel: parent.parentLabel || parent.label || "Pallets",

            parentCount: parent.parentCount != null ? parent.parentCount : parent.count,

            count: locRows.length || data.drill_bag_count || 0,

            detail: { by_product: locBuckets, bags: locRows.length, kg: 0 },

          };

          finishDrillFetch(token);
          paint();

          return;

        }

        var productLabel = locBuckets.length === 1

          ? locBuckets[0].product_code

          : bucket.label;

        showPhysicalPalletFlatList(

          { key: statusKey, label: bucket.label },

          locRows,

          locRows.length || data.drill_bag_count || 0,

          productLabel

        );

        selected.parentLabel = parent.parentLabel || parent.label || "Pallets";

        finishDrillFetch(token);
        paint();

      } catch (e) {

        if (drillFetchCancelled(token)) return;

        finishDrillFetch(token);
        body.innerHTML = "";

        body.appendChild(ui.error("Could not load pallets: " + (e.message || e)));

        syncFloatingNav();

      }

    }



    function openPhysicalPalletsByProduct(st, detail, count) {

      selectedEvent = null;

      wxDrill = null;

      selected = {

        key: st.key,

        label: st.label || "Pallets",

        mode: "physical_pallets",

        view: "by_product",

        parentLabel: "Pallets",

        count: count != null ? count : (st.bags || 0),

        detail: detail || { by_product: st.by_product || [], bags: st.bags, kg: st.kg },

      };

      paint();

    }



    function showPhysicalPalletFlatList(st, rows, count, productLabel) {

      selected = {

        key: st.key,

        label: productLabel || st.label || "Pallets",

        mode: "physical_pallets",

        view: "flat_list",

        parentLabel: productLabel ? "Pallets" : "Bags Status",

        count: (rows || []).length || count || 0,

        rows: rows || [],

      };

      paint();

    }



    function showPhysicalPalletByProduct(st, palletData, count) {

      var detail = palletData.physical_pallets || { by_product: [], bags: count, kg: 0 };

      var buckets = (detail.by_product || []).filter(function (b) { return (b.bags || 0) > 0; });

      if (!buckets.length) {

        var rows = flattenPalletSectionRows(palletData.event_sections || []);

        showPhysicalPalletFlatList(st, rows, count, null);

        return;

      }

      selected = {

        key: st.key,

        label: st.label || "Pallets",

        mode: "physical_pallets",

        view: "by_product",

        parentLabel: "Pallets",

        count: detail.bags || count || 0,

        detail: detail,

      };

      selectedEvent = null;

      paint();

    }



    async function openPhysicalPalletsTile(st) {

      selectedEvent = null;

      wxDrill = null;

      var count = st.bags || (summary.pallet_summary && summary.pallet_summary.total && summary.pallet_summary.total.bags) || 0;

      var buckets = (summary.pallet_summary && summary.pallet_summary.buckets) || [];

      var withStock = buckets.filter(function (b) {
        return (b.bags || 0) > 0;
      });

      if (withStock.length) {

        selected = {

          key: st.key,

          label: st.label || "Pallets",

          mode: "physical_pallets",

          view: "locations",

          parentLabel: "Pallets",

          parentCount: count,

          count: count,

          locationBuckets: withStock,

        };

        paint();

        return;

      }

      var token = beginDrillFetch(st.label || "Pallets");

      try {

        var palletData = await ctx.api.traceability(bagsStatusDrillPath(null, "pallet"));

        if (!container.isConnected || drillFetchCancelled(token)) return;

        showPhysicalPalletByProduct(st, palletData, count);

        finishDrillFetch(token);

      } catch (e) {

        if (drillFetchCancelled(token)) return;

        finishDrillFetch(token);
        body.innerHTML = "";

        body.appendChild(ui.error("Could not load pallets: " + (e.message || e)));

        syncFloatingNav();

      }

    }



    async function openWalvisStorageHub(st) {
      selectedEvent = null;
      wxDrill = null;
      selected = {
        key: WALVIS_STORAGE_STATUS,
        label: st.label || "In storage — Carbo Yard",
        mode: "walvis_storage_hub",
        bulkStatus: st,
        palletBucket: palletWalvisStorageBucket(summary.pallet_summary),
        walvisReportLoading: !walvisStorageReport,
        walvisReport: walvisStorageReport,
      };
      paint();
      if (walvisStorageReport) return;
      try {
        walvisStorageReport = await ctx.api.traceability("/walvis-dispatches/storage-at-walvis-breakdown");
        if (selected && selected.mode === "walvis_storage_hub") {
          selected.walvisReport = walvisStorageReport;
          selected.walvisReportLoading = false;
          selected.walvisReportError = null;
          paint();
        }
      } catch (e) {
        if (selected && selected.mode === "walvis_storage_hub") {
          selected.walvisReportLoading = false;
          selected.walvisReportError = e.message || String(e);
          paint();
        }
      }
    }

    async function openWalvisTransitHub(st) {
      selectedEvent = null;
      wxDrill = null;
      selected = {
        key: WALVIS_TRANSIT_STATUS,
        label: st.label || "In transit — Walvis Bay",
        mode: "walvis_transit_hub",
        walvisReportLoading: !walvisTransitReport,
        walvisReport: walvisTransitReport,
      };
      paint();
      if (walvisTransitReport) return;
      try {
        walvisTransitReport = await ctx.api.traceability("/walvis-dispatches/in-transit-breakdown");
        if (selected && selected.mode === "walvis_transit_hub") {
          selected.walvisReport = walvisTransitReport;
          selected.walvisReportLoading = false;
          selected.walvisReportError = null;
          paint();
        }
      } catch (e) {
        if (selected && selected.mode === "walvis_transit_hub") {
          selected.walvisReportLoading = false;
          selected.walvisReportError = e.message || String(e);
          paint();
        }
      }
    }

    async function openWalvisBulkDrill() {
      var token = beginDrillFetch("Bulk bags — Carbo Yard");
      try {
        var data = await ctx.api.traceability(bagsStatusDrillPath(WALVIS_STORAGE_STATUS));
        if (drillFetchCancelled(token)) return;
        var rows = flattenEventRows(data.event_sections || []).filter(function (r) {
          return (r.product_stream || "").toLowerCase() !== "pallet";
        });
        selectedEvent = null;
        selected = null;
        wxDrill = {
          label: "Bulk bags — Carbo Yard",
          rows: rows,
          backTo: "main",
        };
        finishDrillFetch(token);
        paint();
      } catch (e) {
        if (drillFetchCancelled(token)) return;
        finishDrillFetch(token);
        body.innerHTML = "";
        body.appendChild(ui.error("Could not load Walvis bags: " + (e.message || e)));
        syncFloatingNav();
      }
    }

    async function openWalvisPalletsDrill(st) {
      selectedEvent = null;
      wxDrill = null;
      var bucket = palletWalvisStorageBucket(summary.pallet_summary);
      if (!(bucket.bags || 0)) {
        await openPalletBucket(
          { key: WALVIS_STORAGE_STATUS, label: bucket.label, bags: 0, kg: 0 },
          WALVIS_STORAGE_STATUS
        );
        return;
      }
      await openPalletBucket(bucket, WALVIS_STORAGE_STATUS);
    }

    async function openStatus(st) {

      if (st.kind === "walvis_bulk_bags") {
        await openWalvisStorageHub(st);
        return;
      }

      if (st.kind === "walvis_pallets") {
        await openWalvisPalletsDrill(st);
        return;
      }

      if (st.key === WALVIS_TRANSIT_STATUS) {
        await openWalvisTransitHub(st);
        return;
      }

      if (st.kind === "walvis_transit_pallets" && (st.rows || []).length) {
        selectedEvent = null;
        wxDrill = {
          label: st.label || "Pallets in transit",
          rows: st.rows || [],
          backTo: "walvis_transit_hub",
          view: "pallet_table",
        };
        paint();
        return;
      }

      if (st.kind === "walvis_dispatch_select" && st.dispatch) {
        selectedEvent = null;
        wxDrill = null;
        if (st.transit) {
          selected = {
            key: st.key,
            mode: "walvis_transit_dispatch",
            dispatch: st.dispatch,
            walvisReport: walvisTransitReport,
          };
        } else {
          selected = {
            key: st.key,
            mode: "walvis_storage_dispatch",
            dispatch: st.dispatch,
            walvisReport: walvisStorageReport,
          };
        }
        paint();
        return;
      }

      if (st.kind === "walvis_unassigned" && st.unassigned) {
        selectedEvent = null;
        wxDrill = null;
        if (st.transit) {
          selected = {
            key: st.key,
            mode: "walvis_transit_unassigned_hub",
            unassigned: st.unassigned,
            walvisReport: walvisTransitReport,
          };
        } else {
          selected = {
            key: st.key,
            mode: "walvis_unassigned_hub",
            unassigned: st.unassigned,
            walvisReport: walvisStorageReport,
          };
        }
        paint();
        return;
      }

      if (st.kind === "walvis_dispatch_category") {
        selectedEvent = null;
        wxDrill = {
          label: st.label || "Category",
          rows: st.rows || [],
          backTo: st.transit
            ? (st.dispatch ? "walvis_transit_dispatch" : "walvis_transit_unassigned")
            : (st.dispatch ? "walvis_dispatch" : "walvis_unassigned"),
          backDispatch: st.dispatch || null,
        };
        paint();
        return;
      }

      if (isWalvisStorageStatus(st.key)) {
        await openWalvisStorageHub(st);
        return;
      }

      if (st.kind === "factory_pallets_in_storage") {

        var inStoreBucket = palletInStorageBucket(summary.pallet_summary);

        selectedEvent = null;

        wxDrill = null;

        selected = {

          key: st.key,

          label: st.label || "Pallets in storage",

          mode: "physical_pallets",

          view: "locations",

          parentLabel: "Factory storage",

          parentCount: inStoreBucket.bags || 0,

          count: inStoreBucket.bags || 0,

          locationBuckets: [inStoreBucket],

        };

        paint();

        return;

      }

      if (isPalletBasketTile(st)) {

        selectedEvent = null;

        wxDrill = null;

        selected = {

          key: st.key,

          label: st.label,

          mode: "pallet_basket",

          detail: summary.pallet_basket || { by_product: st.by_product, available_kg: st.kg, pallet_equivalent: st.pallet_equivalent },

        };

        paint();

        return;

      }

      if (isPhysicalPalletsTile(st)) {

        await openPhysicalPalletsTile(st);

        return;

      }

      if (WX_BUCKET_STATUS[st.key] && weathering) {

        selectedEvent = null;

        wxDrill = null;

        var pipeDrill = factoryStoragePipelineDrillSel(st);

        if (pipeDrill) {
          await openWxDrill(pipeDrill, {
            backTo: "main",
            note: factoryStorageWxDrillNote(st.key, weathering),
          });
          return;
        }

        selected = {

          key: st.key,

          label: st.label,

          mode: "weathering_buckets",

          buckets: wxBucketsForStatus(st.key, weathering),

        };

        paint();

        return;

      }

      var token = beginDrillFetch(st.label || "Bags");

      try {

        var data = await ctx.api.traceability(bagsStatusDrillPath(st.key));

        if (drillFetchCancelled(token)) return;

        selectedEvent = null;

        wxDrill = null;

        var sections = data.event_sections || [];

        if (isFactoryStorageBagStatus(st.key)) {

          sections = filterEventSectionsToIntakeBags(sections);

        }

        var drillCount = 0;

        sections.forEach(function (sec) {
          drillCount += sec.bags || 0;
        });

        selected = {

          key: st.key,

          label: st.label,

          mode: "events",

          count: drillCount,

          sections: sections,

        };

        finishDrillFetch(token);
        paint();

      } catch (e) {

        if (drillFetchCancelled(token)) return;

        finishDrillFetch(token);
        body.innerHTML = "";

        body.appendChild(ui.error("Could not load bags: " + (e.message || e)));

        syncFloatingNav();

      }

    }



    var countdownTimer = null;

    var countdownSec = Math.round(BS_AUTO_REFRESH_MS / 1000);

    var lastReportUpdatedAt = null;

    var refreshInFlight = false;



    function findWalvisDispatch(report, dispatchId) {

      if (!report || dispatchId == null) return null;

      var idStr = String(dispatchId);

      var list = report.dispatches || [];

      for (var i = 0; i < list.length; i++) {

        if (String(list[i].id) === idStr) return list[i];

      }

      return null;

    }



    function syncSelectedEventFromSections() {

      if (!selectedEvent || !selected || !selected.sections) return;

      var evKey = selectedEvent.key || selectedEvent.date;

      if (!evKey) return;

      for (var i = 0; i < selected.sections.length; i++) {

        var sec = selected.sections[i];

        if ((sec.key || sec.date) === evKey) {

          selectedEvent = sec;

          return;

        }

      }

    }



    async function reloadDrillFromServer() {

      if (!ctx.api.traceability || !summary) return;



      if (bagSearch && bagSearch.active && bagSearch.serial && !bagSearch.loading) {

        var hit = await ctx.api.traceability(

          "/reports/bags-status/lookup?serial=" + encodeURIComponent(bagSearch.serial)

        );

        bagSearch.data = hit;

        bagSearch.error = null;

        return;

      }



      if (selected && selected.palletDetail && selected.serial) {

        selected.palletDetail = await ctx.api.traceability(

          "/reports/pallet-detail?serial=" + encodeURIComponent(selected.serial)

        );

        return;

      }



      if (wxDrill && wxDrill.querySel) {

        var wxData = await ctx.api.traceability(buildWxDrillQuery(wxDrill.querySel));

        var wxRows = (wxData.drill && wxData.drill.rows) || [];

        if (selected && isFactoryStorageBagStatus(selected.key)) {

          wxRows = wxRows.filter(function (r) {

            return (r.product_stream || "").toLowerCase() !== "pallet";

          });

        }

        wxDrill.rows = wxRows;

        return;

      }



      var needsWalvisStorage =

        selected &&

        (selected.mode === "walvis_storage_hub" ||

          selected.mode === "walvis_storage_dispatch" ||

          selected.mode === "walvis_unassigned_hub");

      var needsWalvisTransit =

        selected &&

        (selected.mode === "walvis_transit_hub" ||

          selected.mode === "walvis_transit_dispatch" ||

          selected.mode === "walvis_transit_unassigned_hub");

      if (needsWalvisStorage) {

        walvisStorageReport = await ctx.api.traceability("/walvis-dispatches/storage-at-walvis-breakdown");

      }

      if (needsWalvisTransit) {

        walvisTransitReport = await ctx.api.traceability("/walvis-dispatches/in-transit-breakdown");

      }

      if (selected && selected.mode === "walvis_storage_hub") {

        selected.walvisReport = walvisStorageReport;

        selected.palletBucket = palletWalvisStorageBucket(summary.pallet_summary);

        selected.walvisReportLoading = false;

      }

      if (selected && selected.mode === "walvis_transit_hub") {

        selected.walvisReport = walvisTransitReport;

        selected.walvisReportLoading = false;

      }

      if (selected && selected.mode === "walvis_unassigned_hub" && walvisStorageReport) {

        selected.unassigned = walvisStorageReport.unassigned || {};

        selected.walvisReport = walvisStorageReport;

      }

      if (selected && selected.mode === "walvis_transit_unassigned_hub" && walvisTransitReport) {

        selected.unassigned = walvisTransitReport.unassigned || {};

        selected.walvisReport = walvisTransitReport;

      }

      if (selected && selected.mode === "walvis_storage_dispatch" && walvisStorageReport && selected.dispatch) {

        var sd = findWalvisDispatch(walvisStorageReport, selected.dispatch.id);

        if (sd) selected.dispatch = sd;

        selected.walvisReport = walvisStorageReport;

      }

      if (selected && selected.mode === "walvis_transit_dispatch" && walvisTransitReport && selected.dispatch) {

        var td = findWalvisDispatch(walvisTransitReport, selected.dispatch.id);

        if (td) selected.dispatch = td;

        selected.walvisReport = walvisTransitReport;

      }



      if (selected && selected.mode === "events" && selected.key) {

        var drillData = await ctx.api.traceability(bagsStatusDrillPath(selected.key));

        var sections = drillData.event_sections || [];

        if (isFactoryStorageBagStatus(selected.key)) {

          sections = filterEventSectionsToIntakeBags(sections);

        }

        var drillCount = 0;

        sections.forEach(function (sec) {

          drillCount += sec.bags || 0;

        });

        selected.sections = sections;

        selected.count = drillCount;

        syncSelectedEventFromSections();

        return;

      }



      if (selected && selected.mode === "weathering_buckets" && selected.key && weathering) {

        selected.buckets = wxBucketsForStatus(selected.key, weathering);

        return;

      }



      if (selected && selected.mode === "pallet_basket") {

        selected.detail = summary.pallet_basket || selected.detail;

        return;

      }



      if (selected && selected.mode === "physical_pallets" && selected.key) {

        if (selected.view === "locations") {

          var buckets = (summary.pallet_summary && summary.pallet_summary.buckets) || [];

          selected.locationBuckets = buckets.filter(function (b) {

            return (b.bags || 0) > 0;

          });

          var total = summary.pallet_summary && summary.pallet_summary.total;

          selected.count = (total && total.bags) || selected.count;

          return;

        }

        var palletDrill = await ctx.api.traceability(bagsStatusDrillPath(selected.key, "pallet"));

        if (selected.view === "flat_list") {

          var flatRows = sortPalletFlattenedRows(flattenPalletSectionRows(palletDrill.event_sections || []));

          selected.rows = flatRows;

          selected.count = flatRows.length || palletDrill.drill_bag_count || 0;

          return;

        }

        if (selected.view === "by_product") {

          var locRows = flattenPalletSectionRows(palletDrill.event_sections || []);

          if (!locRows.length && palletDrill.physical_pallets && palletDrill.physical_pallets.by_product) {

            (palletDrill.physical_pallets.by_product || []).forEach(function (b) {

              (b.rows || []).forEach(function (row) {

                locRows.push(row);

              });

            });

          }

          locRows = sortPalletFlattenedRows(locRows);

          var locBuckets = buildProductBucketsFromRows(locRows);

          selected.detail = { by_product: locBuckets, bags: locRows.length, kg: 0 };

          selected.count = locRows.length || palletDrill.drill_bag_count || selected.count;

        }

      }

    }



    function updateCountdownText() {

      if (!refreshNote || !container.isConnected) return;

      refreshNote.hidden = false;

      var tail = lastReportUpdatedAt ? " · Last updated " + lastReportUpdatedAt : "";
      refreshNote.textContent = "Next update in " + countdownSec + " seconds" + tail;

    }



    function resetCountdown() {

      countdownSec = Math.round(BS_AUTO_REFRESH_MS / 1000);

      updateCountdownText();

    }



    function stopTimers() {

      if (countdownTimer) {

        clearInterval(countdownTimer);

        countdownTimer = null;

      }

    }



    function startCountdown() {

      if (countdownTimer) return;

      resetCountdown();

      countdownTimer = setInterval(function () {

        if (!container.isConnected) {

          stopTimers();

          return;

        }

        countdownSec -= 1;

        if (countdownSec <= 0) {

          void refreshReport({ silent: true });

          countdownSec = Math.round(BS_AUTO_REFRESH_MS / 1000);

        }

        updateCountdownText();

      }, 1000);

    }



    async function refreshReport(opts) {

      opts = opts || {};

      if (!ctx.api.traceability) {

        if (!opts.silent) {

          status.style.display = "none";

          body.appendChild(ui.error("Traceability API is not configured in CIS."));

        }

        return;

      }

      if (opts.silent && !summary) return;

      if (refreshInFlight) {

        if (opts.silent) return;

      }

      refreshInFlight = true;



      if (!opts.silent) {

        status.textContent = "Loading…";

        status.style.display = "";

        if (opts.reset) {

          body.innerHTML = "";

        }

      }



      try {

        var results = await Promise.all([

          ctx.api.traceability("/reports/bags-status"),

          ctx.api.traceability("/reports/bags-weathering").catch(function () { return null; }),

        ]);

        if (!container.isConnected) return;

        summary = results[0];

        weathering = results[1];

        lastReportUpdatedAt = fmtReportGenerated(summary.generated_at);

        if (selected && selected.mode === "pallet_basket" && summary.pallet_basket) {
          selected.detail = summary.pallet_basket;
        }

        try {

          await reloadDrillFromServer();

        } catch (drillErr) {

          /* Keep prior drill view if a drill refetch fails; summary still refreshed. */

        }

        if (!opts.silent) {

          status.style.display = "none";

        }

        paint();

        resetCountdown();

        startCountdown();

      } catch (e) {

        var errMsg = (e && e.message) || String(e || "");

        if (opts.silent && /\b401\b|unauthorized/i.test(errMsg)) {

          stopTimers();

          refreshNote.hidden = false;

          refreshNote.textContent =
            "Live refresh stopped (sign-in expired). Sign out and sign in, or press F5 — numbers below may be stale.";

          return;

        }

        if (opts.silent) return;

        status.textContent = "";

        refreshNote.hidden = true;

        body.innerHTML = "";

        body.appendChild(ui.error("Could not load report: " + (CIS.traceabilityApiErrorMessage ? CIS.traceabilityApiErrorMessage(e) : errMsg)));

      } finally {

        refreshInFlight = false;

      }

    }



    stopTimers();

    startCountdown();

    await refreshReport({ reset: true });

  }



  CIS.modules.push({

    id: "bags_status_report",

    title: "Bags Status",

    section: "Production",

    kind: "lookup",

    order: 17,

    icon: "bags",

    description: "Where bags are — and the 21-day weathering clock",

    requires: "traceability.bags_status",

    render: render,

  });

})();

