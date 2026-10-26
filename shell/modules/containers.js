/* Containers — preload booked containers so the Walvis Bay yard can load against them (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var LOCATIONS = [
    { value: "walvisbay", label: "Walvisbay" },
    { value: "agl", label: "AGL" },
  ];

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

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-GB", {
        timeZone: "Africa/Windhoek",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return "—";
    }
  }

  function fmtShipDate(isoDate) {
    if (!isoDate) return "—";
    try {
      var parts = String(isoDate).split("-");
      if (parts.length !== 3) return isoDate;
      var d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch (e) {
      return isoDate;
    }
  }

  function progressText(c) {
    return fmt(c.loaded_bags) + " / " + fmt(c.target_bag_count);
  }

  /** Yard loading started (first pallet), not planned ship date or per-pallet dates. */
  function fmtContainerLoadingDate(c) {
    if (c.first_loaded_at) return fmtDate(c.first_loaded_at);
    return fmtShipDate(c.load_date || c.expected_ship_date);
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var rows = [];
    var showClosed = false;

    container.className = "module-content ct-containers-host";
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Containers"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Preload containers from the booking (ship date and bag target). ",
        ui.el("strong", {}, ["Release for loading"]),
        " activates Bag Walk ",
        ui.el("strong", {}, ["Into container"]),
        " when a released booking exists (any coast storage or in-transit bag that may load per status rules). ",
        "Set ",
        ui.el("strong", {}, ["Booking ref"]),
        " when preloading, or later with ",
        ui.el("strong", {}, ["Set booking ref"]),
        " on an existing row (including after loading is closed or shipped) so ",
        ui.el("strong", {}, ["Traceability Documentation"]),
        " can pick all containers in one booking.",
      ])
    );

    var productOptions = [];

    var addSection = ui.el("section", { class: "ct-containers-add-section" });
    addSection.appendChild(
      ui.el("h3", { class: "ct-containers-section-title" }, ["Add container booking"])
    );
    addSection.appendChild(
      ui.el("p", { class: "muted ct-containers-section-desc" }, [
        "Create a new preload row — this does not load bags. Release for loading when the yard may scan Into container.",
      ])
    );

    var form = ui.el("form", { class: "toolbar ct-form ct-form--container-booking" });
    var numberInput = ui.el("input", {
      type: "text",
      placeholder: "Office / booking container ref",
      required: "required",
      autocomplete: "off",
    });
    var fclInput = ui.el("input", {
      type: "text",
      placeholder: "Physical FCL, e.g. MSCU1234567 (optional)",
      autocomplete: "off",
    });
    var countInput = ui.el("input", {
      type: "number",
      min: "1",
      step: "1",
      placeholder: "Bags",
      required: "required",
    });
    var locationSelect = ui.el("select", {});
    LOCATIONS.forEach(function (loc) {
      locationSelect.appendChild(ui.el("option", { value: loc.value }, [loc.label]));
    });
    var loadDateInput = ui.el("input", { type: "date", required: "required", autocomplete: "off" });
    var productSelect = ui.el("select", { required: "required" });
    productSelect.appendChild(ui.el("option", { value: "" }, ["Loading products…"]));
    var shipToInput = ui.el("input", { type: "text", autocomplete: "off" });
    var deliveryNoteInput = ui.el("input", { type: "text", autocomplete: "off" });
    var transporterInput = ui.el("input", { type: "text", autocomplete: "off" });
    var shipNameInput = ui.el("input", { type: "text", autocomplete: "off" });
    var bookingInput = ui.el("input", { type: "text", placeholder: "Booking ref (optional)", autocomplete: "off" });
    var shipDateInput = ui.el("input", { type: "date", autocomplete: "off" });

    function labelled(text, control) {
      return ui.el("label", { class: "ct-field" }, [
        ui.el("span", { class: "ct-field-label" }, [text]),
        control,
      ]);
    }

    form.appendChild(labelled("Container number", numberInput));
    form.appendChild(labelled("FCL number", fclInput));
    form.appendChild(labelled("Load date", loadDateInput));
    form.appendChild(labelled("Product", productSelect));
    form.appendChild(labelled("Bags when full", countInput));
    form.appendChild(labelled("Yard", locationSelect));
    form.appendChild(labelled("Consignee", shipToInput));
    form.appendChild(labelled("Delivery note", deliveryNoteInput));
    form.appendChild(labelled("Shipping line", transporterInput));
    form.appendChild(labelled("Ship's name", shipNameInput));
    form.appendChild(labelled("Expected ship date", shipDateInput));
    form.appendChild(labelled("Booking ref", bookingInput));
    form.appendChild(ui.el("button", { class: "btn", type: "submit" }, ["Add container"]));
    addSection.appendChild(form);

    var status = ui.el("p", { class: "muted ct-containers-add-status" }, [""]);
    addSection.appendChild(status);
    container.appendChild(addSection);

    var listSection = ui.el("section", { class: "ct-containers-list-section" });
    listSection.appendChild(
      ui.el("h3", { class: "ct-containers-section-title" }, ["Booked containers"])
    );

    var toggle = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Show shipped and cancelled"]);
    toggle.addEventListener("click", function () {
      showClosed = !showClosed;
      toggle.textContent = showClosed
        ? "Hide shipped and cancelled"
        : "Show shipped and cancelled";
      paint();
    });
    listSection.appendChild(toggle);

    var body = ui.el("div", { class: "ct-containers-list-body" });
    listSection.appendChild(body);
    container.appendChild(listSection);

    function setStatus(text, isError) {
      status.textContent = text || "";
      status.className = isError ? "error-box" : "muted";
    }

    function fillProductSelect() {
      productSelect.innerHTML = "";
      productSelect.appendChild(ui.el("option", { value: "" }, ["Choose product…"]));
      productOptions.forEach(function (opt) {
        var o = ui.el("option", { value: opt.key }, [opt.label || opt.key]);
        o.dataset.label = opt.label || opt.key;
        productSelect.appendChild(o);
      });
    }

    async function loadOptions() {
      try {
        var prod = await ctx.api.traceability("/containers/product-options");
        productOptions = [];
        (prod.bulk || []).forEach(function (o) {
          productOptions.push(o);
        });
        (prod.pallets || []).forEach(function (o) {
          productOptions.push(o);
        });
        fillProductSelect();
      } catch (e) {
        setStatus("Could not load product options: " + (e.message || e), true);
      }
    }

    function confirmContainerAction(title, detail) {
      return window.confirm(title + "\n\n" + detail + "\n\nContinue?");
    }

    function openBookingRefOnlyDialog(containerRow, onSaved) {
      var backdrop = ui.el("div", { class: "modal-backdrop cm-print-dialog-backdrop" });
      var dialog = ui.el("div", { class: "modal cm-print-dialog" });
      dialog.appendChild(
        ui.el("h3", { class: "cm-print-dialog-title" }, [
          "Booking ref — " + containerRow.container_number,
        ])
      );
      dialog.appendChild(
        ui.el("p", { class: "muted" }, [
          "Shipped containers cannot be edited here except booking ref (EUDR / documentation by booking).",
        ])
      );
      var bookingInput = ui.el("input", {
        type: "text",
        placeholder: "e.g. EBKG19038595",
        autocomplete: "off",
        value: containerRow.booking_ref || "",
      });
      var lab = ui.el("label", { class: "ct-field cm-print-field" });
      lab.appendChild(ui.el("span", { class: "ct-field-label" }, ["Booking ref"]));
      lab.appendChild(bookingInput);
      dialog.appendChild(lab);

      var errEl = ui.el("p", { class: "error-box", hidden: true }, [""]);
      dialog.appendChild(errEl);

      var actions = ui.el("div", { class: "cm-print-dialog-actions" });
      var cancelBtn = ui.el("button", { type: "button", class: "btn btn-sm" }, ["Cancel"]);
      var saveBtn = ui.el("button", { type: "button", class: "btn" }, ["Save"]);
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      dialog.appendChild(actions);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);

      function close() {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }

      cancelBtn.addEventListener("click", close);
      backdrop.addEventListener("click", function (ev) {
        if (ev.target === backdrop) close();
      });

      async function save() {
        errEl.hidden = true;
        saveBtn.disabled = true;
        try {
          await ctx.api.traceability(
            "/containers/" + encodeURIComponent(containerRow.id),
            {
              method: "PATCH",
              body: { booking_ref: bookingInput.value.trim() || null },
            }
          );
          close();
          if (onSaved) await onSaved();
        } catch (e) {
          errEl.textContent = e.message || String(e);
          errEl.hidden = false;
          saveBtn.disabled = false;
        }
      }

      saveBtn.addEventListener("click", function () {
        save();
      });
      bookingInput.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          save();
        }
      });
      bookingInput.focus();
      bookingInput.select();
    }

    function openEditContainerDialog(containerRow, onSaved) {
      var backdrop = ui.el("div", { class: "modal-backdrop cm-print-dialog-backdrop" });
      var dialog = ui.el("div", { class: "modal cm-print-dialog cm-edit-container-dialog" });
      dialog.appendChild(
        ui.el("h3", { class: "cm-print-dialog-title" }, ["Edit container"])
      );
      dialog.appendChild(
        ui.el("p", { class: "muted" }, [
          "Change any fields you need and save — only updated values are sent. Bag assignments and loading history are unchanged.",
        ])
      );

      var numberInput = ui.el("input", {
        type: "text",
        autocomplete: "off",
        value: containerRow.container_number || "",
      });
      var fclInput = ui.el("input", {
        type: "text",
        autocomplete: "off",
        value: containerRow.fcl_number || "",
      });
      var countInput = ui.el("input", {
        type: "number",
        min: "1",
        step: "1",
        value: String(containerRow.target_bag_count || ""),
      });
      var locationSelect = ui.el("select", {});
      LOCATIONS.forEach(function (loc) {
        var opt = ui.el("option", { value: loc.value }, [loc.label]);
        if (containerRow.location === loc.value) opt.selected = true;
        locationSelect.appendChild(opt);
      });
      var loadDateInput = ui.el("input", { type: "date", autocomplete: "off" });
      if (containerRow.load_date) loadDateInput.value = containerRow.load_date;
      var productSelect = ui.el("select", {});
      productSelect.appendChild(ui.el("option", { value: "" }, ["Choose product…"]));
      productOptions.forEach(function (opt) {
        var o = ui.el("option", { value: opt.key }, [opt.label || opt.key]);
        o.dataset.label = opt.label || opt.key;
        if (opt.key === containerRow.product_key) o.selected = true;
        productSelect.appendChild(o);
      });
      var shipToInput = ui.el("input", {
        type: "text",
        autocomplete: "off",
        value: containerRow.ship_to || "",
      });
      var deliveryNoteInput = ui.el("input", {
        type: "text",
        autocomplete: "off",
        value: containerRow.delivery_note || "",
      });
      var transporterInput = ui.el("input", {
        type: "text",
        autocomplete: "off",
        value: containerRow.transporter || "",
      });
      var shipNameInput = ui.el("input", {
        type: "text",
        autocomplete: "off",
        value: containerRow.ship_name || "",
      });
      var bookingInput = ui.el("input", {
        type: "text",
        autocomplete: "off",
        value: containerRow.booking_ref || "",
      });
      var shipDateInput = ui.el("input", { type: "date", autocomplete: "off" });
      if (containerRow.expected_ship_date) shipDateInput.value = containerRow.expected_ship_date;

      function fieldRow(label, control) {
        var lab = ui.el("label", { class: "ct-field cm-print-field" });
        lab.appendChild(ui.el("span", { class: "ct-field-label" }, [label]));
        lab.appendChild(control);
        return lab;
      }

      var formGrid = ui.el("div", { class: "cm-edit-container-grid" });
      formGrid.appendChild(fieldRow("Container number", numberInput));
      formGrid.appendChild(fieldRow("FCL number", fclInput));
      formGrid.appendChild(fieldRow("Booking ref", bookingInput));
      formGrid.appendChild(fieldRow("Consignee", shipToInput));
      formGrid.appendChild(fieldRow("Delivery note", deliveryNoteInput));
      formGrid.appendChild(fieldRow("Shipping line", transporterInput));
      formGrid.appendChild(fieldRow("Ship's name", shipNameInput));
      formGrid.appendChild(fieldRow("Product", productSelect));
      formGrid.appendChild(fieldRow("Bags when full", countInput));
      formGrid.appendChild(fieldRow("Yard", locationSelect));
      formGrid.appendChild(fieldRow("Load date", loadDateInput));
      formGrid.appendChild(fieldRow("Expected ship date", shipDateInput));
      dialog.appendChild(formGrid);

      var errEl = ui.el("p", { class: "error-box", hidden: true }, [""]);
      dialog.appendChild(errEl);

      var actions = ui.el("div", { class: "cm-print-dialog-actions" });
      var cancelBtn = ui.el("button", { type: "button", class: "btn btn-sm" }, ["Cancel"]);
      var saveBtn = ui.el("button", { type: "button", class: "btn" }, ["Save"]);
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      dialog.appendChild(actions);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);

      function close() {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }

      cancelBtn.addEventListener("click", close);
      backdrop.addEventListener("click", function (ev) {
        if (ev.target === backdrop) close();
      });

      function normText(v) {
        if (v == null) return null;
        var t = String(v).trim();
        return t || null;
      }

      function buildEditPatch() {
        var patch = {};
        var number = numberInput.value.trim().toUpperCase();
        var prevNumber = normText(containerRow.container_number);
        if (prevNumber) prevNumber = prevNumber.toUpperCase();
        if (number !== prevNumber) {
          if (!number) {
            return { error: "Container number cannot be cleared — enter the full number or cancel." };
          }
          patch.container_number = number;
        }

        var fcl = fclInput.value.trim().toUpperCase() || null;
        var prevFcl = normText(containerRow.fcl_number);
        if (prevFcl) prevFcl = prevFcl.toUpperCase();
        if (fcl !== prevFcl) patch.fcl_number = fcl;

        var countRaw = countInput.value.trim();
        if (countRaw !== "") {
          var count = parseInt(countRaw, 10);
          if (isNaN(count) || count < 1) {
            return { error: "Bags when full must be a positive number, or leave unchanged." };
          }
          if (count !== Number(containerRow.target_bag_count)) {
            patch.target_bag_count = count;
          }
        }

        if (locationSelect.value !== containerRow.location) {
          patch.location = locationSelect.value;
        }

        var productKey = productSelect.value;
        var prevKey = containerRow.product_key || "";
        if (productKey !== prevKey) {
          patch.product_key = productKey || null;
          if (productKey) {
            var selOpt = productSelect.options[productSelect.selectedIndex];
            patch.product_label =
              (selOpt && (selOpt.dataset.label || selOpt.textContent)) || productKey;
          } else {
            patch.product_label = null;
          }
        }

        var booking = bookingInput.value.trim() || null;
        if (booking !== normText(containerRow.booking_ref)) patch.booking_ref = booking;

        var shipTo = shipToInput.value.trim() || null;
        if (shipTo !== normText(containerRow.ship_to)) patch.ship_to = shipTo;

        var deliveryNote = deliveryNoteInput.value.trim() || null;
        if (deliveryNote !== normText(containerRow.delivery_note)) {
          patch.delivery_note = deliveryNote;
        }

        var transporter = transporterInput.value.trim() || null;
        if (transporter !== normText(containerRow.transporter)) patch.transporter = transporter;

        var shipName = shipNameInput.value.trim() || null;
        if (shipName !== normText(containerRow.ship_name)) patch.ship_name = shipName;

        var loadDate = loadDateInput.value || null;
        if (loadDate !== (containerRow.load_date || null)) patch.load_date = loadDate;

        var shipDate = shipDateInput.value || null;
        if (shipDate !== (containerRow.expected_ship_date || null)) {
          patch.expected_ship_date = shipDate;
        }

        return { patch: patch };
      }

      async function save() {
        errEl.hidden = true;
        var built = buildEditPatch();
        if (built.error) {
          errEl.textContent = built.error;
          errEl.hidden = false;
          return;
        }
        var bodyPayload = built.patch;
        if (!Object.keys(bodyPayload).length) {
          errEl.textContent = "No changes to save.";
          errEl.hidden = false;
          return;
        }
        saveBtn.disabled = true;
        try {
          await ctx.api.traceability(
            "/containers/" + encodeURIComponent(containerRow.id),
            { method: "PATCH", body: bodyPayload }
          );
          close();
          if (onSaved) await onSaved();
        } catch (e) {
          errEl.textContent = e.message || String(e);
          errEl.hidden = false;
          saveBtn.disabled = false;
        }
      }

      saveBtn.addEventListener("click", function () {
        save();
      });
      numberInput.focus();
    }

    async function act(containerId, path, payload, describe) {
      if (!window.confirm(describe + "?")) return;
      try {
        if (path) {
          await ctx.api.traceability(path, { method: "POST", body: payload || {} });
        } else {
          await ctx.api.traceability("/containers/" + encodeURIComponent(containerId), {
            method: "PATCH",
            body: payload,
          });
        }
        await load();
      } catch (e) {
        setStatus("Could not update: " + (e.message || e), true);
      }
    }

    function renderTable(list) {
      var table = ui.el("table", { class: "data" });
      table.innerHTML =
        "<thead><tr>" +
        "<th>Container</th><th>FCL</th><th>Booking ref</th><th>Product</th><th>Loading date</th><th>Yard</th>" +
        "<th>Loaded</th><th>Status</th><th>Released</th><th></th>" +
        "</tr></thead>";
      var tbody = ui.el("tbody");

      list.forEach(function (c) {
        var tr = ui.el("tr");
        tr.innerHTML =
          "<td><strong>" + ui.escape(c.container_number) + "</strong></td>" +
          "<td>" + ui.escape(c.fcl_number || "—") + "</td>" +
          "<td>" + ui.escape(c.booking_ref || "—") + "</td>" +
          "<td>" + ui.escape(c.product_label || c.product_key || "—") + "</td>" +
          "<td>" + ui.escape(fmtContainerLoadingDate(c)) + "</td>" +
          "<td>" + ui.escape(c.location_display) + "</td>" +
          "<td>" + ui.escape(progressText(c)) + "</td>" +
          "<td>" + ui.escape(STATUS_LABEL[c.status] || c.status) + "</td>" +
          "<td>" +
          ui.escape(c.released_for_loading ? fmtDate(c.released_for_loading_at) : "Not released") +
          "</td>";

        var actions = ui.el("td", { class: "ct-actions-cell" });
        if (c.status === "booked" || c.status === "loading" || c.status === "full") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                openEditContainerDialog(c, load);
              },
            }, ["Edit container"])
          );
        } else if (c.status === "dispatched") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                openBookingRefOnlyDialog(c, load);
              },
            }, [c.booking_ref ? "Change booking ref" : "Set booking ref"])
          );
        }
        if ((c.status === "booked" || c.status === "loading") && !c.released_for_loading) {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(
                  c.id,
                  "/containers/" + encodeURIComponent(c.id) + "/release-for-loading",
                  {},
                  "Release " + c.container_number + " for yard loading"
                );
              },
            }, ["Release for loading"])
          );
        }
        if (c.status === "loading") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm btn-sm-active",
              type: "button",
              onclick: function () {
                if (
                  !confirmContainerAction(
                    "Close loading — " + c.container_number,
                    "Yard must stop scanning bags into this container. Bags stay Into container until you mark Shipped. You can re-open loading later if needed."
                  )
                ) {
                  return;
                }
                act(
                  c.id,
                  "/containers/" + encodeURIComponent(c.id) + "/close-loading",
                  {},
                  "Close yard loading for " + c.container_number
                );
              },
            }, ["Close loading"])
          );
        }
        if (c.status === "full") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                if (
                  !confirmContainerAction(
                    "Re-open loading — " + c.container_number,
                    "Bag Walk may scan Into container again for this booking. Status returns to Loading."
                  )
                ) {
                  return;
                }
                act(
                  c.id,
                  "/containers/" + encodeURIComponent(c.id) + "/reopen-loading",
                  {},
                  "Re-open yard loading for " + c.container_number
                );
              },
            }, ["Re-open loading"])
          );
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                if (
                  !confirmContainerAction(
                    "Mark Shipped — " + c.container_number,
                    "Container has left the yard. Bags in this container will appear under Shipped in Bags Status."
                  )
                ) {
                  return;
                }
                act(
                  c.id,
                  null,
                  { status: "dispatched" },
                  "Mark " + c.container_number + " as shipped"
                );
              },
            }, ["Shipped"])
          );
        }
        if (c.status === "booked") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                if (
                  !confirmContainerAction(
                    "Cancel booking — " + c.container_number,
                    "Removes this preload row. No bags should be loaded against it."
                  )
                ) {
                  return;
                }
                act(c.id, null, { status: "cancelled" }, "Cancel the booking for " + c.container_number);
              },
            }, ["Cancel"])
          );
        }
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      return table;
    }

    function paint() {
      body.innerHTML = "";
      var list = rows.filter(function (c) {
        return showClosed || (c.status !== "dispatched" && c.status !== "cancelled");
      });
      if (!list.length) {
        body.appendChild(ui.el("p", { class: "muted" }, ["No containers yet. Add the next booking above."]));
        return;
      }
      body.appendChild(renderTable(list));
    }

    async function load() {
      setStatus("Loading…");
      if (!ctx.api.traceability) {
        setStatus("Traceability API is not configured in CIS.", true);
        return;
      }
      try {
        var data = await ctx.api.traceability("/containers");
        rows = data.containers || [];
        setStatus("");
        paint();
      } catch (e) {
        setStatus("Could not load containers: " + (e.message || e), true);
      }
    }

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var number = numberInput.value.trim().toUpperCase();
      var count = parseInt(countInput.value, 10);
      var productKey = productSelect.value;
      if (!number || !count || count < 1 || !loadDateInput.value || !productKey) {
        setStatus("Container number, load date, product, and bag target are required.", true);
        return;
      }
      var selOpt = productSelect.options[productSelect.selectedIndex];
      setStatus("Saving…");
      try {
        var bodyPayload = {
          container_number: number,
          fcl_number: fclInput.value.trim().toUpperCase() || null,
          target_bag_count: count,
          location: locationSelect.value,
          load_date: loadDateInput.value,
          product_key: productKey,
          product_label: (selOpt && (selOpt.dataset.label || selOpt.textContent)) || productKey,
          booking_ref: bookingInput.value.trim() || null,
          ship_to: shipToInput.value.trim() || null,
          delivery_note: deliveryNoteInput.value.trim() || null,
          transporter: transporterInput.value.trim() || null,
          ship_name: shipNameInput.value.trim() || null,
        };
        if (shipDateInput.value) bodyPayload.expected_ship_date = shipDateInput.value;
        await ctx.api.traceability("/containers", {
          method: "POST",
          body: bodyPayload,
        });
        numberInput.value = "";
        countInput.value = "";
        bookingInput.value = "";
        shipDateInput.value = "";
        loadDateInput.value = "";
        shipToInput.value = "";
        deliveryNoteInput.value = "";
        fclInput.value = "";
        transporterInput.value = "";
        shipNameInput.value = "";
        productSelect.value = "";
        await load();
      } catch (e) {
        setStatus("Could not add container: " + (e.message || e), true);
      }
    });

    var today = new Date();
    loadDateInput.value =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    await loadOptions();
    await load();
  }

  CIS.modules.push({
    id: "containers",
    title: "Containers",
    section: "Production",
    kind: "lookup",
    order: 17,
    icon: "bags",
    description: "Preload and release containers for Bag Walk Into container scans",
    requires: "traceability.containers",
    render: render,
  });
})();
