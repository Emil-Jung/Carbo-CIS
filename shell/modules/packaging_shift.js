/* Packaging shift — schedule SKUs for Candy / wrap (CIS). Universal Bag Walk scan unchanged. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var STATUS_LABEL = {
    scheduled: "Scheduled",
    active: "Active on scanners",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  function render(container, ctx) {
    var ui = CIS.ui;
    var shifts = [];
    var products = [];
    var showClosed = false;

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Packaging Shifts"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Choose which pallet SKUs Candy and wrap may use while a shift is active. ",
        "Bag Walk still scans any bag and shows storage next steps — only packaging product buttons are limited.",
      ])
    );

    var status = ui.el("p", { class: "muted" }, [""]);
    container.appendChild(status);

    var productHost = ui.el("div", { class: "packaging-shift-products ct-form" });
    container.appendChild(productHost);

    var notesInput = ui.el("textarea", {
      rows: "2",
      placeholder: "Optional notes for the floor",
      autocomplete: "off",
    });
    var activateNow = ui.el("input", { type: "checkbox" });
    activateNow.checked = true;

    var form = ui.el("form", { class: "toolbar ct-form" });
    form.appendChild(ui.el("label", { class: "ct-field" }, [
      ui.el("span", { class: "ct-field-label" }, ["Products on this shift"]),
      productHost,
    ]));
    form.appendChild(
      ui.el("label", { class: "ct-field ct-field--inline" }, [activateNow, " Activate immediately"])
    );
    form.appendChild(ui.el("label", { class: "ct-field" }, [
      ui.el("span", { class: "ct-field-label" }, ["Notes"]),
      notesInput,
    ]));
    form.appendChild(ui.el("button", { class: "btn", type: "submit" }, ["Start packaging shift"]));
    container.appendChild(form);

    var toggle = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Show completed and cancelled"]);
    toggle.addEventListener("click", function () {
      showClosed = !showClosed;
      toggle.textContent = showClosed
        ? "Hide completed and cancelled"
        : "Show completed and cancelled";
      paint();
    });
    container.appendChild(toggle);

    var body = ui.el("div", {});
    container.appendChild(body);

    function setStatus(text, isError) {
      status.textContent = text || "";
      status.className = isError ? "error-box" : "muted";
    }

    function paintProductChecks() {
      productHost.innerHTML = "";
      if (!products.length) {
        productHost.appendChild(ui.el("p", { class: "muted" }, ["No active products in Pallet Configuration."]));
        return;
      }
      products.forEach(function (p) {
        var id = "ps-" + p.product_code;
        var cb = ui.el("input", { type: "checkbox", id: id, value: p.product_code });
        var label = p.product_code + (p.name ? " — " + p.name : "");
        productHost.appendChild(
          ui.el("label", { class: "ct-field ct-field--inline", for: id }, [cb, " " + label])
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

    function paint() {
      body.innerHTML = "";
      var list = shifts.filter(function (s) {
        return showClosed || (s.status !== "completed" && s.status !== "cancelled");
      });
      if (!list.length) {
        body.appendChild(ui.el("p", { class: "muted" }, ["No packaging shifts yet."]));
        return;
      }
      var table = ui.el("table", { class: "data" });
      table.innerHTML =
        "<thead><tr><th>Shift</th><th>Status</th><th></th></tr></thead>";
      var tbody = ui.el("tbody");
      list.forEach(function (s) {
        var tr = ui.el("tr");
        tr.innerHTML =
          "<td><strong>" +
          ui.escape(s.title || s.product_codes.join(", ")) +
          "</strong></td>" +
          "<td>" +
          ui.escape(STATUS_LABEL[s.status] || s.status) +
          "</td>";
        var actions = ui.el("td", {});
        if (s.status === "scheduled") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(s.id, { status: "active" }, "Activate " + s.title);
              },
            }, ["Activate"])
          );
        }
        if (s.status === "scheduled" || s.status === "active") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(s.id, { status: "completed" }, "Complete " + s.title);
              },
            }, ["Complete"])
          );
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(s.id, { status: "cancelled" }, "Cancel " + s.title);
              },
            }, ["Cancel"])
          );
        }
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      body.appendChild(table);
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
        paint();
        setStatus("");
      } catch (e) {
        setStatus("Could not load: " + (e.message || e), true);
      }
    }

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var codes = selectedCodes();
      if (!codes.length) {
        setStatus("Select at least one product.", true);
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
