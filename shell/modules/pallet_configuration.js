/* Pallet Configuration — packaging product catalog (CIS). */

(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function fmtKg(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 }) + " kg";
  }

  function fmtNum(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  function render(container, ctx) {
    var ui = CIS.ui;
    var products = [];
    var editing = null;

    container.innerHTML = "";
    container.className = "module-content pallet-config-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Pallet Configuration"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Retail pallet SKUs used at the packaging plant (CH05W, CH10, LF4, LF2.5, …). ",
      "Changes apply to new pallet builds only — completed pallets and build sessions already ",
      "in progress keep the targets recorded when they were opened.",
    ]));

    var status = ui.el("p", { class: "muted" }, [""]);
    container.appendChild(status);

    var listHost = ui.el("div", { class: "pallet-config-list" });
    container.appendChild(listHost);

    var formPanel = ui.el("section", { class: "pallet-config-panel ct-form" });
    formPanel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Add product"]));
    var form = buildForm(ui, null);
    formPanel.appendChild(form.el);
    container.appendChild(formPanel);

    function setStatus(text, isError) {
      status.textContent = text || "";
      status.className = isError ? "error-box" : "muted";
    }

    function buildForm(ui, product) {
      var isEdit = !!product;
      var el = ui.el("form", { class: "pallet-config-form" });

      var codeInput = ui.el("input", {
        class: "input",
        type: "text",
        placeholder: "e.g. CH10",
        autocomplete: "off",
        required: "required",
      });
      if (isEdit) {
        codeInput.value = product.product_code;
        codeInput.readOnly = true;
        codeInput.disabled = true;
      }

      var nameInput = ui.el("input", { class: "input", type: "text", required: "required" });
      var clientInput = ui.el("input", { class: "input", type: "text", autocomplete: "off" });
      var retailInput = ui.el("input", { class: "input", type: "number", min: "0.001", step: "0.001", required: "required" });
      var bagsInput = ui.el("input", { class: "input", type: "number", min: "1", step: "1", required: "required" });
      var prodPalletInput = ui.el("input", { class: "input", type: "number", min: "0.001", step: "0.001", required: "required" });
      var commercialInput = ui.el("input", { class: "input", type: "number", min: "0.001", step: "0.001" });
      var prodPackInput = ui.el("input", { class: "input", type: "number", min: "0.001", step: "0.001" });
      var activeInput = ui.el("input", { type: "checkbox" });
      activeInput.checked = true;

      if (product) {
        nameInput.value = product.name || "";
        clientInput.value = product.client_name || "";
        retailInput.value = String(product.retail_bag_weight_kg || "");
        bagsInput.value = String(product.bags_per_pallet || "");
        prodPalletInput.value = String(
          product.production_pallet_weight_kg != null
            ? product.production_pallet_weight_kg
            : product.production_target_kg || product.pallet_weight_kg || ""
        );
        commercialInput.value =
          product.commercial_pallet_weight_kg != null ? String(product.commercial_pallet_weight_kg) : "";
        prodPackInput.value =
          product.production_pack_weight_kg != null ? String(product.production_pack_weight_kg) : "";
        activeInput.checked = product.active !== false;
      }

      function field(label, control, hint) {
        var wrap = ui.el("label", { class: "ct-field" }, [
          ui.el("span", { class: "ct-field-label" }, [label]),
          control,
        ]);
        if (hint) wrap.appendChild(ui.el("span", { class: "muted pallet-config-hint" }, [hint]));
        return wrap;
      }

      el.appendChild(field("Product code", codeInput, isEdit ? "Code cannot be changed." : "Letters, digits, dot, dash — e.g. CH10, LF2.5"));
      el.appendChild(field("Name", nameInput));
      el.appendChild(field("Client", clientInput, "Optional — e.g. Big-K England"));
      el.appendChild(field("Retail bag weight (kg)", retailInput));
      el.appendChild(field("Bags per pallet", bagsInput));
      el.appendChild(field("Production pallet target (kg)", prodPalletInput, "Kg accumulated before one pallet is complete."));
      el.appendChild(field("Commercial pallet weight (kg)", commercialInput, "Optional nominal weight for reports."));
      el.appendChild(field("Production pack weight (kg)", prodPackInput, "Optional — when fill weight differs from declared retail (e.g. LF4)."));
      el.appendChild(field("Active", activeInput, "Inactive products are hidden from scanners but history is kept."));

      var actions = ui.el("div", { class: "pallet-config-form-actions" });
      var submit = ui.el("button", { class: "btn", type: "submit" }, [isEdit ? "Save changes" : "Add product"]);
      actions.appendChild(submit);
      if (isEdit) {
        actions.appendChild(ui.el("button", {
          class: "btn-ghost btn-sm",
          type: "button",
          onclick: function () {
            editing = null;
            paintForm();
          },
        }, ["Cancel edit"]));
      }
      el.appendChild(actions);

      el.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var payload = {
          name: nameInput.value.trim(),
          retail_bag_weight_kg: parseFloat(retailInput.value),
          bags_per_pallet: parseInt(bagsInput.value, 10),
          production_pallet_weight_kg: parseFloat(prodPalletInput.value),
          client_name: clientInput.value.trim() || null,
          active: activeInput.checked,
        };
        var commercial = commercialInput.value.trim();
        if (commercial) payload.commercial_pallet_weight_kg = parseFloat(commercial);
        var prodPack = prodPackInput.value.trim();
        if (prodPack) payload.production_pack_weight_kg = parseFloat(prodPack);

        if (isEdit) {
          saveProduct(product.product_code, payload);
        } else {
          payload.product_code = codeInput.value.trim().toUpperCase();
          createProduct(payload);
        }
      });

      return {
        el: el,
        setTitle: function (t) {
          submit.textContent = t;
        },
      };
    }

    var formWrap = { el: form.el };

    function paintForm() {
      formPanel.innerHTML = "";
      formPanel.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, [
        editing ? "Edit " + editing.product_code : "Add product",
      ]));
      formWrap = buildForm(ui, editing);
      formPanel.appendChild(formWrap.el);
    }

    function paintList() {
      listHost.innerHTML = "";
      if (!products.length) {
        listHost.appendChild(ui.el("p", { class: "muted" }, ["No products configured yet."]));
        return;
      }
      var table = ui.el("table", { class: "data pallet-config-table" });
      table.innerHTML =
        "<thead><tr>" +
        "<th>Code</th><th>Name</th><th>Client</th>" +
        "<th>Retail</th><th>Bags</th><th>Production target</th><th>Status</th><th></th>" +
        "</tr></thead>";
      var tbody = ui.el("tbody");
      products.forEach(function (p) {
        var tr = ui.el("tr");
        if (p.active === false) tr.className = "pallet-config-row-inactive";
        tr.innerHTML =
          "<td><strong>" + ui.escape(p.product_code) + "</strong></td>" +
          "<td>" + ui.escape(p.name || "—") + "</td>" +
          "<td>" + ui.escape(p.client_name || "—") + "</td>" +
          "<td>" + ui.escape(fmtKg(p.retail_bag_weight_kg)) + "</td>" +
          "<td>" + ui.escape(fmtNum(p.bags_per_pallet)) + "</td>" +
          "<td>" + ui.escape(fmtKg(p.production_target_kg)) + "</td>" +
          "<td>" + (p.active === false ? "Inactive" : "Active") + "</td>";
        var actions = ui.el("td", {});
        actions.appendChild(ui.el("button", {
          class: "btn btn-sm",
          type: "button",
          onclick: function () {
            editing = p;
            paintForm();
            formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        }, ["Edit"]));
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      listHost.appendChild(table);
    }

    async function load() {
      if (!ctx.api || !ctx.api.traceability) {
        setStatus("Traceability API not configured.", true);
        return;
      }
      setStatus("Loading…");
      try {
        var data = await ctx.api.traceability("/packaging/products/admin?include_inactive=true");
        products = data.products || [];
        paintList();
        setStatus(products.length + " product(s).");
      } catch (e) {
        setStatus("Could not load products: " + (e.message || e), true);
      }
    }

    async function createProduct(payload) {
      try {
        await ctx.api.traceability("/packaging/products/admin", {
          method: "POST",
          body: payload,
        });
        editing = null;
        paintForm();
        await load();
        setStatus("Product " + payload.product_code + " added.");
      } catch (e) {
        setStatus("Could not add product: " + (e.message || e), true);
      }
    }

    async function saveProduct(code, payload) {
      if (!window.confirm("Save changes to " + code + "?\n\nExisting pallets and open builds are not rewritten.")) return;
      try {
        await ctx.api.traceability("/packaging/products/admin/" + encodeURIComponent(code), {
          method: "PATCH",
          body: payload,
        });
        editing = null;
        paintForm();
        await load();
        setStatus("Product " + code + " updated.");
      } catch (e) {
        setStatus("Could not save: " + (e.message || e), true);
      }
    }

    load();
  }

  CIS.modules.push({
    id: "pallet_configuration",
    title: "Pallet Configuration",
    section: "Production",
    kind: "app",
    order: 5,
    icon: "config",
    description: "Packaging product catalog — pallet sizes and retail SKUs",
    requires: "traceability.pallet_configuration",
    render: render,
  });
})();
