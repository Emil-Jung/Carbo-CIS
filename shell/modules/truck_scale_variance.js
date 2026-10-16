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
    return (n >= 0 ? "+" : "") + n.toFixed(1) + " kg";
  }

  /**
   * Vs digital (storage scan vs pay weight): + kg = bags heavier than digital;
   * − kg = bags lighter. Computed as scan − digital (flip of digital − scan).
   */
  function vsDigitalKg(scanKg, digitalKg) {
    return Number(scanKg || 0) - Number(digitalKg || 0);
  }

  function rowVsDigital(row) {
    var d = row.digital || {};
    var sc = row.scanned || {};
    var scanF = Number(sc.fines_kg || 0) + Number(sc.bulk_fines_kg || 0);
    return {
      restaurant_kg: vsDigitalKg(sc.restaurant_kg, d.restaurant_kg),
      lumpwood_kg: vsDigitalKg(sc.lumpwood_kg, d.lumpwood_kg),
      fines_kg: vsDigitalKg(scanF, d.fines_kg),
    };
  }

  /** − red (investigate); + normal text; ~0 muted. */
  function varianceColorClass(kg) {
    if (kg == null || kg === "") return "";
    var n = Number(kg);
    if (!Number.isFinite(n)) return "";
    if (Math.abs(n) < 0.05) return "tsv-var--zero";
    if (n < 0) return "tsv-var--neg";
    return "tsv-var--pos";
  }

  /** Column bands for borders / header grouping (must match renderTable column order). */
  var SIEVE_SAMPLE_DAYS = 5;
  var BOOKING_SAMPLE_VALUE = "__sample5__";

  var TSV_TABLE_GROUPS = [
    { key: "meta", label: "Delivery", columns: ["Booking date", "Supplier", "GRN", "Truck", "Transporter", "Bags"] },
    {
      key: "r",
      label: "Restaurant (R)",
      columns: ["Digital R", "Scan R", "Vs digital"],
    },
    {
      key: "l",
      label: "Lumpwood (L)",
      columns: ["Digital L", "Scan L", "Vs digital"],
    },
    {
      key: "f",
      label: "Fines (F)",
      columns: ["Digital F", "Scan F", "Vs digital"],
    },
  ];

  function tsvCellGroupClass(groupKey, colInGroup) {
    var cls = "tsv-grp tsv-grp--" + groupKey;
    if (colInGroup === 0) cls += " tsv-grp-start";
    return cls;
  }

  /** Sum of |Δ R|+|Δ L|+|Δ F| across rows — stream gaps (table), not net truck total. */
  function sumAbsStreamVariance(rows) {
    var total = 0;
    (rows || []).forEach(function (row) {
      var v = rowVsDigital(row);
      total += Math.abs(v.restaurant_kg);
      total += Math.abs(v.lumpwood_kg);
      total += Math.abs(v.fines_kg);
    });
    return total;
  }

  function sumVsDigitalByStream(rows) {
    var r = 0;
    var l = 0;
    var f = 0;
    (rows || []).forEach(function (row) {
      var v = rowVsDigital(row);
      r += v.restaurant_kg;
      l += v.lumpwood_kg;
      f += v.fines_kg;
    });
    return { restaurant_kg: r, lumpwood_kg: l, fines_kg: f };
  }

  function sumDigitalAndScanRlf(rows) {
    var digital = 0;
    var scan = 0;
    (rows || []).forEach(function (row) {
      var d = row.digital || {};
      var sc = row.scanned || {};
      digital +=
        Number(d.restaurant_kg || 0) +
        Number(d.lumpwood_kg || 0) +
        Number(d.fines_kg || 0);
      scan +=
        Number(sc.restaurant_kg || 0) +
        Number(sc.lumpwood_kg || 0) +
        Number(sc.fines_kg || 0) +
        Number(sc.bulk_fines_kg || 0);
    });
    return { digital_kg: digital, scan_kg: scan, net_vs_digital_kg: scan - digital };
  }

  /**
   * Bar width: mostly vs full total (honest scale), with a little tight-scale mix
   * so small gaps are visible without looking enormous.
   */
  function compareBarWidthPct(value, digitalKg, scanKg) {
    var hi = Math.max(digitalKg, scanKg, 1);
    var fullPct = (value / hi) * 100;
    var lo = Math.min(digitalKg, scanKg);
    var span = hi - lo;
    if (span < 0.05) return fullPct;
    var pad = Math.min(Math.max(span * 0.15, 120), hi * 0.012);
    var base = Math.max(0, lo - pad);
    var top = hi + pad;
    var range = top - base || 1;
    var tightPct = ((value - base) / range) * 100;
    var mix = 0.12;
    return Math.max(0, Math.min(100, fullPct * (1 - mix) + tightPct * mix));
  }

  function fillBookingDateOptions(sel, dates, current) {
    sel.innerHTML = "";
    sel.appendChild(
      CIS.ui.el("option", { value: BOOKING_SAMPLE_VALUE }, [
        "Last " + SIEVE_SAMPLE_DAYS + " sieving days (all trucks on those dates)",
      ])
    );
    sel.appendChild(CIS.ui.el("option", { value: "all" }, ["All dates in filter"]));
    (dates || []).forEach(function (d) {
      sel.appendChild(CIS.ui.el("option", { value: String(d).slice(0, 10) }, [String(d).slice(0, 10)]));
    });
    var allowed = [BOOKING_SAMPLE_VALUE, "all"].concat(
      (dates || []).map(function (d) {
        return String(d).slice(0, 10);
      })
    );
    var want =
      current != null && current !== "" ? String(current) : BOOKING_SAMPLE_VALUE;
    if (allowed.indexOf(want) < 0) want = BOOKING_SAMPLE_VALUE;
    sel.value = want;
  }

  function fillYearOptions(sel, years, current) {
    sel.innerHTML = "";
    sel.appendChild(CIS.ui.el("option", { value: "all" }, ["All years"]));
    var allowed = ["all"];
    (years || []).forEach(function (y) {
      var s = String(y);
      allowed.push(s);
      sel.appendChild(CIS.ui.el("option", { value: s }, [s]));
    });
    var want = current != null && current !== "" ? String(current) : "all";
    if (allowed.indexOf(want) < 0) want = "all";
    sel.value = want;
  }

  function fillMonthOptions(sel, months, current) {
    sel.innerHTML = "";
    sel.appendChild(CIS.ui.el("option", { value: "all" }, ["All months"]));
    (months || []).forEach(function (m) {
      sel.appendChild(
        CIS.ui.el("option", { value: String(m) }, [MONTH_NAMES[m] || String(m)])
      );
    });
    if (current) sel.value = current;
  }

  function fillSupplierOptions(sel, suppliers, current) {
    sel.innerHTML = "";
    sel.appendChild(CIS.ui.el("option", { value: "" }, ["All suppliers"]));
    (suppliers || []).forEach(function (s) {
      sel.appendChild(CIS.ui.el("option", { value: s }, [s]));
    });
    if (current != null) sel.value = current;
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content truck-scale-variance-host deliveries-register-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Scale vs intake variance"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      ui.el("strong", {}, ["Digital"]),
      " is PJ ",
      ui.el("strong", {}, ["Complete"]),
      " Delivery Confirmation pay weight (shotoff kg). Pending loads are excluded. ",
      ui.el("strong", {}, ["Vs digital"]),
      ": ",
      ui.el("strong", {}, ["− kg"]),
      " in ",
      ui.el("strong", {}, ["red"]),
      " = scans lighter than digital (stream/category errors). ",
      ui.el("strong", {}, ["+ kg"]),
      " in normal text = heavier at scan. Net total can look small while R/L/F still disagree. Filters match ",
      ui.el("strong", {}, ["Charcoal deliveries"]),
      ". |Vs digital| over ",
      ui.el("strong", {}, ["5 kg"]),
      " flags the row. Default ",
      ui.el("strong", {}, ["Sample"]),
      " = last ",
      String(SIEVE_SAMPLE_DAYS),
      " distinct ",
      ui.el("strong", {}, ["sieving days"]),
      " (booking dates) — ",
      ui.el("strong", {}, ["every truck"]),
      " on those days in the sheet below, not “5 trucks”.",
    ]));

    var toolbar = ui.el("div", { class: "toolbar deliveries-register-toolbar truck-scale-variance-toolbar" });
    toolbar.appendChild(ui.el("label", { for: "tsv-year" }, ["Year"]));
    var yearSel = ui.el("select", { id: "tsv-year" });
    toolbar.appendChild(yearSel);
    toolbar.appendChild(ui.el("label", { for: "tsv-month" }, ["Month"]));
    var monthSel = ui.el("select", { id: "tsv-month" });
    toolbar.appendChild(monthSel);
    toolbar.appendChild(ui.el("label", { for: "tsv-booking-date" }, ["Sample"]));
    var bookingDateSel = ui.el("select", { id: "tsv-booking-date" });
    bookingDateSel.style.maxWidth = "140px";
    toolbar.appendChild(bookingDateSel);
    toolbar.appendChild(ui.el("label", { for: "tsv-supplier" }, ["Supplier"]));
    var supplierSel = ui.el("select", { id: "tsv-supplier" });
    supplierSel.style.maxWidth = "280px";
    toolbar.appendChild(supplierSel);
    var flaggedOnly = ui.el("input", { type: "checkbox", id: "tsv-flagged-only" });
    toolbar.appendChild(ui.el("label", { for: "tsv-flagged-only" }, [flaggedOnly, " Flagged only"]));
    var csvBtn = ui.el("button", { type: "button", class: "btn-sm delivery-conf-export-btn" }, [
      "Download CSV (line report)",
    ]);
    toolbar.appendChild(csvBtn);
    container.appendChild(toolbar);

    var summaryHost = ui.el("div", { class: "truck-scale-variance-summary" });
    container.appendChild(summaryHost);
    var status = ui.el("p", { class: "muted truck-scale-variance-status deliveries-register-status" }, [
      "Loading…",
    ]);
    container.appendChild(status);
    var tableSectionTitle = ui.el("h3", {
      class: "deliveries-register-totals-title truck-scale-variance-table-title",
    }, ["Line by line — one row per truck"]);
    container.appendChild(tableSectionTitle);
    var tableHost = ui.el("div", { class: "truck-scale-variance-table-wrap deliveries-register-table-wrap" });
    container.appendChild(tableHost);

    function queryString() {
      var sample = bookingDateSel.value || BOOKING_SAMPLE_VALUE;
      var bookingDate = "";
      var sievingDays = "0";
      if (sample === BOOKING_SAMPLE_VALUE) {
        sievingDays = String(SIEVE_SAMPLE_DAYS);
      } else if (sample !== "all") {
        bookingDate = sample;
      }
      return (
        "?year=" +
        encodeURIComponent(yearSel.value || "all") +
        "&month=" +
        encodeURIComponent(monthSel.value || "all") +
        "&booking_date=" +
        encodeURIComponent(bookingDate) +
        "&sieving_days=" +
        encodeURIComponent(sievingDays) +
        "&supplier=" +
        encodeURIComponent(supplierSel.value || "") +
        "&flagged_only=" +
        (flaggedOnly.checked ? "true" : "false")
      );
    }

    function snapshotFromPayload(data) {
      if (data.period_totals) return data.period_totals;
      var rows = data.rows || [];
      var rlf = sumDigitalAndScanRlf(rows);
      var streamSum = sumVsDigitalByStream(rows);
      return {
        count: data.count || rows.length,
        flagged_count: data.flagged_count || 0,
        summary: {
          variance_restaurant_kg: streamSum.restaurant_kg,
          variance_lumpwood_kg: streamSum.lumpwood_kg,
          variance_fines_kg: streamSum.fines_kg,
          variance_saleable_rlf_kg: rlf.net_vs_digital_kg,
        },
        digital_rlf_kg: rlf.digital_kg,
        scan_rlf_kg: rlf.scan_kg,
        net_vs_digital_kg: rlf.net_vs_digital_kg,
        abs_stream_variance_kg: sumAbsStreamVariance(rows),
      };
    }

    function streamSumFromSnapshot(snapshot) {
      var s = snapshot.summary || {};
      return {
        restaurant_kg: Number(s.variance_restaurant_kg || 0),
        lumpwood_kg: Number(s.variance_lumpwood_kg || 0),
        fines_kg: Number(s.variance_fines_kg || 0),
      };
    }

    function renderPeriodPanel(snapshot, panelTitle, dateHint) {
      var panel = ui.el("section", { class: "tsv-period-panel" });
      panel.appendChild(ui.el("h3", { class: "tsv-period-panel-title deliveries-register-totals-title" }, [
        panelTitle,
      ]));
      if (dateHint) {
        panel.appendChild(ui.el("p", { class: "muted tsv-period-panel-hint" }, [dateHint]));
      }
      var streamSum = streamSumFromSnapshot(snapshot);
      var absStream = Number(snapshot.abs_stream_variance_kg || 0);
      var netAll = Number(snapshot.net_vs_digital_kg || 0);
      var cards = ui.el("div", { class: "truck-scale-variance-cards" });
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Trucks"]),
        ui.el("strong", { class: "tsv-card-value" }, [String(snapshot.count || 0)]),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card tsv-card--warn" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Flagged"]),
        ui.el("strong", { class: "tsv-card-value" }, [String(snapshot.flagged_count || 0)]),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Σ net Vs digital (R+L+F)"]),
        ui.el(
          "strong",
          { class: "tsv-card-value " + varianceColorClass(netAll) },
          [fmtVar(netAll)]
        ),
      ]));
      cards.appendChild(ui.el("div", { class: "tsv-card" }, [
        ui.el("span", { class: "tsv-card-label" }, ["Σ |Vs digital| (R+L+F)"]),
        ui.el("strong", { class: "tsv-card-value" }, [fmtKg(absStream)]),
      ]));
      var rlfCard = ui.el("div", { class: "tsv-card tsv-card--rlf" });
      rlfCard.appendChild(
        ui.el("span", { class: "tsv-card-label" }, ["Σ Vs digital by stream"])
      );
      var rlfVals = ui.el("div", { class: "tsv-card-rlf-lines" });
      [
        ["R", streamSum.restaurant_kg],
        ["L", streamSum.lumpwood_kg],
        ["F", streamSum.fines_kg],
      ].forEach(function (pair) {
        var line = ui.el("div", { class: "tsv-card-rlf-line" });
        line.appendChild(ui.el("span", { class: "tsv-card-rlf-key" }, [pair[0]]));
        line.appendChild(
          ui.el("strong", { class: "tsv-card-rlf-val " + varianceColorClass(pair[1]) }, [
            fmtVar(pair[1]),
          ])
        );
        rlfVals.appendChild(line);
      });
      rlfCard.appendChild(rlfVals);
      cards.appendChild(rlfCard);
      panel.appendChild(cards);

      var digitalKg = Number(snapshot.digital_rlf_kg || 0);
      var scanKg = Number(snapshot.scan_rlf_kg || 0);
      if (!snapshot.count && digitalKg === 0 && scanKg === 0) {
        panel.appendChild(
          ui.el("p", { class: "muted" }, ["No trucks in this window for the current filters."])
        );
        return panel;
      }

      var netBar = netAll;
      var barWrap = ui.el("div", { class: "tsv-bar-chart" });
      var titleRow = ui.el("div", { class: "tsv-bar-head" });
      titleRow.appendChild(ui.el("h4", { class: "tsv-bar-title" }, ["Digital vs scanned R+L+F totals"]));
      titleRow.appendChild(
        ui.el("span", { class: "tsv-bar-variance " + varianceColorClass(netBar) }, [
          "Net: ",
          fmtVar(netBar),
        ])
      );
      barWrap.appendChild(titleRow);
      var digitalPct = compareBarWidthPct(digitalKg, digitalKg, scanKg);
      var scanPct = compareBarWidthPct(scanKg, digitalKg, scanKg);
      [
        ["Digital R+L+F (pay)", digitalKg, digitalPct, ""],
        ["Scanned R+L+F (bags)", scanKg, scanPct, " tsv-bar-fill--physical"],
      ].forEach(function (pair) {
        var row = ui.el("div", { class: "tsv-bar-row tsv-bar-row--compact" });
        row.appendChild(ui.el("span", { class: "tsv-bar-label" }, [pair[0]]));
        var track = ui.el("div", { class: "tsv-bar-track" });
        track.appendChild(
          ui.el("div", {
            class: "tsv-bar-fill" + pair[3],
            style: "width:" + Math.round(pair[2]) + "%",
          })
        );
        row.appendChild(track);
        row.appendChild(ui.el("span", { class: "tsv-bar-val" }, [fmtKg(pair[1])]));
        barWrap.appendChild(row);
      });
      var gapLeft = Math.min(digitalPct, scanPct);
      var gapWidth = Math.abs(digitalPct - scanPct);
      var gapRow = ui.el("div", { class: "tsv-bar-row tsv-bar-row--compact tsv-bar-row--gap" });
      gapRow.appendChild(ui.el("span", { class: "tsv-bar-label" }, ["Gap (visual)"]));
      var gapTrack = ui.el("div", { class: "tsv-bar-track tsv-bar-track--gap" });
      gapTrack.appendChild(
        ui.el("div", {
          class: "tsv-bar-gap " + varianceColorClass(netBar),
          style: "margin-left:" + gapLeft.toFixed(2) + "%;width:" + gapWidth.toFixed(2) + "%",
        })
      );
      gapRow.appendChild(gapTrack);
      gapRow.appendChild(
        ui.el("span", { class: "tsv-bar-val " + varianceColorClass(netBar) }, [fmtVar(netBar)])
      );
      barWrap.appendChild(gapRow);
      panel.appendChild(barWrap);
      return panel;
    }

    function renderCompareTable(sampleSnap, allSnap) {
      var table = ui.el("table", { class: "tsv-compare-table delivery-conf-tracker-table" });
      var thead = ui.el("thead");
      var hr = ui.el("tr");
      ["Measure", "Last " + SIEVE_SAMPLE_DAYS + " sieving days", "All complete loads (filter)"].forEach(function (h) {
        hr.appendChild(ui.el("th", {}, [h]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      function addRow(label, a, b, isVar) {
        var tr = ui.el("tr");
        tr.appendChild(ui.el("td", {}, [label]));
        var cls = isVar ? " tsv-td--var " + varianceColorClass(a) : "";
        tr.appendChild(ui.el("td", { class: "tsv-td--num" + cls }, [isVar ? fmtVar(a) : String(a)]));
        cls = isVar ? " tsv-td--var " + varianceColorClass(b) : "";
        tr.appendChild(ui.el("td", { class: "tsv-td--num" + cls }, [isVar ? fmtVar(b) : String(b)]));
        tbody.appendChild(tr);
      }
      addRow("Trucks", sampleSnap.count, allSnap.count, false);
      addRow("Digital R+L+F total", fmtKg(sampleSnap.digital_rlf_kg), fmtKg(allSnap.digital_rlf_kg), false);
      addRow("Scanned R+L+F total", fmtKg(sampleSnap.scan_rlf_kg), fmtKg(allSnap.scan_rlf_kg), false);
      addRow("Net vs digital (R+L+F)", sampleSnap.net_vs_digital_kg, allSnap.net_vs_digital_kg, true);
      addRow("Σ |Vs digital| (streams)", fmtKg(sampleSnap.abs_stream_variance_kg), fmtKg(allSnap.abs_stream_variance_kg), false);
      var catKeys = ["restaurant_kg", "lumpwood_kg", "fines_kg"];
      var sa = sampleSnap.category_analysis;
      var aa = allSnap.category_analysis;
      if (sa && sa.categories && aa && aa.categories) {
        catKeys.forEach(function (key) {
          var sc = sa.categories[key] || {};
          var ac = aa.categories[key] || {};
          addRow((sc.label || key) + " — net", sc.net_kg, ac.net_kg, true);
          addRow((sc.label || key) + " — Σ |Vs digital|", fmtKg(sc.abs_sum_kg), fmtKg(ac.abs_sum_kg), false);
          addRow(
            (sc.label || key) + " — % trucks off (>5 kg)",
            (sc.trucks_off_pct != null ? sc.trucks_off_pct + "%" : "—"),
            (ac.trucks_off_pct != null ? ac.trucks_off_pct + "%" : "—"),
            false
          );
        });
      }
      table.appendChild(tbody);
      return table;
    }

    function categoryBiasText(bias) {
      if (bias === "heavier_at_scan") return "usually heavier at scan (+ kg)";
      if (bias === "lighter_at_scan") return "usually lighter at scan (− kg)";
      return "mixed +/− when off";
    }

    function renderCategoryInsights(analysis, scopeTitle) {
      if (!analysis || !analysis.categories) return ui.el("div");
      var box = ui.el("div", { class: "tsv-cat-insight" });
      box.appendChild(ui.el("h4", { class: "tsv-cat-insight-title" }, [scopeTitle]));
      var la = analysis.largest_abs_gap || {};
      var mo = analysis.most_often_off || {};
      var ul = ui.el("ul", { class: "tsv-cat-insight-list" });
      if (la.label) {
        ul.appendChild(
          ui.el("li", {}, [
            ui.el("strong", {}, ["Largest total gap: "]),
            la.label,
            " — Σ|Vs digital| ",
            fmtKg(la.abs_sum_kg),
            ", net ",
            fmtVar(la.net_kg),
          ])
        );
      }
      if (mo.label && analysis.truck_count) {
        ul.appendChild(
          ui.el("li", {}, [
            ui.el("strong", {}, ["Most often off (>5 kg): "]),
            mo.label,
            " on ",
            String(mo.trucks_off_count || 0),
            " / ",
            String(analysis.truck_count),
            " trucks (",
            String(mo.trucks_off_pct != null ? mo.trucks_off_pct : 0),
            "% — ",
            mo.consistency || "sometimes",
            "). When off: ",
            categoryBiasText(mo.when_off_bias),
            ".",
          ])
        );
      }
      ["restaurant_kg", "lumpwood_kg", "fines_kg"].forEach(function (key) {
        var c = analysis.categories[key];
        if (!c) return;
        ul.appendChild(
          ui.el("li", {}, [
            ui.el("strong", {}, [c.label + ": "]),
            "net ",
            fmtVar(c.net_kg),
            ", Σ|Vs| ",
            fmtKg(c.abs_sum_kg),
            ", ",
            String(c.trucks_off_pct != null ? c.trucks_off_pct : 0),
            "% trucks off",
            c.trucks_off_count ? " (" + categoryBiasText(c.when_off_bias) + ")" : "",
            ".",
          ])
        );
      });
      box.appendChild(ul);
      return box;
    }

    function renderCategoryAnalysisBlock(sampleSnap, allSnap) {
      if (!sampleSnap.category_analysis && !(allSnap && allSnap.category_analysis)) {
        return ui.el("div");
      }
      var wrap = ui.el("div", { class: "tsv-cat-analysis-wrap" });
      wrap.appendChild(
        ui.el("h3", { class: "deliveries-register-totals-title" }, ["Category analysis"])
      );
      wrap.appendChild(
        ui.el("p", { class: "muted tsv-cat-analysis-lead" }, [
          "Restaurant, lumpwood, and fines compared separately. Use ",
          ui.el("strong", {}, ["All complete loads"]),
          " to see what is ",
          ui.el("strong", {}, ["mostly or always"]),
          " wrong; use the sample column for recent behaviour.",
        ])
      );
      var grid = ui.el("div", { class: "tsv-cat-insight-grid" });
      grid.appendChild(
        renderCategoryInsights(sampleSnap.category_analysis, "Last " + SIEVE_SAMPLE_DAYS + " sieving days")
      );
      if (allSnap && allSnap.category_analysis) {
        grid.appendChild(renderCategoryInsights(allSnap.category_analysis, "All complete loads in filter"));
      }
      wrap.appendChild(grid);
      return wrap;
    }

    function filterScopeLabel(data) {
      var parts = [];
      if (yearSel.value && yearSel.value !== "all") parts.push("year " + yearSel.value);
      if (monthSel.value && monthSel.value !== "all") {
        parts.push(MONTH_NAMES[Number(monthSel.value)] || monthSel.value);
      }
      if (supplierSel.value) parts.push(supplierSel.value);
      if (!parts.length) return "all years / suppliers";
      return parts.join(" · ");
    }

    function renderSummary(data) {
      summaryHost.innerHTML = "";
      var isSample = bookingDateSel.value === BOOKING_SAMPLE_VALUE;
      var sampleSnap = snapshotFromPayload(data);

      if (isSample && data.all_period) {
        var allSnap = data.all_period;
        summaryHost.appendChild(
          ui.el("p", { class: "muted tsv-dual-summary-lead" }, [
            "Default view compares the last ",
            String(SIEVE_SAMPLE_DAYS),
            " sieving days to ",
            ui.el("strong", {}, ["every"]),
            " PJ-complete truck in the filter (",
            filterScopeLabel(data),
            "). Rising net or |stream| variance on the right with a small net on the left often means category mis-tags; both growing together may point to scale or unit issues.",
          ])
        );
        var grid = ui.el("div", { class: "tsv-period-grid" });
        var sd = data.sample_booking_dates || [];
        var sampleHint =
          sd.length > 0
            ? sd[sd.length - 1] +
              " → " +
              sd[0] +
              " · " +
              sd.length +
              " sieving day" +
              (sd.length === 1 ? "" : "s") +
              (sd.length < SIEVE_SAMPLE_DAYS
                ? " (only " + sd.length + " in system so far — not a full " + SIEVE_SAMPLE_DAYS + "-day window yet)"
                : "") +
              " · " +
              (sampleSnap.count || 0) +
              " truck" +
              (sampleSnap.count === 1 ? "" : "s") +
              " in sheet"
            : "";
        grid.appendChild(
          renderPeriodPanel(
            sampleSnap,
            "Last " + SIEVE_SAMPLE_DAYS + " sieving days",
            sampleHint
          )
        );
        var allHint =
          allSnap.date_min && allSnap.date_max
            ? allSnap.date_min + " → " + allSnap.date_max + " · " + (allSnap.eligible_truck_count || allSnap.count) + " eligible"
            : "";
        grid.appendChild(
          renderPeriodPanel(allSnap, "All complete loads in filter", allHint)
        );
        summaryHost.appendChild(grid);
        var compareWrap = ui.el("div", { class: "tsv-compare-wrap" });
        compareWrap.appendChild(
          ui.el("h3", { class: "deliveries-register-totals-title" }, ["Side-by-side totals"])
        );
        compareWrap.appendChild(renderCompareTable(sampleSnap, allSnap));
        summaryHost.appendChild(compareWrap);
        summaryHost.appendChild(renderCategoryAnalysisBlock(sampleSnap, allSnap));
        if (
          allSnap.count === sampleSnap.count &&
          allSnap.net_vs_digital_kg === sampleSnap.net_vs_digital_kg
        ) {
          summaryHost.appendChild(
            ui.el("p", { class: "muted tsv-dual-summary-lead" }, [
              "Both panels match because every PJ-complete truck in this filter already falls inside the sample window (common while the report history is still short). The sheet below lists those ",
              String(sampleSnap.count || 0),
              " trucks.",
            ])
          );
        }
        return;
      }

      var singleTitle = "Variance summary";
      var hint = "";
      if (data.sample_booking_dates && data.sample_booking_dates.length) {
        var sd2 = data.sample_booking_dates;
        hint =
          sd2[sd2.length - 1] +
          " → " +
          sd2[0] +
          " (" +
          sd2.length +
          " sieving day" +
          (sd2.length === 1 ? "" : "s") +
          ")";
      } else if (bookingDateSel.value === "all") {
        hint = filterScopeLabel(data);
        if (data.date_min && data.date_max) hint += " · " + data.date_min + " → " + data.date_max;
      } else if (bookingDateSel.value) {
        hint = bookingDateSel.value;
      }
      summaryHost.appendChild(renderPeriodPanel(sampleSnap, singleTitle, hint));
      if (sampleSnap.category_analysis) {
        summaryHost.appendChild(renderCategoryAnalysisBlock(sampleSnap, null));
      }
    }

    function renderTable(rows) {
      tableHost.innerHTML = "";
      if (!rows.length) {
        tableHost.appendChild(
          ui.el("p", { class: "muted" }, [
            "No trucks for this filter. Each row needs PJ Complete on Delivery Confirmations plus Charcoal intake scans.",
          ])
        );
        return;
      }
      var table = ui.el("table", {
        class: "truck-scale-variance-table delivery-conf-tracker-table deliveries-register-table",
      });
      var thead = ui.el("thead");
      var groupHr = ui.el("tr", { class: "tsv-group-head-row" });
      TSV_TABLE_GROUPS.forEach(function (g) {
        groupHr.appendChild(
          ui.el(
            "th",
            {
              colspan: String(g.columns.length),
              class: "tsv-grp-head tsv-grp--" + g.key + " tsv-grp-start",
            },
            [g.label]
          )
        );
      });
      thead.appendChild(groupHr);
      var colHr = ui.el("tr", { class: "tsv-col-head-row" });
      TSV_TABLE_GROUPS.forEach(function (g) {
        g.columns.forEach(function (h, i) {
          colHr.appendChild(
            ui.el("th", { class: tsvCellGroupClass(g.key, i) }, [h])
          );
        });
      });
      thead.appendChild(colHr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      function appendTextTd(tr, text, groupKey, colInGroup) {
        tr.appendChild(ui.el("td", { class: tsvCellGroupClass(groupKey, colInGroup) }, [text]));
      }
      function appendNumTd(tr, text, groupKey, colInGroup, isVar, rawKg) {
        var cls = tsvCellGroupClass(groupKey, colInGroup) + " tsv-td--num delivery-conf-td--num";
        if (isVar) cls += " tsv-td--var " + varianceColorClass(rawKg);
        tr.appendChild(ui.el("td", { class: cls }, [text]));
      }

      rows.forEach(function (row) {
        var tr = ui.el("tr");
        var d = row.digital || {};
        var sc = row.scanned || {};
        var v = rowVsDigital(row);
        var scanF = Number(sc.fines_kg || 0) + Number(sc.bulk_fines_kg || 0);
        appendTextTd(tr, row.booking_date || "", "meta", 0);
        appendTextTd(tr, row.supplier || "", "meta", 1);
        appendTextTd(tr, row.grn || "", "meta", 2);
        appendTextTd(tr, row.truck_reg || "", "meta", 3);
        appendTextTd(tr, row.transporter || "", "meta", 4);
        appendTextTd(tr, String(row.bag_count != null ? row.bag_count : ""), "meta", 5);
        appendNumTd(tr, fmtKg(d.restaurant_kg), "r", 0, false);
        appendNumTd(tr, fmtKg(sc.restaurant_kg), "r", 1, false);
        appendNumTd(tr, fmtVar(v.restaurant_kg), "r", 2, true, v.restaurant_kg);
        appendNumTd(tr, fmtKg(d.lumpwood_kg), "l", 0, false);
        appendNumTd(tr, fmtKg(sc.lumpwood_kg), "l", 1, false);
        appendNumTd(tr, fmtVar(v.lumpwood_kg), "l", 2, true, v.lumpwood_kg);
        appendNumTd(tr, fmtKg(d.fines_kg), "f", 0, false);
        appendNumTd(tr, fmtKg(scanF), "f", 1, false);
        appendNumTd(tr, fmtVar(v.fines_kg), "f", 2, true, v.fines_kg);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      if (CIS.wrapDeliveryTrackerTable) {
        tableHost.appendChild(CIS.wrapDeliveryTrackerTable(ui, table));
      } else {
        tableHost.appendChild(table);
      }
    }

    async function loadFilters() {
      try {
        var f = await ctx.api.traceability(
          "/reports/scale-vs-intake-variance/filters?year=" +
            encodeURIComponent(yearSel.value || "all") +
            "&month=" +
            encodeURIComponent(monthSel.value || "all") +
            "&supplier=" +
            encodeURIComponent(supplierSel.value || "")
        );
        fillYearOptions(yearSel, f.available_years, yearSel.value || "all");
        fillMonthOptions(monthSel, f.available_months, monthSel.value);
        fillBookingDateOptions(
          bookingDateSel,
          f.available_booking_dates,
          bookingDateSel.value
        );
        fillSupplierOptions(supplierSel, f.suppliers, supplierSel.value);
      } catch (e) {
        fillYearOptions(yearSel, [], yearSel.value || "all");
        fillMonthOptions(monthSel, [], monthSel.value || "all");
        fillSupplierOptions(supplierSel, [], supplierSel.value || "");
      }
    }

    async function loadData() {
      status.textContent = "Loading…";
      status.style.display = "";
      tableHost.innerHTML = "";
      summaryHost.innerHTML = "";
      try {
        var data = await ctx.api.traceability("/reports/scale-vs-intake-variance" + queryString());
        if (data.filters) {
          fillYearOptions(yearSel, data.filters.available_years, yearSel.value);
          fillMonthOptions(monthSel, data.filters.available_months, monthSel.value);
          fillBookingDateOptions(
            bookingDateSel,
            data.filters.available_booking_dates,
            bookingDateSel.value
          );
          fillSupplierOptions(supplierSel, data.filters.suppliers, supplierSel.value);
        }
        var isSampleView = bookingDateSel.value === BOOKING_SAMPLE_VALUE;
        var sdStatus = data.sample_booking_dates || [];
        status.textContent =
          (data.count != null ? data.count + " trucks" : "") +
          (data.flagged_count ? " · " + data.flagged_count + " flagged" : "") +
          (isSampleView && sdStatus.length
            ? " · " +
              sdStatus.length +
              " sieving day" +
              (sdStatus.length === 1 ? "" : "s") +
              " (" +
              sdStatus.join(", ") +
              ")"
            : data.date_min && data.date_max
              ? " · " + data.date_min + " → " + data.date_max
              : "") +
          (data.eligible_truck_count != null && data.eligible_truck_count !== data.count
            ? " · " + data.eligible_truck_count + " eligible before flagged filter"
            : "");
        renderSummary(data);
        tableSectionTitle.style.display = "";
        tableSectionTitle.textContent = isSampleView
          ? "Line by line — trucks on last " +
            SIEVE_SAMPLE_DAYS +
            " sieving days (" +
            (data.count != null ? data.count : (data.rows || []).length) +
            " rows)"
          : "Line by line — one row per truck";
        renderTable(data.rows || []);
      } catch (e) {
        status.textContent = "";
        tableHost.appendChild(ui.error(String(e.message || e)));
      }
    }

    async function downloadCsv() {
      var base = (ctx.config && ctx.config.traceabilityApiBase) || "/traceability/api/v1";
      var url = base + "/reports/scale-vs-intake-variance/export.csv" + queryString();
      status.textContent = "Preparing CSV…";
      try {
        var res = await fetch(url, {
          headers: { Authorization: "Bearer " + (CIS.getToken && CIS.getToken()) },
        });
        if (!res.ok) throw new Error("Export failed (" + res.status + ")");
        var blob = await res.blob();
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "scale-vs-intake-" + (yearSel.value || "all") + ".csv";
        a.click();
        URL.revokeObjectURL(a.href);
        status.textContent = "Download started.";
      } catch (e) {
        status.textContent = String(e.message || e);
      }
    }

    yearSel.addEventListener("change", function () {
      monthSel.value = "all";
      bookingDateSel.value = BOOKING_SAMPLE_VALUE;
      supplierSel.value = "";
      void loadFilters().then(loadData);
    });
    monthSel.addEventListener("change", function () {
      if (bookingDateSel.value !== BOOKING_SAMPLE_VALUE && bookingDateSel.value !== "all") {
        bookingDateSel.value = BOOKING_SAMPLE_VALUE;
      }
      supplierSel.value = "";
      void loadFilters().then(loadData);
    });
    bookingDateSel.addEventListener("change", function () {
      void loadFilters().then(loadData);
    });
    supplierSel.addEventListener("change", loadData);
    flaggedOnly.addEventListener("change", loadData);
    csvBtn.addEventListener("click", function () {
      void downloadCsv();
    });

    yearSel.value = "all";
    monthSel.value = "all";
    bookingDateSel.value = BOOKING_SAMPLE_VALUE;
    await loadFilters();
    await loadData();
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
