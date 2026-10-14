/* Packaging Shifts — supervisor control of packaging scanner SKUs (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var STATUS_LABEL = {
    scheduled: "Scheduled",
    active: "Active",
    paused: "Paused",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  var EMPTY = {
    active:
      "No shifts on scanners. Activate a scheduled shift in this column, or start a new shift below.",
    scheduled:
      "None waiting. Save a shift without “Activate immediately” to queue it here.",
    paused:
      "None. Pause removes a shift from scanners during a long wait; Activate puts it back.",
    completed:
      "None yet. Only Complete closes a shift. Active shifts stay on scanners overnight until a manager completes or pauses them.",
    cancelled: "None.",
  };

  function render(container, ctx) {
    var ui = CIS.ui;
    var shifts = [];
    var products = [];

    container.innerHTML = "";
    container.className = "module-content packaging-shift-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Packaging Shifts"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Supervisors choose which pallet SKUs packaging scanners may use. ",
        "Only those products appear when assigning bulk bags or building pallets. ",
        "Active shifts remain on scanners across days until a manager pauses or completes them.",
      ])
    );

    var status = ui.el("p", { class: "muted packaging-shift-status" }, [""]);
    container.appendChild(status);

    var busyOverlay = ui.el("div", {
      class: "packaging-shift-busy-overlay",
      hidden: true,
      "aria-live": "polite",
      "aria-busy": "true",
    }, [
      ui.el("div", { class: "packaging-shift-busy-card" }, [
        ui.el("p", { class: "packaging-shift-busy-title" }, ["Working…"]),
        ui.el("p", { class: "packaging-shift-busy-detail" }, [""]),
      ]),
    ]);
    container.appendChild(busyOverlay);

    var boardSection = ui.el("section", { class: "packaging-shift-section packaging-shift-board" });
    boardSection.appendChild(
      ui.el("h3", { class: "print-labels-panel-title" }, ["Current shifts"])
    );
    boardSection.appendChild(
      ui.el("p", { class: "muted packaging-shift-section-hint" }, [
        "Scanners use every ",
        ui.el("strong", {}, ["active"]),
        " shift together (combined SKU list). ",
        "Paused and completed shifts are off scanners.",
      ])
    );

    var scannerBanner = ui.el("p", {
      class: "packaging-shift-active-banner",
      hidden: true,
    });
    boardSection.appendChild(scannerBanner);

    var grid = ui.el("div", { class: "packaging-shift-grid" });

    var colLive = ui.el("div", { class: "packaging-shift-column packaging-shift-column--live" });
    colLive.appendChild(
      ui.el("h4", { class: "packaging-shift-panel-title" }, ["Active on scanners"])
    );
    var activeBody = ui.el("div", { class: "packaging-shift-panel-body" });
    colLive.appendChild(activeBody);
    colLive.appendChild(
      ui.el("h4", { class: "packaging-shift-panel-title packaging-shift-panel-title--sub" }, [
        "Scheduled (not on scanners yet)",
      ])
    );
    var scheduledBody = ui.el("div", { class: "packaging-shift-panel-body" });
    colLive.appendChild(scheduledBody);

    var colSide = ui.el("div", { class: "packaging-shift-column packaging-shift-column--side" });
    colSide.appendChild(ui.el("h4", { class: "packaging-shift-panel-title" }, ["Paused"]));
    var pausedBody = ui.el("div", { class: "packaging-shift-panel-body" });
    colSide.appendChild(pausedBody);
    colSide.appendChild(
      ui.el("h4", { class: "packaging-shift-panel-title packaging-shift-panel-title--sub" }, [
        "Completed",
      ])
    );
    var completedBody = ui.el("div", { class: "packaging-shift-panel-body" });
    colSide.appendChild(completedBody);
    colSide.appendChild(
      ui.el("h4", { class: "packaging-shift-panel-title packaging-shift-panel-title--sub" }, [
        "Cancelled",
      ])
    );
    var cancelledBody = ui.el("div", { class: "packaging-shift-panel-body" });
    colSide.appendChild(cancelledBody);

    grid.appendChild(colLive);
    grid.appendChild(colSide);
    boardSection.appendChild(grid);
    container.appendChild(boardSection);

    var formSection = ui.el("section", { class: "packaging-shift-section packaging-shift-section--form" });
    formSection.appendChild(
      ui.el("h3", { class: "print-labels-panel-title" }, ["Start a new shift"])
    );
    formSection.appendChild(
      ui.el("p", { class: "muted packaging-shift-section-hint" }, [
        "Tick pallet products from Pallet Configuration. ",
        "Unticked products stay hidden on packaging scanners for this shift.",
      ])
    );

    var productHost = ui.el("div", { class: "packaging-shift-products" });
    var activateNow = ui.el("input", { type: "checkbox", id: "packaging-shift-activate-now" });
    activateNow.checked = true;

    var form = ui.el("form", { class: "packaging-shift-form ct-form" });

    form.appendChild(ui.el("div", { class: "ct-field" }, [
      ui.el("span", { class: "ct-field-label" }, ["Products for this shift"]),
      ui.el("p", { class: "muted packaging-shift-field-hint" }, [
        "Example: tick only LF2.5 — scanners offer LF2.5 only, not the full pallet catalog.",
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
        "When ticked: this shift goes on scanners as soon as it is saved. ",
        "Other active shifts stay active — scanners show the combined SKU list.",
      ])
    );
    activateBlock.appendChild(
      ui.el("p", { class: "muted packaging-shift-activate-hint" }, [
        "When unticked: saved as Scheduled in the list above until a manager activates it.",
      ])
    );
    form.appendChild(activateBlock);

    var saveBtn = ui.el("button", { class: "btn", type: "submit" }, ["Save shift"]);
    form.appendChild(saveBtn);
    formSection.appendChild(form);
    container.appendChild(formSection);

    var busy = false;
    var panelBodies = [activeBody, scheduledBody, pausedBody, completedBody, cancelledBody];

    function setStatus(text, isError, isBusy) {
      status.textContent = text || "";
      var cls = "packaging-shift-status";
      if (isBusy) cls += " packaging-shift-status--busy";
      else if (isError) cls += " error-box";
      else cls += " muted";
      status.className = cls;
    }

    function setBusy(on, message) {
      busy = !!on;
      saveBtn.disabled = busy;
      productHost.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
        cb.disabled = busy;
      });
      activateNow.disabled = busy;
      panelBodies.forEach(function (body) {
        body.querySelectorAll("button").forEach(function (btn) {
          btn.disabled = busy;
        });
      });
      var detail = busyOverlay.querySelector(".packaging-shift-busy-detail");
      if (busy) {
        var text = message || "Please wait…";
        if (detail) detail.textContent = text;
        busyOverlay.hidden = false;
        setStatus(text, false, true);
      } else {
        busyOverlay.hidden = true;
        if (detail) detail.textContent = "";
      }
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

    async function act(shiftId, payload, describe, busyMsg) {
      if (busy) return;
      if (!window.confirm(describe + "?")) return;
      setBusy(true, busyMsg || "Updating shift…");
      try {
        await ctx.api.traceability("/packaging-shifts/" + encodeURIComponent(shiftId), {
          method: "PATCH",
          body: payload,
        });
        await load();
        setStatus("Shift updated.", false, false);
      } catch (e) {
        setStatus("Could not update: " + (e.message || e), true, false);
      } finally {
        setBusy(false);
      }
    }

    function formatWhen(iso) {
      if (!iso) return "—";
      try {
        var d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        return iso;
      }
    }

    function shiftMeta(s) {
      var parts = [];
      if (s.started_at) parts.push("On scanners since " + formatWhen(s.started_at));
      else if (s.created_at) parts.push("Created " + formatWhen(s.created_at));
      if (s.status === "completed" && s.completed_at) {
        parts.push("Completed " + formatWhen(s.completed_at));
      }
      if (s.notes) parts.push(s.notes);
      return parts.join(" · ");
    }

    function appendActions(actions, s) {
      if (s.status === "scheduled" || s.status === "paused") {
        actions.appendChild(
          ui.el("button", {
            class: "btn btn-sm",
            type: "button",
            onclick: function () {
              act(
                s.id,
                { status: "active" },
                "Activate on scanners (" + (s.product_codes || []).join(", ") + ")",
                "Activating shift on scanners…"
              );
            },
          }, ["Activate"])
        );
      }
      if (s.status === "active") {
        actions.appendChild(
          ui.el("button", {
            class: "btn btn-sm",
            type: "button",
            onclick: function () {
              act(
                s.id,
                { status: "paused" },
                "Pause this shift (remove its SKUs from scanners until resumed)",
                "Pausing shift…"
              );
            },
          }, ["Pause"])
        );
      }
      if (s.status === "scheduled" || s.status === "active" || s.status === "paused") {
        actions.appendChild(
          ui.el("button", {
            class: "btn btn-sm",
            type: "button",
            onclick: function () {
              act(s.id, { status: "completed" }, "Complete this shift", "Completing shift…");
            },
          }, ["Complete"])
        );
        actions.appendChild(
          ui.el("button", {
            class: "btn btn-sm",
            type: "button",
            onclick: function () {
              act(s.id, { status: "cancelled" }, "Cancel this shift", "Cancelling shift…");
            },
          }, ["Cancel"])
        );
      }
    }

    function paintTable(host, list, emptyText) {
      host.innerHTML = "";
      if (!list.length) {
        host.appendChild(ui.el("p", { class: "packaging-shift-empty" }, [emptyText]));
        return;
      }
      var table = ui.el("table", { class: "data packaging-shift-table" });
      table.innerHTML =
        "<thead><tr><th>Products</th><th>Details</th><th>Actions</th></tr></thead>";
      var tbody = ui.el("tbody");
      list.forEach(function (s) {
        var tr = ui.el("tr");
        tr.innerHTML =
          "<td><strong>" +
          ui.escape((s.product_codes || []).join(", ") || "—") +
          "</strong></td>" +
          "<td class=\"packaging-shift-meta\">" +
          ui.escape(shiftMeta(s) || STATUS_LABEL[s.status] || s.status) +
          "</td>";
        var actions = ui.el("td", { class: "packaging-shift-actions" });
        appendActions(actions, s);
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      host.appendChild(table);
    }

    function paintScannerBanner() {
      var actives = shifts.filter(function (s) {
        return s.status === "active";
      });
      if (!actives.length) {
        scannerBanner.hidden = false;
        scannerBanner.className = "packaging-shift-active-banner packaging-shift-active-banner--idle";
        scannerBanner.textContent =
          "No active shifts — packaging scanners will not offer pallet products until a supervisor activates one.";
        return;
      }
      var skuSet = {};
      actives.forEach(function (s) {
        (s.product_codes || []).forEach(function (c) {
          skuSet[c] = true;
        });
      });
      var skus = Object.keys(skuSet).sort();
      scannerBanner.hidden = false;
      scannerBanner.className = "packaging-shift-active-banner";
      scannerBanner.textContent =
        "Scanners now (" +
        actives.length +
        " active shift" +
        (actives.length === 1 ? "" : "s") +
        "): " +
        skus.join(", ");
    }

    function paintBoard() {
      paintScannerBanner();
      var byStatus = {
        active: [],
        scheduled: [],
        paused: [],
        completed: [],
        cancelled: [],
      };
      shifts.forEach(function (s) {
        var bucket = byStatus[s.status];
        if (bucket) bucket.push(s);
      });
      paintTable(activeBody, byStatus.active, EMPTY.active);
      paintTable(scheduledBody, byStatus.scheduled, EMPTY.scheduled);
      paintTable(pausedBody, byStatus.paused, EMPTY.paused);
      paintTable(completedBody, byStatus.completed, EMPTY.completed);
      paintTable(cancelledBody, byStatus.cancelled, EMPTY.cancelled);
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
        paintBoard();
        setStatus("");
      } catch (e) {
        setStatus("Could not load: " + (e.message || e), true);
      }
    }

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      if (busy) return;
      var codes = selectedCodes();
      if (!codes.length) {
        setStatus("Select at least one product for this shift.", true, false);
        return;
      }
      var msg = activateNow.checked
        ? "Activating shift on scanners — please wait…"
        : "Saving shift — please wait…";
      setBusy(true, msg);
      try {
        await ctx.api.traceability("/packaging-shifts", {
          method: "POST",
          body: {
            product_codes: codes,
            activate: activateNow.checked,
          },
        });
        await load();
        setStatus(
          activateNow.checked ? "Shift saved and active on scanners." : "Shift saved (scheduled).",
          false,
          false
        );
      } catch (e) {
        setStatus("Could not save: " + (e.message || e), true, false);
      } finally {
        setBusy(false);
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
