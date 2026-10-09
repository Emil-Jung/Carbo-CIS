/* Label Fencing — serial ranges (known IDs) or quantity park (unknown serials). */

(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var LD_UI_VERSION = "1.2.0";
  var SERIAL_RE = /^BAG-\d{4}-\d{6,}$/i;

  var CATEGORIES = [
    { key: "testing_abroad", label: "Testing abroad" },
    { key: "pre_scanner", label: "Pre-scanner attachment" },
    { key: "other", label: "Other" },
  ];

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  function normalizeSerial(raw) {
    var text = String(raw || "").trim().toUpperCase();
    if (!text) return "";
    if (SERIAL_RE.test(text)) return text;
    var digits = text.replace(/\D/g, "");
    if (!digits) return text;
    var year = new Date().getFullYear();
    return "BAG-" + year + "-" + digits.padStart(6, "0");
  }

  function categoryLabel(key) {
    var found = CATEGORIES.find(function (c) { return c.key === key; });
    return found ? found.label : key;
  }

  function formatWhen(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, {
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

  function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content label-deployment-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Label Fencing"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Set labels aside from the available count — not permanent; they may return, be used, or be voided later. "
        + "Fence a serial range when you know the Bag IDs (e.g. testing abroad), or park a quantity when serials are unknown. UI "
        + LD_UI_VERSION + ".",
    ]));

    var inventoryEl = ui.el("div", { class: "label-deployment-inventory muted" }, ["Loading inventory…"]);
    var inventoryPanel = ui.el("section", { class: "label-deployment-panel" });
    inventoryPanel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Label stock summary"]));
    inventoryPanel.appendChild(inventoryEl);
    container.appendChild(inventoryPanel);

    /* --- Serial range form --- */
    var rangePanel = ui.el("section", { class: "label-deployment-panel" });
    rangePanel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Serial range (known Bag IDs)"]));
    rangePanel.appendChild(ui.el("p", { class: "muted label-deployment-hint" }, [
      "For a contiguous block you can identify — e.g. BAG-2026-003311 to BAG-2026-003511 sent to England. Each label is fenced (set aside) until returned, used, or voided.",
    ]));

    var rangeForm = ui.el("form", { class: "label-deployment-form" });
    var firstInput = ui.el("input", { class: "input", type: "text", placeholder: "First Bag ID", autocomplete: "off" });
    var lastInput = ui.el("input", { class: "input", type: "text", placeholder: "Last Bag ID", autocomplete: "off" });
    var rangeCategory = ui.el("select", { class: "input" });
    CATEGORIES.forEach(function (cat) {
      rangeCategory.appendChild(ui.el("option", { value: cat.key }, [cat.label]));
    });
    rangeCategory.value = "testing_abroad";
    var rangeNote = ui.el("textarea", {
      class: "input label-deployment-note",
      rows: "2",
      placeholder: "Note — e.g. plane to England for testing",
    });
    var rangeMsg = ui.el("p", { class: "label-deployment-msg muted" });
    var rangeSubmit = ui.el("button", { class: "btn-sm", type: "submit" }, ["Fence serial range"]);

    rangeForm.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["First serial"]),
      firstInput,
    ]));
    rangeForm.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["Last serial"]),
      lastInput,
    ]));
    rangeForm.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["Reason"]),
      rangeCategory,
    ]));
    rangeForm.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["Note"]),
      rangeNote,
    ]));
    rangeForm.appendChild(rangeMsg);
    rangeForm.appendChild(rangeSubmit);
    rangePanel.appendChild(rangeForm);
    container.appendChild(rangePanel);

    /* --- Quantity park form --- */
    var parkPanel = ui.el("section", { class: "label-deployment-panel label-deployment-panel--park" });
    parkPanel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Park quantity (unknown serials)"]));
    parkPanel.appendChild(ui.el("p", { class: "muted label-deployment-hint" }, [
      "When labels were used from a box without recording which Bag IDs — park the estimated count (e.g. 280 on pre-scanner bags). "
        + "Reduce the parked number as those bags are scanned in, or clear it when done.",
    ]));

    var parkForm = ui.el("form", { class: "label-deployment-form" });
    var parkQtyInput = ui.el("input", {
      class: "input",
      type: "number",
      min: "1",
      step: "1",
      placeholder: "Quantity to park",
    });
    var parkCategory = ui.el("select", { class: "input" });
    CATEGORIES.forEach(function (cat) {
      parkCategory.appendChild(ui.el("option", { value: cat.key }, [cat.label]));
    });
    parkCategory.value = "pre_scanner";
    var parkNote = ui.el("textarea", {
      class: "input label-deployment-note",
      rows: "2",
      placeholder: "Note — e.g. on bags before scanners; scan in when moved",
    });
    var parkMsg = ui.el("p", { class: "label-deployment-msg muted" });
    var parkSubmit = ui.el("button", { class: "btn-sm", type: "submit" }, ["Park quantity"]);

    parkForm.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["Quantity"]),
      parkQtyInput,
    ]));
    parkForm.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["Reason"]),
      parkCategory,
    ]));
    parkForm.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["Note"]),
      parkNote,
    ]));
    parkForm.appendChild(parkMsg);
    parkForm.appendChild(parkSubmit);
    parkPanel.appendChild(parkForm);
    container.appendChild(parkPanel);

    var listPanel = ui.el("section", { class: "label-deployment-panel" });
    listPanel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Active fences & parks"]));
    var listEl = ui.el("div", { class: "label-deployment-list" });
    listPanel.appendChild(listEl);
    container.appendChild(listPanel);

    function setMsg(el, text, isError) {
      el.textContent = text || "";
      el.className = "label-deployment-msg" + (text ? (isError ? " is-error" : " is-ok") : " muted");
    }

    function renderInventory(inv) {
      if (!inv) {
        inventoryEl.textContent = "Could not load inventory.";
        return;
      }
      var c = inv.counts || {};
      var parked = inv.parked != null ? inv.parked : 0;
      var fenced = inv.fenced_serial != null ? inv.fenced_serial : (inv.fenced || c.fenced || 0);
      inventoryEl.innerHTML =
        "<strong>" + fmt(inv.total) + "</strong> produced · " +
        "<strong class=\"ld-stat-ready\">" + fmt(inv.available) + "</strong> available to use · " +
        (parked ? "<strong class=\"ld-stat-parked\">" + fmt(parked) + "</strong> parked · " : "") +
        (fenced ? "<strong class=\"ld-stat-fenced\">" + fmt(fenced) + "</strong> fenced (serial) · " : "") +
        fmt(c.used || inv.used || 0) + " on bags · " +
        fmt(c.allocated || inv.allocated || 0) + " pending print · " +
        fmt(c.void || inv.void || 0) + " void";
    }

    function renderDeployments(rows) {
      listEl.innerHTML = "";
      var active = (rows || []).filter(function (d) { return d.active !== false && !d.revoked_at; });
      if (!active.length) {
        listEl.appendChild(ui.el("p", { class: "muted" }, ["Nothing active — fence a serial range or park a quantity above."]));
        return;
      }
      active.forEach(function (dep) {
        var isPark = dep.kind === "quantity_park";
        var card = ui.el("article", { class: "label-deployment-card" + (isPark ? " label-deployment-card--park" : "") });
        var head = ui.el("div", { class: "label-deployment-card__head" });
        head.appendChild(ui.el("span", { class: "label-deployment-card__kind" }, [
          isPark ? "Quantity park" : "Serial range",
        ]));
        head.appendChild(ui.el("strong", { class: "label-deployment-card__range" }, [
          isPark ? fmt(dep.quantity) + " labels (serials unknown)" : dep.first_serial + " – " + dep.last_serial,
        ]));
        if (!isPark) {
          head.appendChild(ui.el("span", { class: "label-deployment-card__qty" }, [
            fmt(dep.quantity) + " labels",
          ]));
        }
        card.appendChild(head);
        card.appendChild(ui.el("p", { class: "label-deployment-card__meta" }, [
          categoryLabel(dep.category) +
            (dep.note ? " · " + dep.note : "") +
            " · " + formatWhen(dep.created_at) +
            (dep.created_by ? " · " + dep.created_by : ""),
        ]));

        if (isPark) {
          var adjustRow = ui.el("div", { class: "label-deployment-adjust" });
          var adjustInput = ui.el("input", {
            class: "input label-deployment-adjust__input",
            type: "number",
            min: "0",
            step: "1",
            value: String(dep.quantity),
          });
          var adjustBtn = ui.el("button", { class: "btn-sm", type: "button" }, ["Update count"]);
          adjustBtn.onclick = function () {
            var qty = parseInt(adjustInput.value, 10);
            if (isNaN(qty) || qty < 0) {
              window.alert("Enter a valid quantity (0 to clear the park).");
              return;
            }
            var msg = qty === 0
              ? "Clear this park entirely?"
              : "Set parked quantity to " + qty + "?";
            if (!window.confirm(msg)) return;
            adjustPark(dep.deployment_id, qty);
          };
          adjustRow.appendChild(ui.el("span", { class: "label-deployment-adjust__label" }, ["Parked count:"]));
          adjustRow.appendChild(adjustInput);
          adjustRow.appendChild(adjustBtn);
          card.appendChild(adjustRow);
          card.appendChild(ui.el("p", { class: "muted label-deployment-adjust-hint" }, [
            "Lower this as pre-scanner bags are scanned in. Set to 0 to clear.",
          ]));
        }

        var revokeBtn = ui.el("button", {
          class: "btn-ghost btn-sm",
          type: "button",
        }, [isPark ? "Clear park" : "Return range to available"]);
        revokeBtn.onclick = function () {
          var msg = isPark
            ? "Clear parked quantity of " + dep.quantity + "?"
            : "Return " + dep.quantity + " fenced labels to available?\n\n" + dep.first_serial + " – " + dep.last_serial;
          if (!window.confirm(msg)) return;
          revokeDeployment(dep.deployment_id);
        };
        card.appendChild(revokeBtn);
        listEl.appendChild(card);
      });
    }

    async function loadInventory() {
      if (!ctx.api || !ctx.api.traceability) {
        renderInventory(null);
        return;
      }
      try {
        var inv = await ctx.api.traceability("/labels/inventory");
        renderInventory(inv);
      } catch (e) {
        inventoryEl.textContent = "Could not load inventory: " + (e.message || e);
      }
    }

    async function loadDeployments() {
      if (!ctx.api || !ctx.api.traceability) {
        listEl.innerHTML = "";
        listEl.appendChild(ui.el("p", { class: "error-box" }, ["Traceability API not configured."]));
        return;
      }
      try {
        var data = await ctx.api.traceability("/labels/deployments");
        renderDeployments((data && data.deployments) || []);
      } catch (e) {
        listEl.innerHTML = "";
        listEl.appendChild(ui.el("p", { class: "error-box" }, [String(e.message || e)]));
      }
    }

    async function revokeDeployment(id) {
      try {
        await ctx.api.traceability("/labels/deployments/" + encodeURIComponent(id) + "/revoke", {
          method: "POST",
        });
        await loadInventory();
        await loadDeployments();
      } catch (e) {
        window.alert(String(e.message || e));
      }
    }

    async function adjustPark(id, quantity) {
      try {
        await ctx.api.traceability("/labels/deployments/" + encodeURIComponent(id), {
          method: "PATCH",
          body: { quantity: quantity },
        });
        await loadInventory();
        await loadDeployments();
      } catch (e) {
        window.alert(String(e.message || e));
      }
    }

    rangeForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!ctx.api || !ctx.api.traceability) {
        setMsg(rangeMsg, "Traceability API not configured.", true);
        return;
      }
      var first = normalizeSerial(firstInput.value);
      var last = normalizeSerial(lastInput.value);
      if (!SERIAL_RE.test(first) || !SERIAL_RE.test(last)) {
        setMsg(rangeMsg, "Enter valid Bag IDs (BAG-YYYY-NNNNNN).", true);
        return;
      }
      setMsg(rangeMsg, "Saving…");
      rangeSubmit.disabled = true;
      ctx.api.traceability("/labels/deployments", {
        method: "POST",
        body: {
          kind: "serial_range",
          first_serial: first,
          last_serial: last,
          category: rangeCategory.value,
          note: (rangeNote.value || "").trim() || null,
        },
      }).then(function () {
        firstInput.value = "";
        lastInput.value = "";
        rangeNote.value = "";
        setMsg(rangeMsg, "Serial range fenced.", false);
        return loadInventory().then(loadDeployments);
      }).catch(function (e) {
        setMsg(rangeMsg, String(e.message || e), true);
      }).finally(function () {
        rangeSubmit.disabled = false;
      });
    });

    parkForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!ctx.api || !ctx.api.traceability) {
        setMsg(parkMsg, "Traceability API not configured.", true);
        return;
      }
      var qty = parseInt(parkQtyInput.value, 10);
      if (isNaN(qty) || qty < 1) {
        setMsg(parkMsg, "Enter a quantity of at least 1.", true);
        return;
      }
      setMsg(parkMsg, "Saving…");
      parkSubmit.disabled = true;
      ctx.api.traceability("/labels/deployments", {
        method: "POST",
        body: {
          kind: "quantity_park",
          quantity: qty,
          category: parkCategory.value,
          note: (parkNote.value || "").trim() || null,
        },
      }).then(function () {
        parkQtyInput.value = "";
        parkNote.value = "";
        setMsg(parkMsg, "Quantity parked.", false);
        return loadInventory().then(loadDeployments);
      }).catch(function (e) {
        setMsg(parkMsg, String(e.message || e), true);
      }).finally(function () {
        parkSubmit.disabled = false;
      });
    });

    loadInventory();
    loadDeployments();
  }

  CIS.modules.push({
    id: "label_deployment",
    title: "Label Fencing",
    kind: "app",
    icon: "labels",
    description: "Fence serial ranges or park quantities for label stock",
    requires: "traceability.labels.deployment",
    render: render,
  });
})();
