/* Walvis dispatches — truck manifest (GF load) vs received (Walvis storage). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var RESET_CONFIRM = "RESET_WALVIS_DISPATCHES";

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

  function confirmTyped(message, requiredPhrase) {
    var typed = window.prompt(message, "");
    if (typed === null) return false;
    return String(typed).trim() === requiredPhrase;
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

    var addRow = ui.el("div", { class: "walvis-dispatch-add-bag", style: "margin: 1rem 0;" });
    addRow.appendChild(
      ui.el("p", { class: "muted" }, [
        "Add a bag that was missed on the truck scan (must exist as a label in the system). ",
        "Mark received if it is already in Walvis storage.",
      ])
    );
    var addBtn = ui.el("button", {
      type: "button",
      class: "settings-action-btn",
      style: "max-width: 22rem;",
    }, ["Add bag to this dispatch…"]);
    addBtn.addEventListener("click", async function () {
      var serial = window.prompt("Bag serial (e.g. CB-…):", "");
      if (!serial) return;
      var markReceived = window.confirm(
        "Mark this bag as received at Walvis on the manifest?\n\nOK = yes (typical if already in Walvis storage).\nCancel = loaded only."
      );
      addBtn.disabled = true;
      try {
        var updated = await apiPost(ctx, "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/bags", {
          bag_identifier: serial.trim(),
          mark_received: markReceived,
        });
        renderDetail(container, ctx, updated);
      } catch (e) {
        window.alert(e.message || String(e));
      } finally {
        addBtn.disabled = false;
      }
    });
    addRow.appendChild(addBtn);
    container.appendChild(addRow);

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

  async function buildResetPreview(ctx) {
    try {
      return await apiGet(ctx, "/walvis-dispatches/preview-reset");
    } catch (e) {
      /* Fallback when API is stale (preview route not loaded) — list + closed only. */
      var data = await apiGet(ctx, "/walvis-dispatches?limit=50&include_closed=true");
      var rows = data.dispatches || [];
      return {
        dispatch_rows: rows.length,
        dispatches: rows.map(function (d) {
          return {
            dispatch_number: d.dispatch_number,
            status: d.status,
            bag_count: d.loaded_bags,
          };
        }),
        walvis_storage_bags: null,
        unassigned_walvis_storage_bags: null,
        preview_fallback: true,
        preview_error: e.message || String(e),
      };
    }
  }

  async function runResetAndFenceFirst(container, ctx) {
    var preview;
    try {
      preview = await buildResetPreview(ctx);
    } catch (e) {
      window.alert("Could not load dispatch summary: " + (e.message || e));
      return;
    }
    var lines = [
      "This DELETES all Walvis dispatch records and restarts numbering at Dispatch #1.",
      "",
      "Current dispatch rows: " + preview.dispatch_rows,
      preview.walvis_storage_bags != null
        ? "Bags in Walvis storage now: " + preview.walvis_storage_bags
        : "Bags in Walvis storage: (count unavailable — API may need restart; reset still uses live DB)",
      "",
    ];
    if (preview.preview_fallback) {
      lines.push("(Used dispatch list fallback — " + (preview.preview_error || "preview API failed") + ")");
      lines.push("");
    }
    (preview.dispatches || []).forEach(function (d) {
      lines.push(
        "  · #" + d.dispatch_number + " (" + d.status + ") — " + d.bag_count + " bag(s) on manifest"
      );
    });
    lines.push("");
    lines.push("A new CLOSED Dispatch #1 will include every Walvis storage bag.");
    lines.push("");
    lines.push('Type exactly ' + RESET_CONFIRM + " in the next box to continue.");

    if (!confirmTyped(lines.join("\n"), RESET_CONFIRM)) {
      window.alert("Reset cancelled — confirmation text did not match.");
      return;
    }

    var reg = window.prompt("Truck registration for Dispatch #1 (optional):", "") || "";
    var extra = window.prompt(
      "Extra bag serial(s) missed on the truck scan (comma-separated, optional):",
      ""
    );
    var extraList = extra
      ? extra.split(/[,;\s]+/).map(function (s) {
          return s.trim();
        }).filter(Boolean)
      : [];

    if (
      !window.confirm(
        "Last chance: delete " +
          preview.dispatch_rows +
          " dispatch row(s) and create Dispatch #1 with " +
          (preview.walvis_storage_bags != null
            ? preview.walvis_storage_bags + " Walvis bag(s)"
            : "all current Walvis storage bag(s)") +
          (extraList.length ? " plus " + extraList.length + " extra serial(s)" : "") +
          "?"
      )
    ) {
      return;
    }

    try {
      var detail = await apiPost(ctx, "/walvis-dispatches/admin/reset-and-fence-first", {
        confirm: RESET_CONFIRM,
        truck_registration: reg.trim() || null,
        notes: "Dispatch #1 — first Walvis run (64 bags), ring-fenced from CIS",
        extra_bag_identifiers: extraList,
      });
      renderDetail(container, ctx, detail);
    } catch (e) {
      window.alert(e.message || String(e));
    }
  }

  async function renderList(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content walvis-dispatch-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Walvis dispatches"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Truck manifest at Grootfontein vs bags received into Walvis storage. ",
        "Use ",
        ui.el("strong", {}, ["Reset & fence Dispatch #1"]),
        " once to fix accidental dispatch rows and ring-fence the current Walvis stock. ",
        "Day-to-day loading uses Bag Walk at Grootfontein (Switch truck).",
      ])
    );

    var actions = ui.el("div", { class: "walvis-dispatch-actions", style: "margin-bottom: 1rem;" });

    var resetBtn = ui.el("button", {
      type: "button",
      class: "settings-action-btn",
      style: "max-width: 32rem; margin-bottom: 0.5rem; display: block;",
    }, ["Reset all dispatches & fence Dispatch #1 (Walvis storage)"]);
    resetBtn.addEventListener("click", function () {
      runResetAndFenceFirst(container, ctx);
    });
    actions.appendChild(resetBtn);

    var fenceBtn = ui.el("button", {
      type: "button",
      class: "btn-ghost",
      style: "max-width: 32rem; display: block;",
    }, ["Fence unassigned Walvis bags only (keeps existing dispatch numbers)"]);
    fenceBtn.addEventListener("click", async function () {
      if (
        !window.confirm(
          "Create a new closed dispatch for Walvis storage bags that are not on any manifest yet?\n\nThis does NOT delete existing dispatches."
        )
      ) {
        return;
      }
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
    actions.appendChild(fenceBtn);
    container.appendChild(actions);

    var listHost = ui.el("div", { class: "walvis-dispatch-list" });
    container.appendChild(listHost);
    listHost.textContent = "Loading…";

    try {
      var data = await apiGet(ctx, "/walvis-dispatches?limit=50&include_closed=true");
      var rows = data.dispatches || [];
      listHost.innerHTML = "";
      if (!rows.length) {
        listHost.appendChild(
          ui.el("p", { class: "muted" }, [
            "No dispatch records. Use Reset & fence Dispatch #1 if Walvis already has stock on the ground.",
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
          (d.status === "open" ? " (loading)" : " (closed)");
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
