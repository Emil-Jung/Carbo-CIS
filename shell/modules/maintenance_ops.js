/* Maintenance Operations — fleet table aligned with Maintenance Manager (read-only). */
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

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.classList.add("maintenance-ops-host");
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Maintenance — Operations"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Fleet overview matching the Maintenance Manager table — service due, checklists, and open faults.",
    ]));

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
        return {
          v: v,
          svc: svc,
          faults: faultsByVehicle[v.vehicle_id] || 0,
        };
      });

      cards.innerHTML = "";
      cards.appendChild(card(ui, "Total vehicles", String(vehicles.length)));
      cards.appendChild(card(ui, "In service", String(countHealthy), "card-ok"));
      cards.appendChild(card(ui, "Service soon", String(countSoon), "card-warn"));
      cards.appendChild(card(ui, "Service overdue", String(countOverdue), "card-danger"));
      cards.appendChild(card(ui, "Open faults", String(openFaults.length)));

      body.innerHTML = "";
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
      var order = { due: 0, soon: 1, ok: 2, unknown: 3 };
      rows.sort(function (a, b) {
        var d = order[a.svc.state] - order[b.svc.state];
        if (d !== 0) return d;
        return String(a.v.vehicle_id).localeCompare(String(b.v.vehicle_id));
      });

      rows.forEach(function (r) {
        var tr = ui.el("tr", { class: "fleet-row-" + r.svc.state });
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
        var ft = ui.el("table", { class: "data" });
        ft.innerHTML = "<thead><tr><th>Vehicle</th><th>Item</th><th>Raised</th></tr></thead>";
        var fb = ui.el("tbody", {});
        openFaults.forEach(function (f) {
          var tr = ui.el("tr", {});
          tr.innerHTML =
            "<td>" + ui.escape(f.vehicle_id) + "</td>" +
            "<td>" + ui.escape(f.item_description || f.item_code) + "</td>" +
            "<td class='muted'>" + ui.escape(String(f.raised_at || "").slice(0, 16).replace("T", " ")) + "</td>";
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

  CIS.modules.push({
    id: "maintenance_ops",
    title: "Operations",
    section: "Maintenance",
    kind: "lookup",
    order: 10,
    icon: "operations",
    description: "Fleet status, service due, and open faults (read-only)",
    requires: "maintenance.ops.view",
    render: render,
  });
})();
