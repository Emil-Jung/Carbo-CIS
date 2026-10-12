/* Delivery Confirmations — Charcoal Tracker xlsb "Deliveries" sheet (2026). */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  /** Matches 2026 Carbo Charcoal Tracker — Deliveries (cols A–U + Remarks). */
  var ROW1 = [
    { key: "booking_date", label: "Booking Date", patchKey: "booking_date", inputType: "date" },
    { key: "supplier", label: "Supplier", patchKey: "supplier" },
    { key: "contact_number", label: "Contact Number", patchKey: "contact_number" },
    { key: "fsc_flag", label: "F (f=FSC, n=non-FSC)", patchKey: "fsc_flag", inputType: "text" },
    { key: "grn", label: "GRN", patchKey: "grn" },
    { key: "permit_no", label: "Permit No.", patchKey: "permit_no" },
    { key: "transporter", label: "Transporter", patchKey: "transporter" },
    { key: "truck_reg", label: "Truck Reg. No.", patchKey: "truck_reg" },
    { key: "distance_km", label: "Distance from Factory (Km)", patchKey: "distance_km", inputType: "number" },
  ];

  var ROW2 = [
    { key: "weight_ton", label: "Weight (ton)", patchKey: "weight_ton", ton: true },
    { key: "sand_ash_ton", label: "Sand & Ash", patchKey: "sand_ash_ton", ton: true },
    { key: "unburned_wood_ton", label: "Unburned Wood", patchKey: "unburned_wood_ton", ton: true },
    { key: "fines_ton", label: "Fines", patchKey: "fines_ton", ton: true },
    { key: "lumpwood_ton", label: "Lumpwood", patchKey: "lumpwood_ton", ton: true },
    { key: "restaurant_ton", label: "Restaurant", patchKey: "restaurant_ton", ton: true },
  ];

  var MIN_LOAD_TON = 30;
  var PENALTY_NAD_PER_TON = 250;

  var PCT_FIELDS = [
    { key: "pct_restaurant", label: "% Restaurant" },
    { key: "pct_lumpwood", label: "% Lumpwood" },
    { key: "pct_fines", label: "% Fines" },
    { key: "pct_sand_ash", label: "% Sand & Ash" },
    { key: "pct_unburned_wood", label: "% Unburned Wood" },
  ];

  /** Full Deliveries sheet columns (same order as export / xlsb row 1). */
  var LIST_COLS = ROW1.concat(
    ROW2,
    PCT_FIELDS.map(function (p) {
      return { key: p.key, label: p.label, pct: true };
    }),
    [{ key: "remarks", label: "Remarks" }]
  );

  function listCellText(row, col) {
    var val = row[col.key];
    if (col.ton) return fmtTon(val);
    if (col.pct) {
      if (val === null || val === undefined || val === "") return "";
      return num(val).toFixed(2);
    }
    if (val == null || val === "") return "";
    return String(val);
  }

  function listCellClass(col) {
    if (col.ton || col.pct || col.key === "distance_km") return "delivery-conf-td--num";
    if (col.key === "fsc_flag") return "delivery-conf-td--f";
    if (col.key === "remarks") return "delivery-conf-td--remarks";
    if (col.key === "supplier") return "delivery-conf-td--supplier";
    return "";
  }

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function fmtTon(v) {
    if (v === null || v === undefined || v === "") return "";
    return num(v).toFixed(3);
  }

  function fmtPct(v) {
    if (v === null || v === undefined || v === "") return "—";
    return num(v).toFixed(2) + "%";
  }

  function suggestedPenaltyShortageTon(weightTon) {
    if (weightTon == null || weightTon === "") return null;
    var w = num(weightTon);
    var s = MIN_LOAD_TON - w;
    return s > 0 ? Math.round(s * 1000) / 1000 : 0;
  }

  function penaltyNad(shortageTon) {
    if (shortageTon == null || shortageTon === "") return null;
    var s = num(shortageTon);
    if (s <= 0) return 0;
    return Math.round(s * PENALTY_NAD_PER_TON * 100) / 100;
  }

  function fmtNad(v) {
    if (v == null || v === "") return "—";
    return "NAD " + num(v).toFixed(2);
  }

  /** Same as Excel Deliveries: each stream ÷ Weight (ton). */
  function sheetRowFromInputs(tonInputs, baseRow) {
    var row = {};
    Object.keys(tonInputs).forEach(function (k) {
      var raw = tonInputs[k].value.trim();
      row[k] = raw === "" ? null : num(raw);
    });
    row.weight_ton = row.weight_ton != null ? row.weight_ton : num(baseRow.weight_ton);
    row.sand_ash_ton = row.sand_ash_ton != null ? row.sand_ash_ton : num(baseRow.sand_ash_ton);
    row.unburned_wood_ton = row.unburned_wood_ton != null ? row.unburned_wood_ton : num(baseRow.unburned_wood_ton);
    row.fines_ton = row.fines_ton != null ? row.fines_ton : num(baseRow.fines_ton);
    row.lumpwood_ton = row.lumpwood_ton != null ? row.lumpwood_ton : num(baseRow.lumpwood_ton);
    row.restaurant_ton = row.restaurant_ton != null ? row.restaurant_ton : num(baseRow.restaurant_ton);
    var sum =
      num(row.restaurant_ton) +
      num(row.lumpwood_ton) +
      num(row.fines_ton) +
      num(row.unburned_wood_ton) +
      num(row.sand_ash_ton);
    row.sheet_shortage_on_tonnage = num(row.weight_ton) - sum;
    if (Math.abs(row.sheet_shortage_on_tonnage) < 0.0005) row.sheet_shortage_on_tonnage = 0;
    var w = num(row.weight_ton);
    if (w <= 0) {
      return Object.assign({}, row, {
        pct_restaurant: null,
        pct_lumpwood: null,
        pct_fines: null,
        pct_sand_ash: null,
        pct_unburned_wood: null,
      });
    }
    return Object.assign({}, row, {
      pct_restaurant: (num(row.restaurant_ton) / w) * 100,
      pct_lumpwood: (num(row.lumpwood_ton) / w) * 100,
      pct_fines: (num(row.fines_ton) / w) * 100,
      pct_sand_ash: (num(row.sand_ash_ton) / w) * 100,
      pct_unburned_wood: (num(row.unburned_wood_ton) / w) * 100,
    });
  }

  function formatPosted(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Africa/Windhoek",
      });
    } catch (e) {
      return iso;
    }
  }

  function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content delivery-confirmations-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Delivery Confirmations"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Charcoal Tracker — Deliveries. Factory POST pre-fills the row; PJ can edit any column (GRN, F, weights, etc.) to fix Control Room mistakes — re-POST is not possible after the next truck. Mark complete to feed the restaurant report. Export CSV or XLSX anytime.",
    ]));
    var statusTabs = ui.el("div", { class: "delivery-conf-tabs" });
    var tabPending = ui.el("button", { type: "button", class: "delivery-conf-tab delivery-conf-tab--active" }, ["Pending"]);
    var tabYesterday = ui.el("button", { type: "button", class: "delivery-conf-tab" }, ["Yesterday"]);
    var tabComplete = ui.el("button", { type: "button", class: "delivery-conf-tab" }, ["Complete"]);
    var tabAll = ui.el("button", { type: "button", class: "delivery-conf-tab" }, ["All"]);
    statusTabs.appendChild(tabPending);
    statusTabs.appendChild(tabYesterday);
    statusTabs.appendChild(tabComplete);
    statusTabs.appendChild(tabAll);
    container.appendChild(statusTabs);

    var exportRow = ui.el("div", { class: "delivery-conf-export-row" });
    var exportCsvBtn = ui.el("button", {
      type: "button",
      class: "btn-sm delivery-conf-export-btn",
    }, ["Download CSV"]);
    var exportXlsxBtn = ui.el("button", {
      type: "button",
      class: "btn-sm delivery-conf-export-btn",
    }, ["Download XLSX"]);
    exportRow.appendChild(exportCsvBtn);
    exportRow.appendChild(exportXlsxBtn);
    container.appendChild(exportRow);

    var listWrap = ui.el("div", { class: "delivery-conf-list-wrap" });
    var listMsg = ui.el("p", { class: "delivery-conf-msg muted" });
    var listTableHost = ui.el("div", { class: "delivery-conf-list-table-host" });
    listWrap.appendChild(listMsg);
    listWrap.appendChild(listTableHost);
    container.appendChild(listWrap);

    var detailHost = ui.el("div", { class: "delivery-conf-detail", hidden: true });
    container.appendChild(detailHost);

    var filterStatus = "pending";
    var rowsCache = [];

    function setListMsg(text, isError) {
      listMsg.textContent = text || "";
      listMsg.className = "delivery-conf-msg" + (text ? (isError ? " is-error" : "") : " muted");
    }

    function setActiveTab() {
      [tabPending, tabYesterday, tabComplete, tabAll].forEach(function (btn) {
        btn.classList.remove("delivery-conf-tab--active");
      });
      if (filterStatus === "pending") tabPending.classList.add("delivery-conf-tab--active");
      if (filterStatus === "yesterday") tabYesterday.classList.add("delivery-conf-tab--active");
      if (filterStatus === "complete") tabComplete.classList.add("delivery-conf-tab--active");
      if (filterStatus === "all") tabAll.classList.add("delivery-conf-tab--active");
    }

    function renderListTable(rows) {
      listTableHost.innerHTML = "";
      if (!rows.length) {
        listTableHost.appendChild(ui.el("p", { class: "muted" }, [
          filterStatus === "pending" ? "No loads waiting for office confirmation." : "No rows to show.",
        ]));
        return;
      }
      var table = ui.el("table", {
        class: "delivery-conf-tracker-table delivery-conf-tracker-table--list deliveries-register-table",
      });
      var thead = ui.el("thead");
      var hr = ui.el("tr");
      LIST_COLS.forEach(function (col) {
        var thClass = col.key === "fsc_flag" ? "delivery-conf-th--f" : "";
        hr.appendChild(ui.el("th", { class: thClass }, [col.label]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      rows.forEach(function (row) {
        var tr = ui.el("tr", {
          class: "delivery-conf-row",
          title: "Click row to edit office fields",
          onclick: function () {
            openDetail(row.intake_id);
          },
        });
        if (row.office_status === "complete") tr.classList.add("delivery-conf-row--complete");
        LIST_COLS.forEach(function (col) {
          tr.appendChild(ui.el("td", { class: listCellClass(col) }, [listCellText(row, col)]));
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      if (CIS.wrapDeliveryTrackerTable) {
        listTableHost.appendChild(CIS.wrapDeliveryTrackerTable(ui, table));
      } else {
        listTableHost.appendChild(table);
      }
    }

    async function loadList() {
      if (!ctx.api || !ctx.api.traceability) {
        setListMsg("Traceability API not configured.", true);
        return;
      }
      setListMsg("Loading…");
      listWrap.hidden = false;
      detailHost.hidden = true;
      if (ctx.setFloatingBack) ctx.setFloatingBack(null);
      try {
        var data = await ctx.api.traceability(
          "/delivery-confirmations?status=" + encodeURIComponent(filterStatus) + "&limit=200"
        );
        rowsCache = data.rows || [];
        setListMsg("");
        renderListTable(rowsCache);
      } catch (e) {
        setListMsg(String(e.message || e), true);
        listTableHost.innerHTML = "";
      }
    }

    function openDetail(intakeId) {
      void fetchDetail(intakeId);
    }

    async function fetchDetail(intakeId) {
      if (!ctx.api || !ctx.api.traceability) return;
      setListMsg("Loading row…");
      try {
        var data = await ctx.api.traceability(
          "/delivery-confirmations/" + encodeURIComponent(intakeId)
        );
        showDetail(data.row);
        setListMsg("");
      } catch (e) {
        setListMsg(String(e.message || e), true);
      }
    }

    async function downloadDeliveriesExport(kind) {
      var base =
        (ctx.config && ctx.config.traceabilityApiBase) || "/traceability/api/v1";
      var ext = kind === "xlsx" ? "xlsx" : "csv";
      var url =
        base +
        "/delivery-confirmations/export." +
        ext +
        "?status=" +
        encodeURIComponent(filterStatus) +
        "&limit=500";
      setListMsg("Preparing " + ext.toUpperCase() + "…");
      try {
        var res = await fetch(url, {
          headers: { Authorization: "Bearer " + (CIS.getToken && CIS.getToken()) },
        });
        if (!res.ok) throw new Error("Export failed (" + res.status + ")");
        var blob = await res.blob();
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "deliveries-" + filterStatus + "." + ext;
        a.click();
        URL.revokeObjectURL(a.href);
        setListMsg("");
      } catch (e) {
        setListMsg(String(e.message || e), true);
      }
    }

    exportCsvBtn.addEventListener("click", function () {
      void downloadDeliveriesExport("csv");
    });
    exportXlsxBtn.addEventListener("click", function () {
      void downloadDeliveriesExport("xlsx");
    });

    function buildFieldGrid(ui, fields, row, inputs, locked) {
      var grid = ui.el("div", { class: "delivery-conf-form-grid" });
      fields.forEach(function (field) {
        var wrap = ui.el("label", { class: "delivery-conf-field" });
        wrap.appendChild(ui.el("span", { class: "delivery-conf-field-label" }, [field.label]));
        if (field.readOnly) {
          var val = row[field.key];
          if (field.ton) val = fmtTon(val) || "—";
          wrap.appendChild(ui.el("div", { class: "delivery-conf-readonly" }, [val != null ? String(val) : "—"]));
        } else if (field.ton) {
          var inp = ui.el("input", { class: "delivery-conf-input", type: "number", step: "0.001", min: "0" });
          inp.value = fmtTon(row[field.key]);
          if (locked) inp.readOnly = true;
          inputs[field.patchKey] = inp;
          wrap.appendChild(inp);
        } else {
          var textInp = ui.el("input", {
            class: "delivery-conf-input",
            type: field.inputType || "text",
          });
          if (field.inputType === "number") textInp.step = "0.01";
          textInp.value = row[field.key] != null ? String(row[field.key]) : "";
          if (locked) textInp.readOnly = true;
          inputs[field.patchKey] = textInp;
          wrap.appendChild(textInp);
        }
        grid.appendChild(wrap);
      });
      return grid;
    }

    function closeDetail() {
      listWrap.hidden = false;
      detailHost.hidden = true;
      if (ctx.setFloatingBack) ctx.setFloatingBack(null);
      void loadList();
    }

    function showDetail(row) {
      listWrap.hidden = true;
      detailHost.hidden = false;
      detailHost.innerHTML = "";
      if (ctx.setFloatingBack) {
        ctx.setFloatingBack({ onClick: closeDetail });
      }

      var meta = ui.el("p", { class: "muted" });
      meta.textContent =
        "Intake " + (row.intake_id || "—") + " · Posted " + formatPosted(row.factory_posted_at);
      detailHost.appendChild(meta);

      if (!row.factory_weights_saved) {
        detailHost.appendChild(ui.el("p", { class: "delivery-conf-msg is-error" }, [
          "Factory weights are missing — Control Room must POST the capture sheet before PJ can confirm this row.",
        ]));
      } else if (CIS.validateTrackerTonnes) {
        var preErr = CIS.validateTrackerTonnes({
          weight_ton: row.weight_ton,
          restaurant_ton: row.restaurant_ton,
          lumpwood_ton: row.lumpwood_ton,
          fines_ton: row.fines_ton,
          sand_ash_ton: row.sand_ash_ton,
          unburned_wood_ton: row.unburned_wood_ton,
        });
        if (preErr) {
          detailHost.appendChild(ui.el("p", { class: "delivery-conf-msg is-error" }, [
            "Factory weights look wrong — fix tonne columns before Save or mark complete: " + preErr,
          ]));
        }
      }

      var panel = ui.el("section", { class: "delivery-conf-panel" });
      panel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Deliveries (Charcoal Tracker)"]));

      var inputs = {};
      var tonInputs = {};
      var locked = row.office_status === "complete";

      panel.appendChild(ui.el("p", { class: "delivery-conf-row-heading" }, [
        "Truck & supplier — edit if Control Room discharge/POST had wrong values",
      ]));
      panel.appendChild(buildFieldGrid(ui, ROW1, row, inputs, locked));

      panel.appendChild(ui.el("p", { class: "delivery-conf-row-heading" }, [
        "Weights (tonnes, 3 dp) — same as Excel Deliveries; 320 kg = 0.320, not 320. Max ~45 t per truck.",
      ]));
      panel.appendChild(buildFieldGrid(ui, ROW2, row, tonInputs, locked));

      if (row.scr1_20_60_ton != null || row.scr2_60_plus_ton != null) {
        panel.appendChild(ui.el("p", { class: "delivery-conf-sheet-hint muted" }, [
          "SCR split (t): SCR.1 " +
            fmtTon(row.scr1_20_60_ton) +
            " + SCR.2 " +
            fmtTon(row.scr2_60_plus_ton) +
            " → Lumpwood " +
            fmtTon(row.lumpwood_ton) +
            " t",
        ]));
      }

      /** True only after PJ saved a value to the database (not the API suggestion). */
      var shortageLockedByUser = row.penalty_shortage_saved === true;
      var shortageInput = ui.el("input", {
        type: "text",
        class: "delivery-conf-input delivery-conf-input--ton delivery-conf-input--decimal",
        inputMode: "decimal",
        autocomplete: "off",
        placeholder: "0.000",
      });
      if (locked) shortageInput.readOnly = true;
      var shortageNadEl = ui.el("span", { class: "delivery-conf-penalty-nad" }, ["—"]);
      var shortageHint = ui.el("p", { class: "muted delivery-conf-shortage-hint" }, [""]);
      var pctWrap = ui.el("div", { class: "delivery-conf-pct-row" });
      var pctEls = {};
      PCT_FIELDS.forEach(function (f) {
        var box = ui.el("div", { class: "delivery-conf-pct-box" });
        box.appendChild(ui.el("span", { class: "delivery-conf-field-label" }, [f.label]));
        var span = ui.el("span", { class: "delivery-conf-pct-value" }, ["—"]);
        pctEls[f.key] = span;
        box.appendChild(span);
        pctWrap.appendChild(box);
      });

      function currentWeightTon() {
        var raw = tonInputs.weight_ton && tonInputs.weight_ton.value.trim();
        if (raw !== "") return num(raw);
        return row.weight_ton != null ? num(row.weight_ton) : null;
      }

      function calculatedShortageTon() {
        return suggestedPenaltyShortageTon(currentWeightTon());
      }

      function syncShortageInputFromWeight() {
        if (locked || shortageLockedByUser) {
          if (shortageLockedByUser && row.shortage_on_tonnage != null) {
            shortageInput.value = fmtTon(row.shortage_on_tonnage);
          }
          return;
        }
        var s = calculatedShortageTon();
        if (s == null && row.suggested_penalty_shortage_ton != null) {
          s = num(row.suggested_penalty_shortage_ton);
        }
        shortageInput.value = s != null ? fmtTon(s) : "";
      }

      function refreshDerived() {
        syncShortageInputFromWeight();
        var calc = sheetRowFromInputs(tonInputs, row);
        var w = currentWeightTon();
        var calculated = calculatedShortageTon();
        shortageHint.textContent =
          w != null
            ? "Auto: max(0, " +
              MIN_LOAD_TON +
              " − " +
              fmtTon(w) +
              ") = " +
              (calculated != null ? fmtTon(calculated) + " t" : "—") +
              (shortageLockedByUser
                ? " — saved value; edit this box (e.g. 0 for no penalty)."
                : " — changes with Weight (t). Type 0 for no penalty.")
            : "Enter Weight (t) to calculate shortage (minimum load " + MIN_LOAD_TON + " t).";
        var shortageVal =
          shortageInput.value.trim() !== "" ? num(shortageInput.value) : calculated;
        shortageNadEl.textContent = fmtNad(penaltyNad(shortageVal));
        PCT_FIELDS.forEach(function (f) {
          pctEls[f.key].textContent = fmtPct(calc[f.key]);
        });
      }

      syncShortageInputFromWeight();

      var shortageField = ui.el("label", { class: "delivery-conf-field delivery-conf-field--shortage" });
      shortageField.appendChild(ui.el("span", { class: "delivery-conf-field-label" }, ["Shortage on Tonnage (t)"]));
      var shortageRow = ui.el("div", { class: "delivery-conf-shortage-row" });
      shortageRow.appendChild(shortageInput);
      shortageRow.appendChild(
        ui.el("span", { class: "delivery-conf-penalty-nad-label" }, ["Penalty: "])
      );
      shortageRow.appendChild(shortageNadEl);
      shortageField.appendChild(shortageRow);
      shortageField.appendChild(shortageHint);
      panel.appendChild(shortageField);
      panel.appendChild(ui.el("p", { class: "delivery-conf-row-heading" }, ["Percentages (calculated like Excel)"]));
      panel.appendChild(pctWrap);

      panel.appendChild(ui.el("p", { class: "delivery-conf-row-heading" }, ["Remarks"]));
      var remarks = ui.el("textarea", { class: "delivery-conf-input delivery-conf-remarks", rows: "3" });
      remarks.value = row.remarks || "";
      if (locked) remarks.readOnly = true;
      inputs.remarks = remarks;
      panel.appendChild(remarks);

      detailHost.appendChild(panel);

      Object.keys(tonInputs).forEach(function (k) {
        tonInputs[k].addEventListener("input", refreshDerived);
      });
      shortageInput.addEventListener("input", function () {
        shortageLockedByUser = true;
        refreshDerived();
      });
      refreshDerived();

      var actions = ui.el("div", { class: "delivery-conf-actions" });
      var saveBtn = ui.el("button", { type: "button", class: "btn-sm" }, ["Save row"]);
      var completeLabel = ui.el("label", { class: "delivery-conf-complete-label" });
      var completeCheck = ui.el("input", { type: "checkbox" });
      completeLabel.appendChild(completeCheck);
      completeLabel.appendChild(document.createTextNode(" Mark complete"));
      var completeBtn = ui.el("button", { type: "button", class: "btn-sm delivery-conf-btn-primary" }, [
        "Save & mark complete",
      ]);
      var detailMsg = ui.el("p", { class: "delivery-conf-msg muted" });

      if (locked) {
        saveBtn.disabled = true;
        completeBtn.disabled = true;
        completeCheck.disabled = true;
        completeCheck.checked = true;
        detailMsg.textContent = "This row is already marked complete.";
      }

      actions.appendChild(saveBtn);
      actions.appendChild(completeLabel);
      actions.appendChild(completeBtn);
      detailHost.appendChild(actions);
      detailHost.appendChild(detailMsg);

      function setDetailMsg(text, isError) {
        detailMsg.textContent = text || "";
        detailMsg.className = "delivery-conf-msg" + (text ? (isError ? " is-error" : "") : " muted");
      }

      function buildPatch(markComplete) {
        var payload = {};
        [
          "booking_date",
          "supplier",
          "contact_number",
          "fsc_flag",
          "grn",
          "permit_no",
          "transporter",
          "truck_reg",
        ].forEach(function (key) {
          if (inputs[key]) {
            payload[key] = inputs[key].value.trim() || null;
          }
        });
        if (inputs.distance_km) {
          var d = inputs.distance_km.value.trim();
          payload.distance_km = d === "" ? null : num(d);
        }
        Object.keys(tonInputs).forEach(function (key) {
          var raw = tonInputs[key].value.trim();
          payload[key] = raw === "" ? null : num(raw);
        });
        var shRaw = shortageInput.value.trim();
        if (shRaw !== "") {
          payload.shortage_on_tonnage = num(shRaw);
        } else {
          var autoSh = calculatedShortageTon();
          payload.shortage_on_tonnage = autoSh != null ? autoSh : null;
        }
        if (inputs.remarks) payload.remarks = inputs.remarks.value.trim() || null;
        if (markComplete) payload.mark_complete = true;
        return payload;
      }

      async function save(markComplete) {
        if (!ctx.api || !ctx.api.traceability) return;
        var patch = buildPatch(markComplete);
        if (CIS.validateTrackerTonnes) {
          var tonErr = CIS.validateTrackerTonnes(patch);
          if (tonErr) {
            setDetailMsg(tonErr, true);
            return;
          }
        }
        setDetailMsg("Saving…");
        saveBtn.disabled = true;
        completeBtn.disabled = true;
        try {
          var res = await ctx.api.traceability(
            "/delivery-confirmations/" + encodeURIComponent(row.intake_id),
            { method: "PATCH", body: patch }
          );
          if (res.row) {
            showDetail(res.row);
            var wt = res.row.weight_ton;
            setDetailMsg(
              (markComplete ? "Saved and marked complete." : "Saved.") +
                (wt != null ? " Weight (t): " + fmtTon(wt) + "." : ""),
              false
            );
          } else {
            setDetailMsg(markComplete ? "Saved and marked complete." : "Saved.", false);
          }
          void loadList();
        } catch (e) {
          setDetailMsg(String(e.message || e), true);
        } finally {
          if (!locked) {
            saveBtn.disabled = false;
            completeBtn.disabled = false;
          }
        }
      }

      saveBtn.addEventListener("click", function () {
        void save(false);
      });
      completeBtn.addEventListener("click", function () {
        if (!completeCheck.checked) {
          setDetailMsg('Tick "Mark complete" to finalise this delivery.', true);
          return;
        }
        if (!window.confirm("Mark this delivery complete in the Charcoal Tracker?")) return;
        void save(true);
      });
    }

    tabPending.addEventListener("click", function () {
      filterStatus = "pending";
      setActiveTab();
      void loadList();
    });
    tabYesterday.addEventListener("click", function () {
      filterStatus = "yesterday";
      setActiveTab();
      void loadList();
    });
    tabComplete.addEventListener("click", function () {
      filterStatus = "complete";
      setActiveTab();
      void loadList();
    });
    tabAll.addEventListener("click", function () {
      filterStatus = "all";
      setActiveTab();
      void loadList();
    });

    setActiveTab();
    void loadList();
  }

  CIS.modules.push({
    id: "delivery_confirmations",
    title: "Delivery Confirmations",
    kind: "app",
    icon: "delivery",
    description: "Charcoal Tracker Deliveries row after factory POST",
    requires: "traceability.delivery_confirmations",
    render: render,
  });
})();
