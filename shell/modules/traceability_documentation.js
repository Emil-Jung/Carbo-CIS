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

    /* —— Container sheet (one FCL) —— */
    var sheetSection = ui.el("section", { class: "td-doc-section" });
    sheetSection.appendChild(
      ui.el("h3", { class: "ct-containers-section-title" }, ["Container sheet"])
    );
    sheetSection.appendChild(
      ui.el("p", { class: "muted" }, [
        "Standard load manifest for one container (NR · supplier · weight, booking and shipping header). ",
        "Print one sheet per physical container.",
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
    var sheetBtn = ui.el("button", {
      class: "btn",
      type: "button",
      disabled: "disabled",
    }, ["Generate container sheet"]);
    sheetSection.appendChild(sheetBtn);
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
        sheetBtn.disabled = true;
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
      sheetBtn.disabled = false;
    }

    sheetSelect.addEventListener("change", function () {
      sheetContainerId = sheetSelect.value;
      paintSheetPreview();
    });

    sheetBtn.addEventListener("click", async function () {
      if (!sheetContainerId) return;
      setStatus("Loading manifest…", false);
      sheetBtn.disabled = true;
      try {
        var manifest = await ctx.api.traceability(
          "/containers/" + encodeURIComponent(sheetContainerId) + "/manifest"
        );
        if (CIS.openContainerManifestPrintDialog) {
          CIS.openContainerManifestPrintDialog(manifest, "documentation");
        } else if (CIS.printContainerManifest) {
          CIS.printContainerManifest(manifest, "documentation");
        } else {
          setStatus("Print module not loaded.", true);
        }
        setStatus("", false);
      } catch (e) {
        setStatus("Could not load manifest: " + (e.message || e), true);
      } finally {
        sheetBtn.disabled = !sheetContainerId;
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

    var pickList = ui.el("div", { class: "td-doc-pick-list hidden" });
    eudrSection.appendChild(pickList);

    var eudrPreview = ui.el("div", { class: "td-doc-preview td-doc-eudr-preview muted" }, [
      "Select containers for the shipment.",
    ]);
    eudrSection.appendChild(eudrPreview);

    var eudrActions = ui.el("div", { class: "td-doc-eudr-actions" });
    var btnDds = ui.el("button", {
      class: "btn btn-sm",
      type: "button",
      disabled: true,
    }, ["Due diligence statement"]);
    var btnLocation = ui.el("button", {
      class: "btn btn-sm",
      type: "button",
      disabled: true,
    }, ["Accompanying location sheet"]);
    var btnLocationCsv = ui.el("button", {
      class: "btn btn-sm",
      type: "button",
      disabled: true,
    }, ["Location sheet (CSV)"]);
    var btnGeo = ui.el("button", {
      class: "btn btn-sm",
      type: "button",
      disabled: true,
    }, ["GeoJSON bundle (optional)"]);
    eudrActions.appendChild(btnDds);
    eudrActions.appendChild(btnLocation);
    eudrActions.appendChild(btnLocationCsv);
    eudrActions.appendChild(btnGeo);
    eudrSection.appendChild(eudrActions);
    var eudrActionError = ui.el("p", { class: "error-box td-doc-action-error", hidden: true }, [""]);
    eudrSection.appendChild(eudrActionError);
    var eudrPackNote = ui.el("p", { class: "muted td-doc-phase-note" }, [""]);
    eudrSection.appendChild(eudrPackNote);
    container.appendChild(eudrSection);

    var cachedPack = null;
    var cachedPackKey = "";

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
      eudrActionError.hidden = true;
      eudrActionError.textContent = "";
    }

    function showEudrActionError(msg) {
      eudrActionError.textContent = msg;
      eudrActionError.hidden = !msg;
      if (msg) eudrActionError.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    function onBookingRefChanged() {
      cachedPack = null;
      cachedPackKey = "";
      clearEudrActionError();
      syncBookingSelectFromInput();
      paintEudrPreview();
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
        btnDds.disabled = true;
        btnLocation.disabled = true;
        btnLocationCsv.disabled = true;
        btnGeo.disabled = true;
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
      btnDds.disabled = false;
      btnLocation.disabled = false;
      btnLocationCsv.disabled = false;
      btnGeo.disabled = false;
      if (cachedPack && cachedPackKey === JSON.stringify(eudrSelectionBody())) {
        paintEudrPackNote(cachedPack);
      } else {
        eudrPackNote.textContent = "";
      }
    }

    async function withEudrPack(run, activeBtn) {
      clearEudrActionError();
      setStatus("Building documentation pack…", false);
      var buttons = [btnDds, btnLocation, btnLocationCsv, btnGeo];
      var prevLabels = buttons.map(function (b) { return b.textContent; });
      buttons.forEach(function (b) {
        b.disabled = true;
      });
      if (activeBtn) activeBtn.textContent = "Loading…";
      try {
        var pack = await fetchEudrPack(false);
        paintEudrPackNote(pack);
        await run(pack);
        setStatus("", false);
        clearEudrActionError();
      } catch (e) {
        var msg = CIS.traceabilityApiErrorMessage
          ? CIS.traceabilityApiErrorMessage(e)
          : e.message || String(e);
        setStatus(msg, true);
        showEudrActionError("Could not build EUDR pack: " + msg);
      } finally {
        buttons.forEach(function (b, i) {
          b.textContent = prevLabels[i];
        });
        paintEudrPreview();
      }
    }

    btnDds.addEventListener("click", function () {
      withEudrPack(function (pack) {
        if (CIS.openEudrDueDiligenceDialog) {
          CIS.openEudrDueDiligenceDialog(pack);
        } else if (CIS.printEudrDueDiligence) {
          CIS.printEudrDueDiligence(pack, {});
        } else {
          setStatus("EUDR render module not loaded.", true);
        }
      }, btnDds);
    });

    btnLocation.addEventListener("click", function () {
      withEudrPack(function (pack) {
        if (CIS.printEudrLocationSheet) CIS.printEudrLocationSheet(pack);
        else setStatus("EUDR render module not loaded.", true);
      }, btnLocation);
    });

    btnLocationCsv.addEventListener("click", function () {
      withEudrPack(function (pack) {
        if (CIS.downloadEudrLocationSheetCsv) CIS.downloadEudrLocationSheetCsv(pack);
        else setStatus("EUDR render module not loaded.", true);
      }, btnLocationCsv);
    });

    btnGeo.addEventListener("click", function () {
      var body = eudrSelectionBody();
      if (!body) return;
      setStatus("Preparing GeoJSON bundle…", false);
      btnGeo.disabled = true;
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
          var msg = CIS.traceabilityApiErrorMessage
            ? CIS.traceabilityApiErrorMessage(e)
            : e.message || String(e);
          setStatus(msg, true);
        })
        .finally(function () {
          btnGeo.disabled = !eudrResolvedContainers().length;
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
