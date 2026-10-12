/* Walvis day scan log — flat timeline for one Windhoek day (Traceability hub).
   Newest scan on top; gap column helps spot truck batches (~64 bags). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var DISPLAY_TZ = "Africa/Windhoek";
  var STATUS_OPTIONS = [
    { value: "storage_walvisbay", label: "Into storage — Walvis Bay" },
    { value: "on_truck_walvisbay", label: "In transit — truck to Walvis Bay" },
  ];
  var STREAM_OPTIONS = [
    { value: "", label: "All streams" },
    { value: "restaurant", label: "Restaurant" },
    { value: "lumpwood", label: "Lumpwood" },
    { value: "fines", label: "Fines" },
    { value: "briquettes", label: "Briquettes" },
    { value: "pallet", label: "Pallet" },
  ];

  function windhoekTodayIso() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: DISPLAY_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function fmtMass(kg) {
    return CIS.formatMassFromKg(kg, { forceKg: true });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!parts) return String(iso);
    var d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function fmtMovedAt(row) {
    if (!row) return "—";
    var iso = row.status_changed_at || row.recorded_at;
    if (!iso) return "—";
    var timeHm = row.status_changed_time || row.recorded_time;
    if (timeHm) return timeHm;
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleTimeString("en-GB", {
        timeZone: DISPLAY_TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (e) {
      return "—";
    }
  }

  function streamLabel(row) {
    var map = {
      restaurant: "Restaurant",
      lumpwood: "Lumpwood",
      fines: "Fines",
      briquettes: "Briquettes",
      pallet: "Pallet",
    };
    var key = (row.product_stream || "").toLowerCase();
    return map[key] || row.product_stream || "—";
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content bs-dashboard-host";

    var dash = ui.el("div", { class: "bs-dashboard wdsl-dashboard" });
    dash.appendChild(
      ui.el("header", { class: "bs-dash-header" }, [
        ui.el("h2", { class: "bs-dash-title" }, ["Day scan log"]),
        ui.el("p", { class: "bs-dash-lead" }, [
          "Full list for one Windhoek day — newest scan on top. ",
          "The gap column is time since the previous scan (chronologically); a long gap often marks the start of the next truck load.",
        ]),
      ])
    );
    container.appendChild(dash);

    var dayInput = ui.el("input", { type: "date", value: windhoekTodayIso() });
    var statusSelect = ui.el("select", {});
    STATUS_OPTIONS.forEach(function (opt) {
      statusSelect.appendChild(ui.el("option", { value: opt.value }, [opt.label]));
    });
    var streamSelect = ui.el("select", {});
    STREAM_OPTIONS.forEach(function (opt) {
      streamSelect.appendChild(ui.el("option", { value: opt.value }, [opt.label]));
    });
    var gapInput = ui.el("input", {
      type: "number",
      min: "5",
      max: "480",
      step: "5",
      value: "20",
      title: "Highlight gaps at or above this many minutes",
    });

    var toolbar = ui.el("div", { class: "toolbar wdsl-toolbar" });
    toolbar.appendChild(
      ui.el("label", { class: "ct-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Day (Windhoek)"]),
        dayInput,
      ])
    );
    toolbar.appendChild(
      ui.el("label", { class: "ct-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Status moved into"]),
        statusSelect,
      ])
    );
    toolbar.appendChild(
      ui.el("label", { class: "ct-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Stream"]),
        streamSelect,
      ])
    );
    toolbar.appendChild(
      ui.el("label", { class: "ct-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Highlight gap ≥ (min)"]),
        gapInput,
      ])
    );
    var refreshBtn = ui.el("button", { type: "button", class: "btn wdsl-refresh-btn" }, ["Refresh"]);
    toolbar.appendChild(refreshBtn);
    dash.appendChild(toolbar);

    var summaryEl = ui.el("p", { class: "wdsl-summary bs-dash-drill-note" });
    dash.appendChild(summaryEl);

    var body = ui.el("div", { class: "wdsl-body bs-dash-body" });
    dash.appendChild(body);

    async function load() {
      var day = dayInput.value || windhoekTodayIso();
      var status = statusSelect.value;
      var stream = streamSelect.value;
      var gapMin = parseInt(gapInput.value, 10) || 20;
      body.innerHTML = "";
      summaryEl.textContent = "Loading…";
      refreshBtn.disabled = true;
      try {
        var q =
          "/reports/bag-movements-by-day?day=" +
          encodeURIComponent(day) +
          "&status=" +
          encodeURIComponent(status) +
          "&gap_highlight_minutes=" +
          encodeURIComponent(String(gapMin));
        if (stream) q += "&stream=" + encodeURIComponent(stream);
        var data = await ctx.api.traceability(q);
        var rows = data.rows || [];
        summaryEl.textContent =
          fmtDate(data.day) +
          " · " +
          (data.status_label || data.status || status) +
          " · " +
          rows.length +
          " bags · " +
          fmtMass(data.kg);
        if (!rows.length) {
          body.appendChild(
            ui.el("p", { class: "muted" }, ["No scans on this day for the selected filters."])
          );
          return;
        }
        var wrap = ui.el("div", { class: "bs-dash-table-wrap" });
        var table = ui.el("table", { class: "bs-dash-table wdsl-table" });
        var thead = ui.el("thead", {});
        var hr = ui.el("tr", {});
        ["#", "Bag", "Producer", "Stream", "kg", "Moved at", "Gap since prior scan"].forEach(function (h) {
          hr.appendChild(ui.el("th", {}, [h]));
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        var tbody = ui.el("tbody", {});
        rows.forEach(function (row, i) {
          var tr = ui.el("tr", {});
          if (row.gap_highlight) tr.className = "wdsl-row--gap";
          tr.appendChild(ui.el("td", { class: "bs-dash-muted" }, [String(i + 1)]));
          tr.appendChild(ui.el("td", {}, [row.serial || "—"]));
          tr.appendChild(ui.el("td", {}, [row.producer_name || "—"]));
          tr.appendChild(ui.el("td", {}, [streamLabel(row)]));
          tr.appendChild(ui.el("td", {}, [fmtMass(row.net_weight_kg)]));
          tr.appendChild(ui.el("td", { class: "wdsl-moved-at" }, [fmtMovedAt(row)]));
          var gapTd = ui.el("td", {});
          if (row.gap_to_previous_label) {
            gapTd.textContent = row.gap_to_previous_label;
            if (row.gap_highlight) gapTd.className = "wdsl-gap--long";
          } else {
            gapTd.textContent = i === rows.length - 1 ? "—" : "—";
          }
          tr.appendChild(gapTd);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        body.appendChild(wrap);
      } catch (e) {
        summaryEl.textContent = "";
        body.appendChild(ui.error("Could not load scan log: " + (e.message || e)));
      } finally {
        refreshBtn.disabled = false;
      }
    }

    refreshBtn.addEventListener("click", load);
    dayInput.addEventListener("change", load);
    statusSelect.addEventListener("change", load);
    streamSelect.addEventListener("change", load);
    gapInput.addEventListener("change", load);
    await load();
  }

  CIS.modules.push({
    id: "walvis_day_scan_log",
    title: "Day scan log",
    section: "Traceability",
    kind: "lookup",
    order: 18,
    icon: "schedule",
    description: "One day, all scans, newest first — spot gaps between truck loads",
    requires: "traceability.bags_status",
    render: render,
  });
})();
