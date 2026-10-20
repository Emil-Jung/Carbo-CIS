/* Pallet Configuration — packaging product catalog (CIS). */

(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function fmtKg(n) {
    if (n == null || isNaN(n)) return "—";
    return CIS.formatMassFromKg(n, { forceKg: true });
  }

  function fmtNum(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  var FSC_BAG_POLICIES = [
    { value: "fsc_only", label: "FSC only (FSC bulk only)" },
    { value: "non_fsc_only", label: "Non-FSC only (non-FSC bulk only)" },
  ];

  function fscPolicyLabel(code) {
    var found = FSC_BAG_POLICIES.filter(function (o) {
      return o.value === code;
    })[0];
    return (found && found.label) || code || "—";
  }

  function render(container, ctx) {
    var ui = CIS.ui;
    var products = [];
    var floorByCode = {};
    var onScannersList = [];
    var editing = null;
    var canToggleScanners = CIS.hasPermission("traceability.packaging_shift");

    container.innerHTML = "";
    container.className = "module-content pallet-config-host";

    var basketModal = ui.el("div", {
      class: "packaging-shift-basket-modal",
      hidden: true,
      role: "dialog",
      "aria-modal": "true",
    });
    var basketModalCard = ui.el("div", { class: "packaging-shift-basket-modal__card" });
    basketModal.appendChild(basketModalCard);

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Packing & products"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Manage pallet SKUs and packing-floor status here (CIS only — packaging scanner apps are unchanged). ",
      "Every packing scanner shows the same product list when ",
      ui.el("strong", {}, ["Packing scanner"]),
      " is Yes; Bag Walk is shared across scanners. Turn SKUs on or off in that column — not when adding a new catalog row.",
    ]));

    var status = ui.el("p", { class: "muted pallet-config-status" }, [""]);
    container.appendChild(status);

    var workspace = ui.el("div", { class: "walvis-dispatch-workspace pallet-config-workspace" });
    var formPanel = ui.el("section", { class: "walvis-dispatch-panel pallet-config-panel" });
    var listPanel = ui.el("section", { class: "walvis-dispatch-panel walvis-dispatch-panel--list pallet-config-list-panel" });
    listPanel.appendChild(
      ui.el("h3", { class: "walvis-dispatch-panel-title" }, ["Products"])
    );
    listPanel.appendChild(
      ui.el("div", { class: "packing-floor-legend" }, [
        ui.el("p", { class: "packing-floor-legend__title" }, ["Column guide"]),
        ui.el("dl", { class: "packing-floor-legend__dl" }, [
          ui.el("dt", {}, ["Packing scanner"]),
          ui.el("dd", {}, [
            "Yes = this SKU appears on the packing scanner product list for operators. ",
            "No = hidden on scanners (does not delete catalog data).",
          ]),
          ui.el("dt", {}, ["Pallet basket"]),
          ui.el("dd", {}, [
            "Bulk charcoal already consumed at the plant and waiting for an A4 pallet wrap — ",
            "not the same as “on scanner”. Empty = nothing in the pool for that SKU.",
          ]),
          ui.el("dt", {}, ["Production target"]),
          ui.el("dd", {}, [
            "Kg the line must accumulate before one pallet is complete (scale / build logic). ",
            "This is not the commercial nominal weight — use Commercial kg for labels or customer-facing nominal weight.",
          ]),
          ui.el("dt", {}, ["Commercial kg"]),
          ui.el("dd", {}, [
            "Optional nominal pallet weight for reports and paperwork; does not change when the build completes.",
          ]),
        ]),
      ])
    );
    var listHost = ui.el("div", { class: "walvis-dispatch-list-col pallet-config-list" });
    listPanel.appendChild(listHost);

    formPanel.appendChild(
      ui.el("h3", { class: "walvis-dispatch-panel-title" }, ["Add product"])
    );
    formPanel.appendChild(
      ui.el("p", { class: "muted pallet-config-add-lead" }, [
        "New SKUs join the catalog only — set ",
        ui.el("strong", {}, ["Packing scanner"]),
        " to Yes in the table when a line should run them.",
      ])
    );
    var form = buildForm(ui, null);
    formPanel.appendChild(form.el);

    workspace.appendChild(formPanel);
    workspace.appendChild(listPanel);
    container.appendChild(workspace);
    container.appendChild(basketModal);

    function setStatus(text, isError) {
      status.textContent = text || "";
      status.className = isError ? "error-box" : "muted";
    }

    function buildForm(ui, product) {
      var isEdit = !!product;
      var el = ui.el("form", { class: "walvis-dispatch-form pallet-config-form" });

      var codeInput = ui.el("input", {
        class: "wd-field-input",
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

      var nameInput = ui.el("input", { class: "wd-field-input", type: "text", required: "required" });
      var clientInput = ui.el("input", { class: "wd-field-input", type: "text", autocomplete: "off" });
      var retailInput = ui.el("input", {
        class: "wd-field-input wd-field-narrow",
        type: "number",
        min: "0.001",
        step: "0.001",
        required: "required",
      });
      var bagsInput = ui.el("input", {
        class: "wd-field-input wd-field-narrow",
        type: "number",
        min: "1",
        step: "1",
        required: "required",
      });
      var prodPalletInput = ui.el("input", {
        class: "wd-field-input wd-field-narrow",
        type: "number",
        min: "0.001",
        step: "0.001",
        required: "required",
      });
      var commercialInput = ui.el("input", {
        class: "wd-field-input wd-field-narrow",
        type: "number",
        min: "0.001",
        step: "0.001",
      });
      var prodPackInput = ui.el("input", {
        class: "wd-field-input wd-field-narrow",
        type: "number",
        min: "0.001",
        step: "0.001",
      });
      var activeInput = null;
      var fscSel = ui.el("select", { class: "wd-field-select", required: "required" });
      fscSel.appendChild(ui.el("option", { value: "" }, ["— Select source-bag policy —"]));
      FSC_BAG_POLICIES.forEach(function (opt) {
        fscSel.appendChild(ui.el("option", { value: opt.value }, [opt.label]));
      });

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
        fscSel.value =
          product.fsc_bag_policy === "fsc_only" || product.fsc_bag_policy === "non_fsc_only"
            ? product.fsc_bag_policy
            : "non_fsc_only";
      } else {
        fscSel.value = "";
        codeInput.addEventListener("input", function () {
          if (codeInput.value.trim().toUpperCase().indexOf("LF") === 0) {
            fscSel.value = "fsc_only";
          }
        });
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
      el.appendChild(
        field(
          "Production pallet target (kg)",
          prodPalletInput,
          "Plant scale target — when this kg is reached, one pallet build is complete. Not the commercial nominal weight."
        )
      );
      el.appendChild(
        field(
          "Commercial pallet weight (kg)",
          commercialInput,
          "Optional customer / label nominal weight — does not drive the packing line counter."
        )
      );
      el.appendChild(field("Production pack weight (kg)", prodPackInput, "Optional — when fill weight differs from declared retail (e.g. LF4)."));
      el.appendChild(
        field(
          "Source bags (FSC)",
          fscSel,
          "Which bulk bags may be scanned into this SKU at the packing plant. LF lines are typically FSC only."
        )
      );
      if (isEdit) {
        activeInput = ui.el("input", { type: "checkbox", class: "pallet-config-active-cb" });
        activeInput.checked = product.active === false;
        el.appendChild(
          field(
            "Retired from catalog",
            activeInput,
            "Checked = SKU discontinued (hidden from Packing scanner). To run a SKU today, use Packing scanner Yes in the table — not this box."
          )
        );
      }

      var actions = ui.el("div", { class: "pallet-config-form-actions" });
      var submit = ui.el("button", {
        class: "settings-action-btn pallet-config-save-btn",
        type: "submit",
      }, [isEdit ? "Save changes" : "Add product"]);
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
        if (!fscSel.value) {
          setStatus("Choose source bags: FSC only or Non-FSC only (never mixed on one SKU).", true);
          fscSel.focus();
          return;
        }
        var payload = {
          name: nameInput.value.trim(),
          retail_bag_weight_kg: parseFloat(retailInput.value),
          bags_per_pallet: parseInt(bagsInput.value, 10),
          production_pallet_weight_kg: parseFloat(prodPalletInput.value),
          client_name: clientInput.value.trim() || null,
          fsc_bag_policy: fscSel.value,
        };
        if (isEdit) {
          payload.active = !activeInput.checked;
        }
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
      formPanel.appendChild(ui.el("h3", { class: "walvis-dispatch-panel-title" }, [
        editing ? "Edit " + editing.product_code : "Add product",
      ]));
      formWrap = buildForm(ui, editing);
      formPanel.appendChild(formWrap.el);
    }

    function closeBasketModal() {
      basketModal.hidden = true;
      basketModalCard.innerHTML = "";
    }

    function openReassignModal(productCode, basketKg, onDone) {
      basketModalCard.innerHTML = "";
      basketModalCard.appendChild(
        ui.el("h3", { class: "packaging-shift-basket-modal__title" }, [
          "Move basket material — " + productCode,
        ])
      );
      basketModalCard.appendChild(
        ui.el("p", { class: "muted packaging-shift-basket-modal__lead" }, [
          fmtKg(basketKg) + " is still in the pallet basket for ",
          productCode,
          ". Choose another active SKU to take it over (same source bags, used first when wrapping).",
        ])
      );
      var sel = ui.el("select", { class: "packaging-shift-basket-select" });
      var opts = products.filter(function (p) {
        return p.active !== false && p.product_code !== productCode;
      });
      if (!opts.length) {
        sel.appendChild(ui.el("option", { value: "" }, ["No other active products"]));
        sel.disabled = true;
      } else {
        opts.forEach(function (p) {
          sel.appendChild(
            ui.el("option", { value: p.product_code }, [
              p.product_code + (p.name ? " — " + p.name : ""),
            ])
          );
        });
      }
      basketModalCard.appendChild(sel);
      var err = ui.el("p", { class: "error-box packaging-shift-basket-modal__err", hidden: true }, [""]);
      basketModalCard.appendChild(err);
      var actions = ui.el("div", { class: "packaging-shift-basket-modal__actions" });
      actions.appendChild(
        ui.el("button", { type: "button", class: "btn btn-secondary", onclick: closeBasketModal }, ["Cancel"])
      );
      actions.appendChild(
        ui.el("button", {
          type: "button",
          class: "btn",
          onclick: function () {
            var to = (sel.value || "").trim();
            if (!to) {
              err.textContent = "Choose a target product.";
              err.hidden = false;
              return;
            }
            closeBasketModal();
            onDone(to);
          },
        }, ["Move pool & turn off scanners"])
      );
      basketModalCard.appendChild(actions);
      basketModal.hidden = false;
    }

    async function setOnScanners(productCode, wantOn, reassignTo) {
      var body = { on_scanners: wantOn };
      if (reassignTo) body.reassign_to_product_code = reassignTo;
      setStatus(wantOn ? "Turning on " + productCode + "…" : "Turning off " + productCode + "…");
      try {
        await ctx.api.traceability(
          "/packaging-floor/products/" + encodeURIComponent(productCode) + "/scanners",
          { method: "POST", body: body }
        );
        await load();
        setStatus(productCode + (wantOn ? " is on scanners." : " is off scanners."));
        if (CIS.refreshOperationsSummary) CIS.refreshOperationsSummary();
      } catch (e) {
        setStatus("Could not update scanners: " + (e.message || e), true);
        await load();
      }
    }

    function appendScannerCell(tr, p, onScan, basketKg) {
      var scanTd = ui.el("td", { class: "packing-floor-col-scan" });
      if (p.active === false) {
        scanTd.appendChild(ui.el("span", { class: "packing-floor-muted-cell" }, ["— catalog inactive"]));
      } else if (!canToggleScanners) {
        scanTd.appendChild(
          ui.el("span", {
            class: "packing-floor-pill packing-floor-pill--" + (onScan ? "yes" : "no"),
          }, [onScan ? "Yes" : "No"])
        );
      } else {
        var row = ui.el("div", { class: "packing-floor-scan-control" });
        var stateEl = ui.el("span", {
          class: "packing-floor-pill packing-floor-pill--" + (onScan ? "yes" : "no"),
        }, [onScan ? "Yes" : "No"]);
        var cb = ui.el("input", {
          type: "checkbox",
          "aria-label": "Packing scanner menu for " + p.product_code,
        });
        cb.checked = onScan;
        cb.addEventListener("change", function () {
          var want = cb.checked;
          stateEl.textContent = want ? "Yes" : "No";
          stateEl.className =
            "packing-floor-pill packing-floor-pill--" + (want ? "yes" : "no");
          if (!want && basketKg > 0.001) {
            cb.checked = true;
            stateEl.textContent = "Yes";
            stateEl.className = "packing-floor-pill packing-floor-pill--yes";
            openReassignModal(p.product_code, basketKg, function (to) {
              void setOnScanners(p.product_code, false, to);
            });
            return;
          }
          cb.disabled = true;
          void setOnScanners(p.product_code, want, null).finally(function () {
            cb.disabled = false;
          });
        });
        row.appendChild(stateEl);
        row.appendChild(cb);
        scanTd.appendChild(row);
      }
      tr.appendChild(scanTd);
    }

    function appendBasketCell(tr, basketKg) {
      var basketTd = ui.el("td", { class: "packing-floor-col-basket packing-floor-num" });
      if (basketKg > 0.001) {
        basketTd.appendChild(ui.el("div", { class: "packing-floor-basket-kg" }, [fmtKg(basketKg)]));
        basketTd.appendChild(
          ui.el("div", { class: "packing-floor-basket-sub" }, ["waiting to wrap"])
        );
      } else {
        basketTd.appendChild(ui.el("span", { class: "packing-floor-muted-cell" }, ["Empty"]));
      }
      tr.appendChild(basketTd);
    }

    function renderProductTable(list, showScannerCols) {
      var wrap = ui.el("div", { class: "packing-floor-table-wrap" });
      var table = ui.el("table", { class: "packing-floor-table" });
      var thead = ui.el("thead", {});
      if (showScannerCols) {
        var groupRow = ui.el("tr", { class: "packing-floor-head-group" });
        groupRow.appendChild(ui.el("th", { colspan: "2", scope: "colgroup" }, ["Product"]));
        groupRow.appendChild(ui.el("th", { colspan: "2", scope: "colgroup" }, ["Packing floor status"]));
        groupRow.appendChild(ui.el("th", { colspan: "5", scope: "colgroup" }, ["Pallet specification"]));
        groupRow.appendChild(ui.el("th", { class: "packing-floor-col-action", scope: "colgroup" }, [""]));
        thead.appendChild(groupRow);
      }
      var hr = ui.el("tr", {});
      hr.appendChild(ui.el("th", { scope: "col", class: "packing-floor-col-code" }, ["SKU"]));
      hr.appendChild(ui.el("th", { scope: "col", class: "packing-floor-col-name" }, ["Name"]));
      if (showScannerCols) {
        hr.appendChild(ui.el("th", { scope: "col", class: "packing-floor-col-scan" }, ["Packing scanner"]));
        hr.appendChild(ui.el("th", { scope: "col", class: "packing-floor-col-basket" }, ["Pallet basket"]));
      }
      hr.appendChild(ui.el("th", { scope: "col" }, ["Source FSC"]));
      hr.appendChild(ui.el("th", { scope: "col", class: "packing-floor-num" }, ["Retail kg"]));
      hr.appendChild(ui.el("th", { scope: "col", class: "packing-floor-num" }, ["Bags / pallet"]));
      hr.appendChild(
        ui.el("th", {
          scope: "col",
          class: "packing-floor-num",
          title: "Production target — kg on the scale before one pallet build completes",
        }, ["Prod. target kg"])
      );
      hr.appendChild(
        ui.el("th", {
          scope: "col",
          class: "packing-floor-num",
          title: "Commercial nominal pallet weight (optional)",
        }, ["Commercial kg"])
      );
      hr.appendChild(ui.el("th", { scope: "col", class: "packing-floor-col-action" }, [""]));
      thead.appendChild(hr);
      table.appendChild(thead);

      var tbodyEl = ui.el("tbody");
      list.forEach(function (p) {
        var tr = ui.el("tr");
        var floor = floorByCode[p.product_code] || {};
        var onScan = !!(p.on_scanners || floor.on_scanners);
        var basketKg = floor.basket_kg != null ? floor.basket_kg : 0;
        if (p.active === false) tr.className = "pallet-config-row-inactive";
        if (showScannerCols && onScan) {
          tr.className = (tr.className ? tr.className + " " : "") + "pallet-config-row-on-scanner";
        }
        tr.appendChild(ui.el("td", { class: "packing-floor-col-code" }, [
          ui.el("strong", {}, [p.product_code]),
        ]));
        tr.appendChild(ui.el("td", { class: "packing-floor-col-name" }, [p.name || "—"]));
        if (showScannerCols) {
          appendScannerCell(tr, p, onScan, basketKg);
          appendBasketCell(tr, basketKg);
        }
        tr.appendChild(ui.el("td", {}, [p.fsc_bag_policy_label || fscPolicyLabel(p.fsc_bag_policy)]));
        tr.appendChild(ui.el("td", { class: "packing-floor-num" }, [fmtKg(p.retail_bag_weight_kg)]));
        tr.appendChild(ui.el("td", { class: "packing-floor-num" }, [fmtNum(p.bags_per_pallet)]));
        tr.appendChild(ui.el("td", { class: "packing-floor-num" }, [fmtKg(p.production_target_kg)]));
        tr.appendChild(
          ui.el("td", { class: "packing-floor-num" }, [
            p.commercial_pallet_weight_kg != null ? fmtKg(p.commercial_pallet_weight_kg) : "—",
          ])
        );
        var actions = ui.el("td", { class: "packing-floor-col-action" });
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
        tbodyEl.appendChild(tr);
      });
      table.appendChild(tbodyEl);
      wrap.appendChild(table);
      return wrap;
    }

    function appendProductBlock(title, list, emptyText, showScannerCols) {
      var block = ui.el("div", { class: "pallet-config-product-block" });
      block.appendChild(ui.el("h4", { class: "pallet-config-block-title" }, [title]));
      if (!list.length) {
        block.appendChild(ui.el("p", { class: "muted pallet-config-block-empty" }, [emptyText]));
      } else {
        block.appendChild(renderProductTable(list, !!showScannerCols));
      }
      listHost.appendChild(block);
    }

    function paintList() {
      listHost.innerHTML = "";
      if (!products.length) {
        listHost.appendChild(ui.el("p", { class: "muted" }, ["No products configured yet."]));
        return;
      }
      var active = products.filter(function (p) {
        return p.active !== false;
      });
      var inactive = products.filter(function (p) {
        return p.active === false;
      });
      active.sort(function (a, b) {
        return String(a.product_code).localeCompare(String(b.product_code));
      });
      inactive.sort(function (a, b) {
        return String(a.product_code).localeCompare(String(b.product_code));
      });
      appendProductBlock(
        "Catalog — active products",
        active,
        "No active products — add a SKU or reactivate one from inactive below.",
        true
      );
      appendProductBlock(
        "Catalog — inactive (retired)",
        inactive,
        "No inactive products.",
        false
      );
    }

    async function load() {
      if (!ctx.api || !ctx.api.traceability) {
        setStatus("Traceability API not configured.", true);
        return;
      }
      setStatus("Loading…");
      try {
        var data = await ctx.api.traceability("/packaging-floor");
        products = data.products || [];
        floorByCode = {};
        products.forEach(function (p) {
          floorByCode[p.product_code] = p;
        });
        onScannersList = data.on_scanners || [];
        paintList();
        var nActive = products.filter(function (p) {
          return p.active !== false;
        }).length;
        setStatus(
          onScannersList.length
            ? "Packing scanner: " + onScannersList.join(", ") + " · " + nActive + " in catalog."
            : nActive + " in catalog · packing scanner menu empty."
        );
      } catch (e) {
        setStatus("Could not load: " + (e.message || e), true);
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
    title: "Packing & products",
    section: "Production",
    kind: "app",
    order: 5,
    icon: "config",
    description: "Pallet SKUs, on-scanners toggles, and basket kg in one place",
    requires: "traceability.pallet_configuration",
    render: render,
  });
})();
