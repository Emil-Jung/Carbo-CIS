/* Bags Status — analytics dashboard: where bags are + 21-day weathering clock. */



(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];



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

    var card = ui.el("div", { class: "bs-dash-card bs-dash-card--chart" });

    card.appendChild(ui.el("div", { class: "bs-dash-card__head" }, [

      ui.el("h3", {}, ["Release calendar"]),

      ui.el("p", { class: "bs-dash-card__sub" }, ["Bags finishing weathering by week — click a bar"]),

    ]));

    var weeks = (endWeeks || []).filter(function (w) { return (w.bags || 0) > 0; });

    if (!weeks.length) {

      card.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No upcoming releases on the clock."]));

      return card;

    }

    var maxBags = Math.max.apply(null, weeks.map(function (w) { return w.bags || 0; }));

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

    return card;

  }



  function renderPipelineChart(pipeline, ui) {

    var card = ui.el("div", { class: "bs-dash-card bs-dash-card--wide" });

    card.appendChild(ui.el("div", { class: "bs-dash-card__head" }, [

      ui.el("h3", {}, ["Pipeline by location"]),

      ui.el("p", { class: "bs-dash-card__sub" }, [

        "Still on the clock vs ready to move — in storage, packaging, briquette plant",

      ]),

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

    addPart(inv.available, "ready", "ready");

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

    closed: "slate",

  };



  function renderGroup(group, ui, selectedStatus, onSelect) {

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

    var cards = ui.el("div", { class: "bs-dash-status-grid" });

    group.statuses.forEach(function (st) {

      var cls = "bs-dash-status-card";

      if (st.key === selectedStatus) cls += " bs-dash-status-card--active";

      var card = ui.el("button", { class: cls, type: "button", onclick: function () { onSelect(st); } });

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__label" }, [st.label]));

      card.appendChild(ui.el("div", { class: "bs-dash-status-card__value" }, [String(st.bags)]));

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__sub" }, [fmtKg(st.kg) + " kg"]));

      var split = streamSplitText(st.streams);

      if (split) card.appendChild(ui.el("span", { class: "bs-dash-status-card__streams" }, [split]));

      cards.appendChild(card);

    });

    block.appendChild(cards);

    return block;

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
    return text;
  }

  function fscText(row) {
    var label = normalizeFscLabel(row.fsc_status);
    if (label) return label;
    label = normalizeFscLabel(row.fsc_classification);
    if (label) return label;
    var mode = String(row.supplier_mode || "").toLowerCase();
    if (SUPPLIER_MODE_FSC[mode]) return SUPPLIER_MODE_FSC[mode];
    if (row.is_fsc === true) return "FSC";
    if (row.is_fsc === false) return "Non-FSC";
    return "Unknown";
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
      var producer = (row.producer_name || "Unknown producer").trim() || "Unknown producer";
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

  function renderProducerBagTable(rows, ui) {
    var wrap = ui.el("div", { class: "bs-dash-table-wrap" });
    var table = ui.el("table", { class: "bs-dash-table bs-dash-table--compact" });
    var thead = ui.el("thead", {});
    var hr = ui.el("tr", {});
    ["Bag", "Stream", "kg", "Scanned", "Weathering", "Detail"].forEach(function (h) {
      hr.appendChild(ui.el("th", {}, [h]));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = ui.el("tbody", {});
    rows.forEach(function (row) {
      var tr = ui.el("tr", {});
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
      tr.appendChild(ui.el("td", {}, [fmtDate(row.recorded_date || row.recorded_at)]));
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

  function renderWxDrillView(rows, ui) {
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
      details.appendChild(renderProducerBagTable(group.rows, ui));
      list.appendChild(details);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function renderDrillTable(rows, ui) {

    var wrap = ui.el("div", { class: "bs-dash-table-wrap" });

    var table = ui.el("table", { class: "bs-dash-table" });

    var thead = ui.el("thead", {});

    var hr = ui.el("tr", {});

    ["#", "Bag", "Stream", "Producer", "kg", "Scanned", "Weathering", "Detail"].forEach(function (h) {

      hr.appendChild(ui.el("th", {}, [h]));

    });

    thead.appendChild(hr);

    table.appendChild(thead);

    var tbody = ui.el("tbody", {});

    rows.forEach(function (row, i) {

      var tr = ui.el("tr", {});

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

      tr.appendChild(ui.el("td", {}, [row.producer_name || "—"]));

      tr.appendChild(ui.el("td", {}, [fmtKg(row.net_weight_kg)]));

      tr.appendChild(ui.el("td", {}, [fmtDate(row.recorded_date || row.recorded_at)]));

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

      card.appendChild(ui.el("span", { class: "bs-dash-status-card__label" }, [fmtDayHeading(section.date)]));

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



    var BACK_MAIN = "Bags Status";

    function goBackFromWxDrill() {
      wxDrillToken += 1;
      wxDrill = null;
      paint();
    }

    function wxDrillBackLabel(backTo) {
      return backTo === "status_buckets" ? "Buckets" : BACK_MAIN;
    }

    function syncFloatingNav() {
      if (!ctx.setFloatingBack) return;
      if (wxDrill) {
        ctx.setFloatingBack({
          label: wxDrill.backTo === "status_buckets"
            ? "← Return to buckets"
            : "← Return to Bags Status",
          onClick: goBackFromWxDrill,
        });
      } else if (selected) {
        if (selectedEvent) {
          ctx.setFloatingBack({
            label: "← Return to event dates",
            onClick: function () {
              selectedEvent = null;
              paint();
            },
          });
        } else {
          ctx.setFloatingBack({
            label: "← Return to Bags Status",
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
      body.appendChild(renderBack(wxDrillBackLabel(opts.backTo), function () {
        wxDrillToken += 1;
        wxDrill = null;
        paint();
      }));
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
        wxDrill = {
          label: sel.label,
          rows: (data.drill && data.drill.rows) || [],
          backTo: opts.backTo || "main",
        };
        paint();
      } catch (e) {
        if (token !== wxDrillToken) return;
        body.innerHTML = "";
        body.appendChild(renderBack(wxDrillBackLabel(opts.backTo), function () {
          wxDrill = null;
          paint();
        }));
        body.appendChild(ui.error("Could not load bags: " + (e.message || e)));
        syncFloatingNav();
      }
    }



    function renderBack(label, onClick) {

      return ui.el("button", {

        class: "bs-dash-back",

        type: "button",

        onclick: onClick,

      }, ["← " + label]);

    }



    function paint() {

      body.innerHTML = "";

      if (!summary) return;



      if (wxDrill) {

        body.appendChild(renderBack(wxDrillBackLabel(wxDrill.backTo), function () {
          goBackFromWxDrill();
        }));

        body.appendChild(ui.el("h3", { class: "bs-dash-drill-title" }, [

          wxDrill.label + " — " + (wxDrill.rows || []).length + " bags",

        ]));

        if (!(wxDrill.rows || []).length) {

          body.appendChild(ui.el("p", { class: "bs-dash-empty" }, ["No bags in this bucket."]));

        } else {

          body.appendChild(renderWxDrillView(wxDrill.rows, ui));

        }

        syncFloatingNav();
        return;

      }



      if (selected) {

        var backLabel = selectedEvent ? "Event dates" : BACK_MAIN;

        if (selected.mode === "weathering_buckets" && !selectedEvent) backLabel = BACK_MAIN;

        body.appendChild(renderBack(backLabel, function () {

          if (selectedEvent) {

            selectedEvent = null;

          } else {

            selected = null;

          }

          paint();

        }));



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

            body.appendChild(renderDrillTable(selectedEvent.rows, ui));

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

        grid.appendChild(renderWeekChart(weathering.end_weeks, ui, openWxDrill));

        body.appendChild(grid);

        body.appendChild(renderPipelineChart(weathering.pipeline, ui));

      }



      summary.groups.forEach(function (group) {

        body.appendChild(renderGroup(group, ui, null, openStatus));

      });

      syncFloatingNav();
    }



    async function openStatus(st) {

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

        selected = {

          key: st.key,

          label: st.label,

          mode: "events",

          count: data.drill_bag_count || 0,

          sections: data.event_sections || [],

        };

        status.style.display = "none";

        paint();

      } catch (e) {

        status.style.display = "none";

        body.innerHTML = "";

        body.appendChild(ui.error("Could not load bags: " + (e.message || e)));

      }

    }



    if (!ctx.api.traceability) {

      status.style.display = "none";

      body.appendChild(ui.error("Traceability API is not configured in CIS."));

      return;

    }



    try {

      var results = await Promise.all([

        ctx.api.traceability("/reports/bags-status"),

        ctx.api.traceability("/reports/bags-weathering").catch(function () { return null; }),

      ]);

      summary = results[0];

      weathering = results[1];

      status.style.display = "none";

      paint();

    } catch (e) {

      status.textContent = "";

      body.appendChild(ui.error("Could not load report: " + (e.message || e)));

    }

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

