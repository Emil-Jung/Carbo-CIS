/* Traceability Documentation — container load sheet per FCL. */
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

  async function render(container, ctx) {
    var ui = CIS.ui;
    var containers = [];
    var sheetContainerId = "";

    container.className = "module-content td-doc-host";
    if (ctx.applyModuleFloatNavPadding) ctx.applyModuleFloatNavPadding(container);
    container.appendChild(
      ui.el("h2", { class: "module-title" }, ["Traceability Documentation"])
    );
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Operational ",
        ui.el("strong", {}, ["container load sheet"]),
        " for one FCL — preview, download, or print from the manifest and in-container bags.",
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
    });

    function visibleList() {
      if (includeClosed) return containers.slice();
      return containers.filter(function (c) {
        return c.status !== "dispatched" && c.status !== "cancelled";
      });
    }

    /* —— Container sheet (one FCL) —— */
    var sheetSection = ui.el("section", { class: "td-doc-section" });
    sheetSection.appendChild(
      ui.el("h3", { class: "ct-containers-section-title" }, ["Container sheet"])
    );
    sheetSection.appendChild(
      ui.el("p", { class: "muted" }, [
        "Select a container, preview the form, then download or print.",
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
    var sheetActions = ui.el("div", { class: "td-doc-sheet-actions" });
    var sheetBtnPreview = ui.el("button", {
      class: "btn",
      type: "button",
      disabled: "disabled",
    }, ["Preview Container Load Sheet"]);
    sheetActions.appendChild(sheetBtnPreview);
    sheetSection.appendChild(sheetActions);
    var sheetActionMsg = ui.el("p", {
      class: "error-box td-doc-sheet-action-msg td-doc-action-error--hidden",
    }, [""]);
    sheetSection.appendChild(sheetActionMsg);
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
        sheetBtnPreview.disabled = true;
        sheetBtnPreview.title = "Choose a container from the list above.";
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
      sheetBtnPreview.disabled = false;
      sheetBtnPreview.removeAttribute("title");
    }

    function setSheetActionMsg(text) {
      sheetActionMsg.textContent = text || "";
      if (text) sheetActionMsg.classList.remove("td-doc-action-error--hidden");
      else sheetActionMsg.classList.add("td-doc-action-error--hidden");
    }

    function showSheetLoadingModal(initialMessage) {
      var backdrop = ui.el("div", {
        class: "modal-backdrop td-doc-busy-backdrop",
        role: "dialog",
        "aria-modal": "true",
        "aria-busy": "true",
      });
      var dialog = ui.el("div", { class: "modal td-doc-busy-dialog" });
      dialog.appendChild(
        ui.el("h3", { class: "cm-print-dialog-title td-doc-busy-title" }, [
          "Preparing container load sheet",
        ])
      );
      var msgEl = ui.el("p", { class: "td-doc-busy-message" }, [
        initialMessage || "Please wait…",
      ]);
      dialog.appendChild(msgEl);
      dialog.appendChild(
        ui.el("p", { class: "td-doc-busy-hint muted" }, [
          "Please wait — the preview opens when loading finishes. Do not click the button again.",
        ])
      );
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);

      return {
        setMessage: function (text) {
          msgEl.textContent = text || "";
        },
        close: function () {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        },
      };
    }

    async function fetchSheetManifest() {
      if (!sheetContainerId) {
        throw new Error("Choose a container from the list above.");
      }
      return await ctx.api.traceability(
        "/containers/" + encodeURIComponent(sheetContainerId) + "/manifest"
      );
    }

    sheetSelect.addEventListener("change", function () {
      sheetContainerId = sheetSelect.value;
      setSheetActionMsg("");
      paintSheetPreview();
    });

    sheetBtnPreview.addEventListener("click", async function () {
      if (!sheetContainerId) return;
      setSheetActionMsg("");
      var prevBtnLabel = sheetBtnPreview.textContent;
      sheetBtnPreview.disabled = true;
      sheetBtnPreview.textContent = "Loading…";
      var busy = showSheetLoadingModal(
        "Loading container manifest from Traceability…"
      );
      try {
        var manifest = await fetchSheetManifest();
        if (!manifest || !manifest.header) {
          throw new Error("Manifest did not return container header data.");
        }
        if (!CIS.prepareContainerSheetManifest || !CIS.showContainerSheetPreview) {
          throw new Error("Container sheet module not loaded.");
        }
        busy.setMessage(
          "Loading in-container bags (same data as Bags Status → Into container)…"
        );
        manifest = await CIS.prepareContainerSheetManifest(ctx.api, manifest);
        var loadCount = (manifest._sheet_loading_rows || []).length;
        if (!loadCount) {
          throw new Error(
            "No in-container bags found for this FCL. Check Bags Status → Into container."
          );
        }
        busy.close();
        await CIS.showContainerSheetPreview(manifest, "documentation");
      } catch (e) {
        busy.close();
        var msg = e.message || String(e);
        setSheetActionMsg("Could not open preview: " + msg);
      } finally {
        if (sheetContainerId) {
          sheetBtnPreview.disabled = false;
          sheetBtnPreview.textContent = prevBtnLabel;
        }
      }
    });

    async function loadContainers() {
      setStatus("Loading containers…", false);
      try {
        var data = await ctx.api.traceability("/containers");
        containers = (data && data.containers) || [];
        containers.sort(function (a, b) {
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
        paintSheetSelect();
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
    description: "Container load sheets for logistics",
    requires: "traceability.containers",
    render: render,
  });
})();
