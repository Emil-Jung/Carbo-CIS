/* Label inventory — Zebra bag vs A4 pallet QR (Reports). */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function fmt(n) {
    if (n == null || n === "") return "—";
    return String(n);
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content label-inventory-report-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Label inventory"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Ready-to-use printed stock split by label type. ",
        "Daily use is a ",
        ui.el("strong", {}, ["14-day average"]),
        " (intake bags recorded vs pallet wrap scans). ",
        "SMS warnings use the same figures when stock falls below ",
        ui.el("strong", {}, ["3"]),
        " then ",
        ui.el("strong", {}, ["2"]),
        " days at that pace.",
      ])
    );

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    container.appendChild(status);
    var body = ui.el("div", { class: "label-inv-body" });
    container.appendChild(body);

    try {
      var data = await ctx.api.traceability("/reports/label-inventory-summary");
      status.textContent = "";
      (data.formats || []).forEach(function (block) {
        var card = ui.el("section", { class: "label-inv-card" });
        card.appendChild(ui.el("h3", {}, [block.label || block.format]));
        var dl = ui.el("dl", { class: "label-inv-dl" });
        function row(k, v) {
          dl.appendChild(ui.el("dt", {}, [k]));
          dl.appendChild(ui.el("dd", {}, [v]));
        }
        row("Ready to use", fmt(block.available));
        row("On bags (used)", fmt(block.used));
        row("Fenced / parked", fmt((block.fenced || 0) + (block.parked || 0)));
        row("Avg daily use", fmt(block.daily_use_avg));
        var days = block.days_remaining_at_avg_use;
        row(
          "Days left at avg use",
          days != null ? fmt(days) : "— (no recent use)"
        );
        card.appendChild(dl);
        body.appendChild(card);
      });
      if (data.legacy_untyped && data.legacy_untyped.note) {
        body.appendChild(ui.el("p", { class: "muted" }, [data.legacy_untyped.note]));
      }
    } catch (e) {
      status.textContent = "";
      body.appendChild(ui.error("Could not load label inventory: " + (e.message || e)));
    }
  }

  CIS.modules.push({
    id: "label_inventory_report",
    title: "Label inventory",
    section: "Reports & lookups",
    kind: "lookup",
    order: 42,
    icon: "labels",
    description: "Zebra bag vs A4 pallet label stock and days remaining",
    requires: "traceability.labels.inventory_report",
    render: render,
  });
})();
