/* Delivery Confirmations — Charcoal Tracker xlsb "Deliveries" sheet (2026). */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  /** Matches 2026 Carbo Charcoal Tracker — Deliveries (cols A–U + Remarks). */
  var ROW1 = [
    { key: "booking_date", label: "Booking Date", readOnly: true },
    { key: "supplier", label: "Supplier", readOnly: true },
    { key: "contact_number", label: "Contact Number", patchKey: "contact_number" },
    { key: "fsc_flag", label: "F", readOnly: true },
    { key: "grn", label: "GRN", readOnly: true },
    { key: "permit_no", label: "Permit No.", readOnly: true },
    { key: "transporter", label: "Transporter", readOnly: true },
    { key: "truck_reg", label: "Truck Reg. No.", readOnly: true },
    { key: "distance_km", label: "Distance from Factory (Km)", patchKey: "distance_km", inputType: "number" },
  ];

  var ROW2 = [
    { key: "weight_ton", label: "Weight (ton)", patchKey: "weight_ton", ton: true },
    { key: "sand_ash_ton", label: "Sand & Ash", patchKey: "sand_ash_ton", ton: true },
    { key: "unburned_wood_ton", label: "Unburned Wood", patchKey: "unburned_wood_ton", ton: true },
    { key: "fines_ton", label: "Fines", patchKey: "fines_ton", ton: true },
    { key: "lumpwood_ton", label: "Lumpwood", patchKey: "lumpwood_ton", ton: true },
    { key: "restaurant_ton", label: "Restaurant", patchKey: "restaurant_ton", ton: true },
    { key: "shortage_on_tonnage", label: "Shortage on Tonnage", readOnly: true, ton: true },
  ];

  var PCT_FIELDS = [
    { key: "pct_restaurant", label: "% Restaurant" },
    { key: "pct_lumpwood", label: "% Lumpwood" },
    { key: "pct_fines", label: "% Fines" },
    { key: "pct_sand_ash", label: "% Sand & Ash" },
    { key: "pct_unburned_wood", label: "% Unburned Wood" },
  ];

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
    row.shortage_on_tonnage = num(row.weight_ton) - sum;
    if (Math.abs(row.shortage_on_tonnage) < 0.0005) row.shortage_on_tonnage = 0;
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
      "Charcoal Tracker — Deliveries (tonnes). Factory capture from Control Room POST is stored in SQL and shown here — no retyping into Excel. Complete office gaps (contact, distance, remarks), then export CSV or mark complete.",
    ]));
    container.appendChild(ui.el("button", {
      class: "btn-ghost btn-sm hub-back",
      type: "button",
      onclick: function () {
        if (CIS.openModule) CIS.openModule("traceability");
      },
    }, ["Back to Traceability"]));

    var statusTabs = ui.el("div", { class: "delivery-conf-tabs" });
    var tabPending = ui.el("button", { type: "button", class: "delivery-conf-tab delivery-conf-tab--active" }, ["Pending"]);
    var tabComplete = ui.el("button", { type: "button", class: "delivery-conf-tab" }, ["Complete"]);
    var tabAll = ui.el("button", { type: "button", class: "delivery-conf-tab" }, ["All"]);
    statusTabs.appendChild(tabPending);
    statusTabs.appendChild(tabComplete);
    statusTabs.appendChild(tabAll);
    container.appendChild(statusTabs);

    var exportBtn = ui.el("button", {
      type: "button",
      class: "btn-sm delivery-conf-export-btn",
    }, ["Download Deliveries CSV"]);
    container.appendChild(exportBtn);

    var listWrap = ui.el("div", { class: "delivery-conf-list-wrap" });
    var listMsg = ui.el("p", { class: "delivery-conf-msg muted" });
    var listTableHost = ui.el("div", { class: "print-labels-history-wrap" });
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
      [tabPending, tabComplete, tabAll].forEach(function (btn) {
        btn.classList.remove("delivery-conf-tab--active");
      });
      if (filterStatus === "pending") tabPending.classList.add("delivery-conf-tab--active");
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
      var table = ui.el("table", { class: "print-labels-history delivery-conf-history" });
      var thead = ui.el("thead");
      var hr = ui.el("tr");
      ["Booking Date", "Supplier", "GRN", "Weight (t)", "Posted", "Status"].forEach(function (h) {
        hr.appendChild(ui.el("th", {}, [h]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      rows.forEach(function (row) {
        var tr = ui.el("tr", {
          class: "delivery-conf-row",
          onclick: function () {
            openDetail(row.intake_id);
          },
        });
        tr.appendChild(ui.el("td", {}, [row.booking_date || "—"]));
        tr.appendChild(ui.el("td", {}, [row.supplier || "—"]));
        tr.appendChild(ui.el("td", {}, [row.grn || "—"]));
        tr.appendChild(ui.el("td", {}, [row.weight_ton != null ? fmtTon(row.weight_ton) : "—"]));
        tr.appendChild(ui.el("td", {}, [formatPosted(row.factory_posted_at)]));
        var statusTd = ui.el("td", {});
        statusTd.appendChild(ui.el("span", {
          class: "pill " + (row.office_status === "complete" ? "ok" : "warn"),
        }, [row.office_status === "complete" ? "Complete" : "Pending"]));
        tr.appendChild(statusTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      listTableHost.appendChild(table);
    }

    async function loadList() {
      if (!ctx.api || !ctx.api.traceability) {
        setListMsg("Traceability API not configured.", true);
        return;
      }
      setListMsg("Loading…");
      listWrap.hidden = false;
      detailHost.hidden = true;
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

    async function downloadDeliveriesCsv() {
      var base =
        (ctx.config && ctx.config.traceabilityApiBase) || "/traceability/api/v1";
      var url =
        base +
        "/delivery-confirmations/export.csv?status=" +
        encodeURIComponent(filterStatus) +
        "&limit=500";
      setListMsg("Preparing CSV…");
      try {
        var res = await fetch(url, {
          headers: { Authorization: "Bearer " + (CIS.getToken && CIS.getToken()) },
        });
        if (!res.ok) throw new Error("Export failed (" + res.status + ")");
        var blob = await res.blob();
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "deliveries-" + filterStatus + ".csv";
        a.click();
        URL.revokeObjectURL(a.href);
        setListMsg("");
      } catch (e) {
        setListMsg(String(e.message || e), true);
      }
    }

    exportBtn.addEventListener("click", function () {
      void downloadDeliveriesCsv();
    });

    function buildFieldGrid(ui, fields, row, inputs, locked, factoryTonnesLocked) {
      var grid = ui.el("div", { class: "delivery-conf-form-grid" });
      fields.forEach(function (field) {
        var wrap = ui.el("label", { class: "delivery-conf-field" });
        wrap.appendChild(ui.el("span", { class: "delivery-conf-field-label" }, [field.label]));
        if (field.readOnly || (field.ton && factoryTonnesLocked)) {
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

    function showDetail(row) {
      listWrap.hidden = true;
      detailHost.hidden = false;
      detailHost.innerHTML = "";

      detailHost.appendChild(ui.el("button", {
        class: "btn-ghost btn-sm",
        type: "button",
        onclick: function () {
          listWrap.hidden = false;
          detailHost.hidden = true;
          void loadList();
        },
      }, ["← Back to pending list"]));

      var meta = ui.el("p", { class: "muted" });
      meta.textContent =
        "Intake " + (row.intake_id || "—") + " · Posted " + formatPosted(row.factory_posted_at);
      detailHost.appendChild(meta);

      if (!row.factory_weights_saved) {
        detailHost.appendChild(ui.el("p", { class: "delivery-conf-msg is-error" }, [
          "Factory weights are missing — Control Room must POST the capture sheet before PJ can confirm this row.",
        ]));
      }

      var panel = ui.el("section", { class: "delivery-conf-panel" });
      panel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Deliveries (Charcoal Tracker)"]));

      var inputs = {};
      var tonInputs = {};
      var locked = row.office_status === "complete";
      var factoryTonnesLocked = !!row.factory_weights_saved && !locked;

      panel.appendChild(ui.el("p", { class: "delivery-conf-row-heading" }, ["Truck & supplier (from Control Room discharge)"]));
      panel.appendChild(buildFieldGrid(ui, ROW1, row, inputs, locked, false));

      panel.appendChild(ui.el("p", { class: "delivery-conf-row-heading" }, [
        factoryTonnesLocked
          ? "Weights (tonnes) — from factory POST (read-only; same as CSV export)"
          : "Weights (tonnes) — waiting for factory POST",
      ]));
      var row2Grid = buildFieldGrid(ui, ROW2.filter(function (f) {
        return f.key !== "shortage_on_tonnage";
      }), row, tonInputs, locked, factoryTonnesLocked);
      panel.appendChild(row2Grid);

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

      var shortageEl = ui.el("div", { class: "delivery-conf-readonly delivery-conf-shortage" });
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

      function refreshDerived() {
        if (factoryTonnesLocked) {
          shortageEl.textContent = fmtTon(row.shortage_on_tonnage);
          PCT_FIELDS.forEach(function (f) {
            pctEls[f.key].textContent = fmtPct(row[f.key]);
          });
          return;
        }
        var calc = sheetRowFromInputs(tonInputs, row);
        shortageEl.textContent = fmtTon(calc.shortage_on_tonnage);
        PCT_FIELDS.forEach(function (f) {
          pctEls[f.key].textContent = fmtPct(calc[f.key]);
        });
      }

      var shortageField = ui.el("label", { class: "delivery-conf-field delivery-conf-field--shortage" });
      shortageField.appendChild(ui.el("span", { class: "delivery-conf-field-label" }, ["Shortage on Tonnage"]));
      shortageField.appendChild(shortageEl);
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

      if (!factoryTonnesLocked) {
        Object.keys(tonInputs).forEach(function (k) {
          tonInputs[k].addEventListener("input", refreshDerived);
        });
      }
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
        if (inputs.contact_number) {
          payload.contact_number = inputs.contact_number.value.trim() || null;
        }
        if (inputs.distance_km) {
          var d = inputs.distance_km.value.trim();
          payload.distance_km = d === "" ? null : num(d);
        }
        if (!factoryTonnesLocked) {
          Object.keys(tonInputs).forEach(function (key) {
            var raw = tonInputs[key].value.trim();
            payload[key] = raw === "" ? null : num(raw);
          });
        }
        if (inputs.remarks) payload.remarks = inputs.remarks.value.trim() || null;
        if (markComplete) payload.mark_complete = true;
        return payload;
      }

      async function save(markComplete) {
        if (!ctx.api || !ctx.api.traceability) return;
        setDetailMsg("Saving…");
        saveBtn.disabled = true;
        completeBtn.disabled = true;
        try {
          var res = await ctx.api.traceability(
            "/delivery-confirmations/" + encodeURIComponent(row.intake_id),
            { method: "PATCH", body: JSON.stringify(buildPatch(markComplete)) }
          );
          if (res.row) showDetail(res.row);
          setDetailMsg(markComplete ? "Saved and marked complete." : "Saved.", false);
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
