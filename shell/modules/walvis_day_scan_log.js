/* Walvis day scan log — flat timeline for one Windhoek day (Traceability hub).
   Newest scan on top; gap column helps spot truck batches (~64 bags). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var DISPLAY_TZ = "Africa/Windhoek";
  var WDSL_AUTO_REFRESH_MS = 40000;
  var FALLBACK_STATUS_OPTIONS = [
    { value: "all", label: "All movement scans" },
    { value: "master_storage_revert", label: "God mode — status revert" },
    { value: "packaging", label: "Packing — in, consumed, pallet wrapped" },
    { value: "storage_walvisbay", label: "Into storage — Walvis Bay" },
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

  function fmtDateTime(iso, timeHm) {
    if (!iso) return "—";
    var datePart = fmtDate(iso);
    if (timeHm) return datePart + " · " + timeHm;
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return datePart;
      return (
        datePart +
        " · " +
        d.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    } catch (e) {
      return datePart;
    }
  }

  /** Current storage status clock (live bag), same as Bags Status drill. */
  function fmtStatusSince(row) {
    if (!row) return "—";
    if (row.bag_status_since_at) {
      return fmtDateTime(row.bag_status_since_at, row.bag_status_since_time);
    }
    if (row.recorded_at) {
      return fmtDateTime(row.recorded_at, row.recorded_time);
    }
    return "—";
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
        ui.el("h2", { class: "bs-dash-title" }, ["Daily scan log"]),
        ui.el("p", { class: "bs-dash-lead" }, [
          "Every bag movement scan for one Windhoek day (sieve Charcoal Intake is excluded). ",
          "Newest on top — use packaging filters to compare bulk bag consumed vs pallets wrapped (wastage). ",
          "Gap column = time since the previous scan; long gaps often mark a new truck batch. ",
          "God mode status reverts are shown in ",
          ui.el("span", { class: "wdsl-movement--master-revert" }, ["violet text"]),
          " in the Movement column (or use the God mode filter).",
        ]),
      ])
    );
    container.appendChild(dash);

    var dayInput = ui.el("input", { type: "date", value: windhoekTodayIso() });
    var statusSelect = ui.el("select", {});
    function fillStatusOptions(list) {
      statusSelect.innerHTML = "";
      (list || FALLBACK_STATUS_OPTIONS).forEach(function (opt) {
        statusSelect.appendChild(ui.el("option", { value: opt.value }, [opt.label]));
      });
    }
    fillStatusOptions(FALLBACK_STATUS_OPTIONS);
    try {
      var optData = await ctx.api.traceability("/reports/bag-movements-by-day/status-options");
      if (optData && optData.options && optData.options.length) {
        fillStatusOptions(optData.options);
      }
    } catch (e) {
      /* fallback list */
    }
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
        ui.el("span", { class: "ct-field-label" }, ["Movement filter"]),
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
    var refreshNote = ui.el("p", { class: "bm-refresh-note muted", hidden: true }, [""]);
    dash.appendChild(refreshNote);

    var balanceEl = ui.el("div", { class: "wdsl-packaging-balance" });
    dash.appendChild(balanceEl);

    var body = ui.el("div", { class: "wdsl-body bs-dash-body" });
    dash.appendChild(body);

    function renderPackagingBalance(byProduct) {
      balanceEl.innerHTML = "";
      var keys = Object.keys(byProduct || {}).sort();
      if (!keys.length) return;
      var panel = ui.el("div", { class: "wdsl-balance-panel" });
      panel.appendChild(
        ui.el("h3", { class: "wdsl-balance-title" }, ["Packing balance by SKU (this day)"])
      );
      panel.appendChild(
        ui.el("p", { class: "bs-dash-drill-note" }, [
          "Consumed bulk bag kg vs pallet output kg — variance near zero suggests full yield; negative means more in than pallets out (same day).",
        ])
      );
      var wrap = ui.el("div", { class: "bs-dash-table-wrap" });
      var table = ui.el("table", { class: "bs-dash-table wdsl-table" });
      var hr = ui.el("tr", {});
      ["SKU", "Bulk bag consumed (kg)", "Pallet output (kg)", "Variance (kg)"].forEach(function (h) {
        hr.appendChild(ui.el("th", {}, [h]));
      });
      table.appendChild(ui.el("thead", {}, [hr]));
      var tbody = ui.el("tbody", {});
      keys.forEach(function (code) {
        var b = byProduct[code];
        var tr = ui.el("tr", {});
        tr.appendChild(ui.el("td", {}, [code]));
        tr.appendChild(ui.el("td", {}, [fmtMass(b.consumed_kg)]));
        tr.appendChild(ui.el("td", {}, [fmtMass(b.pallet_output_kg)]));
        var varTd = ui.el("td", {});
        varTd.textContent = fmtMass(b.variance_kg);
        if (Math.abs(Number(b.variance_kg || 0)) > 50) varTd.className = "wdsl-gap--long";
        tr.appendChild(varTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      panel.appendChild(wrap);
      balanceEl.appendChild(panel);
    }

    var pollTimer = null;
    var countdownTimer = null;
    var countdownSec = Math.round(WDSL_AUTO_REFRESH_MS / 1000);

    function updateCountdownText() {
      if (!refreshNote || !container.isConnected) return;
      refreshNote.hidden = false;
      refreshNote.textContent = "Next update in " + countdownSec + " seconds";
    }

    function resetCountdown() {
      countdownSec = Math.round(WDSL_AUTO_REFRESH_MS / 1000);
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
          countdownSec = Math.round(WDSL_AUTO_REFRESH_MS / 1000);
        }
        updateCountdownText();
      }, 1000);
    }

    async function load(opts) {
      opts = opts || {};
      var day = dayInput.value || windhoekTodayIso();
      var status = statusSelect.value;
      var stream = streamSelect.value;
      var gapMin = parseInt(gapInput.value, 10) || 20;
      if (!opts.silent) {
        body.innerHTML = "";
        balanceEl.innerHTML = "";
        summaryEl.textContent = "Checking Traceability API…";
        refreshBtn.disabled = true;
      }
      try {
        if (CIS.traceabilityHealth) {
          var health = await CIS.traceabilityHealth();
          if (!health.ok) {
            var healthMsg =
              health.status === 502 || (health.detail && /\b502\b/.test(String(health.detail)))
                ? CIS.traceabilityApiErrorMessage(new Error("HTTP 502"))
                : "Traceability API is not reachable (" + (health.detail || "health check failed") + ").";
            if (!opts.silent) {
              summaryEl.textContent = "";
              body.appendChild(ui.error(healthMsg));
            }
            return;
          }
        }
        if (!opts.silent) summaryEl.textContent = "Loading…";
        var q =
          "/reports/bag-movements-by-day?day=" +
          encodeURIComponent(day) +
          "&status=" +
          encodeURIComponent(status) +
          "&gap_highlight_minutes=" +
          encodeURIComponent(String(gapMin));
        if (stream) q += "&stream=" + encodeURIComponent(stream);
        var data = await ctx.api.traceability(q);
        if (!container.isConnected) return;
        var rows = data.rows || [];
        body.innerHTML = "";
        balanceEl.innerHTML = "";
        summaryEl.textContent =
          fmtDate(data.day) +
          " · " +
          (data.status_label || data.status || status) +
          " · " +
          rows.length +
          " events · " +
          fmtMass(data.kg);
        renderPackagingBalance(data.packaging_balance_by_product);
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
        ["#", "Bag", "Movement", "SKU", "Producer", "Stream", "kg", "Status since", "Moved at", "Gap"].forEach(function (h) {
          hr.appendChild(ui.el("th", {}, [h]));
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        var tbody = ui.el("tbody", {});
        rows.forEach(function (row, i) {
          var tr = ui.el("tr", {});
          var rowCls = [];
          if (row.gap_highlight) rowCls.push("wdsl-row--gap");
          if (row.master_storage_override) rowCls.push("wdsl-row--master-revert");
          if (rowCls.length) tr.className = rowCls.join(" ");
          var movementCls = "wdsl-movement";
          if (row.master_storage_override) movementCls += " wdsl-movement--master-revert";
          tr.appendChild(ui.el("td", { class: "bs-dash-muted" }, [String(i + 1)]));
          tr.appendChild(ui.el("td", {}, [row.serial || "—"]));
          tr.appendChild(ui.el("td", { class: movementCls }, [row.movement_summary || "—"]));
          tr.appendChild(ui.el("td", {}, [row.movement_product_code || row.product_code || "—"]));
          tr.appendChild(ui.el("td", {}, [row.producer_name || "—"]));
          tr.appendChild(ui.el("td", {}, [streamLabel(row)]));
          tr.appendChild(ui.el("td", {}, [fmtMass(row.net_weight_kg)]));
          tr.appendChild(ui.el("td", { class: "wdsl-status-since" }, [fmtStatusSince(row)]));
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
        if (opts.silent) return;
        summaryEl.textContent = "";
        refreshNote.hidden = true;
        var errText =
          CIS.traceabilityApiErrorMessage && CIS.traceabilityApiErrorMessage(e)
            ? CIS.traceabilityApiErrorMessage(e)
            : e.message || e;
        body.appendChild(ui.error("Could not load scan log: " + errText));
      } finally {
        if (!opts.silent) refreshBtn.disabled = false;
        resetCountdown();
        startCountdown();
      }
    }

    refreshBtn.addEventListener("click", function () {
      load();
    });
    dayInput.addEventListener("change", load);
    statusSelect.addEventListener("change", load);
    streamSelect.addEventListener("change", load);
    gapInput.addEventListener("change", load);

    stopTimers();
    pollTimer = setInterval(function () {
      if (!container.isConnected) {
        stopTimers();
        return;
      }
      load({ silent: true });
    }, WDSL_AUTO_REFRESH_MS);

    await load();
  }

  CIS.modules.push({
    id: "walvis_day_scan_log",
    title: "Daily scan log",
    section: "Reports & lookups",
    kind: "lookup",
    order: 18,
    icon: "schedule",
    description: "One day, all movement scans — packing yield and truck gaps",
    requires: "traceability.bags_status",
    render: render,
  });
})();
