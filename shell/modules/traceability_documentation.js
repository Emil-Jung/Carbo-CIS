/* Traceability Documentation — container sheet and (later) EUDR pack generation. */
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
    var selectedId = "";

    container.className = "module-content td-doc-host";
    container.appendChild(
      ui.el("h2", { class: "module-title" }, ["Traceability Documentation"])
    );
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Generate printable traceability documents for export containers. ",
        "Container loading and dispatch are unchanged — use ",
        ui.el("strong", {}, ["Containers"]),
        " for yard operations.",
      ])
    );

    var statusEl = ui.el("p", { class: "muted td-doc-status" }, [""]);
    container.appendChild(statusEl);

    function setStatus(text, isError) {
      statusEl.textContent = text || "";
      statusEl.className = isError ? "error-box td-doc-status" : "muted td-doc-status";
    }

    var pickerSection = ui.el("section", { class: "td-doc-section" });
    pickerSection.appendChild(ui.el("h3", { class: "ct-containers-section-title" }, ["Select container"]));

    var includeClosed = false;
    var toggleClosed = ui.el("button", { class: "btn btn-sm", type: "button" }, [
      "Include shipped and cancelled",
    ]);
    toggleClosed.addEventListener("click", function () {
      includeClosed = !includeClosed;
      toggleClosed.textContent = includeClosed
        ? "Hide shipped and cancelled"
        : "Include shipped and cancelled";
      paintSelect();
    });
    pickerSection.appendChild(toggleClosed);

    var select = ui.el("select", { class: "td-doc-select", required: "required" });
    select.appendChild(ui.el("option", { value: "" }, ["Loading containers…"]));
    pickerSection.appendChild(
      ui.el("label", { class: "ct-field td-doc-field" }, [
        ui.el("span", { class: "ct-field-label" }, ["Container"]),
        select,
      ])
    );

    var preview = ui.el("div", { class: "td-doc-preview muted" }, ["Choose a container to see details."]);
    pickerSection.appendChild(preview);
    container.appendChild(pickerSection);

    var sheetSection = ui.el("section", { class: "td-doc-section" });
    sheetSection.appendChild(
      ui.el("h3", { class: "ct-containers-section-title" }, ["Standard container sheet"])
    );
    sheetSection.appendChild(
      ui.el("p", { class: "muted" }, [
        "Accompanies every container regardless of destination. Uses the current loaded bags from Traceability.",
      ])
    );
    var sheetBtn = ui.el("button", {
      class: "btn",
      type: "button",
      disabled: "disabled",
    }, ["Generate container sheet"]);
    sheetSection.appendChild(sheetBtn);
    container.appendChild(sheetSection);

    var eudrSection = ui.el("section", { class: "td-doc-section td-doc-section--eudr" });
    eudrSection.appendChild(ui.el("h3", { class: "ct-containers-section-title" }, ["EUDR pack"]));
    eudrSection.appendChild(
      ui.el("p", { class: "muted" }, [
        "Optional due-diligence package for EU shipments (statement, shipment summary, producer and farm data, GeoJSON evidence). ",
        "Coming in phase 2 after the standard container sheet is verified.",
      ])
    );
    var eudrBtn = ui.el("button", {
      class: "btn btn-sm",
      type: "button",
      disabled: "disabled",
      title: "Phase 2 — not yet available",
    }, ["Generate EUDR pack (phase 2)"]);
    eudrSection.appendChild(eudrBtn);
    container.appendChild(eudrSection);

    function visibleList() {
      if (includeClosed) return containers.slice();
      return containers.filter(function (c) {
        return c.status !== "dispatched" && c.status !== "cancelled";
      });
    }

    function selectedContainer() {
      return containers.find(function (c) {
        return c.id === selectedId;
      });
    }

    function paintPreview() {
      var c = selectedContainer();
      if (!c) {
        preview.textContent = "Choose a container to see details.";
        preview.className = "td-doc-preview muted";
        sheetBtn.disabled = true;
        return;
      }
      preview.innerHTML = "";
      preview.className = "td-doc-preview";
      preview.appendChild(
        ui.el("p", {}, [
          ui.el("strong", {}, [c.container_number]),
          " · ",
          c.product_label || c.product_key || "—",
          " · ",
          STATUS_LABEL[c.status] || c.status,
        ])
      );
      preview.appendChild(
        ui.el("p", { class: "muted" }, [
          "Loaded ",
          fmt(c.loaded_bags),
          " / ",
          fmt(c.target_bag_count),
          " bags",
          c.ship_to ? " · To: " + c.ship_to : "",
          c.booking_ref ? " · Booking: " + c.booking_ref : "",
        ])
      );
      sheetBtn.disabled = false;
    }

    function paintSelect() {
      var list = visibleList();
      var prev = select.value;
      select.innerHTML = "";
      if (!list.length) {
        select.appendChild(ui.el("option", { value: "" }, ["No containers in this view"]));
        selectedId = "";
      } else {
        select.appendChild(ui.el("option", { value: "" }, ["Choose container…"]));
        list.forEach(function (c) {
          var label =
            c.container_number +
            " (" +
            (STATUS_LABEL[c.status] || c.status) +
            ", " +
            fmt(c.loaded_bags) +
            " bags)";
          select.appendChild(ui.el("option", { value: c.id }, [label]));
        });
        if (prev && list.some(function (c) { return c.id === prev; })) {
          select.value = prev;
          selectedId = prev;
        } else {
          selectedId = select.value;
        }
      }
      paintPreview();
    }

    select.addEventListener("change", function () {
      selectedId = select.value;
      paintPreview();
    });

    async function loadContainers() {
      setStatus("Loading containers…", false);
      try {
        var data = await ctx.api.traceability("/containers");
        containers = (data && data.containers) || [];
        containers.sort(function (a, b) {
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
        paintSelect();
        setStatus("", false);
      } catch (e) {
        setStatus("Could not load containers: " + (e.message || e), true);
      }
    }

    sheetBtn.addEventListener("click", async function () {
      if (!selectedId) return;
      setStatus("Loading manifest…", false);
      sheetBtn.disabled = true;
      try {
        var manifest = await ctx.api.traceability(
          "/containers/" + encodeURIComponent(selectedId) + "/manifest"
        );
        if (CIS.openContainerManifestPrintDialog) {
          CIS.openContainerManifestPrintDialog(manifest, "container_sheet");
        } else if (CIS.printContainerManifest) {
          CIS.printContainerManifest(manifest, "container_sheet");
        } else {
          setStatus("Print module not loaded.", true);
        }
        setStatus("", false);
      } catch (e) {
        setStatus("Could not load manifest: " + (e.message || e), true);
      } finally {
        sheetBtn.disabled = !selectedId;
      }
    });

    await loadContainers();
  }

  CIS.modules.push({
    id: "traceability_documentation",
    title: "Traceability Documentation",
    section: "Production",
    kind: "lookup",
    order: 18,
    icon: "traceability",
    description: "Container load sheets and EUDR documentation packages",
    requires: "traceability.containers",
    render: render,
  });
})();
