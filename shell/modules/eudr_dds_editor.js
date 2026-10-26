/* EUDR Due Diligence Statement — CIS editor (Phase 2: booking + single). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var MODE_BOOKING = "booking";
  var MODE_SINGLE = "single";

  var FIELD_LABELS = {
    client: "Client (internal reference)",
    container: "Scope / container (on document)",
    container_schedule: "Container schedule (text fallback for PDF)",
    carbo_ref: "Carbo reference / booking ref",
    destination: "Destination",
    shipment_date: "Shipment date",
    operator: "Operator",
    operator_address: "Operator address",
    eori: "EORI / EU operator reference",
    product: "Product",
    hs_code: "HS code",
    trade_description: "Trade description",
    wood_species: "Wood species",
    net_mass: "Net mass",
    country: "Country of production",
    geolocation: "Production geolocation",
    dds_reference: "DDS reference",
    container_sheet: "Accompanying — container sheet",
    geojson: "Accompanying — GeoJSON files",
    traceability_record: "Accompanying — traceability record",
    signed_for: "Signed for and on behalf of",
    signature_date: "Signature date",
    signatory: "Name and function",
    signature: "Signature",
  };

  var MULTILINE = {
    operator_address: true,
    wood_species: true,
    geolocation: true,
    dds_reference: true,
    container_sheet: true,
    container_schedule: true,
    geojson: true,
    traceability_record: true,
  };

  CIS.mountEudrDdsEditor = function (container, ctx, shared) {
    var ui = shared.ui || CIS.ui;
    var containers = shared.containers || [];

    var mode = MODE_BOOKING;
    var fields = CIS.eudrDdsDefaultFields();
    var statementId = "";
    var containerId = "";
    var bookingRef = "";
    var containerIds = [];
    var scopeSnapshot = null;
    var assetUrls = null;

    var section = ui.el("section", { class: "td-doc-section td-doc-eudr-dds" });
    section.appendChild(
      ui.el("h3", { class: "ct-containers-section-title" }, [
        "EUDR Due Diligence Statement",
      ])
    );
    section.appendChild(
      ui.el("p", { class: "muted" }, [
        "Prepare a due diligence statement by ",
        ui.el("strong", {}, ["booking reference"]),
        " (default) or a ",
        ui.el("strong", {}, ["single container"]),
        ", then save, preview, or download PDF.",
      ])
    );

    var saveState = ui.el("p", { class: "muted td-doc-eudr-save-state" }, [
      "Choose a booking or container.",
    ]);
    section.appendChild(saveState);

    var modeRow = ui.el("div", { class: "td-doc-doc-row td-doc-eudr-mode-row" });
    var modeBooking = ui.el("label", { class: "td-doc-eudr-mode-opt" }, [
      ui.el("input", { type: "radio", name: "eudr-dds-mode", value: MODE_BOOKING, checked: "checked" }),
      " Booking reference",
    ]);
    var modeSingle = ui.el("label", { class: "td-doc-eudr-mode-opt" }, [
      ui.el("input", { type: "radio", name: "eudr-dds-mode", value: MODE_SINGLE }),
      " Single container",
    ]);
    modeRow.appendChild(modeBooking);
    modeRow.appendChild(modeSingle);
    section.appendChild(modeRow);

    var bookingPanel = ui.el("div", { class: "td-doc-eudr-mode-panel" });
    var bookingSelect = ui.el("select", { class: "td-doc-select" });
    bookingSelect.appendChild(ui.el("option", { value: "" }, ["Choose booking ref…"]));
    bookingPanel.appendChild(
      ui.el("label", { class: "ct-field td-doc-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Booking reference"]),
        bookingSelect,
      ])
    );

    var singlePanel = ui.el("div", {
      class: "td-doc-eudr-mode-panel td-doc-eudr-mode-panel--hidden",
    });
    var containerSelect = ui.el("select", { class: "td-doc-select" });
    containerSelect.appendChild(ui.el("option", { value: "" }, ["Choose container…"]));
    containers.forEach(function (c) {
      containerSelect.appendChild(
        ui.el("option", { value: c.id }, [
          (c.container_number || "—") + (c.booking_ref ? " · " + c.booking_ref : ""),
        ])
      );
    });
    singlePanel.appendChild(
      ui.el("label", { class: "ct-field td-doc-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Container"]),
        containerSelect,
      ])
    );

    section.appendChild(bookingPanel);
    section.appendChild(singlePanel);

    var scopeSummary = ui.el("div", { class: "td-doc-eudr-scope-summary muted" });
    section.appendChild(scopeSummary);

    var savedSelect = ui.el("select", { class: "td-doc-select" });
    savedSelect.appendChild(ui.el("option", { value: "" }, ["New statement (unsaved)"]));
    section.appendChild(
      ui.el("label", { class: "ct-field td-doc-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Saved drafts"]),
        savedSelect,
      ])
    );

    var formWrap = ui.el("div", { class: "cm-eudr-dds-fields td-doc-eudr-form" });
    var inputs = {};
    (CIS.EUDR_DDS_FIELD_KEYS || []).forEach(function (key) {
      var control;
      if (MULTILINE[key]) {
        control = ui.el("textarea", {
          class: "td-doc-eudr-input",
          rows: key === "container_schedule" ? "5" : "3",
          "data-field": key,
        });
      } else {
        control = ui.el("input", {
          class: "td-doc-eudr-input",
          type: "text",
          "data-field": key,
        });
      }
      control.addEventListener("input", function () {
        fields[key] = control.value;
        saveState.textContent = statementId
          ? "Unsaved changes — use Save statement."
          : "Unsaved new statement.";
      });
      inputs[key] = control;
      formWrap.appendChild(
        ui.el("label", { class: "ct-field td-doc-eudr-field-row" }, [
          ui.el("span", { class: "ct-field-label" }, [FIELD_LABELS[key] || key]),
          control,
        ])
      );
    });
    section.appendChild(formWrap);

    var actionMsg = ui.el("p", {
      class: "error-box td-doc-sheet-action-msg td-doc-action-error--hidden",
    }, [""]);
    section.appendChild(actionMsg);

    var actions = ui.el("div", { class: "td-doc-sheet-actions td-doc-eudr-actions" });
    var btnLoadSuggested = ui.el("button", { class: "btn btn-sm", type: "button" }, [
      "Load suggested fields",
    ]);
    var btnSave = ui.el("button", { class: "btn", type: "button" }, ["Save statement"]);
    var btnPreview = ui.el("button", { class: "btn", type: "button" }, ["Preview statement"]);
    var btnPdf = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Download PDF"]);
    var btnPrint = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Print"]);
    actions.appendChild(btnLoadSuggested);
    actions.appendChild(btnSave);
    actions.appendChild(btnPreview);
    actions.appendChild(btnPdf);
    actions.appendChild(btnPrint);
    section.appendChild(actions);
    container.appendChild(section);

    function setActionMsg(text) {
      actionMsg.textContent = text || "";
      if (text) actionMsg.classList.remove("td-doc-action-error--hidden");
      else actionMsg.classList.add("td-doc-action-error--hidden");
    }

    function paintFields() {
      (CIS.EUDR_DDS_FIELD_KEYS || []).forEach(function (key) {
        if (inputs[key]) inputs[key].value = fields[key] == null ? "" : fields[key];
      });
    }

    function resetEditorSelection() {
      statementId = "";
      savedSelect.value = "";
      fields = CIS.eudrDdsDefaultFields();
      paintFields();
    }

    function paintScopeSummary() {
      scopeSummary.innerHTML = "";
      if (!scopeSnapshot || !scopeSnapshot.containers || !scopeSnapshot.containers.length) {
        scopeSummary.textContent =
          mode === MODE_BOOKING
            ? "Select a booking, then load suggested fields to list every container in that booking."
            : "Select a container and load suggested fields.";
        return;
      }
      var n = scopeSnapshot.container_count || scopeSnapshot.containers.length;
      scopeSummary.appendChild(
        ui.el("p", {}, [
          ui.el("strong", {}, [String(n)]),
          " container(s) in scope",
          scopeSnapshot.booking_ref
            ? " · Booking " + scopeSnapshot.booking_ref
            : "",
        ])
      );
      var conflicts = scopeSnapshot.conflicts || {};
      var conflictKeys = Object.keys(conflicts);
      if (conflictKeys.length) {
        scopeSummary.appendChild(
          ui.el("p", { class: "td-doc-eudr-conflicts" }, [
            "Differs by container: " +
              conflictKeys
                .map(function (k) {
                  return k + " (" + (conflicts[k] || []).join("; ") + ")";
                })
                .join(" · "),
          ])
        );
      }
      var table = ui.el("table", { class: "data td-doc-eudr-scope-table" });
      table.innerHTML =
        "<thead><tr><th>Container</th><th>FCL</th><th>Destination</th><th>Loaded mass</th></tr></thead>";
      var tbody = ui.el("tbody");
      scopeSnapshot.containers.forEach(function (r) {
        var tr = ui.el("tr");
        var kg = r.net_mass_kg;
        tr.innerHTML =
          "<td>" +
          ui.escape(r.container_number || "—") +
          "</td><td>" +
          ui.escape(r.fcl_number || "—") +
          "</td><td>" +
          ui.escape(r.destination || "—") +
          "</td><td>" +
          (kg != null ? ui.escape(String(kg) + " kg") : "—") +
          "</td>";
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      scopeSummary.appendChild(table);
      if (statementId) {
        scopeSummary.appendChild(
          ui.el("p", { class: "muted" }, [
            "Frozen scope from when this statement was saved — live booking data may have changed.",
          ])
        );
      }
    }

    function applyModeUi() {
      var isBooking = mode === MODE_BOOKING;
      bookingPanel.classList.toggle("td-doc-eudr-mode-panel--hidden", !isBooking);
      singlePanel.classList.toggle("td-doc-eudr-mode-panel--hidden", isBooking);
      modeBooking.querySelector("input").checked = isBooking;
      modeSingle.querySelector("input").checked = !isBooking;
    }

    function getScopeOpts() {
      return {
        scopeMode: mode,
        scopeSnapshot: scopeSnapshot,
      };
    }

    function applyRecord(rec) {
      statementId = rec && rec.id ? rec.id : "";
      mode = rec.scope_mode === MODE_SINGLE ? MODE_SINGLE : MODE_BOOKING;
      applyModeUi();
      containerId = rec.container_id || "";
      bookingRef = rec.booking_ref || "";
      containerIds = (rec.container_ids || []).slice();
      scopeSnapshot = rec.scope_snapshot || null;
      fields = Object.assign(CIS.eudrDdsDefaultFields(), (rec && rec.fields) || {});

      if (mode === MODE_BOOKING) {
        containerId = "";
        containerSelect.value = "";
        if (bookingRef) bookingSelect.value = bookingRef;
      } else {
        bookingRef = "";
        bookingSelect.value = "";
        if (containerId) containerSelect.value = containerId;
      }

      paintFields();
      paintScopeSummary();
      if (statementId) {
        saveState.textContent =
          "Saved " +
          (rec.status || "draft") +
          " · " +
          mode +
          " · updated " +
          (rec.updated_at || "").replace("T", " ").slice(0, 19);
      }
    }

    async function refreshSavedList() {
      savedSelect.innerHTML = "";
      savedSelect.appendChild(ui.el("option", { value: "" }, ["New statement (unsaved)"]));
      var query = "";
      if (mode === MODE_BOOKING) {
        if (!bookingRef) return;
        query =
          "/containers/eudr-dds-statements?booking_ref=" +
          encodeURIComponent(bookingRef);
      } else {
        if (!containerId) return;
        query =
          "/containers/eudr-dds-statements?container_id=" +
          encodeURIComponent(containerId);
      }
      try {
        var data = await ctx.api.traceability(query);
        var list = (data && data.statements) || [];
        list.forEach(function (s) {
          var label =
            (s.scope_mode || "single") +
            " · " +
            (s.status || "draft") +
            " · " +
            (s.updated_at || "").slice(0, 10);
          savedSelect.appendChild(ui.el("option", { value: s.id }, [label]));
        });
        if (statementId && list.some(function (s) { return s.id === statementId; })) {
          savedSelect.value = statementId;
        }
      } catch (e) {
        setActionMsg("Could not list saved statements: " + (e.message || e));
      }
    }

    async function populateBookingSelect() {
      bookingSelect.innerHTML = "";
      bookingSelect.appendChild(ui.el("option", { value: "" }, ["Choose booking ref…"]));
      try {
        var data = await ctx.api.traceability("/containers/eudr-dds-booking-refs");
        var list = (data && data.bookings) || [];
        list.forEach(function (b) {
          bookingSelect.appendChild(
            ui.el("option", { value: b.booking_ref }, [
              b.booking_ref + " (" + b.container_count + " containers)",
            ])
          );
        });
      } catch (e) {
        var seen = {};
        containers.forEach(function (c) {
          var ref = (c.booking_ref || "").trim();
          if (!ref || seen[ref]) return;
          seen[ref] = true;
          bookingSelect.appendChild(ui.el("option", { value: ref }, [ref]));
        });
      }
    }

    async function ensureAssets() {
      if (assetUrls) return assetUrls;
      assetUrls = await CIS.prepareEudrDdsAssetUrls();
      return assetUrls;
    }

    function getDocumentHtml() {
      return CIS.buildEudrDdsDocumentHtml(fields, assetUrls || undefined, getScopeOpts());
    }

    function onModeChange(newMode) {
      if (newMode === mode) return;
      mode = newMode;
      applyModeUi();
      resetEditorSelection();
      containerId = "";
      bookingRef = "";
      containerIds = [];
      scopeSnapshot = null;
      bookingSelect.value = "";
      containerSelect.value = "";
      setActionMsg("");
      paintScopeSummary();
      saveState.textContent =
        mode === MODE_BOOKING
          ? "Choose a booking reference."
          : "Choose a container.";
    }

    modeBooking.querySelector("input").addEventListener("change", function () {
      if (this.checked) onModeChange(MODE_BOOKING);
    });
    modeSingle.querySelector("input").addEventListener("change", function () {
      if (this.checked) onModeChange(MODE_SINGLE);
    });

    bookingSelect.addEventListener("change", async function () {
      bookingRef = bookingSelect.value;
      resetEditorSelection();
      containerIds = [];
      scopeSnapshot = null;
      setActionMsg("");
      paintScopeSummary();
      await refreshSavedList();
      if (bookingRef) {
        saveState.textContent = "Load suggested fields for this booking.";
      }
    });

    containerSelect.addEventListener("change", async function () {
      containerId = containerSelect.value;
      resetEditorSelection();
      containerIds = [];
      scopeSnapshot = null;
      setActionMsg("");
      paintScopeSummary();
      await refreshSavedList();
      if (containerId) {
        saveState.textContent = "Load suggested fields for this container.";
      }
    });

    savedSelect.addEventListener("change", async function () {
      var id = savedSelect.value;
      if (!id) {
        resetEditorSelection();
        paintScopeSummary();
        saveState.textContent = "New statement (not saved yet).";
        return;
      }
      setActionMsg("");
      try {
        var rec = await ctx.api.traceability(
          "/containers/eudr-dds-statements/" + encodeURIComponent(id)
        );
        applyRecord(rec);
      } catch (e) {
        setActionMsg("Could not open statement: " + (e.message || e));
      }
    });

    btnLoadSuggested.addEventListener("click", async function () {
      setActionMsg("");
      btnLoadSuggested.disabled = true;
      try {
        if (mode === MODE_BOOKING) {
          if (!bookingRef) throw new Error("Choose a booking reference first.");
          var bData = await ctx.api.traceability(
            "/containers/eudr-dds-booking-defaults?booking_ref=" +
              encodeURIComponent(bookingRef)
          );
          fields = Object.assign(CIS.eudrDdsDefaultFields(), (bData && bData.fields) || {});
          containerIds = (bData && bData.container_ids) || [];
          scopeSnapshot = (bData && bData.scope_snapshot) || null;
        } else {
          if (!containerId) throw new Error("Choose a container first.");
          var cData = await ctx.api.traceability(
            "/containers/" + encodeURIComponent(containerId) + "/eudr-dds-defaults"
          );
          fields = Object.assign(CIS.eudrDdsDefaultFields(), (cData && cData.fields) || {});
          containerIds = (cData && cData.container_ids) || [containerId];
          scopeSnapshot = (cData && cData.scope_snapshot) || null;
        }
        statementId = "";
        paintFields();
        paintScopeSummary();
        saveState.textContent = "Suggested fields loaded — review and Save statement.";
      } catch (e) {
        setActionMsg("Could not load suggested fields: " + (e.message || e));
      } finally {
        btnLoadSuggested.disabled = false;
      }
    });

    btnSave.addEventListener("click", async function () {
      if (mode === MODE_BOOKING && !bookingRef) {
        setActionMsg("Choose a booking reference before saving.");
        return;
      }
      if (mode === MODE_SINGLE && !containerId) {
        setActionMsg("Choose a container before saving.");
        return;
      }
      if (!containerIds.length && !scopeSnapshot) {
        setActionMsg("Load suggested fields first so container scope is captured.");
        return;
      }
      setActionMsg("");
      btnSave.disabled = true;
      try {
        var payload = {
          scope_mode: mode,
          booking_ref: mode === MODE_BOOKING ? bookingRef : null,
          container_id: mode === MODE_SINGLE ? containerId : null,
          container_ids: containerIds,
          scope_snapshot: scopeSnapshot,
          fields: fields,
          status: "draft",
        };
        var rec;
        if (statementId) {
          rec = await ctx.api.traceability(
            "/containers/eudr-dds-statements/" + encodeURIComponent(statementId),
            { method: "PUT", body: payload }
          );
        } else {
          rec = await ctx.api.traceability("/containers/eudr-dds-statements", {
            method: "POST",
            body: payload,
          });
        }
        applyRecord(rec);
        await refreshSavedList();
        savedSelect.value = statementId;
      } catch (e) {
        var msg = e.message || String(e);
        if (/column .* does not exist/i.test(msg) || /scope_mode/i.test(msg)) {
          msg += " (Apply migration 055_ct_eudr_dds_scope on Traceability DB.)";
        }
        setActionMsg("Save failed: " + msg);
      } finally {
        btnSave.disabled = false;
      }
    });

    async function openPreview(autoPrint) {
      setActionMsg("");
      try {
        await ensureAssets();
        var filename = CIS.buildEudrDdsPdfFilename(fields, getScopeOpts());
        await CIS.showHtmlDocumentPreview({
          title: "EUDR Due Diligence Statement",
          frameClassName: "a4-print-preview-overlay__frame cm-container-sheet-preview-frame",
          pdfFilename: filename,
          autoPrintAfterLoad: !!autoPrint,
          getHtml: getDocumentHtml,
          downloadPdf: function () {
            return ensureAssets().then(function () {
              return CIS.downloadHtmlDocumentPdf(getDocumentHtml(), filename);
            });
          },
        });
      } catch (e) {
        setActionMsg((autoPrint ? "Print" : "Preview") + " failed: " + (e.message || e));
      }
    }

    btnPreview.addEventListener("click", function () { openPreview(false); });
    btnPrint.addEventListener("click", function () { openPreview(true); });
    btnPdf.addEventListener("click", async function () {
      setActionMsg("");
      btnPdf.disabled = true;
      try {
        await ensureAssets();
        await CIS.downloadHtmlDocumentPdf(
          getDocumentHtml(),
          CIS.buildEudrDdsPdfFilename(fields, getScopeOpts())
        );
      } catch (e) {
        setActionMsg("PDF failed: " + (e.message || e));
      } finally {
        btnPdf.disabled = false;
      }
    });

    applyModeUi();
    paintFields();
    populateBookingSelect();
  };
})();
