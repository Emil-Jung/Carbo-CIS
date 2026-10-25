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
        "Container sheets and EUDR documents are under ",
        ui.el("strong", {}, ["Traceability Documentation"]),
        ".",
      ])
    );

    var productOptions = [];
    var dispatchOptions = [];

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
      placeholder: "Container number, e.g. MSCU1234567",
      required: "required",
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
    var tareInput = ui.el("input", { type: "number", min: "0", step: "1", autocomplete: "off" });
    var tagInput = ui.el("input", { type: "text", autocomplete: "off" });
    var transporterInput = ui.el("input", { type: "text", autocomplete: "off" });
    var bookingInput = ui.el("input", { type: "text", placeholder: "Booking ref (optional)", autocomplete: "off" });
    var shipDateInput = ui.el("input", { type: "date", autocomplete: "off" });
    var dispatchSelect = ui.el("select", {});
    dispatchSelect.appendChild(ui.el("option", { value: "" }, ["No dispatch link (yard storage only)"]));

    function labelled(text, control) {
      return ui.el("label", { class: "ct-field" }, [
        ui.el("span", { class: "ct-field-label" }, [text]),
        control,
      ]);
    }

    form.appendChild(labelled("Container number", numberInput));
    form.appendChild(labelled("Load date", loadDateInput));
    form.appendChild(labelled("Product", productSelect));
    form.appendChild(labelled("Bags when full", countInput));
    form.appendChild(labelled("Yard", locationSelect));
    form.appendChild(labelled("To", shipToInput));
    form.appendChild(labelled("Delivery note", deliveryNoteInput));
    form.appendChild(labelled("Tare (kg)", tareInput));
    form.appendChild(labelled("Tag", tagInput));
    form.appendChild(labelled("Transporter", transporterInput));
    form.appendChild(labelled("Expected ship date", shipDateInput));
    form.appendChild(labelled("Booking ref", bookingInput));
    form.appendChild(labelled("Walvis dispatch (Option A)", dispatchSelect));
    form.appendChild(
      ui.el("p", { class: "muted ct-form-hint" }, [
        "Link a dispatch to load bags from that truck manifest (in transit or Walvis/AGL storage). ",
        "Leave unlinked for yard-only loading.",
      ])
    );
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

    function fillDispatchSelect() {
      while (dispatchSelect.options.length > 1) dispatchSelect.remove(1);
      dispatchOptions.forEach(function (d) {
        dispatchSelect.appendChild(ui.el("option", { value: d.id }, [d.label || d.id]));
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
        var disp = await ctx.api.traceability("/containers/dispatch-link-options");
        dispatchOptions = disp.dispatches || [];
        fillDispatchSelect();
      } catch (e) {
        setStatus("Could not load product/dispatch options: " + (e.message || e), true);
      }
    }

    function confirmContainerAction(title, detail) {
      return window.confirm(title + "\n\n" + detail + "\n\nContinue?");
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
        "<th>Container</th><th>Product</th><th>Loading date</th><th>Yard</th>" +
        "<th>Loaded</th><th>Status</th><th>Released</th><th></th>" +
        "</tr></thead>";
      var tbody = ui.el("tbody");

      list.forEach(function (c) {
        var tr = ui.el("tr");
        tr.innerHTML =
          "<td><strong>" + ui.escape(c.container_number) + "</strong></td>" +
          "<td>" + ui.escape(c.product_label || c.product_key || "—") + "</td>" +
          "<td>" + ui.escape(fmtContainerLoadingDate(c)) + "</td>" +
          "<td>" + ui.escape(c.location_display) + "</td>" +
          "<td>" + ui.escape(progressText(c)) + "</td>" +
          "<td>" + ui.escape(STATUS_LABEL[c.status] || c.status) + "</td>" +
          "<td>" +
          ui.escape(c.released_for_loading ? fmtDate(c.released_for_loading_at) : "Not released") +
          "</td>";

        var actions = ui.el("td", { class: "ct-actions-cell" });
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
          target_bag_count: count,
          location: locationSelect.value,
          load_date: loadDateInput.value,
          product_key: productKey,
          product_label: (selOpt && (selOpt.dataset.label || selOpt.textContent)) || productKey,
          booking_ref: bookingInput.value.trim() || null,
          ship_to: shipToInput.value.trim() || null,
          delivery_note: deliveryNoteInput.value.trim() || null,
          tag_ref: tagInput.value.trim() || null,
          transporter: transporterInput.value.trim() || null,
        };
        if (tareInput.value !== "") bodyPayload.tare_kg = Number(tareInput.value);
        if (shipDateInput.value) bodyPayload.expected_ship_date = shipDateInput.value;
        if (dispatchSelect.value) bodyPayload.walvis_dispatch_id = dispatchSelect.value;
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
        tareInput.value = "";
        tagInput.value = "";
        transporterInput.value = "";
        productSelect.value = "";
        dispatchSelect.value = "";
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
