/* Bags Movement — daily sieve scan-in report (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var STREAMS = [
    { id: "all", label: "All streams" },
    { id: "restaurant", label: "Restaurant" },
    { id: "lumpwood", label: "Lumpwood" },
    { id: "fines", label: "Fines" },
  ];

  var STREAM_META = {
    restaurant: { label: "Restaurant", className: "bm-stream--rest" },
    lumpwood: { label: "Lumpwood", className: "bm-stream--lump" },
    fines: { label: "Fines", className: "bm-stream--fines" },
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
    var n = parseInt(m, 10);
    return names[n - 1] || m;
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

  function card(ui, label, value) {
    var c = ui.el("div", { class: "card" });
    c.appendChild(ui.el("div", { class: "label" }, [label]));
    c.appendChild(ui.el("div", { class: "value" }, [value]));
    return c;
  }

  function streamChip(label, count, kg) {
    if (!count) return label + " 0";
    return label + " " + count + " · " + fmt(kg, 0) + " kg";
  }

  function renderBagTable(rows, ui) {
    var table = ui.el("table", { class: "data bags-movement-table bags-movement-table--compact" });
    table.innerHTML =
      "<thead><tr>" +
      "<th>#</th><th>Net kg</th><th>Days left</th><th>Status</th><th>Tag</th>" +
      "</tr></thead>";
    var tbody = ui.el("tbody");
    rows.forEach(function (row) {
      var tr = ui.el("tr");
      var daysClass = row.weathered ? "bags-movement-days bags-movement-days--done" : "bags-movement-days";
      var daysText = row.weathered ? "0 (ready)" : String(row.days_remaining);
      tr.innerHTML =
        "<td>" + ui.escape(String(row.seq)) + "</td>" +
        "<td>" + fmt(row.net_weight_kg, 0) + "</td>" +
        "<td class='" + daysClass + "'>" + ui.escape(daysText) + "</td>" +
        "<td>" + ui.escape(row.storage_status_display || row.storage_status_label || "—") + "</td>" +
        "<td class='bags-movement-tag'>" + ui.escape(row.serial || "—") + "</td>";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function paintReport(body, data, ui, streamFilter) {
    body.innerHTML = "";
    streamFilter = streamFilter || "all";
    var streams = data.streams || {};
    var groups = data.producer_groups || [];

    var cards = ui.el("div", { class: "cards" });
    cards.appendChild(card(ui, "Producers this day", fmt(data.producer_count || groups.length)));
    cards.appendChild(card(ui, "Bags this day", fmt(data.bag_count)));
    cards.appendChild(
      card(
        ui,
        "Restaurant",
        fmt((streams.restaurant && streams.restaurant.bags) || 0) +
          " · " + fmt((streams.restaurant && streams.restaurant.kg) || 0, 0) + " kg"
      )
    );
    cards.appendChild(
      card(
        ui,
        "Lumpwood",
        fmt((streams.lumpwood && streams.lumpwood.bags) || 0) +
          " · " + fmt((streams.lumpwood && streams.lumpwood.kg) || 0, 0) + " kg"
      )
    );
    cards.appendChild(
      card(
        ui,
        "Fines",
        fmt((streams.fines && streams.fines.bags) || 0) +
          " · " + fmt((streams.fines && streams.fines.kg) || 0, 0) + " kg"
      )
    );
    body.appendChild(cards);

    if (!groups.length) {
      body.appendChild(ui.el("p", { class: "muted" }, ["No bags recorded on this date."]));
      return;
    }

    var hint = ui.el("p", { class: "muted bm-hint" }, [
      groups.length + " producer load(s). Each section is collapsed by default on busy days — expand to see bag lines split into Restaurant, Lumpwood, and Fines.",
    ]);
    body.appendChild(hint);

    var collapseDefault = (data.bag_count || 0) > 30;
    var list = ui.el("div", { class: "bm-producer-list" });

    groups.forEach(function (group) {
      var visibleStreams = ["restaurant", "lumpwood", "fines"].filter(function (sid) {
        if (streamFilter !== "all" && streamFilter !== sid) return false;
        var block = group.streams && group.streams[sid];
        return block && block.bags > 0;
      });
      if (!visibleStreams.length) return;

      var details = ui.el("details", { class: "bm-producer" });
      if (!collapseDefault) details.open = true;

      var summaryParts = [
        ui.escape(group.producer_name || "—"),
        " — ",
        streamChip("R", (group.streams.restaurant && group.streams.restaurant.bags) || 0, (group.streams.restaurant && group.streams.restaurant.kg) || 0),
        " · ",
        streamChip("L", (group.streams.lumpwood && group.streams.lumpwood.bags) || 0, (group.streams.lumpwood && group.streams.lumpwood.kg) || 0),
        " · ",
        streamChip("F", (group.streams.fines && group.streams.fines.bags) || 0, (group.streams.fines && group.streams.fines.kg) || 0),
      ];
      if (group.weathering_end_date) {
        summaryParts.push(" · weathering to " + ui.escape(fmtDate(group.weathering_end_date)));
      }
      var summary = ui.el("summary", { class: "bm-producer-summary" });
      summary.innerHTML = summaryParts.join("");
      details.appendChild(summary);

      var inner = ui.el("div", { class: "bm-producer-body" });
      inner.appendChild(
        ui.el("p", { class: "bm-producer-meta muted" }, [
          fmt(group.bag_count) + " bags · " + fmt(group.total_kg, 0) + " kg total" +
            (group.min_days_remaining != null
              ? " · " + (group.min_days_remaining <= 0 ? "weathered" : group.min_days_remaining + " days left")
              : ""),
        ])
      );

      visibleStreams.forEach(function (sid) {
        var meta = STREAM_META[sid];
        var block = group.streams[sid];
        var section = ui.el("section", { class: "bm-stream " + (meta ? meta.className : "") });
        section.appendChild(
          ui.el("h4", { class: "bm-stream-title" }, [
            (meta ? meta.label : sid) + " (" + block.bags + " bags · " + fmt(block.kg, 0) + " kg)",
          ])
        );
        section.appendChild(renderBagTable(block.rows || [], ui));
        inner.appendChild(section);
      });

      details.appendChild(inner);
      list.appendChild(details);
    });

    body.appendChild(list);

    body.appendChild(
      ui.el("p", { class: "muted" }, [
        "Weathering: " + String(data.weathering_days || 21) +
          " calendar days after scan-in · " + ui.escape(data.timezone || "Africa/Windhoek") + ".",
      ])
    );
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var streamFilter = "all";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Bags Movement"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Daily scan-in by producer — Restaurant, Lumpwood, and Fines kept separate. Expand a producer to see individual bags.",
      ])
    );

    var toolbar = ui.el("div", { class: "toolbar bm-toolbar" });
    toolbar.appendChild(ui.el("label", { for: "bags-movement-date" }, ["Date"]));
    var dateInput = ui.el("input", { id: "bags-movement-date", type: "date", value: todayIso() });
    toolbar.appendChild(dateInput);
    toolbar.appendChild(ui.el("button", { type: "button", class: "btn-ghost btn-sm", id: "bm-prev" }, ["Previous day"]));
    toolbar.appendChild(ui.el("button", { type: "button", class: "btn-ghost btn-sm", id: "bm-next" }, ["Next day"]));
    toolbar.appendChild(ui.el("button", { type: "button", class: "btn-ghost btn-sm", id: "bm-today" }, ["Today"]));
    container.appendChild(toolbar);

    var filterBar = ui.el("div", { class: "toolbar bm-filter-bar" });
    filterBar.appendChild(ui.el("span", { class: "bm-filter-label" }, ["Show:"]));
    var filterBtns = ui.el("div", { class: "bm-filter-btns" });
    STREAMS.forEach(function (s) {
      var btn = ui.el("button", {
        type: "button",
        class: "btn-ghost btn-sm bm-filter-btn" + (s.id === streamFilter ? " bm-filter-btn--active" : ""),
        "data-stream": s.id,
      }, [s.label]);
      filterBtns.appendChild(btn);
    });
    filterBar.appendChild(filterBtns);
    container.appendChild(filterBar);

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    container.appendChild(status);
    var body = ui.el("div", { class: "report-body" });
    container.appendChild(body);

    var lastData = null;

    function setFilter(next) {
      streamFilter = next;
      filterBtns.querySelectorAll(".bm-filter-btn").forEach(function (btn) {
        btn.classList.toggle("bm-filter-btn--active", btn.getAttribute("data-stream") === streamFilter);
      });
      if (lastData) paintReport(body, lastData, ui, streamFilter);
    }

    filterBtns.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".bm-filter-btn");
      if (!btn) return;
      setFilter(btn.getAttribute("data-stream") || "all");
    });

    async function loadReport(isoDate) {
      status.textContent = "Loading…";
      status.style.display = "";
      body.innerHTML = "";
      if (!ctx.api.traceability) {
        status.style.display = "none";
        body.appendChild(ui.error("Traceability API is not configured in CIS."));
        return;
      }
      try {
        var data = await ctx.api.traceability(
          "/reports/bags-movement?date=" + encodeURIComponent(isoDate)
        );
        lastData = data;
        status.style.display = "none";
        paintReport(body, data, ui, streamFilter);
      } catch (e) {
        lastData = null;
        status.textContent = "";
        body.innerHTML = "";
        body.appendChild(ui.error("Could not load report: " + (e.message || e)));
      }
    }

    function currentDate() {
      return dateInput.value || todayIso();
    }

    dateInput.addEventListener("change", function () { loadReport(currentDate()); });
    container.querySelector("#bm-prev").addEventListener("click", function () {
      dateInput.value = shiftDate(currentDate(), -1);
      loadReport(dateInput.value);
    });
    container.querySelector("#bm-next").addEventListener("click", function () {
      dateInput.value = shiftDate(currentDate(), 1);
      loadReport(dateInput.value);
    });
    container.querySelector("#bm-today").addEventListener("click", function () {
      dateInput.value = todayIso();
      loadReport(dateInput.value);
    });

    await loadReport(currentDate());
  }

  CIS.modules.push({
    id: "bags_movement_report",
    title: "Bags Movement",
    section: "Production",
    kind: "lookup",
    order: 16,
    icon: "bags",
    description: "Daily bag scan-in — producer, stream, weathering, storage status",
    requires: "traceability.bags_movement",
    requiresAny: ["traceability.bags_movement", "traceability.stock.view"],
    render: render,
  });
})();
