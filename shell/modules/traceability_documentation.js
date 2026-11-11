/* Traceability Documentation — load sheet, traceability summary, EUDR declaration. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var STATUS_LABEL = {
    booked: "Booked",
    loading: "Loading",
    full: "Full (loading closed)",
    dispatched: "Shipped",
    cancelled: "Cancelled",
  };

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var containers = [];
    var selectedContainerId = "";

    container.className = "module-content td-doc-host";
    if (ctx.applyModuleFloatNavPadding) ctx.applyModuleFloatNavPadding(container);

    container.appendChild(
      ui.el("h2", { class: "module-title" }, ["Traceability Documentation"])
    );
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Three separate documents per shipment. Pick a container once below, then open the document you need.",
      ])
    );

    var introGrid = ui.el("div", { class: "td-doc-intro-grid", role: "list" });
    [
      {
        doc: "load",
        title: "1 — Container load sheet",
        text:
          "Operational weighing list: every pallet/bag ID, product code and weight loaded into the FCL. For the yard, transporter and shipping line — not for farm GPS.",
      },
      {
        doc: "trace",
        title: "2 — EUDR accompanying location sheet",
        text:
          "GPS location sheet (Excel layout): each producer and farm that supplied charcoal in this FCL, with latitude and longitude — not camp GeoJSON polygons.",
      },
      {
        doc: "eudr",
        title: "3 — EUDR declaration",
        text:
          "Due Diligence Statement (DDS): formal EU regulatory declaration by booking or container, with save, PDF and print — not a bag-by-bag load list.",
      },
    ].forEach(function (card) {
      var el = ui.el("div", {
        class: "td-doc-intro-card",
        "data-doc": card.doc,
        role: "listitem",
      });
      el.appendChild(ui.el("h4", {}, [card.title]));
      el.appendChild(ui.el("p", {}, [card.text]));
      introGrid.appendChild(el);
    });
    container.appendChild(introGrid);

    var statusEl = ui.el("p", { class: "muted td-doc-status" }, [""]);
    container.appendChild(statusEl);

    function setStatus(text, isError) {
      statusEl.textContent = text || "";
      statusEl.className = isError ? "error-box td-doc-status" : "muted td-doc-status";
    }

    var includeClosed = false;
    var toggleClosed = ui.el("button", { class: "btn btn-sm", type: "button" }, [
      "Include shipped and cancelled",
    ]);

    function visibleList() {
      if (includeClosed) return containers.slice();
      return containers.filter(function (c) {
        return c.status !== "dispatched" && c.status !== "cancelled";
      });
    }

    function selectedContainer() {
      return containers.find(function (x) {
        return x.id === selectedContainerId;
      });
    }

    var sharedSection = ui.el("section", { class: "td-doc-shared-picker" });
    sharedSection.appendChild(
      ui.el("h3", { class: "td-doc-shared-picker__title" }, ["Choose container (documents 1 & 2)"])
    );
    sharedSection.appendChild(
      ui.el("p", { class: "muted td-doc-shared-picker__hint" }, [
        "The EUDR due diligence statement (document 3) uses its own booking or container scope below.",
      ])
    );
    sharedSection.appendChild(toggleClosed);

    var containerSelect = ui.el("select", { class: "td-doc-select" });
    containerSelect.appendChild(ui.el("option", { value: "" }, ["Loading containers…"]));
    sharedSection.appendChild(
      ui.el("label", { class: "ct-field td-doc-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Container for load sheet & location sheet"]),
        containerSelect,
      ])
    );

    var containerPreview = ui.el("div", { class: "td-doc-preview muted" }, ["Choose a container."]);
    sharedSection.appendChild(containerPreview);
    container.appendChild(sharedSection);

    toggleClosed.addEventListener("click", function () {
      includeClosed = !includeClosed;
      toggleClosed.textContent = includeClosed
        ? "Hide shipped and cancelled"
        : "Include shipped and cancelled";
      paintContainerSelect();
    });

    function paintContainerSelect() {
      var list = visibleList();
      var prev = containerSelect.value;
      containerSelect.innerHTML = "";
      if (!list.length) {
        containerSelect.appendChild(ui.el("option", { value: "" }, ["No containers in this view"]));
        selectedContainerId = "";
      } else {
        containerSelect.appendChild(ui.el("option", { value: "" }, ["Choose container…"]));
        list.forEach(function (c) {
          containerSelect.appendChild(
            ui.el("option", { value: c.id }, [
              c.container_number +
                " (" +
                (STATUS_LABEL[c.status] || c.status) +
                ", " +
                fmt(c.loaded_bags) +
                " loaded)",
            ])
          );
        });
        if (prev && list.some(function (c) { return c.id === prev; })) {
          containerSelect.value = prev;
        }
      }
      selectedContainerId = containerSelect.value;
      paintContainerPreview();
      syncDocButtons();
    }

    function paintContainerPreview() {
      var c = selectedContainer();
      if (!c) {
        containerPreview.textContent = "Choose a container.";
        containerPreview.className = "td-doc-preview muted";
        return;
      }
      containerPreview.innerHTML = "";
      containerPreview.className = "td-doc-preview";
      containerPreview.appendChild(
        ui.el("p", {}, [
          ui.el("strong", {}, [c.container_number]),
          " · ",
          c.product_label || c.product_key || "—",
          " · ",
          STATUS_LABEL[c.status] || c.status,
        ])
      );
      containerPreview.appendChild(
        ui.el("p", { class: "muted" }, [
          fmt(c.loaded_bags),
          " bags loaded · Booking ",
          c.booking_ref || "—",
          c.ship_to ? " · To " + c.ship_to : "",
        ])
      );
    }

    containerSelect.addEventListener("change", function () {
      selectedContainerId = containerSelect.value;
      paintContainerPreview();
      syncDocButtons();
      setLoadSheetMsg("");
      setTraceSummaryMsg("");
    });

    function showBusyModal(title, initialMessage) {
      var backdrop = ui.el("div", {
        class: "modal-backdrop td-doc-busy-backdrop",
        role: "dialog",
        "aria-modal": "true",
        "aria-busy": "true",
      });
      var dialog = ui.el("div", { class: "modal td-doc-busy-dialog" });
      dialog.appendChild(ui.el("h3", { class: "cm-print-dialog-title td-doc-busy-title" }, [title]));
      var msgEl = ui.el("p", { class: "td-doc-busy-message" }, [initialMessage || "Please wait…"]);
      dialog.appendChild(msgEl);
      dialog.appendChild(
        ui.el("p", { class: "td-doc-busy-hint muted" }, [
          "The preview opens when loading finishes. Do not click the button again.",
        ])
      );
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);
      return {
        setMessage: function (text) {
          msgEl.textContent = text || "";
        },
        close: function () {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        },
      };
    }

    /* —— Document 1: Container load sheet —— */
    var loadSheetCard = ui.el("section", {
      class: "td-doc-doc-card td-doc-doc-card--load",
      "aria-labelledby": "td-doc-load-title",
    });
    loadSheetCard.appendChild(ui.el("p", { class: "td-doc-doc-card__tag" }, ["Document 1 · Operational"]));
    loadSheetCard.appendChild(
      ui.el("h3", { class: "td-doc-doc-card__title", id: "td-doc-load-title" }, [
        "Container load sheet",
      ])
    );
    loadSheetCard.appendChild(
      ui.el("p", { class: "td-doc-doc-card__purpose" }, [
        "Printable load manifest: NR, bag ID with product code, and weight — same data as yard loading.",
      ])
    );
    var btnLoadSheet = ui.el("button", {
      class: "btn",
      type: "button",
      disabled: "disabled",
    }, ["Preview load sheet"]);
    loadSheetCard.appendChild(ui.el("div", { class: "td-doc-sheet-actions" }, [btnLoadSheet]));
    var loadSheetMsg = ui.el("p", {
      class: "error-box td-doc-sheet-action-msg td-doc-action-error--hidden",
    }, [""]);
    loadSheetCard.appendChild(loadSheetMsg);
    container.appendChild(loadSheetCard);

    function setLoadSheetMsg(text) {
      loadSheetMsg.textContent = text || "";
      if (text) loadSheetMsg.classList.remove("td-doc-action-error--hidden");
      else loadSheetMsg.classList.add("td-doc-action-error--hidden");
    }

    btnLoadSheet.addEventListener("click", async function () {
      if (!selectedContainerId) return;
      setLoadSheetMsg("");
      var prevLabel = btnLoadSheet.textContent;
      btnLoadSheet.disabled = true;
      btnLoadSheet.textContent = "Loading…";
      var busy = showBusyModal("Container load sheet", "Loading container manifest…");
      try {
        var manifest = await ctx.api.traceability(
          "/containers/" + encodeURIComponent(selectedContainerId) + "/manifest"
        );
        if (!manifest || !manifest.header) {
          throw new Error("Manifest did not return container header data.");
        }
        if (!CIS.prepareContainerSheetManifest || !CIS.showContainerSheetPreview) {
          throw new Error("Container sheet module not loaded.");
        }
        busy.setMessage("Loading in-container bags…");
        manifest = await CIS.prepareContainerSheetManifest(ctx.api, manifest);
        if (!(manifest._sheet_loading_rows || []).length) {
          throw new Error("No in-container bags found. Check Bags Status → Into container.");
        }
        busy.close();
        await CIS.showContainerSheetPreview(manifest, "documentation");
      } catch (e) {
        busy.close();
        setLoadSheetMsg("Could not open load sheet: " + (e.message || e));
      } finally {
        if (selectedContainerId) {
          btnLoadSheet.disabled = false;
          btnLoadSheet.textContent = prevLabel;
        }
        syncDocButtons();
      }
    });

    /* —— Document 2: Traceability summary —— */
    var traceCard = ui.el("section", {
      class: "td-doc-doc-card td-doc-doc-card--trace",
      "aria-labelledby": "td-doc-trace-title",
    });
    traceCard.appendChild(ui.el("p", { class: "td-doc-doc-card__tag" }, ["Document 2 · EUDR GPS evidence"]));
    traceCard.appendChild(
      ui.el("h3", { class: "td-doc-doc-card__title", id: "td-doc-trace-title" }, [
        "EUDR accompanying location sheet",
      ])
    );
    traceCard.appendChild(
      ui.el("p", { class: "td-doc-doc-card__purpose" }, [
        "Same layout as ",
        ui.el("em", {}, ["GPS EUDR Accompanying Location Sheet Containers"]),
        ": supplier, farm name & number, and farm GPS point per producer in the container (from Traceability + Producers API).",
      ])
    );
    var traceActions = ui.el("div", { class: "td-doc-sheet-actions" });
    var btnTraceSummary = ui.el("button", {
      class: "btn",
      type: "button",
      disabled: "disabled",
      id: "td-doc-location-sheet-pdf",
    }, ["Preview location sheet"]);
    var btnTraceCsv = ui.el("button", {
      class: "btn btn-sm td-doc-eudr-btn-secondary",
      type: "button",
      disabled: "disabled",
      id: "td-doc-location-sheet-print",
    }, ["Download CSV (Excel)"]);
    traceActions.appendChild(btnTraceSummary);
    traceActions.appendChild(btnTraceCsv);
    traceCard.appendChild(traceActions);
    var traceSummaryMsg = ui.el("p", {
      class: "error-box td-doc-sheet-action-msg td-doc-action-error--hidden",
    }, [""]);
    traceCard.appendChild(traceSummaryMsg);
    container.appendChild(traceCard);

    function setTraceSummaryMsg(text) {
      traceSummaryMsg.textContent = text || "";
      if (text) traceSummaryMsg.classList.remove("td-doc-action-error--hidden");
      else traceSummaryMsg.classList.add("td-doc-action-error--hidden");
    }

    btnTraceCsv.addEventListener("click", async function () {
      if (!selectedContainerId) return;
      setTraceSummaryMsg("");
      btnTraceCsv.disabled = true;
      try {
        if (!CIS.downloadEudrAccompanyingLocationSheetCsv) {
          throw new Error("Location sheet module not loaded.");
        }
        await CIS.downloadEudrAccompanyingLocationSheetCsv(ctx.api, selectedContainerId);
      } catch (e) {
        setTraceSummaryMsg("CSV download failed: " + (e.message || e));
      } finally {
        syncDocButtons();
      }
    });

    btnTraceSummary.addEventListener("click", async function () {
      if (!selectedContainerId) return;
      setTraceSummaryMsg("");
      var prevLabel = btnTraceSummary.textContent;
      btnTraceSummary.disabled = true;
      btnTraceSummary.textContent = "Loading…";
      var busy = showBusyModal(
        "EUDR accompanying location sheet",
        "Resolving producers and farm GPS for this container…"
      );
      try {
        if (!CIS.showEudrAccompanyingLocationSheetPreview) {
          throw new Error("Location sheet module not loaded.");
        }
        busy.close();
        await CIS.showEudrAccompanyingLocationSheetPreview(ctx.api, selectedContainerId);
      } catch (e) {
        busy.close();
        setTraceSummaryMsg("Could not open summary: " + (e.message || e));
      } finally {
        if (selectedContainerId) {
          btnTraceSummary.disabled = false;
          btnTraceSummary.textContent = prevLabel;
        }
        syncDocButtons();
      }
    });

    function syncDocButtons() {
      var on = !!selectedContainerId;
      btnLoadSheet.disabled = !on;
      btnTraceSummary.disabled = !on;
      btnTraceCsv.disabled = !on;
      if (!on) {
        btnLoadSheet.title = "Choose a container in the section above.";
        btnTraceSummary.title = "Choose a container in the section above.";
        btnTraceCsv.title = "Choose a container in the section above.";
      } else {
        btnLoadSheet.removeAttribute("title");
        btnTraceSummary.removeAttribute("title");
        btnTraceCsv.removeAttribute("title");
      }
    }

    async function loadContainers() {
      setStatus("Loading containers…", false);
      try {
        var data = await ctx.api.traceability("/containers");
        containers = (data && data.containers) || [];
        containers.sort(function (a, b) {
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
        paintContainerSelect();
        setStatus("", false);
        if (CIS._tdDocOnContainersLoaded) CIS._tdDocOnContainersLoaded(containers);
      } catch (e) {
        setStatus("Could not load containers: " + (e.message || e), true);
      }
    }

    await loadContainers();

    if (CIS.mountEudrDdsEditor) {
      CIS.mountEudrDdsEditor(container, ctx, {
        ui: ui,
        containers: containers,
        onContainersReloaded: function (fn) {
          CIS._tdDocOnContainersLoaded = fn;
        },
      });
    }
  }

  CIS.modules.push({
    id: "traceability_documentation",
    title: "Traceability Documentation",
    section: "Production",
    kind: "lookup",
    order: 18,
    icon: "traceability",
    description: "Load sheet, EUDR location sheet (GPS), and EUDR declaration",
    requires: "traceability.containers",
    render: render,
  });
})();
