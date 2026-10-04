/* Bags Status — where the charcoal physically is right now.
   Bags Intake answers "what came off the trucks"; this answers "what is still
   standing, and where". Each bag counts once, against its current status. */

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

  function renderLabelInventoryPanel(inv, ui) {
    if (!inv) return null;
    var tag = ui.el("aside", {
      class: "bm-label-tag",
      title: "Printed labels ready vs labels already on bags",
    });
    tag.appendChild(ui.el("span", { class: "bm-label-tag__badge" }, ["Bag labels"]));
    var line = ui.el("span", { class: "bm-label-tag__line" });
    function addItem(value, suffix, tone) {
      var item = ui.el("span", { class: "bm-label-tag__item bm-label-tag__item--" + tone });
      item.appendChild(ui.el("strong", {}, [fmt(value)]));
      item.appendChild(document.createTextNode(" " + suffix));
      line.appendChild(item);
    }
    function addSep() {
      line.appendChild(ui.el("span", { class: "bm-label-tag__sep" }, ["·"]));
    }
    addItem(inv.available, "ready", "ready");
    addSep();
    addItem(inv.used, "on bags", "used");
    if ((inv.allocated || 0) > 0) {
      addSep();
      addItem(inv.allocated, "awaiting print", "pending");
    }
    if ((inv.void || 0) > 0) {
      addSep();
      addItem(inv.void, "void", "void");
    }
    tag.appendChild(line);
    return tag;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d;
    // Plain YYYY-MM-DD is a calendar day, not an instant — build it locally so
    // the browser's timezone cannot shift it to the day before.
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

  /** Weathering shown as a countdown, or how long it has been ready. */
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

  var WX_STREAM_ORDER = ["restaurant", "lumpwood", "fines"];

  /** Status tiles that drill by weathering bucket, not scan date. */
  var WX_BUCKET_STATUS = {
    in_storage_weathering: function (key) { return key !== "ready"; },
    in_storage: function (key) { return key === "ready"; },
  };

  function wxMaxKg(items) {
    var m = 0;
    (items || []).forEach(function (item) { m = Math.max(m, Number(item.kg || 0)); });
    return m || 1;
  }

  function renderWxBarSegments(streamKg, totalKg, scaleMax, ui) {
    var track = ui.el("div", { class: "bs-wx-bar-track" });
    if (!totalKg) return track;
    track.style.width = Math.max((totalKg / scaleMax) * 100, 1) + "%";
    WX_STREAM_ORDER.forEach(function (key) {
      var kg = (streamKg || {})[key] || 0;
      if (!kg) return;
      track.appendChild(ui.el("div", {
        class: "bs-wx-bar-seg bs-wx-bar-seg--" + key,
        style: { width: (kg / totalKg * 100) + "%" },
      }));
    });
    return track;
  }

  function renderWxKpis(kpis, ui) {
    var row = ui.el("div", { class: "bs-wx-kpi-row" });
    [
      { key: "ready_now", label: "Ready now", hi: true },
      { key: "freeing_this_week", label: "Freeing this week" },
      { key: "still_weathering", label: "Still weathering" },
      { key: "at_packaging", label: "At packaging" },
    ].forEach(function (item) {
      var k = (kpis || {})[item.key] || {};
      var card = ui.el("div", { class: "bs-wx-kpi" + (item.hi ? " bs-wx-kpi--hi" : "") });
      card.appendChild(ui.el("span", { class: "bs-wx-kpi__label" }, [item.label]));
      card.appendChild(ui.el("div", { class: "bs-wx-kpi__value" }, [String(k.bags || 0)]));
      card.appendChild(ui.el("div", { class: "bs-wx-kpi__sub" }, [fmtKg(k.kg) + " kg"]));
      row.appendChild(card);
    });
    return row;
  }

  function renderWeatheringPanel(wx, ui, onDrill) {
    if (!wx) return null;
    var panel = ui.el("section", { class: "bs-wx-panel" });
    panel.appendChild(ui.el("h3", {}, ["Weathering — 21-day clock"]));
    panel.appendChild(ui.el("p", { class: "bs-wx-note" }, [
      "How factory stock is progressing on the clock. Click a row to list bags.",
    ]));
    panel.appendChild(renderWxKpis(wx.kpis, ui));
    var scale = wxMaxKg(wx.days_buckets);
    var any = false;
    (wx.days_buckets || []).forEach(function (b) {
      if (!(b.bags || 0)) return;
      any = true;
      var row = ui.el("button", {
        class: "bs-wx-bar-row",
        type: "button",
        onclick: function () { onDrill({ bucket: b.key, label: b.label }); },
      });
      row.appendChild(ui.el("span", { class: "bs-wx-bar-label" }, [b.label]));
      row.appendChild(renderWxBarSegments(b.stream_kg, b.kg, scale, ui));
      row.appendChild(ui.el("span", { class: "bs-wx-bar-meta" }, [
        b.bags + " · " + fmtKg(b.kg),
      ]));
      panel.appendChild(row);
    });
    if (!any) panel.appendChild(ui.el("p", { class: "bs-wx-empty" }, ["No bags on the clock."]));
    return panel;
  }

  function renderWxBucketCards(buckets, ui, onOpen) {
    var wrap = ui.el("div", { class: "cards bm-status-cards" });
    buckets.forEach(function (b) {
      var card = ui.el("button", {
        class: "card bm-status-card",
        type: "button",
        onclick: function () { onOpen({ bucket: b.key, label: b.label }); },
      });
      card.appendChild(ui.el("span", { class: "label" }, [b.label]));
      card.appendChild(ui.el("div", { class: "value" }, [String(b.bags)]));
      card.appendChild(ui.el("span", { class: "muted" }, [fmtKg(b.kg) + " kg"]));
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

  function renderSummaryCards(data, ui) {
    var row = ui.el("div", { class: "bs-summary-row" });
    var wrap = ui.el("div", { class: "cards" });
    [
      { label: "Active in system", value: data.in_system, highlight: true },
      { label: "End of life", value: data.closed },
      { label: "All bags in system", value: { bags: data.bag_count } },
    ].forEach(function (item) {
      var card = ui.el("div", { class: "card" + (item.highlight ? " card--highlight" : "") });
      card.appendChild(ui.el("span", { class: "label" }, [item.label]));
      card.appendChild(ui.el("div", { class: "value" }, [String((item.value && item.value.bags) || 0)]));
      if (item.value && item.value.kg !== undefined) {
        card.appendChild(ui.el("span", { class: "muted" }, [fmtKg(item.value.kg) + " kg"]));
      }
      wrap.appendChild(card);
    });
    row.appendChild(wrap);
    var labelPanel = renderLabelInventoryPanel(data.label_inventory, ui);
    if (labelPanel) {
      var slot = ui.el("div", { class: "bm-label-slot bs-summary-label" });
      slot.appendChild(labelPanel);
      row.appendChild(slot);
    }
    return row;
  }

  function renderGroup(group, ui, selectedStatus, onSelect) {
    var block = ui.el("div", {});
    block.appendChild(ui.el("h3", { class: "bm-subheading" }, [
      group.label + " — " + group.bags + (group.bags === 1 ? " bag" : " bags"),
    ]));
    if (group.note) {
      block.appendChild(ui.el("p", { class: "muted bags-status-note" }, [group.note]));
    }
    var cards = ui.el("div", { class: "cards bm-status-cards" });
    group.statuses.forEach(function (st) {
      var cls = "card bm-status-card";
      if (st.key === selectedStatus) cls += " bm-status-card--active";
      var card = ui.el("button", { class: cls, type: "button", onclick: function () { onSelect(st); } });
      card.appendChild(ui.el("span", { class: "label" }, [st.label]));
      card.appendChild(ui.el("div", { class: "value" }, [String(st.bags)]));
      card.appendChild(ui.el("span", { class: "muted" }, [fmtKg(st.kg) + " kg"]));
      var split = streamSplitText(st.streams);
      if (split) card.appendChild(ui.el("div", { class: "muted" }, [split]));
      cards.appendChild(card);
    });
    block.appendChild(cards);
    return block;
  }

  function renderDrillTable(rows, ui) {
    var table = ui.el("table", { class: "data" });
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
      tr.appendChild(ui.el("td", { class: "muted" }, [String(i + 1)]));
      tr.appendChild(ui.el("td", {}, [row.serial || "—"]));
      tr.appendChild(ui.el("td", {}, [streamText(row)]));
      tr.appendChild(ui.el("td", {}, [row.producer_name || "—"]));
      tr.appendChild(ui.el("td", {}, [fmtKg(row.net_weight_kg)]));
      tr.appendChild(ui.el("td", {}, [fmtDate(row.recorded_date || row.recorded_at)]));
      tr.appendChild(ui.el("td", {}, [weatherText(row)]));
      tr.appendChild(ui.el("td", { class: "muted" }, [
        row.client_name || row.container_number || row.status_display || "—",
      ]));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  /** Date clusters only — bag detail waits for a second click. */
  function renderEventCards(sections, ui, onOpen) {
    var wrap = ui.el("div", { class: "cards bm-status-cards" });
    sections.forEach(function (section) {
      var card = ui.el("button", {
        class: "card bm-status-card",
        type: "button",
        onclick: function () { onOpen(section); },
      });
      card.appendChild(ui.el("span", { class: "label" }, [fmtDayHeading(section.date)]));
      card.appendChild(ui.el("div", { class: "value" }, [String(section.bags)]));
      card.appendChild(ui.el("span", { class: "muted" }, [fmtKg(section.kg) + " kg"]));
      var dest = section.client_name || section.container_number;
      if (dest) card.appendChild(ui.el("div", { class: "bags-status-event-dest" }, [dest]));
      var split = streamSplitText(section.streams);
      if (split) card.appendChild(ui.el("div", { class: "muted" }, [split]));
      wrap.appendChild(card);
    });
    return wrap;
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var summary = null;
    var weathering = null;
    var selected = null;
    var selectedEvent = null;
    var wxDrill = null;

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Bags Status"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Where bags are now, and how the 21-day weathering clock is running. Click a status for detail.",
    ]));

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    container.appendChild(status);
    var body = ui.el("div", { class: "report-body" });
    container.appendChild(body);

    function buildWxDrillQuery(sel) {
      var q = [];
      if (sel.bucket) q.push("bucket=" + encodeURIComponent(sel.bucket));
      return "/reports/bags-weathering?" + q.join("&");
    }

    async function openWxDrill(sel) {
      status.textContent = "Loading " + (sel.label || "bags") + "…";
      status.style.display = "";
      try {
        var data = await ctx.api.traceability(buildWxDrillQuery(sel));
        wxDrill = {
          label: sel.label,
          rows: (data.drill && data.drill.rows) || [],
        };
        selected = null;
        selectedEvent = null;
        status.style.display = "none";
        paint();
      } catch (e) {
        status.style.display = "none";
        body.innerHTML = "";
        body.appendChild(ui.error("Could not load bags: " + (e.message || e)));
      }
    }

    function paint() {
      body.innerHTML = "";
      if (!summary) return;

      if (wxDrill) {
        body.appendChild(ui.el("button", {
          class: "btn-ghost btn-sm",
          type: "button",
          onclick: function () { wxDrill = null; paint(); },
        }, ["← Weathering"]));
        body.appendChild(ui.el("h3", { class: "bm-subheading" }, [
          wxDrill.label + " — " + (wxDrill.rows || []).length + " bags",
        ]));
        if (!(wxDrill.rows || []).length) {
          body.appendChild(ui.el("p", { class: "muted" }, ["No bags in this bucket."]));
        } else {
          body.appendChild(renderDrillTable(wxDrill.rows, ui));
        }
        return;
      }

      if (selected) {
        var backLabel = selectedEvent ? "← Buckets" : "← All statuses";
        if (selected.mode !== "weathering_buckets") backLabel = selectedEvent ? "← Event dates" : "← All statuses";
        var back = ui.el("button", { class: "btn-ghost btn-sm", type: "button", onclick: function () {
          if (selectedEvent) {
            selectedEvent = null;
          } else {
            selected = null;
          }
          paint();
        } }, [backLabel]);
        body.appendChild(back);

        if (selected.mode === "weathering_buckets" && !selectedEvent) {
          body.appendChild(ui.el("h3", { class: "bm-subheading" }, [
            selected.label + " — by days remaining",
          ]));
          body.appendChild(ui.el("p", { class: "muted bags-status-note" }, [
            "Grouped by weathering clock, not scan date. Click a bucket for the bag list.",
          ]));
          if (!selected.buckets.length) {
            body.appendChild(ui.el("p", { class: "muted" }, ["No bags in this status."]));
          } else {
            body.appendChild(renderWxBucketCards(selected.buckets, ui, function (sel) {
              openWxDrill(sel);
            }));
          }
          return;
        }

        if (selectedEvent) {
          var dest = selectedEvent.client_name || selectedEvent.container_number;
          body.appendChild(ui.el("h3", { class: "bm-subheading" }, [
            selected.label + " — " + fmtDayHeading(selectedEvent.date)
              + (dest ? " — " + dest : "")
              + " — " + selectedEvent.bags + (selectedEvent.bags === 1 ? " bag" : " bags"),
          ]));
          if (!(selectedEvent.rows || []).length) {
            body.appendChild(ui.el("p", { class: "muted" }, ["No bags in this event."]));
          } else {
            body.appendChild(renderDrillTable(selectedEvent.rows, ui));
          }
          return;
        }

        body.appendChild(ui.el("h3", { class: "bm-subheading" }, [
          selected.label + " — " + selected.count + (selected.count === 1 ? " bag" : " bags")
            + " across " + selected.sections.length
            + (selected.sections.length === 1 ? " date" : " dates"),
        ]));
        if (!selected.sections.length) {
          body.appendChild(ui.el("p", { class: "muted" }, ["No bags are in this status."]));
        } else {
          body.appendChild(ui.el("p", { class: "muted bags-status-note" }, [
            "Each date is one cluster — three loads to the same destination on the same day count as one event. Click a date for the bags.",
          ]));
          body.appendChild(renderEventCards(selected.sections, ui, function (section) {
            selectedEvent = section;
            paint();
          }));
        }
        return;
      }

      body.appendChild(renderSummaryCards(summary, ui));
      var wxPanel = renderWeatheringPanel(weathering, ui, openWxDrill);
      if (wxPanel) body.appendChild(wxPanel);
      summary.groups.forEach(function (group) {
        body.appendChild(renderGroup(group, ui, null, openStatus));
      });
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
