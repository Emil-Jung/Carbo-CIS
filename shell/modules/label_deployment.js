/* Label Deployment — record serial ranges excised from available label stock. */

(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var LD_UI_VERSION = "1.0.0";
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

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Label Deployment"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Record labels that are still part of total production but must not count as available — e.g. sent for testing, or already on bags before scanners were live. UI " + LD_UI_VERSION + ".",
    ]));

    container.appendChild(ui.el("button", {
      class: "btn-ghost btn-sm hub-back",
      type: "button",
      onclick: function () {
        if (CIS.openModule) CIS.openModule("labels");
      },
    }, ["Back to Labels"]));

    var inventoryEl = ui.el("div", { class: "label-deployment-inventory muted" }, ["Loading inventory…"]);
    var inventoryPanel = ui.el("section", { class: "label-deployment-panel" });
    inventoryPanel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Label stock summary"]));
    inventoryPanel.appendChild(inventoryEl);
    container.appendChild(inventoryPanel);

    var formPanel = ui.el("section", { class: "label-deployment-panel" });
    formPanel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["New deployment"]));
    formPanel.appendChild(ui.el("p", { class: "muted label-deployment-hint" }, [
      "Enter the first and last Bag ID in the range (e.g. BAG-2026-003311 to BAG-2026-003511). All labels in the range must already exist and be available.",
    ]));

    var form = ui.el("form", { class: "label-deployment-form" });
    var firstInput = ui.el("input", {
      class: "input",
      type: "text",
      placeholder: "First Bag ID",
      autocomplete: "off",
    });
    var lastInput = ui.el("input", {
      class: "input",
      type: "text",
      placeholder: "Last Bag ID",
      autocomplete: "off",
    });
    var categorySelect = ui.el("select", { class: "input" });
    CATEGORIES.forEach(function (cat) {
      categorySelect.appendChild(ui.el("option", { value: cat.key }, [cat.label]));
    });
    var noteInput = ui.el("textarea", {
      class: "input label-deployment-note",
      rows: "2",
      placeholder: "Note (optional) — e.g. plane to England for testing",
    });

    form.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["First serial"]),
      firstInput,
    ]));
    form.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["Last serial"]),
      lastInput,
    ]));
    form.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["Reason"]),
      categorySelect,
    ]));
    form.appendChild(ui.el("label", { class: "label-deployment-field" }, [
      ui.el("span", { class: "label-deployment-field__label" }, ["Note"]),
      noteInput,
    ]));

    var formMsg = ui.el("p", { class: "label-deployment-msg muted" });
    var submitBtn = ui.el("button", { class: "btn-sm", type: "submit" }, ["Record deployment"]);
    form.appendChild(formMsg);
    form.appendChild(submitBtn);
    formPanel.appendChild(form);
    container.appendChild(formPanel);

    var listPanel = ui.el("section", { class: "label-deployment-panel" });
    listPanel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Active deployments"]));
    var listEl = ui.el("div", { class: "label-deployment-list" });
    listPanel.appendChild(listEl);
    container.appendChild(listPanel);

    if (ctx.setFloatingBack) {
      ctx.setFloatingBack({
        label: "← Labels",
        onClick: function () {
          if (CIS.openModule) CIS.openModule("labels");
        },
      });
    }

    function setFormMsg(text, isError) {
      formMsg.textContent = text || "";
      formMsg.className = "label-deployment-msg" + (text ? (isError ? " is-error" : " is-ok") : " muted");
    }

    function renderInventory(inv) {
      if (!inv) {
        inventoryEl.textContent = "Could not load inventory.";
        return;
      }
      var c = inv.counts || {};
      inventoryEl.innerHTML =
        "<strong>" + fmt(inv.total) + "</strong> produced total · " +
        "<strong class=\"ld-stat-ready\">" + fmt(inv.available) + "</strong> available · " +
        "<strong class=\"ld-stat-deployed\">" + fmt(inv.deployed || c.deployed || 0) + "</strong> deployed · " +
        fmt(c.used || inv.used || 0) + " on bags · " +
        fmt(c.allocated || inv.allocated || 0) + " pending print · " +
        fmt(c.void || inv.void || 0) + " void";
    }

    function renderDeployments(rows) {
      listEl.innerHTML = "";
      var active = (rows || []).filter(function (d) { return d.active !== false && !d.revoked_at; });
      if (!active.length) {
        listEl.appendChild(ui.el("p", { class: "muted" }, ["No active deployments recorded."]));
        return;
      }
      active.forEach(function (dep) {
        var card = ui.el("article", { class: "label-deployment-card" });
        var head = ui.el("div", { class: "label-deployment-card__head" });
        head.appendChild(ui.el("strong", { class: "label-deployment-card__range" }, [
          dep.first_serial + " – " + dep.last_serial,
        ]));
        head.appendChild(ui.el("span", { class: "label-deployment-card__qty" }, [
          fmt(dep.quantity) + " labels",
        ]));
        card.appendChild(head);
        card.appendChild(ui.el("p", { class: "label-deployment-card__meta" }, [
          categoryLabel(dep.category) +
            (dep.note ? " · " + dep.note : "") +
            " · " + formatWhen(dep.created_at) +
            (dep.created_by ? " · " + dep.created_by : ""),
        ]));
        var revokeBtn = ui.el("button", {
          class: "btn-ghost btn-sm",
          type: "button",
        }, ["Restore to available"]);
        revokeBtn.onclick = function () {
          if (!window.confirm(
            "Restore " + dep.quantity + " labels back to available stock?\n\n" +
              dep.first_serial + " – " + dep.last_serial
          )) return;
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

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!ctx.api || !ctx.api.traceability) {
        setFormMsg("Traceability API not configured.", true);
        return;
      }
      var first = normalizeSerial(firstInput.value);
      var last = normalizeSerial(lastInput.value);
      if (!SERIAL_RE.test(first) || !SERIAL_RE.test(last)) {
        setFormMsg("Enter valid Bag IDs (BAG-YYYY-NNNNNN).", true);
        return;
      }
      setFormMsg("Saving…");
      submitBtn.disabled = true;
      ctx.api.traceability("/labels/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_serial: first,
          last_serial: last,
          category: categorySelect.value,
          note: (noteInput.value || "").trim() || null,
        }),
      }).then(function () {
        firstInput.value = "";
        lastInput.value = "";
        noteInput.value = "";
        setFormMsg("Deployment recorded.", false);
        return loadInventory().then(loadDeployments);
      }).catch(function (e) {
        setFormMsg(String(e.message || e), true);
      }).finally(function () {
        submitBtn.disabled = false;
      });
    });

    loadInventory();
    loadDeployments();
  }

  CIS.modules.push({
    id: "label_deployment",
    title: "Label Deployment",
    kind: "app",
    icon: "labels",
    description: "Record labels excised from available stock",
    requires: "traceability.labels.deployment",
    render: render,
  });
})();
