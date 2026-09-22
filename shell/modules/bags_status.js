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
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
      { label: "In the system", value: data.in_system, highlight: true },
      { label: "Closed", value: data.closed },
      { label: "Bags on record", value: { bags: data.bag_count } },
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

  async function render(container, ctx) {
    var ui = CIS.ui;
    var summary = null;
    var selected = null;

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
          selected = null;
          paint();
        } }, ["← All statuses"]);
        body.appendChild(back);
        body.appendChild(ui.el("h3", { class: "bm-subheading" }, [
          selected.label + " — " + selected.rows.length + (selected.rows.length === 1 ? " bag" : " bags"),
        ]));
        if (!selected.rows.length) {
          body.appendChild(ui.el("p", { class: "muted" }, ["No bags are in this status."]));
        } else {
          body.appendChild(renderDrillTable(selected.rows, ui));
        }
        return;
      }

      body.appendChild(renderSummaryCards(summary, ui));
      summary.groups.forEach(function (group) {
        body.appendChild(renderGroup(group, ui, null, openStatus));
      });
      body.appendChild(ui.el("p", { class: "muted bm-hint" }, [
        "Weathering runs " + summary.weathering_days + " days from the charcoal's origin. Converted bags inherit what is left of their inputs' clock.",
      ]));
    }

    async function openStatus(st) {
      status.textContent = "Loading " + st.label + "…";
      status.style.display = "";
      try {
        var data = await ctx.api.traceability("/reports/bags-status?status=" + encodeURIComponent(st.key));
        selected = { key: st.key, label: st.label, rows: data.rows || [] };
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
