/* Packaging Shifts — schedule SKUs for Candy / wrap (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var STATUS_LABEL = {
    scheduled: "Scheduled (not on scanners yet)",
    active: "Active on scanners",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  function render(container, ctx) {
    var ui = CIS.ui;
    var shifts = [];
    var products = [];
    var showClosed = false;

    container.innerHTML = "";
    container.className = "module-content packaging-shift-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Packaging Shifts"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Tell Candy and wrap which pallet SKUs may be used today. ",
        "Only the ticked products appear when assigning jumbos to a pool or creating a pallet. ",
        "Bag Walk storage steps are not limited — this applies to packaging product buttons only.",
      ])
    );

    var status = ui.el("p", { class: "muted packaging-shift-status" }, [""]);
    container.appendChild(status);

    var shiftsSection = ui.el("section", { class: "packaging-shift-section" });
    shiftsSection.appendChild(
      ui.el("h3", { class: "print-labels-panel-title" }, ["Shifts on the floor"])
    );
    shiftsSection.appendChild(
      ui.el("p", { class: "muted packaging-shift-section-hint" }, [
        "At most one shift is active. While active, scanners show only its SKUs. ",
        "Scheduled shifts wait until you press Activate.",
      ])
    );
    var activeBanner = ui.el("p", {
      class: "packaging-shift-active-banner",
      hidden: true,
    });
    shiftsSection.appendChild(activeBanner);
    var shiftsBody = ui.el("div", { class: "packaging-shift-shifts-body" });
    shiftsSection.appendChild(shiftsBody);
    var toggle = ui.el("button", {
      class: "btn btn-sm packaging-shift-toggle-closed",
      type: "button",
    }, ["Show completed and cancelled"]);
    toggle.addEventListener("click", function () {
      showClosed = !showClosed;
      toggle.textContent = showClosed
        ? "Hide completed and cancelled"
        : "Show completed and cancelled";
      paintShifts();
    });
    shiftsSection.appendChild(toggle);
    container.appendChild(shiftsSection);

    var formSection = ui.el("section", { class: "packaging-shift-section packaging-shift-section--form" });
    formSection.appendChild(
      ui.el("h3", { class: "print-labels-panel-title" }, ["Start a new shift"])
    );
    formSection.appendChild(
      ui.el("p", { class: "muted packaging-shift-section-hint" }, [
        "Tick one or more products from Pallet Configuration. ",
        "Unticked products will not appear on packaging scanners for this shift.",
      ])
    );

    var productHost = ui.el("div", { class: "packaging-shift-products" });
    var notesInput = ui.el("textarea", {
      rows: "2",
      placeholder: "Optional notes for the floor",
      autocomplete: "off",
      class: "input",
    });
    var activateNow = ui.el("input", { type: "checkbox", id: "packaging-shift-activate-now" });
    activateNow.checked = true;

    var form = ui.el("form", { class: "packaging-shift-form ct-form" });

    form.appendChild(ui.el("div", { class: "ct-field" }, [
      ui.el("span", { class: "ct-field-label" }, ["Products for this shift"]),
      ui.el("p", { class: "muted packaging-shift-field-hint" }, [
        "Example: tick only LF2.5 — Candy and wrap will offer LF2.5 only (not every pallet SKU).",
      ]),
      productHost,
    ]));

    var activateBlock = ui.el("div", { class: "packaging-shift-activate-block" });
    activateBlock.appendChild(
      ui.el("label", { class: "packaging-shift-activate-label", for: "packaging-shift-activate-now" }, [
        activateNow,
        ui.el("span", { class: "packaging-shift-activate-title" }, ["Activate immediately"]),
      ])
    );
    activateBlock.appendChild(
      ui.el("p", { class: "muted packaging-shift-activate-hint" }, [
        "When ticked: this shift goes live now and replaces any current active shift. ",
        "Only the products you ticked above become available on scanners — not the whole catalog.",
      ])
    );
    activateBlock.appendChild(
      ui.el("p", { class: "muted packaging-shift-activate-hint" }, [
        "When unticked: the shift is saved as Scheduled. Scanners keep the current active shift ",
        "(or show no packaging SKUs until you Activate this shift in the list above).",
      ])
    );
    form.appendChild(activateBlock);

    form.appendChild(ui.el("label", { class: "ct-field" }, [
      ui.el("span", { class: "ct-field-label" }, ["Notes"]),
      notesInput,
    ]));
    form.appendChild(
      ui.el("button", { class: "btn", type: "submit" }, ["Save shift"])
    );
    formSection.appendChild(form);
    container.appendChild(formSection);

    function setStatus(text, isError) {
      status.textContent = text || "";
      status.className = (isError ? "error-box" : "muted") + " packaging-shift-status";
    }

    function paintProductChecks() {
      productHost.innerHTML = "";
      if (!products.length) {
        productHost.appendChild(
          ui.el("p", { class: "muted" }, ["No active products in Pallet Configuration."])
        );
        return;
      }
      products.forEach(function (p) {
        var id = "ps-" + p.product_code;
        var cb = ui.el("input", { type: "checkbox", id: id, value: p.product_code });
        var label = p.product_code + (p.name ? " — " + p.name : "");
        productHost.appendChild(
          ui.el("label", { class: "packaging-shift-product-row", for: id }, [cb, " " + label])
        );
      });
    }

    function selectedCodes() {
      var codes = [];
      productHost.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
        if (cb.value) codes.push(cb.value);
      });
      return codes;
    }

    async function act(shiftId, payload, describe) {
      if (!window.confirm(describe + "?")) return;
      try {
        await ctx.api.traceability("/packaging-shifts/" + encodeURIComponent(shiftId), {
          method: "PATCH",
          body: payload,
        });
        await load();
      } catch (e) {
        setStatus("Could not update: " + (e.message || e), true);
      }
    }

    function paintActiveBanner() {
      var active = shifts.filter(function (s) {
        return s.status === "active";
      })[0];
      if (!active) {
        activeBanner.hidden = true;
        activeBanner.textContent = "";
        return;
      }
      activeBanner.hidden = false;
      activeBanner.textContent =
        "Active now on scanners: " + (active.product_codes || []).join(", ");
    }

    function paintShifts() {
      shiftsBody.innerHTML = "";
      paintActiveBanner();
      var list = shifts.filter(function (s) {
        return showClosed || (s.status !== "completed" && s.status !== "cancelled");
      });
      if (!list.length) {
        shiftsBody.appendChild(ui.el("p", { class: "muted" }, ["No packaging shifts yet."]));
        return;
      }
      var table = ui.el("table", { class: "data packaging-shift-table" });
      table.innerHTML =
        "<thead><tr><th>Products</th><th>Status</th><th>Actions</th></tr></thead>";
      var tbody = ui.el("tbody");
      list.forEach(function (s) {
        var tr = ui.el("tr");
        tr.innerHTML =
          "<td><strong>" +
          ui.escape((s.product_codes || []).join(", ") || "—") +
          "</strong></td>" +
          "<td>" +
          ui.escape(STATUS_LABEL[s.status] || s.status) +
          "</td>";
        var actions = ui.el("td", { class: "packaging-shift-actions" });
        if (s.status === "scheduled") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(
                  s.id,
                  { status: "active" },
                  "Activate this shift on scanners (" + (s.product_codes || []).join(", ") + ")"
                );
              },
            }, ["Activate on scanners"])
          );
        }
        if (s.status === "scheduled" || s.status === "active") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(s.id, { status: "completed" }, "Complete this shift");
              },
            }, ["Complete"])
          );
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(s.id, { status: "cancelled" }, "Cancel this shift");
              },
            }, ["Cancel"])
          );
        }
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      shiftsBody.appendChild(table);
    }

    async function load() {
      setStatus("Loading…");
      if (!ctx.api.traceability) {
        setStatus("Traceability API is not configured in CIS.", true);
        return;
      }
      try {
        var data = await ctx.api.traceability("/packaging-shifts");
        shifts = data.shifts || [];
        try {
          var pd = await ctx.api.traceability("/packaging-shifts/catalog");
          products = pd.products || [];
        } catch (e) {
          products = [];
        }
        paintProductChecks();
        paintShifts();
        setStatus("");
      } catch (e) {
        setStatus("Could not load: " + (e.message || e), true);
      }
    }

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var codes = selectedCodes();
      if (!codes.length) {
        setStatus("Select at least one product for this shift.", true);
        return;
      }
      setStatus("Saving…");
      try {
        await ctx.api.traceability("/packaging-shifts", {
          method: "POST",
          body: {
            product_codes: codes,
            notes: notesInput.value.trim() || null,
            activate: activateNow.checked,
          },
        });
        notesInput.value = "";
        await load();
        setStatus("Packaging shift saved.");
      } catch (e) {
        setStatus("Could not save: " + (e.message || e), true);
      }
    });

    load();
  }

  CIS.modules.push({
    id: "packaging_shift",
    title: "Packaging Shifts",
    section: "Applications",
    parent: "traceability",
    requires: "traceability.packaging_shift",
    render: render,
  });
})();
