/* Bags Status — analytics dashboard: where bags are + 21-day weathering clock. */



(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];

  var BS_AUTO_REFRESH_MS = 60000;



  var STREAM_LABELS = {

    restaurant: "Restaurant",

    lumpwood: "Lumpwood",

    fines: "Fines",

    briquettes: "Briquettes",

    pallet: "Pallet",

  };



  var STREAM_COLORS = {

    restaurant: "#4F46E5",

    lumpwood: "#059669",

    fines: "#EA580C",

    briquettes: "#7C3AED",

    pallet: "#64748B",

  };



  var BUCKET_ACCENT = {

    ready: "#10B981",

    "1_3": "#EF4444",

    "4_7": "#F97316",

    "8_14": "#3B82F6",

    "15_21": "#8B5CF6",

  };



  var WX_STREAM_ORDER = ["restaurant", "lumpwood", "fines"];



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



  function fmtKg(n) {

    var v = Number(n || 0);

    return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  }



  function bagsKgText(bags, kg) {

    return String(bags || 0) + (bags === 1 ? " bag" : " bags") + " · " + fmtKg(kg) + " kg";

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

  function scanTimestampCell(row) {

    if (!row) return "—";

    /* Drill-down: original scan / weathering start — not manager early-release day. */
    if (row.released_early && row.recorded_at) {
      return fmtDateTime(row.recorded_at, row.recorded_time);
    }

    if (row.status_changed_at) {

      return fmtDateTime(row.status_changed_at, row.status_changed_time);

    }

    if (row.recorded_at) {

      return fmtDateTime(row.recorded_at, row.recorded_time);

    }

    return fmtDate(row.recorded_date);

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



  function weatherText(row) {

    if (row.released_early) return "Released early";

    var days = row.days_remaining;

    if (days === null || days === undefined) return "—";

    days = Number(days);

    if (days > 0) return days + (days === 1 ? " day left" : " days left");

    var over = Math.abs(days);

    if (over === 0) return "Ready today";

    return "Ready " + over + (over === 1 ? " day" : " days") + " ago";

  }



  function streamSplitText(streams) {

    var parts = [];

    Object.keys(STREAM_LABELS).forEach(function (key) {

      var n = (streams || {})[key] || 0;

      if (n > 0) parts.push(n + " " + STREAM_LABELS[key].toLowerCase());

    });

    return parts.join(" · ");

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
      col.appendChild(ui.el("span", { class: "bs-dash-col__kg" }, [fmtKg(w.kg) + " kg"]));

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



  function renderPipelineChart(pipeline, ui) {

    var card = ui.el("div", { class: "bs-dash-card bs-dash-card--side" });

    card.appendChild(ui.el("div", { class: "bs-dash-card__head" }, [

      ui.el("h3", {}, ["Pipeline by location"]),

      ui.el("p", { class: "bs-dash-card__sub" }, ["On the clock vs ready — by area"]),

    ]));

    var rows = pipeline || [];

    if (!rows.length) {

      card.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No pipeline data."]));

      return card;

    }

    var maxKg = wxMaxKg(rows.map(function (loc) {

      return {

        kg: (loc.still_weathering && loc.still_weathering.kg || 0)

          + (loc.ready && loc.ready.kg || 0),

      };

    }));

    var body = ui.el("div", { class: "bs-dash-pipeline" });

    rows.forEach(function (loc) {

      var still = loc.still_weathering || {};

      var ready = loc.ready || {};

      var totalKg = (still.kg || 0) + (ready.kg || 0);

      if (!totalKg) return;

      var row = ui.el("div", { class: "bs-dash-pipeline-row" });

      row.appendChild(ui.el("span", { class: "bs-dash-pipeline-label" }, [loc.label]));

      var trackWrap = ui.el("div", { class: "bs-dash-pipeline-track-wrap" });

      var track = ui.el("div", { class: "bs-dash-pipeline-track" });

      track.style.width = Math.max((totalKg / maxKg) * 100, 8) + "%";

      if (still.kg) {

        track.appendChild(ui.el("div", {

          class: "bs-dash-pipeline-seg bs-dash-pipeline-seg--clock",

          style: { width: (still.kg / totalKg * 100) + "%" },

          title: "Still weathering: " + bagsKgText(still.bags, still.kg),

        }));

      }

      if (ready.kg) {

        track.appendChild(ui.el("div", {

          class: "bs-dash-pipeline-seg bs-dash-pipeline-seg--ready",

          style: { width: (ready.kg / totalKg * 100) + "%" },

          title: "Ready: " + bagsKgText(ready.bags, ready.kg),

        }));

      }

      trackWrap.appendChild(track);

      row.appendChild(trackWrap);

      row.appendChild(ui.el("span", { class: "bs-dash-pipeline-meta" }, [

        bagsKgText(still.bags, still.kg) + " clock · " + bagsKgText(ready.bags, ready.kg) + " ready",

      ]));

      body.appendChild(row);

    });

    card.appendChild(body);

    card.appendChild(ui.el("div", { class: "bs-dash-pipeline-legend" }, [

      ui.el("span", { class: "bs-dash-pipeline-key bs-dash-pipeline-key--clock" }, ["Still weathering"]),

      ui.el("span", { class: "bs-dash-pipeline-key bs-dash-pipeline-key--ready" }, ["Ready now"]),

    ]));

    return card;

  }



  function renderWxKpis(kpis, ui) {

    var row = ui.el("div", { class: "bs-dash-wx-kpis" });

    [

      { key: "ready_now", label: "Ready now", tone: "green" },

      { key: "freeing_this_week", label: "Freeing this week", tone: "amber" },

      { key: "still_weathering", label: "Still weathering", tone: "blue" },

      { key: "at_packaging", label: "At packaging", tone: "purple" },

    ].forEach(function (item) {

      var k = (kpis || {})[item.key] || {};

      var card = ui.el("div", { class: "bs-dash-wx-kpi bs-dash-wx-kpi--" + item.tone });

      card.appendChild(ui.el("span", { class: "bs-dash-wx-kpi__label" }, [item.label]));

      card.appendChild(ui.el("div", { class: "bs-dash-wx-kpi__value" }, [String(k.bags || 0)]));

      card.appendChild(ui.el("div", { class: "bs-dash-wx-kpi__sub" }, [fmtKg(k.kg) + " kg"]));

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

        "Factory stock on the clock. Click a row to list bags.",

      ]),

    ]));

    card.appendChild(renderWxKpis(wx.kpis, ui));



    var mixStrip = ui.el("div", { class: "bs-dash-mix-strip" });
    var mixRow = ui.el("div", { class: "bs-dash-mix-row" });
    var mixText = ui.el("div", { class: "bs-dash-mix-text" });
    var still = (wx.kpis && wx.kpis.still_weathering) || {};

    mixText.appendChild(ui.el("strong", { class: "bs-dash-mix-text__title" }, [
      "Stream mix (still weathering)",
    ]));

    WX_STREAM_ORDER.forEach(function (key) {
      var n = (still.streams || {})[key] || 0;
      if (!n) return;
      var kg = (still.stream_kg || {})[key] || 0;
      var line = ui.el("div", { class: "bs-dash-mix-line" });
      line.appendChild(streamSwatch(key, "bs-dash-mix-dot"));
      var count = ui.el("span", { class: "bs-dash-mix-line__count" });
      applyStyles(count, { color: STREAM_COLORS[key] });
      count.appendChild(document.createTextNode(String(n)));
      line.appendChild(count);
      line.appendChild(ui.el("span", { class: "bs-dash-mix-line__label" }, [
        STREAM_LABELS[key].toLowerCase(),
      ]));
      line.appendChild(ui.el("span", { class: "bs-dash-mix-line__kg" }, [fmtKg(kg) + " kg"]));
      mixText.appendChild(line);
    });

    mixRow.appendChild(mixText);
    renderDonut(mixRow, still.streams, still.bags, ui);
    mixStrip.appendChild(mixRow);
    card.appendChild(mixStrip);



    var scale = wxMaxKg(wx.days_buckets);

    var bars = ui.el("div", { class: "bs-dash-buckets" });

    var any = false;

    (wx.days_buckets || []).forEach(function (b) {

      if (!(b.bags || 0)) return;

      any = true;

      var accent = BUCKET_ACCENT[b.key] || "#64748B";

      var row = ui.el("button", {

        class: "bs-dash-bucket-row",

        type: "button",

        style: { "--bucket-accent": accent },

        onclick: function () { onDrill({ bucket: b.key, label: b.label }); },

      });

      row.appendChild(ui.el("span", { class: "bs-dash-bucket-label" }, [b.label]));

      row.appendChild(renderWxBarSegments(b.stream_kg, b.kg, scale, ui));

      row.appendChild(ui.el("span", { class: "bs-dash-bucket-meta" }, [

        b.bags + " bags · " + fmtKg(b.kg) + " kg",

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

    chip.appendChild(ui.el("span", { class: "bs-dash-label-chip__title" }, ["Bag labels"]));

    var line = ui.el("div", { class: "bs-dash-label-chip__line" });

    function addPart(value, suffix, tone) {

      var p = ui.el("span", { class: "bs-dash-label-chip__part bs-dash-label-chip__part--" + tone });

      p.appendChild(ui.el("strong", {}, [fmt(value)]));

      p.appendChild(document.createTextNode(" " + suffix));

      line.appendChild(p);

    }

    addPart(inv.available != null ? inv.available : inv.available_to_use, "ready", "ready");

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

        card.appendChild(ui.el("span", { class: "bs-dash-kpi__sub" }, [fmtKg(item.value.kg) + " kg"]));

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

  };



  /** Scanner Create pallet button (bags-lookup). */
  var PALLET_MAGENTA = "#c2185b";

  var FACTORY_STORAGE_STATUS_KEYS = {
    in_storage_weathering: true,
    in_storage_released_early: true,
    in_storage: true,
  };

  function isFactoryStorageBagStatus(key) {
    return !!FACTORY_STORAGE_STATUS_KEYS[key];
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

    in_storage: "in_storage,in_storage_weathering,in_storage_released_early",

    in_transit: "on_truck_walvisbay",

    at_coast: "storage_walvisbay,storage_agl",

    in_container: "in_container",

    dispatched: "dispatched",

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

      ["Available for palletisation", fmtKg(b.available_kg) + " kg"],

      ["Pallet equivalent", b.pallet_equivalent != null ? Number(b.pallet_equivalent).toFixed(2) : "—"],

      ["Source bags", String(b.source_bags != null ? b.source_bags : 0)],

    ].forEach(function (pair) {

      dl.appendChild(ui.el("dt", {}, [pair[0]]));

      dl.appendChild(ui.el("dd", {}, [pair[1]]));

    });

    section.appendChild(dl);

    if ((b.by_product || []).length > 1) {

      var sub = ui.el("div", { class: "bs-dash-basket-products" });

      b.by_product.forEach(function (row) {

        sub.appendChild(ui.el("p", { class: "bs-dash-basket-product muted" }, [

          row.product_code + ": " + fmtKg(row.available_kg) + " kg · "

            + (row.pallet_equivalent != null ? Number(row.pallet_equivalent).toFixed(2) : "—")

            + " pallet equiv · " + String(row.source_bag_count || 0) + " source bag(s)",

        ]));

      });

      section.appendChild(sub);

    }

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

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtKg(bucket.kg) + " kg"]));

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

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtKg(b.kg) + " kg"]));

      wrap.appendChild(card);

    });

    return wrap;

  }



  function wxBucketsForStatus(statusKey, wx) {

    var fn = WX_BUCKET_STATUS[statusKey];

    if (!fn || !wx) return [];

    return (wx.days_buckets || []).filter(function (b) {

      return (b.bags || 0) > 0 && fn(b.key);

    });

  }



  var GROUP_TONE = {

    factory: "blue",

    in_transit: "amber",

    coast: "teal",

    transit_coast: "teal",

    closed: "slate",

    packaging_outputs: "amber",

  };



  function combineTransitCoastGroups(groups) {

    groups = groups || [];

    var transit = null;

    var coast = null;

    var insertIdx = -1;

    groups.forEach(function (g, i) {

      if (g.key === "in_transit") {

        transit = g;

        if (insertIdx < 0) insertIdx = i;

      }

      if (g.key === "coast") {

        coast = g;

        if (insertIdx < 0) insertIdx = i;

      }

    });

    if (!transit && !coast) return groups;

    var sections = [];

    if (transit) {

      sections.push({

        key: "in_transit",

        label: transit.label || "In transit",

        statuses: transit.statuses || [],

      });

    }

    if (coast) {

      sections.push({

        key: "coast",

        label: coast.label || "At the coast",

        statuses: coast.statuses || [],

      });

    }

    var combined = {

      key: "transit_coast",

      label: "In transit & at the coast",

      bags: (transit ? transit.bags : 0) + (coast ? coast.bags : 0),

      kg: (transit ? transit.kg : 0) + (coast ? coast.kg : 0),

      sections: sections,

    };

    var out = groups.filter(function (g) {

      return g.key !== "in_transit" && g.key !== "coast";

    });

    var at = groups.slice(0, insertIdx).filter(function (g) {

      return g.key !== "in_transit" && g.key !== "coast";

    }).length;

    out.splice(at, 0, combined);

    return out;

  }



  var DASHBOARD_GROUP_ORDER = [
    "factory",
    "packaging_outputs",
    "transit_coast",
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

      var card = ui.el("button", { class: cls, type: "button", onclick: function () { onSelect(st); } });

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__label" }, [st.label]));

      if (st.kind === "pallet_basket") {

        var equiv = st.pallet_equivalent != null ? Number(st.pallet_equivalent).toFixed(2) : "0.00";

        card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [equiv]));

        card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [
          fmtKg(st.kg) + " kg · material for palletisation",
        ]));

        if ((st.by_product || []).length === 1) {

          var only = st.by_product[0];

          card.appendChild(ui.el("span", { class: "bs-dash-status-card__streams" }, [
            only.product_code
              + (only.production_target_kg != null
                ? " · " + Number(only.production_target_kg).toFixed(0) + " kg/pallet"
                : ""),
          ]));

        }

      } else if (st.kind === "physical_pallets") {

        card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(st.bags || 0)]));

        card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [
          fmtKg(st.kg) + " kg · physical pallet BAG IDs",
        ]));

      } else if (st.kind === "factory_pallets_in_storage") {

        card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(st.bags || 0)]));

        card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [
          fmtKg(st.kg) + " kg · drill down by location",
        ]));

      } else {

        card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(st.bags)]));

        card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtKg(st.kg) + " kg"]));

        var split = streamSplitText(st.streams);

        if (split) card.appendChild(ui.el("span", { class: "bs-dash-status-card__streams" }, [split]));

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
        "Weathering, released early, and weathered — intake bags only (not pallets).",
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

  function renderGroup(group, ui, selectedStatus, onSelect, dashboardSummary) {

    var tone = GROUP_TONE[group.key] || "indigo";

    var block = ui.el("section", { class: "bs-dash-location bs-dash-location--" + tone });

    block.appendChild(ui.el("div", { class: "bs-dash-location__head" }, [

      ui.el("h3", {}, [group.label]),

      ui.el("span", { class: "bs-dash-location__count" }, [
        bagsKgText(group.bags, group.kg),
      ]),

    ]));

    if (group.note) {

      block.appendChild(ui.el("p", { class: "bs-dash-location__note" }, [group.note]));

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
      "Material already converted at packaging — waiting for a pallet label scan at wrapping. "
        + "Not physical pallets yet.",
    ]));

    var dl = ui.el("dl", { class: "bs-dash-basket-dl" });

    [

      ["Available for palletisation", fmtKg(b.available_kg) + " kg"],

      ["Pallet equivalent", b.pallet_equivalent != null ? Number(b.pallet_equivalent).toFixed(2) : "—"],

      ["Source bags consumed", String(b.source_bags != null ? b.source_bags : 0)],

    ].forEach(function (pair) {

      dl.appendChild(ui.el("dt", {}, [pair[0]]));

      dl.appendChild(ui.el("dd", {}, [pair[1]]));

    });

    wrap.appendChild(dl);

    (b.by_product || []).forEach(function (row) {

      var block = ui.el("div", { class: "bs-dash-basket-product-block" });

      block.appendChild(ui.el("h4", {}, [row.product_code + (row.name ? " — " + row.name : "")]));

      var cfg = ui.el("dl", { class: "bs-dash-basket-dl bs-dash-basket-dl--compact" });

      [

        ["Available", fmtKg(row.available_kg) + " kg"],

        ["Pallet equivalent", row.pallet_equivalent != null ? Number(row.pallet_equivalent).toFixed(2) : "—"],

        ["Production target / pallet", row.production_target_kg != null ? fmtKg(row.production_target_kg) + " kg" : "—"],

        ["Commercial pallet", row.commercial_pallet_weight_kg != null ? fmtKg(row.commercial_pallet_weight_kg) + " kg" : "—"],

        ["Retail units / pallet", row.bags_per_pallet != null ? String(row.bags_per_pallet) : "—"],

        ["Source bags", String(row.source_bag_count || 0)],

      ].forEach(function (pair) {

        cfg.appendChild(ui.el("dt", {}, [pair[0]]));

        cfg.appendChild(ui.el("dd", {}, [pair[1]]));

      });

      block.appendChild(cfg);

      wrap.appendChild(block);

    });

    if (!(b.by_product || []).length) {

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

      ["Production weight", p.production_pallet_kg != null ? fmtKg(p.production_pallet_kg) + " kg" : "—"],

      ["Retail units", p.retail_unit_count != null ? String(p.retail_unit_count) : "—"],

      ["Status", p.storage_status || "—"],

    ].forEach(function (pair) {

      dl.appendChild(ui.el("dt", {}, [pair[0]]));

      dl.appendChild(ui.el("dd", {}, [pair[1]]));

    });

    wrap.appendChild(dl);

    if (p.mixed_producers) {

      wrap.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
        "This pallet draws from more than one producer — weights below are from source jumbo allocations at packaging.",
      ]));

    }

    if ((p.producers || []).length) {

      wrap.appendChild(ui.el("h4", {}, ["Producers (from source jumbos)"]));

      var plist = ui.el("ul", { class: "bs-dash-pallet-producers" });

      p.producers.forEach(function (pr) {

        var line = pr.display || "—";

        if (pr.kg != null) line += " · " + fmtKg(pr.kg) + " kg";

        if (pr.pct != null) line += " (" + pr.pct + "%)";

        plist.appendChild(ui.el("li", {}, [line]));

      });

      wrap.appendChild(plist);

    }

    if ((p.input_bags || []).length) {

      wrap.appendChild(ui.el("h4", {}, ["Source jumbo BAG IDs"]));

      var blist = ui.el("ul", { class: "bs-dash-pallet-sources" });

      p.input_bags.forEach(function (s) {

        blist.appendChild(ui.el("li", {}, [s]));

      });

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

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtKg(bucket.kg) + " kg"]));

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
    rows.sort(function (a, b) {
      var da = a.status_changed_at || a.recorded_at || "";
      var db = b.status_changed_at || b.recorded_at || "";
      if (da !== db) return String(da).localeCompare(String(db));
      return String(a.serial || "").localeCompare(String(b.serial || ""));
    });
    return rows;
  }

  function palletProducerCell(row) {
    if (row.producer_name) return row.producer_name;
    if (row.mixed_producers) return "Mixed producers — tap for split";
    return "—";
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
      card.appendChild(ui.el("span", { class: "bs-dash-cat-card__sub" }, [fmtKg(c.kg) + " kg"]));
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
      var producer = (row.producer_name || "").trim();
      if (!producer && row.product_stream === "pallet") {
        producer = "Pallet — tap bag for source producers";
      }
      if (!producer) producer = "Unknown producer";
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
      g.rows.sort(function (a, b) {
        return String(a.serial || "").localeCompare(String(b.serial || ""));
      });
    });
    return list;
  }

  function renderFscPill(label, ui) {
    var tone = FSC_TONE[label] || "unknown";
    return ui.el("span", { class: "bs-dash-fsc-pill bs-dash-fsc-pill--" + tone }, [label]);
  }

  function renderProducerBagTable(rows, ui, onRowClick) {
    var wrap = ui.el("div", { class: "bs-dash-table-wrap" });
    var table = ui.el("table", { class: "bs-dash-table bs-dash-table--compact" });
    var thead = ui.el("thead", {});
    var hr = ui.el("tr", {});
    ["Bag", "Stream", "kg", "When", "Weathering", "Detail"].forEach(function (h) {
      hr.appendChild(ui.el("th", {}, [h]));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = ui.el("tbody", {});
    rows.forEach(function (row) {
      var tr = ui.el("tr", {});
      if (onRowClick && row.product_stream === "pallet") {
        tr.className = "bs-dash-table-row--clickable";
        tr.title = "View source jumbos and producers";
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
      tr.appendChild(ui.el("td", {}, [fmtKg(row.net_weight_kg)]));
      tr.appendChild(ui.el("td", {}, [scanTimestampCell(row)]));
      tr.appendChild(ui.el("td", {}, [weatherText(row)]));
      tr.appendChild(ui.el("td", { class: "bs-dash-muted" }, [
        row.client_name || row.container_number || row.status_display || "—",
      ]));
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

  function renderWxDrillView(rows, ui, onRowClick) {
    var wrap = ui.el("div", { class: "bs-dash-wx-drill" });
    wrap.appendChild(renderStreamCategorySummary(rows, ui));
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
        group.bags + (group.bags === 1 ? " bag" : " bags") + " · " + fmtKg(group.kg) + " kg",
      ]));
      details.appendChild(summary);
      details.appendChild(renderProducerBagTable(group.rows, ui, onRowClick));
      list.appendChild(details);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function renderDrillTable(rows, ui, onRowClick) {

    var wrap = ui.el("div", { class: "bs-dash-table-wrap" });

    var table = ui.el("table", { class: "bs-dash-table" });

    var thead = ui.el("thead", {});

    var hr = ui.el("tr", {});

    ["#", "Bag", "Stream", "Producer", "kg", "When", "Weathering", "Detail"].forEach(function (h) {

      hr.appendChild(ui.el("th", {}, [h]));

    });

    thead.appendChild(hr);

    table.appendChild(thead);

    var tbody = ui.el("tbody", {});

    rows.forEach(function (row, i) {

      var tr = ui.el("tr", {});

      if (onRowClick && row.product_stream === "pallet") {

        tr.className = "bs-dash-table-row--clickable";

        tr.title = "View source jumbos and producers";

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

      tr.appendChild(ui.el("td", {}, [palletProducerCell(row)]));

      tr.appendChild(ui.el("td", {}, [fmtKg(row.net_weight_kg)]));

      tr.appendChild(ui.el("td", {}, [scanTimestampCell(row)]));

      tr.appendChild(ui.el("td", {}, [weatherText(row)]));

      tr.appendChild(ui.el("td", { class: "bs-dash-muted" }, [

        row.client_name || row.container_number || row.status_display || "—",

      ]));

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

      var dayLabel = section.date_kind === "early_release"
        ? "Early release · " + fmtDayHeading(section.date)
        : fmtDayHeading(section.date);
      card.appendChild(ui.el("span", { class: "bs-dash-status-card__label" }, [dayLabel]));

      card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(section.bags)]));

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtKg(section.kg) + " kg"]));

      var dest = section.client_name || section.container_number;

      if (dest) card.appendChild(ui.el("span", { class: "bs-dash-status-card__dest" }, [dest]));

      var split = streamSplitText(section.streams);

      if (split) card.appendChild(ui.el("span", { class: "bs-dash-status-card__streams" }, [split]));

      wrap.appendChild(card);

    });

    return wrap;

  }



  async function render(container, ctx) {

    var ui = CIS.ui;

    container.className = "module-content bs-dashboard-host";



    var summary = null;

    var weathering = null;

    var selected = null;

    var selectedEvent = null;

    var wxDrill = null;
    var wxDrillToken = 0;



    var dash = ui.el("div", { class: "bs-dashboard" });

    dash.appendChild(ui.el("header", { class: "bs-dash-header" }, [

      ui.el("h2", { class: "bs-dash-title" }, ["Bags Status"]),

      ui.el("p", { class: "bs-dash-lead" }, [

        "Where bags are now, and how the 21-day weathering clock is running.",

      ]),

      renderStreamLegend(ui),

    ]));

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

      return "/reports/bags-weathering?" + q.join("&");

    }



    function goBackFromWxDrill() {
      wxDrillToken += 1;
      wxDrill = null;
      paint();
    }

    function syncFloatingNav() {
      if (!ctx.setFloatingBack) return;
      if (wxDrill) {
        ctx.setFloatingBack({ onClick: goBackFromWxDrill });
      } else if (selected) {
        if (selected.palletDetail) {
          ctx.setFloatingBack({
            onClick: function () {
              selected.palletDetail = null;
              selected.serial = null;
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
        } else {
          ctx.setFloatingBack({
            onClick: function () {
              selected = null;
              paint();
            },
          });
        }
      } else {
        ctx.setFloatingBack(null);
      }
    }

    function showWxDrillLoading(sel, opts) {
      opts = opts || {};
      body.innerHTML = "";
      body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [sel.label || "Bags"]));
      body.appendChild(renderDrillLoading(sel.label, ui));
      if (container && typeof container.scrollTop === "number") {
        container.scrollTop = 0;
      }
      syncFloatingNav();
    }

    async function openWxDrill(sel, opts) {
      opts = opts || {};
      var token = wxDrillToken + 1;
      wxDrillToken = token;
      wxDrill = null;
      if (!opts.keepSelected) {
        selected = null;
        selectedEvent = null;
      }
      status.style.display = "none";
      showWxDrillLoading(sel, opts);

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
          backTo: opts.backTo || "main",
        };
        paint();
      } catch (e) {
        if (token !== wxDrillToken) return;
        body.innerHTML = "";
        body.appendChild(ui.error("Could not load bags: " + (e.message || e)));
        syncFloatingNav();
      }
    }



    function paint() {

      body.innerHTML = "";

      if (!summary) return;



      if (selected && selected.palletDetail) {

        body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

          (selected.label || "Pallet") + " — " + selected.serial,

        ]));

        body.appendChild(renderPalletDetailDrill(selected.serial, selected.palletDetail, ui));

        syncFloatingNav();
        return;

      }



      if (wxDrill) {

        body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

          wxDrill.label + " — " + (wxDrill.rows || []).length + " bags",

        ]));

        if (!(wxDrill.rows || []).length) {

          body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No bags in this bucket."]));

        } else {

          body.appendChild(renderWxDrillView(wxDrill.rows, ui, openPalletDetail));

        }

        syncFloatingNav();
        return;

      }



      if (selected) {

        if (selected.key === "packed_into_pallet") {

          body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
            "These are source jumbos consumed at packaging — end of life. "
              + "They are not physical pallets. See Packaging — pallet production below.",
          ]));

        }



        if (selected.mode === "pallet_basket") {

          body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [selected.label]));

          body.appendChild(renderPalletBasketDrill(selected.detail || summary.pallet_basket, ui));

          syncFloatingNav();
          return;

        }



        if (selected.mode === "physical_pallets" && !selectedEvent && !selected.palletDetail) {

          if (selected.view === "flat_list") {

            body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

              selected.label + " — " + selected.count + (selected.count === 1 ? " pallet" : " pallets"),

            ]));

            body.appendChild(ui.el("p", { class: "bs-dash-drill-note" }, [
              "All physical pallet BAG IDs — tap a row for source jumbos and producer mix (kg and %).",
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
              "Physical pallet BAG IDs by location — tap a tile, then a BAG ID for source jumbos and producers.",
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
              "Tap a product, then a pallet BAG ID for source jumbos and producers.",
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
              "Tap a pallet BAG ID for source jumbos and producers.",
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

            "Grouped by weathering clock, not scan date. Click a bucket for the bag list.",

          ]));

          if (!selected.buckets.length) {

            body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No bags in this status."]));

          } else {

            body.appendChild(renderWxBucketCards(selected.buckets, ui, function (bucketSel) {
              openWxDrill(bucketSel, { backTo: "status_buckets", keepSelected: true });
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

        side.appendChild(renderPipelineChart(weathering.pipeline, ui));

        grid.appendChild(side);

        body.appendChild(grid);

      }



      orderDashboardGroups(combineTransitCoastGroups(summary.groups)).forEach(function (group) {

        body.appendChild(renderGroup(group, ui, null, openStatus, summary));

      });

      syncFloatingNav();
    }



    async function openPalletDetail(row) {

      if (!row || !row.serial) return;

      status.textContent = "Loading pallet lineage…";

      status.style.display = "";

      try {

        var data = await ctx.api.traceability(

          "/reports/pallet-detail?serial=" + encodeURIComponent(row.serial)

        );

        if (!selected) {

          selected = { label: "Pallet", mode: "pallet_detail", key: "pallet" };

        }

        selected.palletDetail = data;

        selected.serial = row.serial;

        if (!selected.label) selected.label = "Pallet";

        status.style.display = "none";

        paint();

      } catch (e) {

        status.style.display = "none";

        body.innerHTML = "";

        body.appendChild(ui.error("Could not load pallet: " + (e.message || e)));

      }

    }



    async function openPalletBucket(bucket, statusKey) {

      status.textContent = "Loading " + bucket.label + "…";

      status.style.display = "";

      try {

        var data = await ctx.api.traceability(

          "/reports/bags-status?status=" + encodeURIComponent(statusKey) + "&stream=pallet"

        );

        selectedEvent = null;

        wxDrill = null;

        var parent = selected || {};

        status.style.display = "none";

        var locRows = flattenPalletSectionRows(data.event_sections || []);

        if (!locRows.length && data.physical_pallets && data.physical_pallets.by_product) {

          (data.physical_pallets.by_product || []).forEach(function (b) {

            (b.rows || []).forEach(function (row) { locRows.push(row); });

          });

        }

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

        paint();

      } catch (e) {

        status.style.display = "none";

        body.innerHTML = "";

        body.appendChild(ui.error("Could not load pallets: " + (e.message || e)));

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

      status.textContent = "Loading " + (st.label || "Pallets") + "…";

      status.style.display = "";

      try {

        var palletData = await ctx.api.traceability("/reports/bags-status?stream=pallet");

        if (!container.isConnected) return;

        status.style.display = "none";

        showPhysicalPalletByProduct(st, palletData, count);

      } catch (e) {

        status.style.display = "none";

        body.innerHTML = "";

        body.appendChild(ui.error("Could not load pallets: " + (e.message || e)));

      }

    }



    async function openStatus(st) {

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

        selected = {

          key: st.key,

          label: st.label,

          mode: "weathering_buckets",

          buckets: wxBucketsForStatus(st.key, weathering),

        };

        paint();

        return;

      }

      status.textContent = "Loading " + st.label + "…";

      status.style.display = "";

      try {

        var data = await ctx.api.traceability("/reports/bags-status?status=" + encodeURIComponent(st.key));

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

        status.style.display = "none";

        paint();

      } catch (e) {

        status.style.display = "none";

        body.innerHTML = "";

        body.appendChild(ui.error("Could not load bags: " + (e.message || e)));

      }

    }



    var pollTimer = null;

    var countdownTimer = null;

    var countdownSec = Math.round(BS_AUTO_REFRESH_MS / 1000);



    function updateCountdownText() {

      if (!refreshNote || !container.isConnected) return;

      refreshNote.hidden = false;

      refreshNote.textContent = "Next update in " + countdownSec + " seconds";

    }



    function resetCountdown() {

      countdownSec = Math.round(BS_AUTO_REFRESH_MS / 1000);

      updateCountdownText();

    }



    function stopTimers() {

      if (pollTimer) {

        clearInterval(pollTimer);

        pollTimer = null;

      }

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

        if (countdownSec < 0) {

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

        if (!opts.silent) {

          status.style.display = "none";

        }

        if (!opts.silent || (!selected && !selectedEvent && !wxDrill)) {

          paint();

        }

        resetCountdown();

        startCountdown();

      } catch (e) {

        if (opts.silent) return;

        status.textContent = "";

        refreshNote.hidden = true;

        body.innerHTML = "";

        body.appendChild(ui.error("Could not load report: " + (e.message || e)));

      }

    }



    stopTimers();

    pollTimer = setInterval(function () {

      if (!container.isConnected) {

        stopTimers();

        return;

      }

      refreshReport({ silent: true });

    }, BS_AUTO_REFRESH_MS);



    await refreshReport({ reset: true });

  }



  CIS.modules.push({

    id: "bags_status_report",

    title: "Bags Status",

    section: "Production",

    kind: "lookup",

    order: 17,

    icon: "bags",

    description: "Where bags are — and weathering clock, release timing, pipeline",

    requires: "traceability.bags_status",

    render: render,

  });

})();

