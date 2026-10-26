/* Traceability Documentation — container load sheet + EUDR shipment pack (phase 2). */
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

  function normBooking(ref) {
    return String(ref || "")
      .trim()
      .toLowerCase();
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var containers = [];
    var sheetContainerId = "";
    var eudrMode = "booking";
    var eudrSelectedIds = {};

    container.className = "module-content td-doc-host";
    if (ctx.applyModuleFloatNavPadding) ctx.applyModuleFloatNavPadding(container);
    container.appendChild(
      ui.el("h2", { class: "module-title" }, ["Traceability Documentation"])
    );
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Three document types: ",
        ui.el("strong", {}, ["Container sheet"]),
        " (logistics manifest per FCL — no farm traceability on the page), ",
        ui.el("strong", {}, ["EUDR due diligence statement"]),
        " (one shipment, all selected containers), and ",
        ui.el("strong", {}, ["accompanying location sheet"]),
        " (producers per container with farm GPS from the register, not EUDR GeoJSON polygons).",
      ])
    );

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
    toggleClosed.addEventListener("click", function () {
      includeClosed = !includeClosed;
      toggleClosed.textContent = includeClosed
        ? "Hide shipped and cancelled"
        : "Include shipped and cancelled";
      paintSheetSelect();
      paintEudrPickList();
      paintEudrPreview();
    });

    function visibleList() {
      if (includeClosed) return containers.slice();
      return containers.filter(function (c) {
        return c.status !== "dispatched" && c.status !== "cancelled";
      });
    }

    function uniqueBookingRefs(list) {
      var seen = {};
      var out = [];
      list.forEach(function (c) {
        var r = String(c.booking_ref || "").trim();
        if (!r || seen[r]) return;
        seen[r] = true;
        out.push(r);
      });
      out.sort();
      return out;
    }

    function containersForBooking(ref) {
      var key = normBooking(ref);
      if (!key) return [];
      return containers.filter(function (c) {
        return normBooking(c.booking_ref) === key;
      });
    }

    /* —— Container sheet (one FCL) —— */
    var sheetSection = ui.el("section", { class: "td-doc-section" });
    sheetSection.appendChild(
      ui.el("h3", { class: "ct-containers-section-title" }, ["Container sheet"])
    );
    sheetSection.appendChild(
      ui.el("p", { class: "muted" }, [
        "Operational container load sheet for one FCL. Select a container, preview the form, then download or print.",
      ])
    );
    sheetSection.appendChild(toggleClosed);

    var sheetSelect = ui.el("select", { class: "td-doc-select" });
    sheetSelect.appendChild(ui.el("option", { value: "" }, ["Loading containers…"]));
    sheetSection.appendChild(
      ui.el("label", { class: "ct-field td-doc-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Container"]),
        sheetSelect,
      ])
    );
    var sheetPreview = ui.el("div", { class: "td-doc-preview muted" }, [
      "Choose a container.",
    ]);
    sheetSection.appendChild(sheetPreview);
    var sheetActions = ui.el("div", { class: "td-doc-sheet-actions" });
    var sheetBtnPreview = ui.el("button", {
      class: "btn",
      type: "button",
      disabled: "disabled",
    }, ["Preview Container Load Sheet"]);
    sheetActions.appendChild(sheetBtnPreview);
    sheetSection.appendChild(sheetActions);
    var sheetActionMsg = ui.el("p", {
      class: "error-box td-doc-sheet-action-msg td-doc-action-error--hidden",
    }, [""]);
    sheetSection.appendChild(sheetActionMsg);
    container.appendChild(sheetSection);

    function paintSheetSelect() {
      var list = visibleList();
      var prev = sheetSelect.value;
      sheetSelect.innerHTML = "";
      if (!list.length) {
        sheetSelect.appendChild(ui.el("option", { value: "" }, ["No containers in this view"]));
        sheetContainerId = "";
      } else {
        sheetSelect.appendChild(ui.el("option", { value: "" }, ["Choose container…"]));
        list.forEach(function (c) {
          sheetSelect.appendChild(
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
          sheetSelect.value = prev;
        }
      }
      sheetContainerId = sheetSelect.value;
      paintSheetPreview();
    }

    function paintSheetPreview() {
      var c = containers.find(function (x) { return x.id === sheetContainerId; });
      if (!c) {
        sheetPreview.textContent = "Choose a container.";
        sheetPreview.className = "td-doc-preview muted";
        sheetBtnPreview.disabled = true;
        sheetBtnPreview.title = "Choose a container from the list above.";
        return;
      }
      sheetPreview.innerHTML = "";
      sheetPreview.className = "td-doc-preview";
      sheetPreview.appendChild(
        ui.el("p", {}, [
          ui.el("strong", {}, [c.container_number]),
          " · ",
          c.product_label || c.product_key || "—",
          " · ",
          STATUS_LABEL[c.status] || c.status,
        ])
      );
      sheetPreview.appendChild(
        ui.el("p", { class: "muted" }, [
          fmt(c.loaded_bags),
          " bags loaded · Booking ",
          c.booking_ref || "—",
          c.ship_to ? " · To " + c.ship_to : "",
        ])
      );
      sheetBtnPreview.disabled = false;
      sheetBtnPreview.removeAttribute("title");
    }

    function setSheetActionMsg(text) {
      sheetActionMsg.textContent = text || "";
      if (text) sheetActionMsg.classList.remove("td-doc-action-error--hidden");
      else sheetActionMsg.classList.add("td-doc-action-error--hidden");
    }

    /** Blocking modal while manifest + bag rows load (avoids top-of-page status + double-clicks). */
    function showSheetLoadingModal(initialMessage) {
      var backdrop = ui.el("div", {
        class: "modal-backdrop td-doc-busy-backdrop",
        role: "dialog",
        "aria-modal": "true",
        "aria-busy": "true",
      });
      var dialog = ui.el("div", { class: "modal td-doc-busy-dialog" });
      dialog.appendChild(
        ui.el("h3", { class: "cm-print-dialog-title td-doc-busy-title" }, [
          "Preparing container load sheet",
        ])
      );
      var msgEl = ui.el("p", { class: "td-doc-busy-message" }, [
        initialMessage || "Please wait…",
      ]);
      dialog.appendChild(msgEl);
      dialog.appendChild(
        ui.el("p", { class: "td-doc-busy-hint muted" }, [
          "Please wait — the preview opens when loading finishes. Do not click the button again.",
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

    async function fetchSheetManifest() {
      if (!sheetContainerId) {
        throw new Error("Choose a container from the list above.");
      }
      return await ctx.api.traceability(
        "/containers/" + encodeURIComponent(sheetContainerId) + "/manifest"
      );
    }

    sheetSelect.addEventListener("change", function () {
      sheetContainerId = sheetSelect.value;
      setSheetActionMsg("");
      paintSheetPreview();
    });

    sheetBtnPreview.addEventListener("click", async function () {
      if (!sheetContainerId) return;
      setSheetActionMsg("");
      var prevBtnLabel = sheetBtnPreview.textContent;
      sheetBtnPreview.disabled = true;
      sheetBtnPreview.textContent = "Loading…";
      var busy = showSheetLoadingModal(
        "Loading container manifest from Traceability…"
      );
      try {
        var manifest = await fetchSheetManifest();
        if (!manifest || !manifest.header) {
          throw new Error("Manifest did not return container header data.");
        }
        if (!CIS.prepareContainerSheetManifest || !CIS.showContainerSheetPreview) {
          throw new Error("Container sheet module not loaded.");
        }
        busy.setMessage(
          "Loading in-container bags (same data as Bags Status → Into container)…"
        );
        manifest = await CIS.prepareContainerSheetManifest(ctx.api, manifest);
        var loadCount = (manifest._sheet_loading_rows || []).length;
        if (!loadCount) {
          throw new Error(
            "No in-container bags found for this FCL. Check Bags Status → Into container."
          );
        }
        busy.close();
        await CIS.showContainerSheetPreview(manifest, "documentation");
      } catch (e) {
        busy.close();
        var msg = e.message || String(e);
        setSheetActionMsg("Could not open preview: " + msg);
      } finally {
        if (sheetContainerId) {
          sheetBtnPreview.disabled = false;
          sheetBtnPreview.textContent = prevBtnLabel;
        }
      }
    });

    /* —— EUDR shipment selection —— */
    var eudrSection = ui.el("section", { class: "td-doc-section td-doc-section--eudr" });
    eudrSection.appendChild(
      ui.el("h3", { class: "ct-containers-section-title" }, ["EUDR shipment pack"])
    );
    eudrSection.appendChild(
      ui.el("p", { class: "muted" }, [
        "Select all containers in the same order/shipment. Use the ",
        ui.el("strong", {}, ["booking ref"]),
        " from Containers setup, or tick individual FCLs. Generation follows the Carbo EUDR due diligence Word template and the accompanying location Excel layout.",
      ])
    );

    var modeBooking = ui.el("input", { type: "radio", name: "td-eudr-mode", value: "booking" });
    modeBooking.checked = true;
    var modePick = ui.el("input", { type: "radio", name: "td-eudr-mode", value: "pick" });
    var modeRow = ui.el("div", { class: "td-doc-mode-row" });
    modeRow.appendChild(
      ui.el("label", { class: "td-doc-radio" }, [modeBooking, " By booking / order ref"])
    );
    modeRow.appendChild(
      ui.el("label", { class: "td-doc-radio" }, [modePick, " Select containers"])
    );
    eudrSection.appendChild(modeRow);

    var bookingSelect = ui.el("select", { class: "td-doc-select td-doc-booking-select" });
    bookingSelect.appendChild(
      ui.el("option", { value: "" }, ["Choose saved booking ref…"])
    );
    var bookingInput = ui.el("input", {
      type: "text",
      class: "td-doc-booking-input",
      placeholder: "e.g. EBKG19038595",
      autocomplete: "off",
    });
    eudrSection.appendChild(
      ui.el("label", { class: "ct-field td-doc-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Saved booking refs"]),
        bookingSelect,
      ])
    );
    var bookingField = ui.el("label", { class: "ct-field td-doc-field td-doc-booking-field" }, [
      ui.el("span", { class: "ct-field-label" }, ["Booking ref (or type below)"]),
      bookingInput,
    ]);
    eudrSection.appendChild(bookingField);

    function getBookingRef() {
      return String(bookingInput.value || "").trim();
    }

    function eudrResolvedContainers() {
      if (eudrMode === "booking") {
        return containersForBooking(getBookingRef());
      }
      return containers.filter(function (c) {
        return !!eudrSelectedIds[c.id];
      });
    }

    var pickList = ui.el("div", { class: "td-doc-pick-list hidden" });
    eudrSection.appendChild(pickList);

    var eudrPreview = ui.el("div", { class: "td-doc-preview td-doc-eudr-preview muted" }, [
      "Select containers for the shipment.",
    ]);
    eudrSection.appendChild(eudrPreview);

    function docActionRow(label, pdfBtn, printBtn) {
      var row = ui.el("div", { class: "td-doc-doc-row" });
      row.appendChild(ui.el("span", { class: "td-doc-doc-label" }, [label]));
      var actions = ui.el("div", { class: "td-doc-sheet-actions" });
      actions.appendChild(pdfBtn);
      actions.appendChild(printBtn);
      row.appendChild(actions);
      return row;
    }

    var btnDdsPdf = ui.el("button", {
      class: "btn btn-sm td-doc-eudr-btn",
      type: "button",
    }, ["Download PDF"]);
    var btnDdsPrint = ui.el("button", {
      class: "btn btn-sm td-doc-eudr-btn",
      type: "button",
    }, ["Print"]);
    var btnLocationPdf = ui.el("button", {
      id: "td-doc-location-sheet-pdf",
      class: "btn btn-sm td-doc-eudr-btn",
      type: "button",
    }, ["Download PDF"]);
    var btnLocationPrint = ui.el("button", {
      id: "td-doc-location-sheet-print",
      class: "btn btn-sm td-doc-eudr-btn",
      type: "button",
    }, ["Print"]);
    var btnLocationCsv = ui.el("button", {
      class: "btn btn-sm td-doc-eudr-btn",
      type: "button",
    }, ["Download CSV"]);
    var btnGeo = ui.el("button", {
      class: "btn btn-sm td-doc-eudr-btn",
      type: "button",
    }, ["Download GeoJSON zip"]);

    var eudrActions = ui.el("div", { class: "td-doc-eudr-actions" });
    eudrActions.appendChild(
      docActionRow("Due diligence statement", btnDdsPdf, btnDdsPrint)
    );
    eudrActions.appendChild(
      docActionRow("Accompanying location sheet", btnLocationPdf, btnLocationPrint)
    );
    var locationSheetMsg = ui.el("p", {
      id: "td-doc-location-sheet-msg",
      class: "error-box td-doc-sheet-action-msg td-doc-action-error--hidden",
    }, [""]);
    eudrActions.appendChild(locationSheetMsg);

    function setLocationSheetMsg(text) {
      locationSheetMsg.textContent = text || "";
      if (text) {
        locationSheetMsg.classList.remove("td-doc-action-error--hidden");
        locationSheetMsg.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else {
        locationSheetMsg.classList.add("td-doc-action-error--hidden");
      }
    }

    var csvRow = ui.el("div", { class: "td-doc-doc-row" });
    csvRow.appendChild(
      ui.el("span", { class: "td-doc-doc-label" }, ["Location sheet (CSV)"])
    );
    var csvActions = ui.el("div", { class: "td-doc-sheet-actions" });
    csvActions.appendChild(btnLocationCsv);
    csvRow.appendChild(csvActions);
    eudrActions.appendChild(csvRow);
    var geoRow = ui.el("div", { class: "td-doc-doc-row" });
    geoRow.appendChild(
      ui.el("span", { class: "td-doc-doc-label" }, ["GeoJSON bundle (optional)"])
    );
    var geoActions = ui.el("div", { class: "td-doc-sheet-actions" });
    geoActions.appendChild(btnGeo);
    geoRow.appendChild(geoActions);
    eudrActions.appendChild(geoRow);
    eudrSection.appendChild(eudrActions);

    var eudrDocButtons = [
      btnDdsPdf,
      btnDdsPrint,
      btnLocationPdf,
      btnLocationPrint,
      btnLocationCsv,
      btnGeo,
    ];
    var eudrActionError = ui.el("p", { class: "error-box td-doc-action-error td-doc-action-error--hidden" }, [""]);
    eudrSection.appendChild(eudrActionError);
    var eudrPackNote = ui.el("p", { class: "muted td-doc-phase-note" }, [""]);
    eudrSection.appendChild(eudrPackNote);
    container.appendChild(eudrSection);

    var cachedPack = null;
    var cachedPackKey = "";
    var packPrefetchTimer = null;
    var packPrefetchGen = 0;
    var packLoading = false;

    function setEudrMode(mode) {
      eudrMode = mode;
      cachedPack = null;
      cachedPackKey = "";
      bookingField.classList.toggle("hidden", mode !== "booking");
      pickList.classList.toggle("hidden", mode !== "pick");
      paintEudrPreview();
    }

    modeBooking.addEventListener("change", function () {
      if (modeBooking.checked) setEudrMode("booking");
    });
    modePick.addEventListener("change", function () {
      if (modePick.checked) setEudrMode("pick");
    });
    function syncBookingSelectFromInput() {
      var ref = getBookingRef();
      var key = normBooking(ref);
      var match = "";
      uniqueBookingRefs(containers).forEach(function (r) {
        if (normBooking(r) === key) match = r;
      });
      bookingSelect.value = match || "";
    }

    function clearEudrActionError() {
      eudrActionError.textContent = "";
      eudrActionError.classList.add("td-doc-action-error--hidden");
    }

    function showEudrActionError(msg) {
      eudrActionError.textContent = msg;
      if (msg) {
        eudrActionError.classList.remove("td-doc-action-error--hidden");
        eudrActionError.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else {
        eudrActionError.classList.add("td-doc-action-error--hidden");
      }
    }

    function eudrShipmentCanGenerate() {
      return eudrResolvedContainers().length > 0 && !!eudrSelectionBody();
    }

    function eudrActionsDisabledReason() {
      if (eudrShipmentCanGenerate()) return "";
      if (eudrMode === "booking") {
        var ref = getBookingRef();
        if (!ref) {
          return "Choose or type a booking ref that matches containers in Traceability.";
        }
        return (
          "No containers use booking ref " +
          ref +
          ". Set the same ref on each FCL in Containers, then reopen this screen."
        );
      }
      return "Select at least one container for this shipment.";
    }

    /** DOM disabled only when shipment selection cannot run — not when prefetch is loading or failed. */
    function syncEudrActionButtons(opts) {
      opts = opts || {};
      var canRun = eudrShipmentCanGenerate();
      var why = eudrActionsDisabledReason();
      eudrDocButtons.forEach(function (b) {
        b.disabled = !canRun;
        if (canRun) {
          b.removeAttribute("aria-disabled");
          b.removeAttribute("title");
        } else {
          b.setAttribute("aria-disabled", "true");
          if (why) b.title = why;
          else b.removeAttribute("title");
        }
      });
      if (!canRun) return;
      if (opts.skipPrefetch) {
        if (cachedPack && cachedPackKey === JSON.stringify(eudrSelectionBody())) {
          paintEudrPackNote(cachedPack);
        }
        return;
      }
      if (cachedPack && cachedPackKey === JSON.stringify(eudrSelectionBody())) {
        paintEudrPackNote(cachedPack);
      } else if (!packLoading) {
        schedulePackPrefetch();
      }
    }

    function schedulePackPrefetch() {
      if (packPrefetchTimer) clearTimeout(packPrefetchTimer);
      packPrefetchTimer = setTimeout(function () {
        prefetchEudrPack();
      }, 350);
    }

    async function prefetchEudrPack() {
      if (!eudrResolvedContainers().length) {
        eudrPackNote.textContent = "";
        return;
      }
      if (!eudrSelectionBody()) return;
      var gen = ++packPrefetchGen;
      packLoading = true;
      eudrPackNote.textContent = "Loading shipment data from Traceability…";
      try {
        var pack = await fetchEudrPack(true);
        if (gen !== packPrefetchGen) return;
        paintEudrPackNote(pack);
        eudrPackNote.textContent =
          (eudrPackNote.textContent || "") + " Document buttons are ready.";
        clearEudrActionError();
      } catch (e) {
        if (gen !== packPrefetchGen) return;
        var msg = CIS.traceabilityApiErrorMessage
          ? CIS.traceabilityApiErrorMessage(e)
          : e.message || String(e);
        eudrPackNote.textContent = "";
        showEudrActionError("Could not load EUDR pack: " + msg);
      } finally {
        if (gen === packPrefetchGen) {
          packLoading = false;
          syncEudrActionButtons({ skipPrefetch: true });
        }
      }
    }

    function onBookingRefChanged() {
      cachedPack = null;
      cachedPackKey = "";
      clearEudrActionError();
      syncBookingSelectFromInput();
      paintEudrPreview();
      schedulePackPrefetch();
    }

    bookingSelect.addEventListener("change", function () {
      if (bookingSelect.value) {
        bookingInput.value = bookingSelect.value;
      }
      onBookingRefChanged();
    });
    bookingInput.addEventListener("input", onBookingRefChanged);
    bookingInput.addEventListener("change", onBookingRefChanged);

    function eudrSelectionBody() {
      if (eudrMode === "booking") {
        var ref = bookingInput.value.trim();
        if (!ref) return null;
        return { booking_ref: ref };
      }
      var ids = Object.keys(eudrSelectedIds);
      if (!ids.length) return null;
      return { container_ids: ids };
    }

    async function fetchEudrPack(forceRefresh) {
      var body = eudrSelectionBody();
      if (!body) {
        throw new Error("Select a booking ref or at least one container.");
      }
      var key = JSON.stringify(body);
      if (!forceRefresh && cachedPack && cachedPackKey === key) {
        return cachedPack;
      }
      var pack = await ctx.api.traceability("/containers/eudr-documentation-pack", {
        method: "POST",
        body: body,
      });
      cachedPack = pack;
      cachedPackKey = key;
      return pack;
    }

    function paintEudrPackNote(pack) {
      if (!pack) {
        eudrPackNote.textContent = "";
        return;
      }
      var parts = [];
      var ship = pack.shipment || {};
      parts.push(
        "Loaded reconciliation: " +
          fmt(ship.total_bags) +
          " bags, " +
          fmt(ship.net_mass_kg) +
          " kg net across " +
          fmt(ship.container_count) +
          " container(s)."
      );
      if (pack.registry_error) {
        parts.push("Registry: " + pack.registry_error);
      }
      var gaps = pack.missing_farm_information || [];
      if (gaps.length) {
        parts.push(
          gaps.length +
            " producer/farm row(s) with gaps (shown on printed documents — not omitted)."
        );
      }
      if (pack.geojson_bundle_available === false) {
        parts.push("Optional polygon GeoJSON zip is not configured on the server.");
      }
      eudrPackNote.textContent = parts.join(" ");
    }

    function paintBookingSelect() {
      var prev = bookingSelect.value;
      while (bookingSelect.options.length > 1) bookingSelect.remove(1);
      uniqueBookingRefs(containers).forEach(function (r) {
        bookingSelect.appendChild(ui.el("option", { value: r }, [r]));
      });
      if (prev && uniqueBookingRefs(containers).indexOf(prev) >= 0) {
        bookingSelect.value = prev;
      } else {
        syncBookingSelectFromInput();
      }
    }

    function paintEudrPickList() {
      pickList.innerHTML = "";
      var list = visibleList();
      if (!list.length) {
        pickList.appendChild(ui.el("p", { class: "muted" }, ["No containers to select."]));
        return;
      }
      list.forEach(function (c) {
        var cb = ui.el("input", { type: "checkbox", value: c.id });
        cb.checked = !!eudrSelectedIds[c.id];
        cb.addEventListener("change", function () {
          if (cb.checked) eudrSelectedIds[c.id] = true;
          else delete eudrSelectedIds[c.id];
          cachedPack = null;
          cachedPackKey = "";
          paintEudrPreview();
          schedulePackPrefetch();
        });
        pickList.appendChild(
          ui.el("label", { class: "td-doc-check-row" }, [
            cb,
            " ",
            c.container_number,
            " · ",
            c.booking_ref || "no booking",
            " · ",
            fmt(c.loaded_bags),
            " loaded",
          ])
        );
      });
    }

    function paintEudrPreview() {
      var list = eudrResolvedContainers();
      if (!list.length) {
        if (eudrMode === "booking" && getBookingRef()) {
          eudrPreview.innerHTML = "";
          eudrPreview.className = "td-doc-preview td-doc-eudr-preview";
          eudrPreview.appendChild(
            ui.el("p", { class: "error-box" }, [
              "No containers use booking ref ",
              ui.el("strong", {}, [getBookingRef()]),
              ". Set the same ref on each FCL in ",
              ui.el("strong", {}, ["Containers"]),
              " (Set booking ref), then reopen this screen.",
            ])
          );
        } else {
          eudrPreview.textContent =
            eudrMode === "booking"
              ? "Choose a saved booking or type a ref — matching containers appear below."
              : "Select containers for the shipment.";
          eudrPreview.className = "td-doc-preview td-doc-eudr-preview muted";
        }
        syncEudrActionButtons({ skipPrefetch: true });
        eudrPackNote.textContent = "";
        return;
      }
      eudrPreview.innerHTML = "";
      eudrPreview.className = "td-doc-preview td-doc-eudr-preview";
      eudrPreview.appendChild(
        ui.el("p", {}, [
          ui.el("strong", {}, [String(list.length)]),
          list.length === 1 ? " container" : " containers",
          " in this shipment:",
        ])
      );
      var ul = ui.el("ul", { class: "td-doc-shipment-list" });
      list.forEach(function (c) {
        ul.appendChild(
          ui.el("li", {}, [
            c.container_number,
            " — ",
            STATUS_LABEL[c.status] || c.status,
            ", ",
            fmt(c.loaded_bags),
            " bags",
            c.ship_to ? ", to " + c.ship_to : "",
          ])
        );
      });
      eudrPreview.appendChild(ul);
      eudrPreview.appendChild(
        ui.el("p", { class: "muted" }, [
          "Print ",
          list.length,
          " container sheet(s) above for logistics. EUDR documents below use the same selected set.",
        ])
      );
      syncEudrActionButtons();
    }

    function formatEudrError(e) {
      return CIS.traceabilityApiErrorMessage
        ? CIS.traceabilityApiErrorMessage(e)
        : e.message || String(e);
    }

    async function withEudrPack(run, activeBtn) {
      if (!eudrResolvedContainers().length) {
        showEudrActionError("Choose a booking or containers for this shipment first.");
        return;
      }
      clearEudrActionError();
      setStatus("Building documentation pack…", false);
      var prevLabel = activeBtn ? activeBtn.textContent : "";
      if (activeBtn) activeBtn.textContent = "Loading…";
      try {
        var pack = cachedPack;
        if (!pack || cachedPackKey !== JSON.stringify(eudrSelectionBody())) {
          pack = await fetchEudrPack(false);
        }
        paintEudrPackNote(pack);
        var result = run(pack);
        if (result && typeof result.then === "function") {
          await result;
        }
        setStatus("", false);
        clearEudrActionError();
      } catch (e) {
        var msg = formatEudrError(e);
        setStatus(msg, true);
        showEudrActionError("Could not build EUDR pack: " + msg);
      } finally {
        if (activeBtn) activeBtn.textContent = prevLabel;
      }
    }

    function invokeEudrPack(run, activeBtn) {
      void withEudrPack(run, activeBtn).catch(function (e) {
        showEudrActionError("Unexpected error: " + formatEudrError(e));
      });
    }

    function wireEudrPdfPrint(pdfBtn, printBtn, downloadFn, previewFn, label) {
      pdfBtn.addEventListener("click", function () {
        invokeEudrPack(function (pack) {
          if (!downloadFn) throw new Error("EUDR render module not loaded.");
          return downloadFn(pack).then(function (out) {
            if (!out || !out.ok) throw new Error(label + " PDF was not created.");
            setStatus("Downloaded " + (out.filename || "PDF") + ".", false);
          });
        }, pdfBtn);
      });
      printBtn.addEventListener("click", function () {
        invokeEudrPack(function (pack) {
          if (!previewFn) throw new Error("EUDR render module not loaded.");
          return previewFn(pack);
        }, printBtn);
      });
    }

    /** Same flow as container load sheet: modal while loading, then preview or PDF. */
    async function fetchLocationSheetPack(busy) {
      if (!eudrShipmentCanGenerate()) {
        var why = eudrActionsDisabledReason() || "Select a booking ref or containers first.";
        throw new Error(why);
      }
      if (!CIS.buildEudrLocationSheetHtml || !CIS.showEudrLocationSheetPreview) {
        throw new Error("EUDR location sheet module not loaded — hard-refresh CIS (Ctrl+F5).");
      }
      var bodyKey = JSON.stringify(eudrSelectionBody());
      if (cachedPack && cachedPackKey === bodyKey) {
        return cachedPack;
      }
      if (busy) busy.setMessage("Loading shipment data from Traceability…");
      var pack = await fetchEudrPack(false);
      paintEudrPackNote(pack);
      if (!pack || !(pack.containers || []).length) {
        throw new Error("Documentation pack returned no container data for this shipment.");
      }
      return pack;
    }

    wireEudrPdfPrint(
      btnDdsPdf,
      btnDdsPrint,
      CIS.downloadEudrDueDiligencePdf,
      CIS.showEudrDueDiligencePreview,
      "Due diligence"
    );

    btnLocationPdf.addEventListener("click", async function () {
      setLocationSheetMsg("");
      clearEudrActionError();
      var prevLabel = btnLocationPdf.textContent;
      btnLocationPdf.disabled = true;
      btnLocationPrint.disabled = true;
      btnLocationPdf.textContent = "Loading…";
      var busy = showSheetLoadingModal("Preparing accompanying location sheet…");
      try {
        var packPdf = await fetchLocationSheetPack(busy);
        busy.setMessage("Generating PDF…");
        if (!CIS.downloadEudrLocationSheetPdf) {
          throw new Error("PDF export is not available — hard-refresh CIS (Ctrl+F5).");
        }
        var out = await CIS.downloadEudrLocationSheetPdf(packPdf);
        if (!out || !out.ok) {
          throw new Error("Location sheet PDF was not created.");
        }
        setStatus("Downloaded " + (out.filename || "PDF") + ".", false);
        clearEudrActionError();
      } catch (e) {
        var msgPdf = formatEudrError(e);
        setLocationSheetMsg("Location sheet PDF failed: " + msgPdf);
        showEudrActionError(msgPdf);
        setStatus(msgPdf, true);
      } finally {
        busy.close();
        btnLocationPdf.textContent = prevLabel;
        syncEudrActionButtons({ skipPrefetch: true });
      }
    });

    btnLocationPrint.addEventListener("click", async function () {
      setLocationSheetMsg("");
      clearEudrActionError();
      var prevPrintLabel = btnLocationPrint.textContent;
      btnLocationPdf.disabled = true;
      btnLocationPrint.disabled = true;
      btnLocationPrint.textContent = "Loading…";
      var busyPrint = showSheetLoadingModal("Preparing accompanying location sheet…");
      try {
        var packPrint = await fetchLocationSheetPack(busyPrint);
        busyPrint.close();
        await CIS.showEudrLocationSheetPreview(packPrint, { autoPrintAfterLoad: true });
        clearEudrActionError();
      } catch (e) {
        var msgPrint = formatEudrError(e);
        setLocationSheetMsg("Location sheet print failed: " + msgPrint);
        showEudrActionError(msgPrint);
        setStatus(msgPrint, true);
      } finally {
        busyPrint.close();
        btnLocationPrint.textContent = prevPrintLabel;
        syncEudrActionButtons({ skipPrefetch: true });
      }
    });

    btnLocationCsv.addEventListener("click", function () {
      invokeEudrPack(function (pack) {
        if (!CIS.downloadEudrLocationSheetCsv) {
          throw new Error("EUDR render module not loaded.");
        }
        var out = CIS.downloadEudrLocationSheetCsv(pack);
        if (!out || !out.ok) throw new Error("CSV was not created.");
        setStatus("Downloaded " + (out.filename || "CSV") + ".", false);
      }, btnLocationCsv);
    });

    btnGeo.addEventListener("click", function () {
      var body = eudrSelectionBody();
      if (!body) return;
      if (!eudrResolvedContainers().length) {
        showEudrActionError("Choose a booking or containers for this shipment first.");
        return;
      }
      setStatus("Preparing GeoJSON bundle…", false);
      (CIS.downloadEudrGeojsonZip
        ? CIS.downloadEudrGeojsonZip(ctx, body)
        : Promise.reject(new Error("EUDR render module not loaded."))
      )
        .then(function (meta) {
          var msg = "GeoJSON zip downloaded.";
          if (meta && meta.missing > 0) {
            msg += " " + meta.missing + " farm file(s) missing — see MISSING_GEOJSON.txt in the zip.";
          }
          setStatus(msg, false);
          return fetchEudrPack(true);
        })
        .then(function (pack) {
          if (pack) paintEudrPackNote(pack);
        })
        .catch(function (e) {
          var msg = formatEudrError(e);
          setStatus(msg, true);
          showEudrActionError(msg);
        })
        .finally(function () {
          setStatus("", false);
        });
    });

    async function loadContainers() {
      setStatus("Loading containers…", false);
      try {
        var data = await ctx.api.traceability("/containers");
        containers = (data && data.containers) || [];
        containers.sort(function (a, b) {
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
        paintBookingSelect();
        paintSheetSelect();
        paintEudrPickList();
        paintEudrPreview();
        setStatus("", false);
      } catch (e) {
        setStatus("Could not load containers: " + (e.message || e), true);
      }
    }

    await loadContainers();
  }

  CIS.modules.push({
    id: "traceability_documentation",
    title: "Traceability Documentation",
    section: "Production",
    kind: "lookup",
    order: 18,
    icon: "traceability",
    description: "Container load sheets and EUDR documentation packages",
    requires: "traceability.containers",
    render: render,
  });
})();
