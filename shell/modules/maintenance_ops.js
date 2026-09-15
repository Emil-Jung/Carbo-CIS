/* Maintenance Operations — fleet status + issues/fixes drill-down (read-only). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function pill(ui, state, label) {
    var map = {
      ok: ["ok", "In Service"],
      soon: ["warn", "Service Soon"],
      due: ["danger", "Overdue"],
      unknown: ["", "—"],
      open: ["danger", "Open"],
      closed: ["ok", "Closed"],
    };
    var pair = map[state] || map.unknown;
    return ui.el("span", { class: "pill " + pair[0] }, [label || pair[1]]);
  }

  function card(ui, label, value, className) {
    var c = ui.el("div", { class: "card" + (className ? " " + className : "") });
    c.appendChild(ui.el("div", { class: "label" }, [label]));
    c.appendChild(ui.el("div", { class: "value" }, [value]));
    return c;
  }

  function formatTs(value) {
    if (!value) return "—";
    return String(value).slice(0, 16).replace("T", " ");
  }

  function formatMeterReading(row) {
    if (row.km_reading != null && row.km_reading !== "") {
      return String(row.km_reading) + " km";
    }
    if (row.hour_reading != null && row.hour_reading !== "") {
      return String(row.hour_reading) + " h";
    }
    return "—";
  }

  function navBar(ui, navigate, items) {
    var bar = ui.el("div", { class: "maintenance-ops-nav toolbar" });
    items.forEach(function (item) {
      var btn = ui.el(
        "button",
        {
          type: "button",
          class: "btn-sm" + (item.active ? " btn-sm-active" : ""),
          onclick: function () {
            navigate(item.view, item.vehicleId || null);
          },
        },
        [item.label]
      );
      bar.appendChild(btn);
    });
    return bar;
  }

  function backRow(ui, label, onBack) {
    var row = ui.el("div", { class: "maintenance-ops-subhead" });
    row.appendChild(
      ui.el("button", { type: "button", class: "btn-ghost btn-sm", onclick: onBack }, ["← " + label])
    );
    return row;
  }

  function issuesTable(ui, records, opts) {
    opts = opts || {};
    var table = ui.el("table", { class: "data maintenance-ops-issues-table" });
    table.innerHTML =
      "<thead><tr>" +
      (opts.showVehicle !== false ? "<th>Vehicle</th>" : "") +
      "<th>Item</th><th>Raised</th><th>Meter</th><th>Operator note</th>" +
      "<th>Status</th><th>Fixed</th><th>Corrective action</th>" +
      "</tr></thead>";
    var tbody = ui.el("tbody", {});
    if (!records.length) {
      var colSpan = opts.showVehicle !== false ? 8 : 7;
      var trEmpty = ui.el("tr", {});
      trEmpty.appendChild(
        ui.el("td", { colspan: String(colSpan), class: "muted" }, ["No issues recorded yet."])
      );
      tbody.appendChild(trEmpty);
    } else {
      records.forEach(function (r) {
        var tr = ui.el("tr", {});
        if (opts.showVehicle !== false) {
          tr.appendChild(ui.el("td", {}, [String(r.vehicle_id || "—")]));
        }
        tr.appendChild(ui.el("td", {}, [r.item_description || r.item_code || "—"]));
        tr.appendChild(ui.el("td", { class: "muted" }, [formatTs(r.raised_at)]));
        tr.appendChild(ui.el("td", { class: "muted" }, [formatMeterReading(r)]));
        tr.appendChild(ui.el("td", { class: "muted ops-note-cell" }, [r.operator_note || "—"]));
        tr.appendChild(ui.el("td", {}, [
          pill(ui, r.status === "open" ? "open" : "closed", r.status === "open" ? "Open" : "Closed"),
        ]));
        tr.appendChild(ui.el("td", { class: "muted" }, [formatTs(r.resolved_at)]));
        tr.appendChild(ui.el("td", {}, [r.fix_description || "—"]));
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    return table;
  }

  async function renderOverview(container, ctx, navigate) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.classList.add("maintenance-ops-host");
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Fleet Status"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Fleet overview, open faults, and drill-down to issues and corrective actions recorded in Namibia.",
      " (UI v1.1 — click a vehicle row or use the tabs below.)",
    ]));
    container.appendChild(
      navBar(ui, navigate, [
        { label: "Overview", view: "overview", active: true },
        { label: "Issues & fixes", view: "issues" },
        { label: "Repeat issues", view: "repeat" },
      ])
    );

    var cards = ui.el("div", { class: "cards maintenance-ops-cards" });
    var body = ui.el("div", { class: "maintenance-ops-body" });
    container.appendChild(cards);
    container.appendChild(body);
    body.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));

    try {
      var responses = await Promise.all([
        ctx.api.maintenance("/vehicles"),
        ctx.api.maintenance("/exceptions?status=open"),
      ]);
      var vehicles = CIS.filterFleetVehicles(responses[0].vehicles || []);
      var openFaults = (responses[1].exceptions || []).filter(function (f) {
        return !CIS.isTestVehicleId(f.vehicle_id);
      });

      var faultsByVehicle = {};
      openFaults.forEach(function (f) {
        faultsByVehicle[f.vehicle_id] = (faultsByVehicle[f.vehicle_id] || 0) + 1;
      });

      var countHealthy = 0;
      var countSoon = 0;
      var countOverdue = 0;
      var rows = vehicles.map(function (v) {
        var svc = CIS.calculateService(v);
        if (svc.state === "due") countOverdue++;
        else if (svc.state === "soon") countSoon++;
        else if (svc.state === "ok") countHealthy++;
        return { v: v, svc: svc, faults: faultsByVehicle[v.vehicle_id] || 0 };
      });

      cards.innerHTML = "";
      cards.appendChild(card(ui, "Total vehicles", String(vehicles.length)));
      cards.appendChild(card(ui, "In service", String(countHealthy), "card-ok"));
      cards.appendChild(card(ui, "Service soon", String(countSoon), "card-warn"));
      cards.appendChild(card(ui, "Service overdue", String(countOverdue), "card-danger"));
      cards.appendChild(card(ui, "Open faults", String(openFaults.length), openFaults.length ? "card-danger" : ""));

      body.innerHTML = "";
      body.appendChild(
        ui.el("p", { class: "muted maintenance-ops-hint" }, [
          "Click a vehicle row for its full issue and fix history.",
        ])
      );

      if (!rows.length) {
        body.appendChild(ui.el("p", { class: "muted" }, ["No fleet vehicles found."]));
        return;
      }

      var wrap = ui.el("div", { class: "maintenance-ops-table-wrap" });
      var table = ui.el("table", { class: "data maintenance-ops-table" });
      table.innerHTML =
        "<thead><tr>" +
        "<th>Vehicle</th><th>Model / type</th><th>Current</th><th>Op. hours</th>" +
        "<th>Checklist</th><th>Exc.</th><th>Next service</th><th>Due in</th>" +
        "<th>Status</th><th>Last update</th>" +
        "</tr></thead>";
      var tbody = ui.el("tbody", {});
      rows.sort(function (a, b) {
        var typeOrder = CIS.fleetCategoryRank(a.v) - CIS.fleetCategoryRank(b.v);
        if (typeOrder !== 0) return typeOrder;
        return CIS.compareVehicleIds(a.v.vehicle_id, b.v.vehicle_id);
      });

      rows.forEach(function (r) {
        var tr = ui.el("tr", {
          class: "fleet-row-" + r.svc.state + " maintenance-ops-row-click",
          title: "View issue history for " + r.v.vehicle_id,
          onclick: function () {
            navigate("asset", r.v.vehicle_id);
          },
        });
        var v = r.v;
        tr.appendChild(ui.el("td", {}, [String(v.vehicle_id)]));
        tr.appendChild(ui.el("td", { class: "muted" }, [CIS.modelTypeLabel(v)]));
        tr.appendChild(ui.el("td", {}, [CIS.formatMeter(CIS.effectiveCurrentHours(v), v)]));
        tr.appendChild(ui.el("td", {}, [
          v.hours_prev_day != null ? CIS.formatMeter(v.hours_prev_day, v) : "—",
        ]));
        tr.appendChild(ui.el("td", { class: "checklist-cell" }, [
          CIS.formatChecklistWhen(v.last_checklist_datetime),
        ]));
        tr.appendChild(ui.el("td", {}, [
          r.faults > 0
            ? ui.el("span", { class: "pill danger" }, [String(r.faults)])
            : document.createTextNode("0"),
        ]));
        tr.appendChild(ui.el("td", {}, [
          r.svc.nextService != null ? CIS.formatMeter(r.svc.nextService, v) : "—",
        ]));
        tr.appendChild(ui.el("td", {}, [r.svc.dueInLabel]));
        tr.appendChild(ui.el("td", {}, [pill(ui, r.svc.state, r.svc.statusLabel)]));
        tr.appendChild(ui.el("td", { class: "muted" }, [
          CIS.formatLastUpdate(v.last_checklist_datetime),
        ]));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      body.appendChild(wrap);

      if (openFaults.length) {
        body.appendChild(ui.el("h3", { class: "module-title maintenance-ops-faults-title" }, ["Open faults"]));
        body.appendChild(
          ui.el("p", { class: "muted maintenance-ops-hint" }, [
            "Click a row to open that asset’s history.",
          ])
        );
        var ft = ui.el("table", { class: "data" });
        ft.innerHTML = "<thead><tr><th>Vehicle</th><th>Item</th><th>Raised</th></tr></thead>";
        var fb = ui.el("tbody", {});
        openFaults.sort(function (a, b) {
          return CIS.compareVehicleIds(a.vehicle_id, b.vehicle_id);
        });
        openFaults.forEach(function (f) {
          var tr = ui.el("tr", {
            class: "maintenance-ops-row-click",
            onclick: function () {
              navigate("asset", f.vehicle_id);
            },
          });
          tr.appendChild(ui.el("td", {}, [String(f.vehicle_id)]));
          tr.appendChild(ui.el("td", {}, [f.item_description || f.item_code || "—"]));
          tr.appendChild(ui.el("td", { class: "muted" }, [formatTs(f.raised_at)]));
          fb.appendChild(tr);
        });
        ft.appendChild(fb);
        body.appendChild(ft);
      }
    } catch (e) {
      body.innerHTML = "";
      body.appendChild(ui.error("Could not load operations data: " + (e.message || e)));
    }
  }

  async function renderAssetHistory(container, ctx, navigate, vehicleId) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.classList.add("maintenance-ops-host");
    container.appendChild(backRow(ui, "Fleet overview", function () {
      navigate("overview");
    }));
    container.appendChild(ui.el("h2", { class: "module-title" }, [vehicleId + " — issues & fixes"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "All checklist faults and corrective actions recorded for this asset (read-only).",
    ]));

    var body = ui.el("div", { class: "maintenance-ops-body" });
    container.appendChild(body);
    body.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));

    try {
      var resp = await ctx.api.maintenance(
        "/exceptions-report?status=all&vehicle_id=" + encodeURIComponent(vehicleId)
      );
      var records = (resp.records || []).filter(function (r) {
        return !CIS.isTestVehicleId(r.vehicle_id);
      });
      var openCount = records.filter(function (r) {
        return r.status === "open";
      }).length;

      body.innerHTML = "";
      var cards = ui.el("div", { class: "cards maintenance-ops-cards" });
      cards.appendChild(card(ui, "Total issues", String(records.length)));
      cards.appendChild(card(ui, "Open", String(openCount), openCount ? "card-danger" : ""));
      cards.appendChild(
        card(ui, "Closed with fix", String(records.length - openCount), "card-ok")
      );
      body.appendChild(cards);

      var wrap = ui.el("div", { class: "maintenance-ops-table-wrap" });
      wrap.appendChild(issuesTable(ui, records, { showVehicle: false }));
      body.appendChild(wrap);
    } catch (e) {
      body.innerHTML = "";
      body.appendChild(ui.error("Could not load asset history: " + (e.message || e)));
    }
  }

  async function renderAllIssues(container, ctx, navigate) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.classList.add("maintenance-ops-host");
    container.appendChild(backRow(ui, "Fleet overview", function () {
      navigate("overview");
    }));
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Issues & fixes — all assets"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Complete log of checklist faults and manager corrective actions across the fleet.",
    ]));
    container.appendChild(
      navBar(ui, navigate, [
        { label: "Overview", view: "overview" },
        { label: "Issues & fixes", view: "issues", active: true },
        { label: "Repeat issues", view: "repeat" },
      ])
    );

    var body = ui.el("div", { class: "maintenance-ops-body" });
    container.appendChild(body);
    body.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));

    try {
      var resp = await ctx.api.maintenance("/exceptions-report?status=all");
      var records = (resp.records || []).filter(function (r) {
        return !CIS.isTestVehicleId(r.vehicle_id);
      });
      body.innerHTML = "";
      var cards = ui.el("div", { class: "cards maintenance-ops-cards" });
      cards.appendChild(card(ui, "Total records", String(records.length)));
      cards.appendChild(
        card(
          ui,
          "Open",
          String(records.filter(function (r) {
            return r.status === "open";
          }).length)
        )
      );
      cards.appendChild(
        card(
          ui,
          "Closed",
          String(records.filter(function (r) {
            return r.status === "closed";
          }).length),
          "card-ok"
        )
      );
      body.appendChild(cards);

      var wrap = ui.el("div", { class: "maintenance-ops-table-wrap" });
      wrap.appendChild(issuesTable(ui, records, { showVehicle: true }));
      body.appendChild(wrap);
    } catch (e) {
      body.innerHTML = "";
      body.appendChild(ui.error("Could not load issues report: " + (e.message || e)));
    }
  }

  async function renderRepeatIssues(container, ctx, navigate) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.classList.add("maintenance-ops-host");
    container.appendChild(backRow(ui, "Fleet overview", function () {
      navigate("overview");
    }));
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Repeat issues & problem assets"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Items that failed more than once on the same asset, and assets with the most faults (last 12 months).",
    ]));
    container.appendChild(
      navBar(ui, navigate, [
        { label: "Overview", view: "overview" },
        { label: "Issues & fixes", view: "issues" },
        { label: "Repeat issues", view: "repeat", active: true },
      ])
    );

    var body = ui.el("div", { class: "maintenance-ops-body" });
    container.appendChild(body);
    body.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));

    try {
      var resp = await ctx.api.maintenance("/exceptions-summary?months=12&min_count=2");
      var repeats = (resp.repeat_issues || []).filter(function (r) {
        return !CIS.isTestVehicleId(r.vehicle_id);
      });
      var worst = (resp.worst_assets || []).filter(function (r) {
        return !CIS.isTestVehicleId(r.vehicle_id);
      });
      var totals = resp.totals || {};

      body.innerHTML = "";
      var cards = ui.el("div", { class: "cards maintenance-ops-cards" });
      cards.appendChild(card(ui, "Faults (12 mo)", String(totals.all || 0)));
      cards.appendChild(card(ui, "Open now", String(totals.open || 0), totals.open ? "card-danger" : ""));
      cards.appendChild(card(ui, "Repeat patterns", String(repeats.length), repeats.length ? "card-warn" : ""));
      body.appendChild(cards);

      body.appendChild(ui.el("h3", { class: "module-title maintenance-ops-faults-title" }, ["Repeat issues (same item, same asset)"]));
      var rt = ui.el("table", { class: "data" });
      rt.innerHTML =
        "<thead><tr><th>Vehicle</th><th>Item</th><th>Times</th><th>Open</th>" +
        "<th>First</th><th>Last</th></tr></thead>";
      var rb = ui.el("tbody", {});
      if (!repeats.length) {
        var emptyR = ui.el("tr", {});
        emptyR.appendChild(ui.el("td", { colspan: "6", class: "muted" }, ["No repeat patterns in this period."]));
        rb.appendChild(emptyR);
      } else {
        repeats.forEach(function (r) {
          var tr = ui.el("tr", {
            class: "maintenance-ops-row-click",
            onclick: function () {
              navigate("asset", r.vehicle_id);
            },
          });
          tr.appendChild(ui.el("td", {}, [String(r.vehicle_id)]));
          tr.appendChild(ui.el("td", {}, [r.item_description || r.item_code]));
          tr.appendChild(ui.el("td", {}, [String(r.exception_count)]));
          tr.appendChild(ui.el("td", {}, [
            r.open_count > 0 ? ui.el("span", { class: "pill danger" }, [String(r.open_count)]) : "0",
          ]));
          tr.appendChild(ui.el("td", { class: "muted" }, [formatTs(r.first_raised)]));
          tr.appendChild(ui.el("td", { class: "muted" }, [formatTs(r.last_raised)]));
          rb.appendChild(tr);
        });
      }
      rt.appendChild(rb);
      body.appendChild(rt);

      body.appendChild(ui.el("h3", { class: "module-title maintenance-ops-faults-title" }, ["Most faults by asset"]));
      var wt = ui.el("table", { class: "data" });
      wt.innerHTML =
        "<thead><tr><th>Vehicle</th><th>Total faults</th><th>Open</th><th>Last raised</th></tr></thead>";
      var wb = ui.el("tbody", {});
      if (!worst.length) {
        var emptyW = ui.el("tr", {});
        emptyW.appendChild(ui.el("td", { colspan: "4", class: "muted" }, ["No fault history yet."]));
        wb.appendChild(emptyW);
      } else {
        worst.slice(0, 25).forEach(function (r) {
          var tr = ui.el("tr", {
            class: "maintenance-ops-row-click",
            onclick: function () {
              navigate("asset", r.vehicle_id);
            },
          });
          tr.appendChild(ui.el("td", {}, [String(r.vehicle_id)]));
          tr.appendChild(ui.el("td", {}, [String(r.total_faults)]));
          tr.appendChild(ui.el("td", {}, [
            r.open_faults > 0 ? ui.el("span", { class: "pill danger" }, [String(r.open_faults)]) : "0",
          ]));
          tr.appendChild(ui.el("td", { class: "muted" }, [formatTs(r.last_raised)]));
          wb.appendChild(tr);
        });
      }
      wt.appendChild(wb);
      body.appendChild(wt);
    } catch (e) {
      body.innerHTML = "";
      body.appendChild(ui.error("Could not load repeat analysis: " + (e.message || e)));
    }
  }

  async function render(container, ctx) {
    var state = { view: "overview", vehicleId: null };

    function navigate(view, vehicleId) {
      state.view = view || "overview";
      state.vehicleId = vehicleId || null;
      paint();
    }

    async function paint() {
      if (state.view === "asset" && state.vehicleId) {
        await renderAssetHistory(container, ctx, navigate, state.vehicleId);
      } else if (state.view === "issues") {
        await renderAllIssues(container, ctx, navigate);
      } else if (state.view === "repeat") {
        await renderRepeatIssues(container, ctx, navigate);
      } else {
        await renderOverview(container, ctx, navigate);
      }
    }

    await paint();
  }

  CIS.modules.push({
    id: "maintenance_ops",
    title: "Fleet Status",
    section: "Maintenance",
    kind: "lookup",
    order: 10,
    icon: "operations",
    description: "Fleet status, issues, fixes, and repeat-fault analysis (read-only)",
    requires: "maintenance.ops.view",
    render: render,
  });
})();
