/* Consumption module — fuel NUMBERS only (no pricing yet). For finance/operations. */
(function () {
  "use strict";
  const CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function fmt(n, digits) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString(undefined, {
      minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0,
    });
  }

  async function render(container, ctx) {
    const ui = CIS.ui;
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Consumption"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Diesel consumption in litres for powered assets (forklifts, trucks). Trailers are excluded — they have no diesel tank.",
    ]));

    const cards = ui.el("div", { class: "cards" });
    const tableWrap = ui.el("div", {});
    container.appendChild(cards);
    container.appendChild(tableWrap);
    tableWrap.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));

    try {
      const [vehResp, sumResp] = await Promise.all([
        ctx.api.maintenance("/vehicles"),
        ctx.api.maintenance("/fuel-summaries"),
      ]);
      const vehicles = (vehResp.vehicles || []).filter(function (v) {
        return CIS.isFuelEligibleVehicle ? CIS.isFuelEligibleVehicle(v) : true;
      });
      const summaries = (sumResp.summaries || {});

      let totalLitres = 0;
      let withData = 0;
      const rows = vehicles.map((v) => {
        const s = summaries[v.vehicle_id] || {};
        const cum = s.cumulative_liters;
        if (cum != null) { totalLitres += Number(cum); withData++; }
        return {
          vehicle_id: v.vehicle_id,
          type: [v.make, v.model].filter(Boolean).join(" ") || v.vehicle_type || "",
          lph: s.liters_per_hour,
          last_fill: s.liters_added,
          cumulative: cum,
        };
      });

      cards.appendChild(card(ui, "Powered assets", fmt(vehicles.length)));
      cards.appendChild(card(ui, "Total litres (all time)", fmt(totalLitres, 0)));
      cards.appendChild(card(ui, "Vehicles with fuel data", fmt(withData)));

      const table = ui.el("table", { class: "data" });
      table.innerHTML =
        "<thead><tr><th>Vehicle</th><th>Make / model</th>" +
        "<th>Litres / hour</th><th>Last fill (L)</th><th>Total litres</th></tr></thead>";
      const tbody = ui.el("tbody", {});
      rows.sort((a, b) => (b.cumulative || 0) - (a.cumulative || 0));
      rows.forEach((r) => {
        const tr = ui.el("tr", {});
        tr.innerHTML =
          "<td>" + ui.escape(r.vehicle_id) + "</td>" +
          "<td class='muted'>" + ui.escape(r.type) + "</td>" +
          "<td>" + fmt(r.lph, 2) + "</td>" +
          "<td>" + fmt(r.last_fill, 1) + "</td>" +
          "<td>" + fmt(r.cumulative, 0) + "</td>";
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.innerHTML = "";
      tableWrap.appendChild(table);
    } catch (e) {
      tableWrap.innerHTML = "";
      tableWrap.appendChild(ui.error("Could not load consumption data: " + (e.message || e)));
    }
  }

  function card(ui, label, value) {
    const c = ui.el("div", { class: "card" });
    c.appendChild(ui.el("div", { class: "label" }, [label]));
    c.appendChild(ui.el("div", { class: "value" }, [value]));
    return c;
  }

  CIS.modules.push({
    id: "consumption",
    title: "Consumption",
    section: "Maintenance",
    kind: "lookup",
    order: 20,
    icon: "consumption",
    description: "Diesel litres — powered assets only",
    requires: "maintenance.fuel.view",
    render,
  });
})();
