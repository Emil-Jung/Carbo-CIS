/* Scale (Control Room) vs Charcoal intake (scanned bags) — truck-level variance report. */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var MONTH_NAMES = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function fmtKg(v) {
    if (v == null || v === "") return "—";
    return Number(v).toFixed(1) + " kg";
  }

  function fmtVar(v) {
    if (v == null || v === "") return "—";
    var n = Number(v);
    var s = (n >= 0 ? "+" : "") + n.toFixed(1);
    return s + " kg";
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content truck-scale-variance-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Scale vs intake variance"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Per truck: Control Room digital weights (Restaurant, Lumpwood, Fines) compared to Charcoal intake scanned totals. ",
      "Truck-total comparison adds digital sand & ash and unburned wood to the scanned side (waste assumed correct on the scale) — ",
      "for investigation only; Charcoal intake screens are not changed. Rows over ",
      ui.el("strong", {}, ["5 kg"]),
      " variance are flagged.",
    ]));

    var toolbar = ui.el("div", { class: "toolbar truck-scale-variance-toolbar" });
    var yearSel = ui.el("select", { id: "tsv-year" });
    var monthSel = ui.el("select", { id: "tsv-month" });
    var supplierSel = ui.el("select", { id: "tsv-supplier" });
    supplierSel.style.maxWidth = "280px";
    var flaggedOnly = ui.el("input", { type: "checkbox", id: "tsv-flagged-only" });
    toolbar.appendChild(ui.el("label", { for: "tsv-year" }, ["Year"]));
    toolbar.appendChild(yearSel);
    toolbar.appendChild(ui.el("label", { for: "tsv-month" }, ["Month"]));
    toolbar.appendChild(monthSel);
    toolbar.appendChild(ui.el("label", { for: "tsv-supplier" }, ["Supplier"]));
    toolbar.appendChild(supplierSel);
    toolbar.appendChild(ui.el("label", { for: "tsv-flagged-only" }, [flaggedOnly, " Flagged only"]));
    container.appendChild(toolbar);

    var summaryHost = ui.el("div", { class: "truck-scale-variance-summary" });
    container.appendChild(summaryHost);
    var status = ui.el("p", { class: "muted truck-scale-variance-status" }, ["Loading…"]);
    container.appendChild(status);
    var tableHost = ui.el("div", { class: "truck-scale-variance-table-wrap" });
    container.appendChild(tableHost);

    function queryString() {
      return (
        "?year=" +
        encodeURIComponent(yearSel.value || "all") +
        "&month=" +
        encodeURIComponent(monthSel.value || "all") +
        "&supplier=" +
        encodeURIComponent(supplierSel.value || "") +
        "&flagged_only=" +
        (flaggedOnly.checked ? "true" : "false")
      );
    }

    function fillSelect(sel, options, allLabel) {
      var cur = sel.value;
      sel.innerHTML = "";
      sel.appendChild(ui.el("option", { value: "all" }, [allLabel || "All"]));
      options.forEach(function (opt) {
        sel.appendChild(ui.el("option", { value: String(opt.value) }, [opt.label]));
      });
      if (cur) sel.value = cur;
    }

    function renderSummary(data) {
      summaryHost.innerHTML = "";
      var s = data.summary || {};
      var cards = ui.el("div", { class: "truck-scale-variance-cards" });
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Trucks"]),
        ui.el("strong", { class: "tsv-card-value" }, [String(data.count || 0)]),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card tsv-card--warn" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Flagged"]),
        ui.el("strong", { class: "tsv-card-value" }, [String(data.flagged_count || 0)]),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Σ truck variance"]),
        ui.el("strong", { class: "tsv-card-value" }, [fmtVar(s.variance_truck_total_kg)]),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Σ R / L / F variance"]),
        ui.el(
          "strong",
          { class: "tsv-card-value" },
          [
            fmtVar(s.variance_restaurant_kg) +
              " · " +
              fmtVar(s.variance_lumpwood_kg) +
              " · " +
              fmtVar(s.variance_fines_kg),
          ]
        ),
      ]));
      summaryHost.appendChild(cards);

      var barWrap = ui.el("div", { class: "tsv-bar-chart" });
      barWrap.appendChild(ui.el("h3", { class: "tsv-bar-title" }, ["Digital vs physical (compare) truck totals"]));
      var digital = Number(s.digital_truck_total_kg || 0);
      var physical = Number(s.physical_truck_compare_kg || 0);
      var max = Math.max(digital, physical, 1);
      ["Digital (scale)", "Physical + waste"].forEach(function (label, i) {
        var val = i === 0 ? digital : physical;
        var row = ui.el("div", { class: "tsv-bar-row" });
        row.appendChild(ui.el("span", { class: "tsv-bar-label" }, [label]));
        var track = ui.el("div", { class: "tsv-bar-track" });
        var fill = ui.el("div", {
          class: "tsv-bar-fill" + (i === 1 ? " tsv-bar-fill--physical" : ""),
          style: "width:" + Math.round((val / max) * 100) + "%",
        });
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(ui.el("span", { class: "tsv-bar-val" }, [fmtKg(val)]));
        barWrap.appendChild(row);
      });
      summaryHost.appendChild(barWrap);
    }

    function renderTable(rows) {
      tableHost.innerHTML = "";
      if (!rows.length) {
        tableHost.appendChild(ui.el("p", { class: "muted" }, ["No trucks for this filter."]));
        return;
      }
      var table = ui.el("table", { class: "truck-scale-variance-table" });
      var headers = [
        "Date",
        "Supplier",
        "GRN",
        "Truck",
        "Bags",
        "Digital R",
        "Scan R",
        "Δ R",
        "Digital L",
        "Scan L",
        "Δ L",
        "Digital F",
        "Scan F",
        "Δ F",
        "Digital truck",
        "Physical+cmp",
        "Δ truck",
        "Flags",
      ];
      var thead = ui.el("thead");
      var hr = ui.el("tr");
      headers.forEach(function (h) {
        hr.appendChild(ui.el("th", {}, [h]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      rows.forEach(function (row) {
        var tr = ui.el("tr", { class: row.flagged ? "tsv-row--flagged" : "" });
        var d = row.digital || {};
        var sc = row.scanned || {};
        var v = row.variance_kg || {};
        var scanF = Number(sc.fines_kg || 0) + Number(sc.bulk_fines_kg || 0);
        var cells = [
          row.booking_date || "",
          row.supplier || "",
          row.grn || "",
          row.truck_reg || "",
          String(row.bag_count != null ? row.bag_count : ""),
          fmtKg(d.restaurant_kg),
          fmtKg(sc.restaurant_kg),
          fmtVar(v.restaurant_kg),
          fmtKg(d.lumpwood_kg),
          fmtKg(sc.lumpwood_kg),
          fmtVar(v.lumpwood_kg),
          fmtKg(d.fines_kg),
          fmtKg(scanF),
          fmtVar(v.fines_kg),
          fmtKg(d.truck_total_kg),
          fmtKg(row.physical_truck_compare_kg),
          fmtVar(v.truck_total_kg),
          (row.flags || []).join(", "),
        ];
        cells.forEach(function (text, idx) {
          var cls = idx >= 5 && idx <= 16 ? "tsv-td--num" : "";
          if (idx >= 7 && idx <= 16 && idx % 3 === 1) cls += " tsv-td--var";
          tr.appendChild(ui.el("td", { class: cls }, [text]));
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableHost.appendChild(table);
    }

    async function loadFilters() {
      var f = await ctx.api.traceability(
        "/reports/scale-vs-intake-variance/filters?year=" + encodeURIComponent(yearSel.value || "all")
      );
      fillSelect(
        yearSel,
        (f.available_years || []).map(function (y) {
          return { value: y, label: String(y) };
        }),
        "All years"
      );
      fillSelect(
        monthSel,
        (f.available_months || []).map(function (m) {
          return { value: m, label: MONTH_NAMES[m] || String(m) };
        }),
        "All months"
      );
      supplierSel.innerHTML = "";
      supplierSel.appendChild(ui.el("option", { value: "" }, ["All suppliers"]));
      (f.suppliers || []).forEach(function (s) {
        supplierSel.appendChild(ui.el("option", { value: s }, [s]));
      });
    }

    async function loadData() {
      status.textContent = "Loading…";
      tableHost.innerHTML = "";
      summaryHost.innerHTML = "";
      try {
        var data = await ctx.api.traceability("/reports/scale-vs-intake-variance" + queryString());
        status.textContent =
          (data.count != null ? data.count + " trucks" : "") +
          (data.flagged_count ? " · " + data.flagged_count + " flagged" : "");
        renderSummary(data);
        renderTable(data.rows || []);
      } catch (e) {
        status.textContent = "";
        tableHost.appendChild(ui.error(String(e.message || e)));
      }
    }

    yearSel.addEventListener("change", function () {
      monthSel.value = "all";
      supplierSel.value = "";
      void loadFilters().then(loadData);
    });
    monthSel.addEventListener("change", loadData);
    supplierSel.addEventListener("change", loadData);
    flaggedOnly.addEventListener("change", loadData);

    yearSel.value = "2026";
    try {
      await loadFilters();
      await loadData();
    } catch (e) {
      status.textContent = String(e.message || e);
    }
  }

  CIS.modules.push({
    id: "truck_scale_variance",
    title: "Scale vs intake variance",
    section: "Production",
    kind: "lookup",
    order: 15,
    icon: "quality",
    description: "Digital scale vs scanned intake — flagged truck variances",
    requires: "production.truck_scale_variance",
    render: render,
  });
})();
