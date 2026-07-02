/* Device keys — issue keys for PWAs and devices (moved from Maintenance Manager). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var VIEWER_TAG = "viewer";

  var POOLS = [
    {
      id: "maintenance",
      label: "Maintenance checklist",
      api: "maintenance",
      filter: "all",
      pwaUrlKey: "maintenancePwaUrl",
      pwaDefault: "/maintenance/",
      intro: "One key per phone for the Maintenance checklist PWA (field operators).",
      deviceNoun: "phone",
      registerStep: "Tap Register device",
    },
    {
      id: "quality_capture",
      label: "Quality capture",
      api: "quality",
      filter: "exclude_viewer",
      pwaUrlKey: "qualityCaptureUrl",
      pwaDefault: "/quality/",
      intro: "One key per phone for Sieving Sheet capture (Jessica, Francois, etc.).",
      deviceNoun: "phone",
      registerStep: "Tap Register device",
    },
    {
      id: "quality_viewer",
      label: "Quality viewer",
      api: "quality",
      filter: "viewer_only",
      notesTag: VIEWER_TAG,
      pwaUrlKey: "qualityViewerUrl",
      pwaDefault: "/quality/viewer/",
      intro: "One key per laptop for the read-only Quality viewer (when not using CIS login).",
      deviceNoun: "laptop",
      registerStep: "Register, then bookmark the page",
    },
  ];

  function cfg(ctx, key, fallback) {
    var c = (ctx && ctx.config) || {};
    return (c[key] || fallback || "").trim();
  }

  function pwaUrl(ctx, pool) {
    return cfg(ctx, pool.pwaUrlKey, pool.pwaDefault);
  }

  function filterRows(rows, pool) {
    rows = rows || [];
    if (pool.filter === "viewer_only") {
      return rows.filter(function (r) { return (r.notes || "").trim() === VIEWER_TAG; });
    }
    if (pool.filter === "exclude_viewer") {
      return rows.filter(function (r) { return (r.notes || "").trim() !== VIEWER_TAG; });
    }
    return rows;
  }

  function fmtTs(v) {
    if (!v) return "—";
    return String(v).slice(0, 16).replace("T", " ");
  }

  function apiFor(ctx, pool) {
    if (pool.api === "quality") return ctx.api.quality;
    return ctx.api.maintenance;
  }

  async function loadKeys(ctx, pool) {
    var api = apiFor(ctx, pool);
    var resp = await api("/device-keys");
    return filterRows(resp.device_keys || [], pool);
  }

  function renderPool(container, ctx, pool, ui) {
    var section = ui.el("div", { class: "device-keys-panel hidden", "data-pool": pool.id });
    section.appendChild(ui.el("p", { class: "module-desc" }, [pool.intro]));
    section.appendChild(ui.el("p", { class: "muted" }, [
      "PWA: ",
      ui.el("a", { href: pwaUrl(ctx, pool), target: "_blank", rel: "noopener" }, [pwaUrl(ctx, pool)]),
    ]));
    section.appendChild(ui.el("p", { class: "muted device-keys-hint" }, [
      "Disable = temporary block. Revoke = permanent. Delete = test cleanup only.",
    ]));

    var tableWrap = ui.el("div", { class: "device-keys-table-wrap" });
    section.appendChild(tableWrap);

    var toolbar = ui.el("div", { class: "toolbar" });
    var refreshBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Refresh"]);
    var genBtn = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Generate key…"]);
    toolbar.appendChild(genBtn);
    toolbar.appendChild(refreshBtn);
    section.appendChild(toolbar);

    var statusBtns = ui.el("div", { class: "toolbar" });
    var disableBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Disable"]);
    var enableBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Enable"]);
    var revokeBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Revoke"]);
    var deleteBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Delete"]);
    statusBtns.appendChild(disableBtn);
    statusBtns.appendChild(enableBtn);
    statusBtns.appendChild(revokeBtn);
    statusBtns.appendChild(deleteBtn);
    section.appendChild(statusBtns);

    var selectedId = null;

    function renderTable(rows) {
      tableWrap.innerHTML = "";
      var table = ui.el("table", { class: "data device-keys-table" });
      table.innerHTML =
        "<thead><tr><th></th><th>Label</th><th>Key ID</th><th>Status</th><th>Last used</th><th>Created</th></tr></thead>";
      var tbody = ui.el("tbody", {});
      rows.forEach(function (row) {
        var tr = ui.el("tr", {});
        var radio = ui.el("input", { type: "radio", name: "dk-" + pool.id });
        radio.addEventListener("change", function () {
          selectedId = row.device_key_id;
        });
        tr.appendChild(ui.el("td", {}, [radio]));
        tr.appendChild(ui.el("td", {}, [row.label || ""]));
        tr.appendChild(ui.el("td", { class: "muted" }, [row.key_id || ""]));
        var st = row.status || "";
        tr.appendChild(ui.el("td", {}, [ui.el("span", { class: "pill " + (st === "active" ? "ok" : st === "disabled" ? "warn" : "danger") }, [st])]));
        tr.appendChild(ui.el("td", { class: "muted" }, [fmtTs(row.last_used_at)]));
        tr.appendChild(ui.el("td", { class: "muted" }, [fmtTs(row.created_at)]));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(rows.length ? table : ui.el("p", { class: "muted" }, ["No keys yet."]));
    }

    async function refresh() {
      tableWrap.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));
      try {
        renderTable(await loadKeys(ctx, pool));
      } catch (e) {
        tableWrap.innerHTML = "";
        tableWrap.appendChild(ui.error("Could not load keys: " + (e.message || e)));
      }
    }

    async function patchStatus(status) {
      if (!selectedId) {
        window.alert("Select a key first.");
        return;
      }
      if (status === "disabled" && !window.confirm("Temporarily block this " + pool.deviceNoun + "?")) return;
      if (status === "revoked" && !window.confirm("Permanently revoke this key?")) return;
      try {
        await apiFor(ctx, pool)("/device-keys/" + selectedId, { method: "PATCH", body: { status: status } });
        await refresh();
      } catch (e) {
        window.alert(e.message || "Update failed");
      }
    }

    genBtn.addEventListener("click", function () {
      openGenerateModal(ctx, pool, ui, refresh);
    });
    refreshBtn.addEventListener("click", refresh);
    disableBtn.addEventListener("click", function () { patchStatus("disabled"); });
    enableBtn.addEventListener("click", function () { patchStatus("active"); });
    revokeBtn.addEventListener("click", function () { patchStatus("revoked"); });
    deleteBtn.addEventListener("click", async function () {
      if (!selectedId) {
        window.alert("Select a key first.");
        return;
      }
      if (!window.confirm("Delete this test key? Use Disable/Revoke in production.")) return;
      try {
        await apiFor(ctx, pool)("/device-keys/" + selectedId, { method: "DELETE" });
        selectedId = null;
        await refresh();
      } catch (e) {
        window.alert(e.message || "Delete failed");
      }
    });

    container.appendChild(section);
    refresh();
    return section;
  }

  function openGenerateModal(ctx, pool, ui, onDone) {
    var backdrop = ui.el("div", { class: "modal-backdrop" });
    var modal = ui.el("div", { class: "modal" });
    backdrop.appendChild(modal);
    modal.appendChild(ui.el("h3", {}, ["New device key — " + pool.label]));
    var errEl = ui.el("div", { class: "error-box hidden" });
    modal.appendChild(errEl);
    modal.appendChild(ui.el("label", {}, ["Label (device / person)"]));
    var labelInput = ui.el("input", { type: "text", placeholder: pool.deviceNoun === "laptop" ? "e.g. Simon laptop" : "e.g. Jessica Ulefone" });
    modal.appendChild(labelInput);
    if (!pool.notesTag) {
      modal.appendChild(ui.el("label", {}, ["Notes (optional)"]));
      modal.appendChild(ui.el("input", { type: "text", id: "dk-notes-" + pool.id }));
    }
    var actions = ui.el("div", { class: "modal-actions" });
    var cancelBtn = ui.el("button", { class: "btn-ghost", type: "button" }, ["Cancel"]);
    var saveBtn = ui.el("button", { class: "btn", type: "button" }, ["Generate"]);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(actions);

    cancelBtn.addEventListener("click", function () { document.body.removeChild(backdrop); });
    saveBtn.addEventListener("click", async function () {
      errEl.classList.add("hidden");
      var label = labelInput.value.trim();
      if (!label) {
        errEl.textContent = "Label is required";
        errEl.classList.remove("hidden");
        return;
      }
      var body = { label: label, created_by: (CIS.currentUser && CIS.currentUser()) ? CIS.currentUser().login_id : "cis" };
      if (pool.notesTag) body.notes = pool.notesTag;
      else {
        var notesEl = document.getElementById("dk-notes-" + pool.id);
        if (notesEl && notesEl.value.trim()) body.notes = notesEl.value.trim();
      }
      saveBtn.disabled = true;
      try {
        var created = await apiFor(ctx, pool)("/device-keys", { method: "POST", body: body });
        document.body.removeChild(backdrop);
        showCreatedKey(created, pool, ctx, ui);
        if (onDone) await onDone();
      } catch (e) {
        errEl.textContent = e.message || "Could not create key";
        errEl.classList.remove("hidden");
      } finally {
        saveBtn.disabled = false;
      }
    });
    document.body.appendChild(backdrop);
    labelInput.focus();
  }

  function showCreatedKey(created, pool, ctx, ui) {
    var apiKey = created.api_key || "";
    var backdrop = ui.el("div", { class: "modal-backdrop" });
    var modal = ui.el("div", { class: "modal" });
    backdrop.appendChild(modal);
    modal.appendChild(ui.el("h3", {}, ["Device key created"]));
    modal.appendChild(ui.el("p", { class: "muted" }, [
      "Copy this key now — it is shown once. Register the " + pool.deviceNoun + " in the office.",
    ]));
    modal.appendChild(ui.el("p", {}, ["Label: " + (created.label || ""), " · Key ID: " + (created.key_id || "")]));
    var keyInput = ui.el("input", { type: "text", value: apiKey, readonly: "readonly" });
    keyInput.style.fontFamily = "Consolas, monospace";
    keyInput.style.width = "100%";
    modal.appendChild(keyInput);
    var msg =
      pool.label + " device key:\n" + apiKey + "\n\n" +
      "1. Open " + pwaUrl(ctx, pool) + "\n" +
      "2. Paste the key on the registration screen\n" +
      "3. " + pool.registerStep;
    var copyKey = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Copy key"]);
    var copyMsg = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Copy setup message"]);
    var closeBtn = ui.el("button", { class: "btn-ghost", type: "button" }, ["Close"]);
    copyKey.addEventListener("click", function () {
      navigator.clipboard.writeText(apiKey).catch(function () { window.prompt("Copy key:", apiKey); });
    });
    copyMsg.addEventListener("click", function () {
      navigator.clipboard.writeText(msg).catch(function () { window.prompt("Copy message:", msg); });
    });
    closeBtn.addEventListener("click", function () { document.body.removeChild(backdrop); });
    var row = ui.el("div", { class: "modal-actions" });
    row.appendChild(copyKey);
    row.appendChild(copyMsg);
    row.appendChild(closeBtn);
    modal.appendChild(row);
    document.body.appendChild(backdrop);
    keyInput.select();
  }

  function renderStaticPanel(container, ui, opts) {
    var section = ui.el("div", { class: "device-keys-panel hidden", "data-pool": opts.id });
    section.appendChild(ui.el("p", { class: "module-desc" }, [opts.intro]));
    (opts.paragraphs || []).forEach(function (p) {
      section.appendChild(ui.el("p", { class: "muted" }, [p]));
    });
    if (opts.url) {
      section.appendChild(ui.el("p", {}, [
        ui.el("a", { class: "btn btn-sm", href: opts.url, target: "_blank", rel: "noopener" }, [opts.linkLabel || "Open"]),
      ]));
    }
    container.appendChild(section);
    return section;
  }

  function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Device keys & API access"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Issue keys for phones, laptops, and devices. People log in to CIS with User ID; devices use these keys.",
    ]));

    var tabs = ui.el("div", { class: "device-keys-tabs" });
    var panelsWrap = ui.el("div", { class: "device-keys-panels" });
    var panelEls = {};

    POOLS.forEach(function (pool, i) {
      var tab = ui.el("button", {
        class: "device-keys-tab" + (i === 0 ? " active" : ""),
        type: "button",
        "data-pool": pool.id,
      }, [pool.label]);
      tabs.appendChild(tab);
    });

    var staticTabs = [
      {
        id: "producers_office",
        label: "Producers office",
        intro: "Shared API key for the Producers Office PWA (not per-device).",
        paragraphs: [
          "Set PRODUCERS_OFFICE_API_KEY on the server. Office staff paste it once into the Producers Office app.",
          "Quality capture uses this key server-side for the producer dropdown — keep the same value on Quality API (.env PRODUCERS_OFFICE_API_KEY).",
        ],
        url: cfg(ctx, "producersOfficeUrl", "/producers/office/"),
        linkLabel: "Open Producers Office",
      },
      {
        id: "traceability",
        label: "Traceability",
        intro: "Scanner and supervisor devices for charcoal traceability.",
        paragraphs: [
          "Per-device keys for traceability will be issued here when the traceability API is connected.",
          "Until then: configure scanner Bearer keys (FACTORY / WALVISBAY) and CHARCOAL_TRACEABILITY_POST_KEY on the traceability server.",
          "Field scanner: " + cfg(ctx, "traceabilityScannerUrl", "/traceability/scanner/"),
          " · Supervisor: " + cfg(ctx, "traceabilitySupervisorUrl", "/traceability/supervisor/"),
        ],
      },
    ];

    staticTabs.forEach(function (st) {
      var tab = ui.el("button", { class: "device-keys-tab", type: "button", "data-pool": st.id }, [st.label]);
      tabs.appendChild(tab);
    });

    container.appendChild(tabs);
    container.appendChild(panelsWrap);

    POOLS.forEach(function (pool) {
      panelEls[pool.id] = renderPool(panelsWrap, ctx, pool, ui);
    });
    staticTabs.forEach(function (st) {
      panelEls[st.id] = renderStaticPanel(panelsWrap, ui, st);
    });

    function showPool(id) {
      tabs.querySelectorAll(".device-keys-tab").forEach(function (t) {
        t.classList.toggle("active", t.getAttribute("data-pool") === id);
      });
      Object.keys(panelEls).forEach(function (k) {
        var panel = panelEls[k];
        if (panel && panel.classList) {
          panel.classList.toggle("hidden", k !== id);
        }
      });
    }

    tabs.querySelectorAll(".device-keys-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        showPool(tab.getAttribute("data-pool"));
      });
    });
    showPool(POOLS[0].id);
  }

  CIS.modules.push({
    id: "device_keys",
    title: "Device keys",
    section: "Administration",
    kind: "app",
    order: 20,
    icon: "keys",
    description: "PWA keys — maintenance, quality, producers, traceability",
    requires: "identity.device_keys",
    render: render,
  });
})();
