/* EUDR Due Diligence Statement — CIS editor (Phase 1). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var FIELD_LABELS = {
    client: "Client (internal reference)",
    container: "Container number",
    carbo_ref: "Carbo reference",
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
    geojson: true,
    traceability_record: true,
  };

  /**
   * @param {HTMLElement} container
   * @param {object} ctx
   * @param {{ containers: object[], ui: object }} shared
   */
  CIS.mountEudrDdsEditor = function (container, ctx, shared) {
    var ui = shared.ui || CIS.ui;
    var containers = shared.containers || [];
    var fields = CIS.eudrDdsDefaultFields();
    var statementId = "";
    var containerId = "";
    var assetUrls = null;
    var dirty = false;

    var section = ui.el("section", { class: "td-doc-section td-doc-eudr-dds" });
    section.appendChild(
      ui.el("h3", { class: "ct-containers-section-title" }, [
        "EUDR Due Diligence Statement",
      ])
    );
    section.appendChild(
      ui.el("p", { class: "muted" }, [
        "Edit the due diligence statement for one container, save a draft, then preview or download a branded PDF.",
      ])
    );

    var saveState = ui.el("p", { class: "muted td-doc-eudr-save-state" }, [
      "No statement loaded.",
    ]);
    section.appendChild(saveState);

    var containerSelect = ui.el("select", { class: "td-doc-select" });
    containerSelect.appendChild(ui.el("option", { value: "" }, ["Choose container…"]));
    containers.forEach(function (c) {
      containerSelect.appendChild(
        ui.el("option", { value: c.id }, [
          (c.container_number || "—") + (c.booking_ref ? " · " + c.booking_ref : ""),
        ])
      );
    });

    var savedSelect = ui.el("select", { class: "td-doc-select" });
    savedSelect.appendChild(
      ui.el("option", { value: "" }, ["New statement (unsaved)"])
    );

    section.appendChild(
      ui.el("div", { class: "td-doc-doc-row" }, [
        ui.el("label", { class: "ct-field td-doc-field" }, [
          ui.el("span", { class: "ct-field-label" }, ["Container"]),
          containerSelect,
        ]),
        ui.el("label", { class: "ct-field td-doc-field" }, [
          ui.el("span", { class: "ct-field-label" }, ["Saved drafts"]),
          savedSelect,
        ]),
      ])
    );

    var formWrap = ui.el("div", { class: "cm-eudr-dds-fields td-doc-eudr-form" });
    var inputs = {};

    (CIS.EUDR_DDS_FIELD_KEYS || []).forEach(function (key) {
      var label = FIELD_LABELS[key] || key;
      var control;
      if (MULTILINE[key]) {
        control = ui.el("textarea", {
          class: "td-doc-eudr-input",
          rows: MULTILINE[key] === true ? "3" : "2",
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
        dirty = true;
        fields[key] = control.value;
        saveState.textContent = statementId
          ? "Unsaved changes — use Save statement."
          : "Unsaved new statement.";
      });
      inputs[key] = control;
      formWrap.appendChild(
        ui.el("label", { class: "ct-field td-doc-eudr-field-row" }, [
          ui.el("span", { class: "ct-field-label" }, [label]),
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

    function applyRecord(rec) {
      statementId = rec && rec.id ? rec.id : "";
      containerId = (rec && rec.container_id) || containerId;
      fields = Object.assign(CIS.eudrDdsDefaultFields(), (rec && rec.fields) || {});
      if (containerId) containerSelect.value = containerId;
      paintFields();
      dirty = false;
      if (statementId) {
        saveState.textContent =
          "Saved " +
          (rec.status || "draft") +
          " · updated " +
          (rec.updated_at || "").replace("T", " ").slice(0, 19);
      } else {
        saveState.textContent = "New statement (not saved yet).";
      }
    }

    async function refreshSavedList() {
      if (!containerId) {
        savedSelect.innerHTML = "";
        savedSelect.appendChild(
          ui.el("option", { value: "" }, ["New statement (unsaved)"])
        );
        return;
      }
      try {
        var data = await ctx.api.traceability(
          "/containers/eudr-dds-statements?container_id=" +
            encodeURIComponent(containerId)
        );
        var list = (data && data.statements) || [];
        savedSelect.innerHTML = "";
        savedSelect.appendChild(
          ui.el("option", { value: "" }, ["New statement (unsaved)"])
        );
        list.forEach(function (s) {
          var label =
            (s.status || "draft") +
            " · " +
            (s.updated_at || "").slice(0, 10) +
            (s.fields && s.fields.client ? " · " + s.fields.client : "");
          savedSelect.appendChild(ui.el("option", { value: s.id }, [label]));
        });
        if (statementId && list.some(function (s) { return s.id === statementId; })) {
          savedSelect.value = statementId;
        }
      } catch (e) {
        setActionMsg("Could not list saved statements: " + (e.message || e));
      }
    }

    async function ensureAssets() {
      if (assetUrls) return assetUrls;
      if (!CIS.prepareEudrDdsAssetUrls) {
        throw new Error("EUDR render module not loaded.");
      }
      assetUrls = await CIS.prepareEudrDdsAssetUrls();
      return assetUrls;
    }

    function getDocumentHtml() {
      if (!CIS.buildEudrDdsDocumentHtml) {
        throw new Error("EUDR render module not loaded.");
      }
      return CIS.buildEudrDdsDocumentHtml(fields, assetUrls || undefined);
    }

    containerSelect.addEventListener("change", async function () {
      containerId = containerSelect.value;
      statementId = "";
      savedSelect.value = "";
      setActionMsg("");
      await refreshSavedList();
      if (!containerId) return;
      saveState.textContent = "Choose Load suggested fields or open a saved draft.";
    });

    savedSelect.addEventListener("change", async function () {
      var id = savedSelect.value;
      if (!id) {
        statementId = "";
        fields = CIS.eudrDdsDefaultFields();
        paintFields();
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
      if (!containerId) {
        setActionMsg("Choose a container first.");
        return;
      }
      setActionMsg("");
      btnLoadSuggested.disabled = true;
      try {
        var data = await ctx.api.traceability(
          "/containers/" + encodeURIComponent(containerId) + "/eudr-dds-defaults"
        );
        fields = Object.assign(CIS.eudrDdsDefaultFields(), (data && data.fields) || {});
        dirty = true;
        paintFields();
        saveState.textContent = "Suggested fields loaded — review and Save statement.";
      } catch (e) {
        setActionMsg("Could not load suggested fields: " + (e.message || e));
      } finally {
        btnLoadSuggested.disabled = false;
      }
    });

    btnSave.addEventListener("click", async function () {
      if (!containerId) {
        setActionMsg("Choose a container before saving.");
        return;
      }
      setActionMsg("");
      btnSave.disabled = true;
      try {
        var payload = {
          container_id: containerId,
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
        saveState.textContent = "Saved draft · " + (rec.updated_at || "").slice(0, 19);
      } catch (e) {
        var msg = e.message || String(e);
        if (/relation .* does not exist/i.test(msg) || /ct_eudr_dds/i.test(msg)) {
          msg +=
            " (Database migration 054_ct_eudr_dds_statement may not be applied on this server.)";
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
        if (!CIS.showHtmlDocumentPreview) {
          throw new Error("Document preview module not loaded.");
        }
        var filename = CIS.buildEudrDdsPdfFilename(fields);
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

    btnPreview.addEventListener("click", function () {
      openPreview(false);
    });
    btnPrint.addEventListener("click", function () {
      openPreview(true);
    });
    btnPdf.addEventListener("click", async function () {
      setActionMsg("");
      btnPdf.disabled = true;
      try {
        await ensureAssets();
        await CIS.downloadHtmlDocumentPdf(
          getDocumentHtml(),
          CIS.buildEudrDdsPdfFilename(fields)
        );
      } catch (e) {
        setActionMsg("PDF failed: " + (e.message || e));
      } finally {
        btnPdf.disabled = false;
      }
    });

    paintFields();
  };
})();
