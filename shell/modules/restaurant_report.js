/* Restaurant quality report — monthly trend + high-restaurant loads (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function fmt(n, d) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString(undefined, {
      minimumFractionDigits: d || 0,
      maximumFractionDigits: d || 0,
    });
  }

  function renderLineChart(svg, points, threshold, escapeHtml) {
    if (!points.length) {
      svg.innerHTML = "<text x='20' y='40' fill='#888'>No data</text>";
      return;
    }
    var w = 720;
    var h = 260;
    var pad = { l: 48, r: 20, t: 24, b: 52 };
    var innerW = w - pad.l - pad.r;
    var innerH = h - pad.t - pad.b;
    var ys = points.map(function (p) { return p.avg_restaurant_pct; });
    var maxY = Math.max(threshold * 1.5, Math.max.apply(null, ys.concat([threshold])) * 1.1);
    var minY = 0;
    function x(i) { return pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW); }
    function y(v) { return pad.t + innerH - ((v - minY) / (maxY - minY)) * innerH; }

    var parts = [];
    parts.push("<rect width='" + w + "' height='" + h + "' fill='#111' rx='8'/>");
    parts.push("<line x1='" + pad.l + "' y1='" + y(threshold) + "' x2='" + (w - pad.r) +
      "' y2='" + y(threshold) + "' stroke='#c62828' stroke-dasharray='6 4' stroke-width='1'/>");
    parts.push("<text x='" + (w - pad.r) + "' y='" + (y(threshold) - 4) +
      "' fill='#c62828' font-size='10' text-anchor='end'>" + threshold + "% flag</text>");

    var path = points.map(function (p, i) {
      return (i === 0 ? "M" : "L") + x(i) + " " + y(p.avg_restaurant_pct);
    }).join(" ");
    parts.push("<path d='" + path + "' fill='none' stroke='#7cb5ec' stroke-width='2'/>");
    points.forEach(function (p, i) {
      parts.push("<circle cx='" + x(i) + "' cy='" + y(p.avg_restaurant_pct) +
        "' r='3.5' fill='#7cb5ec'/>");
      if (i % Math.ceil(points.length / 12) === 0 || i === points.length - 1) {
        parts.push("<text x='" + x(i) + "' y='" + (h - 12) + "' fill='#aaa' font-size='9' " +
          "text-anchor='end' transform='rotate(-55 " + x(i) + " " + (h - 12) + ")'>" +
          escapeHtml(p.label) + "</text>");
      }
    });
    parts.push("<text x='" + pad.l + "' y='16' fill='#ccc' font-size='11'>Avg % Restaurant (tonnage-weighted)</text>");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.innerHTML = parts.join("");
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Restaurant quality"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Monthly restaurant % trend and loads above 8% from the factory Deliveries tracker.",
    ]));

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    container.appendChild(status);

    try {
      var data = await ctx.api.qualityReports("/restaurant-report");
      status.remove();

      var cards = ui.el("div", { class: "cards" });
      var pa = data.portfolio_averages || {};
      cards.appendChild(card(ui, "Portfolio avg — Restaurant", fmt(pa.restaurant, 2) + "%"));
      cards.appendChild(card(ui, "Portfolio avg — Lumpwood", fmt(pa.lumpwood, 2) + "%"));
      cards.appendChild(card(ui, "Portfolio avg — Fines", fmt(pa.fines, 2) + "%"));
      cards.appendChild(card(ui, "Portfolio avg — Wastage", fmt(pa.wastage, 2) + "%"));
      cards.appendChild(card(ui, "Loads > " + data.restaurant_threshold_pct + "%", fmt(data.high_restaurant_load_count)));
      container.appendChild(cards);

      var chartWrap = ui.el("div", { class: "report-chart-wrap" });
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "report-line-chart");
      chartWrap.appendChild(svg);
      container.appendChild(chartWrap);
      renderLineChart(svg, data.monthly_trend || [], data.restaurant_threshold_pct || 8, ui.escape);

      container.appendChild(ui.el("h3", { class: "module-subtitle" }, [
        "Suppliers with loads above " + data.restaurant_threshold_pct + "% restaurant",
      ]));

      var suppliers = data.high_restaurant_suppliers || [];
      if (!suppliers.length) {
        container.appendChild(ui.el("p", { class: "muted" }, ["No loads above threshold in range."]));
        return;
      }

      suppliers.forEach(function (grp) {
        var block = ui.el("div", { class: "report-supplier-block" });
        var title = grp.supplier + " — " + grp.load_count + " load(s)";
        if (grp.repeat_offender) title += " (repeat supplier)";
        block.appendChild(ui.el("h4", { class: "report-supplier-title" }, [title]));
        var table = ui.el("table", { class: "data" });
        table.innerHTML =
          "<thead><tr><th>Date</th><th>GRN</th><th>Transporter</th><th>Tonnes</th>" +
          "<th>% Restaurant</th><th>% Lumpwood</th><th>% Wastage</th></tr></thead>";
        var tbody = ui.el("tbody");
        (grp.loads || []).forEach(function (ld) {
          var tr = ui.el("tr");
          tr.innerHTML =
            "<td>" + ui.escape(ld.booking_date) + "</td>" +
            "<td>" + ui.escape(ld.grn) + "</td>" +
            "<td class='muted'>" + ui.escape(ld.transporter) + "</td>" +
            "<td>" + fmt(ld.weight_ton, 1) + "</td>" +
            "<td><strong>" + fmt(ld.pct_restaurant, 2) + "</strong></td>" +
            "<td>" + fmt(ld.pct_lumpwood, 2) + "</td>" +
            "<td>" + fmt(ld.pct_wastage, 2) + "</td>";
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        block.appendChild(table);
        container.appendChild(block);
      });

      container.appendChild(ui.el("p", { class: "muted" }, [
        "Source: " + ui.escape(data.source_file || "") + " · through " + ui.escape(data.through_date || ""),
      ]));
    } catch (e) {
      status.textContent = "";
      container.appendChild(ui.error("Could not load report: " + (e.message || e)));
    }
  }

  function card(ui, label, value) {
    var c = ui.el("div", { class: "card" });
    c.appendChild(ui.el("div", { class: "label" }, [label]));
    c.appendChild(ui.el("div", { class: "value" }, [value]));
    return c;
  }

  CIS.modules.push({
    id: "restaurant_report",
    title: "Restaurant quality",
    section: "Production",
    kind: "lookup",
    order: 15,
    icon: "quality",
    description: "Restaurant % trend and loads above 8%",
    requires: "quality.view",
    render: render,
  });
})();
