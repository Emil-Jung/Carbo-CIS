/* Maintenance Operations module — fleet health, service-due, open faults. Read-only. */
(function () {
  "use strict";
  const CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function isTrailer(v) { return String(v.vehicle_type || "").toLowerCase().indexOf("trailer") !== -1; }

  // Returns {state:'ok'|'soon'|'due', remaining} based on hours/km since last service.
  function serviceStatus(v) {
    const interval = v.service_interval_hours;
    const warn = v.service_red_threshold;
    const current = v.current_hours;
    const lastService = v.last_service_hours;
    if (interval == null || current == null) return { state: "unknown", remaining: null };
    const base = (lastService != null) ? lastService : (v.starting_hours || 0);
    const since = current - base;
    const remaining = interval - since;
    let stateName = "ok";
    if (remaining <= 0) stateName = "due";
    else if (warn != null && remaining <= warn) stateName = "soon";
    return { state: stateName, remaining };
  }

  function pill(ui, state) {
    const map = { ok: ["ok", "OK"], soon: ["warn", "Service soon"], due: ["danger", "Service due"], unknown: ["", "—"] };
    const [cls, label] = map[state] || map.unknown;
    const span = ui.el("span", { class: "pill " + cls }, [label]);
    return span;
  }

  async function render(container, ctx) {
    const ui = CIS.ui;
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Maintenance — Operations"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Fleet status, service-due and open faults. Read-only.",
    ]));

    const cards = ui.el("div", { class: "cards" });
    const body = ui.el("div", {});
    container.appendChild(cards);
    container.appendChild(body);
    body.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));

    try {
      const [vehResp, exResp] = await Promise.all([
        ctx.api.maintenance("/vehicles"),
        ctx.api.maintenance("/exceptions?status=open"),
      ]);
      const vehicles = vehResp.vehicles || [];
      const openFaults = exResp.exceptions || [];

      const faultsByVehicle = {};
      openFaults.forEach((f) => {
        faultsByVehicle[f.vehicle_id] = (faultsByVehicle[f.vehicle_id] || 0) + 1;
      });

      let due = 0, soon = 0;
      const rows = vehicles.map((v) => {
        const st = serviceStatus(v);
        if (st.state === "due") due++;
        else if (st.state === "soon") soon++;
        return { v, st, faults: faultsByVehicle[v.vehicle_id] || 0 };
      });

      cards.appendChild(card(ui, "Vehicles", String(vehicles.length)));
      cards.appendChild(card(ui, "Service due", String(due)));
      cards.appendChild(card(ui, "Service soon", String(soon)));
      cards.appendChild(card(ui, "Open faults", String(openFaults.length)));

      body.innerHTML = "";
      const table = ui.el("table", { class: "data" });
      table.innerHTML =
        "<thead><tr><th>Vehicle</th><th>Make / model</th><th>Current</th>" +
        "<th>Service</th><th>Remaining</th><th>Open faults</th></tr></thead>";
      const tbody = ui.el("tbody", {});
      const order = { due: 0, soon: 1, ok: 2, unknown: 3 };
      rows.sort((a, b) => (order[a.st.state] - order[b.st.state]) || String(a.v.vehicle_id).localeCompare(b.v.vehicle_id));
      rows.forEach((r) => {
        const unit = isTrailer(r.v) ? " km" : " h";
        const tr = ui.el("tr", {});
        const tdVeh = ui.el("td", {}, [String(r.v.vehicle_id)]);
        const tdType = ui.el("td", { class: "muted" }, [[r.v.make, r.v.model].filter(Boolean).join(" ") || r.v.vehicle_type || ""]);
        const tdCur = ui.el("td", {}, [r.v.current_hours != null ? (Math.round(r.v.current_hours) + unit) : "—"]);
        const tdSvc = ui.el("td", {}, [pill(ui, r.st.state)]);
        const tdRem = ui.el("td", {}, [r.st.remaining != null ? (Math.round(r.st.remaining) + unit) : "—"]);
        const tdFault = ui.el("td", {}, [
          r.faults > 0 ? ui.el("span", { class: "pill danger" }, [String(r.faults)]) : document.createTextNode("0"),
        ]);
        [tdVeh, tdType, tdCur, tdSvc, tdRem, tdFault].forEach((td) => tr.appendChild(td));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      body.appendChild(table);

      if (openFaults.length) {
        body.appendChild(ui.el("h3", { class: "module-title", style: "margin-top:26px" }, ["Open faults"]));
        const ft = ui.el("table", { class: "data" });
        ft.innerHTML = "<thead><tr><th>Vehicle</th><th>Item</th><th>Raised</th></tr></thead>";
        const fb = ui.el("tbody", {});
        openFaults.forEach((f) => {
          const tr = ui.el("tr", {});
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

  function card(ui, label, value) {
    const c = ui.el("div", { class: "card" });
    c.appendChild(ui.el("div", { class: "label" }, [label]));
    c.appendChild(ui.el("div", { class: "value" }, [value]));
    return c;
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
    render,
  });
})();
