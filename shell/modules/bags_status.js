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

  function fmtKg(n) {
    var v = Number(n || 0);
    return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

  function renderSummaryCards(data, ui) {
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
    return wrap;
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
    var selected = null;
    var selectedEvent = null;

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Bags Status"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Current position of every bag — in storage, in transit, at the coast, or closed. Click a status to list the bags.",
    ]));

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    container.appendChild(status);
    var body = ui.el("div", { class: "report-body" });
    container.appendChild(body);

    function paint() {
      body.innerHTML = "";
      if (!summary) return;

      if (selected) {
        var back = ui.el("button", { class: "btn-ghost btn-sm", type: "button", onclick: function () {
          if (selectedEvent) {
            selectedEvent = null;
          } else {
            selected = null;
          }
          paint();
        } }, [selectedEvent ? "← Event dates" : "← All statuses"]);
        body.appendChild(back);

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
      summary.groups.forEach(function (group) {
        body.appendChild(renderGroup(group, ui, null, openStatus));
      });
    }

    async function openStatus(st) {
      status.textContent = "Loading " + st.label + "…";
      status.style.display = "";
      try {
        var data = await ctx.api.traceability("/reports/bags-status?status=" + encodeURIComponent(st.key));
        selectedEvent = null;
        selected = {
          key: st.key,
          label: st.label,
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
      summary = await ctx.api.traceability("/reports/bags-status");
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
    description: "Where every bag is now — storage, transit, coast, container",
    requires: "traceability.bags_status",
    render: render,
  });
})();
