/* Weathering Board — how the 21-day clock is running across factory stock.
   Uses GET /reports/bags-weathering only; does not touch Bags Created or Bags Status. */

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

  var STREAM_ORDER = ["restaurant", "lumpwood", "fines", "briquettes", "pallet"];

  function fmtKg(n) {
    return Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!parts) return String(iso);
    var d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function weatherText(row) {
    if (row.released_early) return "Early release";
    var days = row.days_remaining;
    if (days === null || days === undefined) return "—";
    days = Number(days);
    if (days > 0) return days + (days === 1 ? " day left" : " days left");
    var over = Math.abs(days);
    if (over === 0) return "Ready today";
    return "Ready " + over + (over === 1 ? " day" : " days") + " ago";
  }

  function maxKg(items) {
    var m = 0;
    (items || []).forEach(function (item) {
      m = Math.max(m, Number(item.kg || 0));
    });
    return m || 1;
  }

  function renderBarSegments(streamKg, totalKg, scaleMax, ui) {
    var wrap = ui.el("div", { class: "wb-bar-wrap" });
    var track = ui.el("div", { class: "wb-bar-track" });
    wrap.appendChild(track);
    if (!totalKg) return wrap;
    track.style.width = Math.max((totalKg / scaleMax) * 100, 1) + "%";
    STREAM_ORDER.forEach(function (key) {
      var kg = (streamKg || {})[key] || 0;
      if (!kg) return;
      var seg = ui.el("div", {
        class: "wb-bar-seg wb-bar-seg--" + key,
        style: { width: (kg / totalKg * 100) + "%" },
        title: fmtKg(kg) + " kg " + (STREAM_LABELS[key] || key).toLowerCase(),
      });
      track.appendChild(seg);
    });
    return wrap;
  }

  function renderHistogram(buckets, ui, onDrill) {
    var panel = ui.el("div", { class: "wb-panel" });
    panel.appendChild(ui.el("h3", {}, ["Days remaining"]));
    panel.appendChild(ui.el("p", { class: "wb-panel-note" }, [
      "Every in-system bag on the weathering clock. Click a row for the bag list.",
    ]));
    var scale = maxKg(buckets);
    var any = false;
    (buckets || []).forEach(function (b) {
      if (!(b.bags || 0)) return;
      any = true;
      var row = ui.el("button", {
        class: "wb-bar-row",
        type: "button",
        onclick: function () { onDrill({ bucket: b.key, label: b.label }); },
      });
      row.appendChild(ui.el("span", { class: "wb-bar-label" }, [b.label]));
      row.appendChild(renderBarSegments(b.stream_kg, b.kg, scale, ui));
      var meta = b.bags + " · " + fmtKg(b.kg) + " kg";
      if (b.early_release) meta += " · " + b.early_release + " early";
      row.appendChild(ui.el("span", { class: "wb-bar-meta" }, [meta]));
      panel.appendChild(row);
    });
    if (!any) panel.appendChild(ui.el("p", { class: "wb-empty" }, ["No bags on the clock."]));
    panel.appendChild(ui.el("div", { class: "wb-legend" }, [
      ui.el("span", { class: "restaurant" }, ["Restaurant"]),
      ui.el("span", { class: "lumpwood" }, ["Lumpwood"]),
      ui.el("span", { class: "fines" }, ["Fines"]),
    ]));
    return panel;
  }

  function renderWeekChart(weeks, ui, onDrill) {
    var panel = ui.el("div", { class: "wb-panel" });
    panel.appendChild(ui.el("h3", {}, ["When stock frees up"]));
    panel.appendChild(ui.el("p", { class: "wb-panel-note" }, [
      "Grouped by weathering end week (Monday). Shows the next eight weeks, then Later.",
    ]));
    var scale = maxKg(weeks);
    var any = false;
    (weeks || []).forEach(function (w) {
      if (!(w.bags || 0)) return;
      any = true;
      var row = ui.el("button", {
        class: "wb-bar-row",
        type: "button",
        onclick: function () { onDrill({ week: w.key, label: w.label }); },
      });
      row.appendChild(ui.el("span", { class: "wb-bar-label" }, [w.label]));
      row.appendChild(renderBarSegments(w.stream_kg, w.kg, scale, ui));
      row.appendChild(ui.el("span", { class: "wb-bar-meta" }, [
        w.bags + " · " + fmtKg(w.kg) + " kg",
      ]));
      panel.appendChild(row);
    });
    if (!any) panel.appendChild(ui.el("p", { class: "wb-empty" }, ["Nothing scheduled to finish."]));
    return panel;
  }

  function renderPipeline(pipeline, ui, onDrill) {
    var panel = ui.el("div", { class: "wb-panel" });
    panel.appendChild(ui.el("h3", {}, ["Factory pipeline"]));
    panel.appendChild(ui.el("p", { class: "wb-panel-note" }, [
      "Location and clock together — bags at packaging still show days left.",
    ]));
    var wrap = ui.el("div", { class: "wb-pipeline" });
    (pipeline || []).forEach(function (row) {
      var grid = ui.el("div", { class: "wb-pipeline-row" });
      grid.appendChild(ui.el("div", { class: "wb-pipeline-loc" }, [row.label]));
      [
        { key: "still_weathering", title: "Still weathering", ready: false },
        { key: "ready", title: "Ready", ready: true },
      ].forEach(function (spec) {
        var cell = row[spec.key] || {};
        var btn = ui.el("button", {
          class: "wb-pipeline-cell" + (spec.ready ? " wb-pipeline-cell--ready" : ""),
          type: "button",
          onclick: function () {
            onDrill({
              pipeline_location: row.location,
              pipeline_clock: spec.key,
              label: row.label + " · " + spec.title,
            });
          },
        });
        btn.appendChild(ui.el("div", { class: "wb-pipeline-cell__title" }, [spec.title]));
        btn.appendChild(ui.el("div", { class: "wb-pipeline-cell__count" }, [String(cell.bags || 0)]));
        var sub = fmtKg(cell.kg) + " kg";
        if (cell.early_release) sub += " · " + cell.early_release + " early";
        btn.appendChild(ui.el("div", { class: "wb-pipeline-cell__sub" }, [sub]));
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
    });
    panel.appendChild(wrap);
    return panel;
  }

  function renderKpis(kpis, ui) {
    var row = ui.el("div", { class: "wb-kpi-row" });
    [
      { key: "ready_now", label: "Ready now", highlight: true },
      { key: "freeing_this_week", label: "Freeing this week" },
      { key: "still_weathering", label: "Still weathering" },
      { key: "at_packaging", label: "At packaging" },
    ].forEach(function (item) {
      var k = (kpis || {})[item.key] || {};
      var card = ui.el("div", {
        class: "wb-kpi" + (item.highlight ? " wb-kpi--highlight" : ""),
      });
      card.appendChild(ui.el("span", { class: "wb-kpi__label" }, [item.label]));
      card.appendChild(ui.el("div", { class: "wb-kpi__value" }, [String(k.bags || 0)]));
      card.appendChild(ui.el("div", { class: "wb-kpi__sub" }, [fmtKg(k.kg) + " kg"]));
      row.appendChild(card);
    });
    var early = (kpis || {}).early_release_in_pipeline || {};
    if ((early.bags || 0) > 0) {
      var subtle = ui.el("div", { class: "wb-kpi wb-kpi--subtle" });
      subtle.appendChild(ui.el("span", { class: "wb-kpi__label" }, ["Early release in pipeline"]));
      subtle.appendChild(ui.el("div", { class: "wb-kpi__value" }, [String(early.bags)]));
      subtle.appendChild(ui.el("div", { class: "wb-kpi__sub" }, [
        fmtKg(early.kg) + " kg · manager override, clock still running",
      ]));
      row.appendChild(subtle);
    }
    return row;
  }

  function renderDrillTable(rows, ui) {
    var table = ui.el("table", { class: "data" });
    var thead = ui.el("thead", {});
    var hr = ui.el("tr", {});
    ["#", "Bag", "Stream", "Producer", "kg", "End date", "Clock", "Location"].forEach(function (h) {
      hr.appendChild(ui.el("th", {}, [h]));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = ui.el("tbody", {});
    (rows || []).forEach(function (row, i) {
      var tr = ui.el("tr", {});
      tr.appendChild(ui.el("td", { class: "muted" }, [String(i + 1)]));
      var serialCell = ui.el("td", {}, [row.serial || "—"]);
      if (row.released_early) {
        serialCell.appendChild(ui.el("span", { class: "wb-badge-early" }, ["early"]));
      }
      tr.appendChild(serialCell);
      tr.appendChild(ui.el("td", {}, [STREAM_LABELS[row.product_stream] || row.product_stream || "—"]));
      tr.appendChild(ui.el("td", {}, [row.producer_name || "—"]));
      tr.appendChild(ui.el("td", {}, [fmtKg(row.net_weight_kg)]));
      tr.appendChild(ui.el("td", {}, [fmtDate(row.weathering_end_date)]));
      tr.appendChild(ui.el("td", {}, [weatherText(row)]));
      tr.appendChild(ui.el("td", { class: "muted" }, [row.status_display || row.storage_status || "—"]));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var root = ui.el("div", { class: "wb-root" });
    container.appendChild(root);

    root.appendChild(ui.el("h2", { class: "module-title" }, ["Weathering Board"]));
    root.appendChild(ui.el("p", { class: "module-desc" }, [
      "How factory stock is progressing on the 21-day weathering clock — ready counts, release timing, and pipeline.",
    ]));

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    root.appendChild(status);
    var body = ui.el("div", { class: "report-body" });
    root.appendChild(body);

    var summary = null;
    var drillSelection = null;

    function buildDrillQuery(sel) {
      var q = [];
      if (sel.bucket) q.push("bucket=" + encodeURIComponent(sel.bucket));
      if (sel.week) q.push("week=" + encodeURIComponent(sel.week));
      if (sel.pipeline_location) q.push("pipeline_location=" + encodeURIComponent(sel.pipeline_location));
      if (sel.pipeline_clock) q.push("pipeline_clock=" + encodeURIComponent(sel.pipeline_clock));
      return "/reports/bags-weathering?" + q.join("&");
    }

    function paint() {
      body.innerHTML = "";
      if (!summary) return;

      if (drillSelection) {
        var head = ui.el("div", { class: "wb-drill-head" });
        head.appendChild(ui.el("button", {
          class: "btn-ghost btn-sm",
          type: "button",
          onclick: function () {
            drillSelection = null;
            paint();
          },
        }, ["← Board"]));
        head.appendChild(ui.el("h3", { class: "bm-subheading" }, [
          drillSelection.label + " — " + (drillSelection.bag_count || 0) + " bags",
        ]));
        body.appendChild(head);
        if (!(drillSelection.rows || []).length) {
          body.appendChild(ui.el("p", { class: "wb-empty" }, ["No bags in this selection."]));
        } else {
          body.appendChild(renderDrillTable(drillSelection.rows, ui));
        }
        return;
      }

      body.appendChild(renderKpis(summary.kpis, ui));
      body.appendChild(renderHistogram(summary.days_buckets, ui, openDrill));
      body.appendChild(renderWeekChart(summary.end_weeks, ui, openDrill));
      body.appendChild(renderPipeline(summary.pipeline, ui, openDrill));
    }

    async function openDrill(sel) {
      status.textContent = "Loading " + (sel.label || "detail") + "…";
      status.style.display = "";
      try {
        var data = await ctx.api.traceability(buildDrillQuery(sel));
        drillSelection = {
          label: sel.label,
          bag_count: (data.drill && data.drill.bag_count) || 0,
          rows: (data.drill && data.drill.rows) || [],
        };
        status.style.display = "none";
        paint();
      } catch (e) {
        status.style.display = "none";
        body.innerHTML = "";
        body.appendChild(ui.error("Could not load detail: " + (e.message || e)));
      }
    }

    if (!ctx.api.traceability) {
      status.style.display = "none";
      body.appendChild(ui.error("Traceability API is not configured in CIS."));
      return;
    }

    try {
      summary = await ctx.api.traceability("/reports/bags-weathering");
      status.style.display = "none";
      paint();
    } catch (e) {
      status.textContent = "";
      body.appendChild(ui.error("Could not load weathering board: " + (e.message || e)));
    }
  }

  CIS.modules.push({
    id: "bags_weathering_board",
    title: "Weathering Board",
    section: "Production",
    kind: "lookup",
    order: 18,
    icon: "bags",
    description: "21-day clock — ready counts, release weeks, factory pipeline",
    requires: "traceability.bags_status",
    render: render,
  });
})();
