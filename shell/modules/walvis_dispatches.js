/* Walvis dispatches — truck manifest (GF load) vs received (Walvis storage). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  async function apiGet(ctx, path) {
    return ctx.api.traceability(path);
  }

  async function apiPost(ctx, path, body) {
    return ctx.api.traceability(path, { method: "POST", body: body || {} });
  }

  function renderDetail(container, ctx, detail) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content walvis-dispatch-host";

    var title =
      "Dispatch #" +
      detail.dispatch_number +
      (detail.truck_registration ? " · " + detail.truck_registration : "");
    container.appendChild(ui.el("h2", { class: "module-title" }, [title]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        detail.status === "open" ? "Loading in progress at Grootfontein." : "Truck load closed.",
        " Opened ",
        fmtDate(detail.opened_at),
        detail.closed_at ? " · Closed " + fmtDate(detail.closed_at) : "",
      ])
    );

    var summary = ui.el("div", { class: "walvis-dispatch-summary" });
    summary.appendChild(
      ui.el("p", {}, [
        ui.el("strong", {}, ["Loaded: "]),
        CIS.bagsAndMassText(detail.loaded_bags, detail.kg_loaded) +
          " · Received: " +
          CIS.bagsAndMassText(detail.received_bags, detail.kg_received),
      ])
    );
    if (detail.missing_count) {
      summary.appendChild(
        ui.el("p", { class: "walvis-dispatch-missing" }, [
          ui.el("strong", {}, [String(detail.missing_count) + " bag(s) not yet scanned in Walvis storage"]),
          detail.missing_bags && detail.missing_bags.length
            ? ": " + detail.missing_bags.slice(0, 12).join(", ") +
              (detail.missing_bags.length > 12 ? "…" : "")
            : "",
        ])
      );
    }
    container.appendChild(summary);

    if (detail.streams && Object.keys(detail.streams).length) {
      var streamLine = Object.keys(detail.streams)
        .map(function (k) {
          return k + ": " + detail.streams[k];
        })
        .join(" · ");
      container.appendChild(ui.el("p", { class: "muted" }, ["Mix on manifest: ", streamLine]));
    }

    var table = ui.el("table", { class: "data-table walvis-dispatch-table" });
    var thead = ui.el("thead");
    thead.appendChild(
      ui.el("tr", {}, [
        ui.el("th", {}, ["Bag"]),
        ui.el("th", {}, ["Stream"]),
        ui.el("th", {}, ["kg"]),
        ui.el("th", {}, ["Loaded"]),
        ui.el("th", {}, ["Received Walvis"]),
        ui.el("th", {}, ["Status now"]),
      ])
    );
    table.appendChild(thead);
    var tbody = ui.el("tbody");
    (detail.bags || []).forEach(function (b) {
      tbody.appendChild(
        ui.el("tr", {}, [
          ui.el("td", {}, [b.bag_identifier]),
          ui.el("td", {}, [b.product_stream || "—"]),
          ui.el("td", {}, [CIS.formatMassFromKg(b.net_weight_kg, { forceKg: true })]),
          ui.el("td", {}, [fmtDate(b.loaded_at)]),
          ui.el("td", {}, [b.received_at ? fmtDate(b.received_at) : "—"]),
          ui.el("td", {}, [b.storage_status || "—"]),
        ])
      );
    });
    table.appendChild(tbody);
    container.appendChild(table);

    container.appendChild(
      ui.el("button", {
        type: "button",
        class: "btn-ghost",
        onclick: function () {
          renderList(container, ctx);
        },
      }, ["← Back to dispatch list"])
    );
  }

  async function openDetail(container, ctx, id) {
    container.innerHTML = "<p class=\"muted\">Loading dispatch…</p>";
    try {
      var detail = await apiGet(ctx, "/walvis-dispatches/" + encodeURIComponent(id));
      renderDetail(container, ctx, detail);
    } catch (e) {
      container.innerHTML = "";
      container.appendChild(CIS.ui.error("Could not load dispatch: " + (e.message || e)));
    }
  }

  async function renderList(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content walvis-dispatch-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Walvis dispatches"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Open truck loads only — Shorty manifests at Grootfontein; Wynand scans into Walvis storage. ",
        "When a run is complete, stock appears under ",
        ui.el("strong", {}, ["Bags Status → In storage — Walvis Bay"]),
        " (not here). Closed dispatches remain in the database for audit.",
      ])
    );

    var fenceBtn = ui.el("button", {
      type: "button",
      class: "settings-action-btn",
      style: "max-width: 28rem; margin-bottom: 1rem;",
    }, ["Fence current Walvis storage bags (no dispatch yet)"]);
    fenceBtn.addEventListener("click", async function () {
      var reg = window.prompt("Truck registration (optional):", "") || "";
      fenceBtn.disabled = true;
      try {
        var detail = await apiPost(ctx, "/walvis-dispatches/fence-unassigned-storage", {
          truck_registration: reg.trim() || null,
        });
        renderDetail(container, ctx, detail);
      } catch (e) {
        window.alert(e.message || String(e));
      } finally {
        fenceBtn.disabled = false;
      }
    });
    container.appendChild(fenceBtn);

    var listHost = ui.el("div", { class: "walvis-dispatch-list" });
    container.appendChild(listHost);
    listHost.textContent = "Loading…";

    try {
      var data = await apiGet(ctx, "/walvis-dispatches?limit=50");
      var rows = data.dispatches || [];
      listHost.innerHTML = "";
      if (!rows.length) {
        listHost.appendChild(
          ui.el("p", { class: "muted" }, [
            "No open truck dispatch. Use Bag Walk at Grootfontein to start loading, or fence retroactive storage from above. ",
            "Completed loads: Bags Status → In transit & at the coast → In storage — Walvis Bay.",
          ])
        );
        return;
      }
      rows.forEach(function (d) {
        var card = ui.el("button", {
          type: "button",
          class: "dashboard-tile walvis-dispatch-tile",
          onclick: function () {
            openDetail(container, ctx, d.id);
          },
        });
        var label =
          "Dispatch #" +
          d.dispatch_number +
          (d.truck_registration ? " · " + d.truck_registration : "") +
          (d.status === "open" ? " (loading)" : "");
        card.appendChild(ui.el("span", { class: "dashboard-tile-title" }, [label]));
        card.appendChild(
          ui.el("span", { class: "dashboard-tile-desc" }, [
            fmt(d.loaded_bags) +
              " loaded · " +
              fmt(d.received_bags) +
              " received Walvis · opened " +
              fmtDate(d.opened_at),
          ])
        );
        listHost.appendChild(card);
      });
    } catch (e) {
      listHost.innerHTML = "";
      listHost.appendChild(ui.el("p", { class: "error-box" }, [e.message || String(e)]));
    }
  }

  async function render(container, ctx) {
    await renderList(container, ctx);
  }

  CIS.modules.push({
    id: "walvis_dispatches",
    title: "Walvis dispatches",
    kind: "app",
    icon: "traceability",
    description: "Truck loads GF → Walvis — manifest vs received",
    requiresAny: [
      "traceability.bags_status",
      "traceability.bags_movement",
      "traceability.movement_jobs",
      "traceability.stock.view",
    ],
    render: render,
  });
})();
