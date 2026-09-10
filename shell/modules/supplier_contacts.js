/* Supplier contacts — dormant charcoal suppliers (90-day call list). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var OUTCOMES = [
    { id: "promised_delivery", label: "Promised delivery" },
    { id: "no_answer", label: "No answer" },
    { id: "not_producing", label: "Not producing" },
    { id: "sold_elsewhere", label: "Sold elsewhere" },
    { id: "will_call_back", label: "Will call back" },
    { id: "other", label: "Other" },
  ];

  function card(ui, label, value, className) {
    var c = ui.el("div", { class: "card" + (className ? " " + className : "") });
    c.appendChild(ui.el("div", { class: "label" }, [label]));
    c.appendChild(ui.el("div", { class: "value" }, [value]));
    return c;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return iso.length >= 10 ? iso.slice(0, 10) : iso;
  }

  function outcomeLabel(id) {
    for (var i = 0; i < OUTCOMES.length; i++) {
      if (OUTCOMES[i].id === id) return OUTCOMES[i].label;
    }
    return id || "—";
  }

  function pill(ui, kind, text) {
    return ui.el("span", { class: "pill " + (kind || "") }, [text]);
  }

  function buildQuery(asOf, year, days, needsOnly) {
    var q = "?year=" + encodeURIComponent(year);
    if (asOf) q += "&as_of=" + encodeURIComponent(asOf);
    if (days) q += "&days=" + encodeURIComponent(String(days));
    if (needsOnly) q += "&needs_contact_only=true";
    return q;
  }

  function openLogDialog(ui, ctx, supplier, asOf, onSaved) {
    var overlay = ui.el("div", {
      class: "supplier-contact-dialog-backdrop",
      style:
        "position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;",
    });
    var box = ui.el("div", {
      class: "supplier-contact-dialog",
      style:
        "background:#1a1a1a;border:1px solid #3d3520;border-radius:8px;padding:1.25rem;max-width:420px;width:92%;",
    });
    box.appendChild(ui.el("h3", { class: "module-subtitle", style: "margin-top:0" }, [supplier.supplier]));
    box.appendChild(ui.el("p", { class: "muted" }, ["Record the outcome of this contact."]));

    var outcomeSel = ui.el("select", { class: "toolbar select", style: "width:100%;margin:0.5rem 0" });
    OUTCOMES.forEach(function (o) {
      outcomeSel.appendChild(ui.el("option", { value: o.id }, [o.label]));
    });

    var notes = ui.el("textarea", {
      rows: "3",
      placeholder: "Notes (optional)",
      style: "width:100%;margin:0.5rem 0;background:#242424;color:#f5f0e6;border:1px solid #3d3520;border-radius:4px;padding:0.5rem;",
    });

    var err = ui.el("p", { class: "error", style: "display:none" });
    var actions = ui.el("div", { style: "display:flex;gap:0.5rem;margin-top:0.75rem;justify-content:flex-end;" });

    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    actions.appendChild(
      ui.el("button", { class: "btn btn-ghost btn-sm", type: "button" }, ["Cancel"])
    );
    actions.appendChild(ui.el("button", { class: "btn btn-sm", type: "button" }, ["Save"]));
    actions.children[0].addEventListener("click", close);
    actions.children[1].addEventListener("click", async function () {
      err.style.display = "none";
      try {
        var user = (ctx && ctx.user) || {};
        await ctx.api.supplierTracking("/contact-log", {
          method: "POST",
          body: {
            supplier_key: supplier.supplier_key,
            contacted_by: user.login_id || user.display_name || "unknown",
            outcome: outcomeSel.value,
            notes: notes.value.trim() || null,
            as_of_date: asOf || null,
          },
        });
        close();
        if (onSaved) onSaved();
      } catch (e) {
        err.textContent = String(e.message || e);
        err.style.display = "block";
      }
    });

    box.appendChild(ui.el("label", { class: "muted" }, ["Outcome"]));
    box.appendChild(outcomeSel);
    box.appendChild(ui.el("label", { class: "muted" }, ["Notes"]));
    box.appendChild(notes);
    box.appendChild(err);
    box.appendChild(actions);
    overlay.appendChild(box);
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) close();
    });
    document.body.appendChild(overlay);
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.classList.add("maintenance-ops-host");

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Supplier contacts"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Charcoal suppliers who delivered in the selected year but have not brought a load in 90 days or more. " +
          "Phone numbers come from the factory Deliveries sheet (Contact Number column).",
      ])
    );

    var toolbar = ui.el("div", { class: "toolbar" });
    var asOfInput = ui.el("input", { type: "date", class: "toolbar select" });
    asOfInput.value = new Date().toISOString().slice(0, 10);
    var yearSel = ui.el("select", { class: "toolbar select" });
    ["2026", "2025"].forEach(function (y) {
      yearSel.appendChild(ui.el("option", { value: y }, [y]));
    });
    var daysInput = ui.el("input", {
      type: "number",
      min: "1",
      max: "730",
      value: "90",
      class: "toolbar select",
      style: "width:5rem",
    });
    var needsOnly = ui.el("input", { type: "checkbox", id: "needs-only" });
    var refreshBtn = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Refresh"]);

    toolbar.appendChild(ui.el("label", { class: "muted" }, ["As of"]));
    toolbar.appendChild(asOfInput);
    toolbar.appendChild(ui.el("label", { class: "muted" }, ["Year"]));
    toolbar.appendChild(yearSel);
    toolbar.appendChild(ui.el("label", { class: "muted" }, ["Days"]));
    toolbar.appendChild(daysInput);
    toolbar.appendChild(ui.el("label", { class: "muted", style: "display:flex;align-items:center;gap:0.35rem" }, [
      needsOnly,
      "Needs contact only",
    ]));
    toolbar.appendChild(refreshBtn);
    container.appendChild(toolbar);

    var cards = ui.el("div", { class: "cards maintenance-ops-cards" });
    var body = ui.el("div", { class: "maintenance-ops-body" });
    container.appendChild(cards);
    container.appendChild(body);
    body.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));

    async function load() {
      body.innerHTML = "";
      body.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));
      cards.innerHTML = "";
      try {
        var path = buildQuery(
          asOfInput.value,
          yearSel.value,
          daysInput.value,
          needsOnly.checked
        );
        var data = await ctx.api.supplierTracking("/dormant-suppliers" + path);
        var summary = data.summary || {};
        var rows = data.suppliers || [];

        cards.appendChild(
          card(ui, "Suppliers in " + data.year, String(summary.total_suppliers_in_year || rows.length))
        );
        cards.appendChild(
          card(ui, "Needs contact", String(summary.needs_contact || 0), "card-warn")
        );
        cards.appendChild(
          card(ui, "Contacted this week", String(summary.contacted_this_week || 0))
        );
        cards.appendChild(
          card(
            ui,
            "Active (< " + data.dormant_days + "d)",
            String(summary.active_within_threshold || 0),
            "card-ok"
          )
        );

        body.innerHTML = "";
        if (!rows.length) {
          body.appendChild(
            ui.el("p", { class: "muted" }, ["No suppliers match the current filters."])
          );
          return;
        }

        var wrap = ui.el("div", { class: "maintenance-ops-table-wrap" });
        var table = ui.el("table", { class: "data maintenance-ops-table" });
        table.innerHTML =
          "<thead><tr>" +
          "<th>Supplier</th><th>Last delivery</th><th>Days</th><th>Phone</th>" +
          "<th>Loads</th><th>Last contact</th><th>Status</th><th></th>" +
          "</tr></thead>";
        var tbody = ui.el("tbody", {});

        rows.forEach(function (r) {
          var trClass = r.needs_contact ? "fleet-row-due" : "fleet-row-ok";
          var tr = ui.el("tr", { class: trClass });
          tr.appendChild(ui.el("td", {}, [r.supplier || "—"]));
          tr.appendChild(ui.el("td", {}, [formatDate(r.last_delivery)]));
          tr.appendChild(ui.el("td", {}, [r.days_since != null ? String(r.days_since) : "—"]));
          tr.appendChild(ui.el("td", {}, [r.contact_number || "—"]));
          tr.appendChild(
            ui.el("td", {}, [String(r.loads_in_year != null ? r.loads_in_year : "—")])
          );
          var lastContact = formatDate(r.last_contacted_at);
          if (r.last_outcome) {
            lastContact += " — " + outcomeLabel(r.last_outcome);
          }
          tr.appendChild(ui.el("td", {}, [lastContact]));
          tr.appendChild(
            ui.el("td", {}, [
              r.needs_contact
                ? pill(ui, "warn", "Call")
                : pill(ui, "ok", "OK"),
            ])
          );
          var logBtn = ui.el("button", { class: "btn btn-ghost btn-sm", type: "button" }, [
            "Log contact",
          ]);
          logBtn.addEventListener("click", function () {
            openLogDialog(ui, ctx, r, asOfInput.value, load);
          });
          var actionTd = ui.el("td", {});
          actionTd.appendChild(logBtn);
          tr.appendChild(actionTd);
          tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        wrap.appendChild(table);
        body.appendChild(wrap);

        var meta = [];
        if (data.cutoff_date) meta.push("Cut-off: last delivery on or before " + data.cutoff_date);
        if (data.delivery_import && data.delivery_import.imported_at) {
          meta.push("Deliveries imported " + data.delivery_import.imported_at.replace("T", " "));
        }
        if (data.contact_sync && data.contact_sync.synced_at) {
          meta.push("Contacts synced " + data.contact_sync.synced_at.replace("T", " "));
        }
        if (meta.length) {
          body.appendChild(
            ui.el("p", { class: "muted", style: "margin-top:0.75rem" }, [meta.join(" · ")])
          );
        }
      } catch (err) {
        body.innerHTML = "";
        body.appendChild(ui.el("p", { class: "error" }, [String(err.message || err)]));
      }
    }

    refreshBtn.addEventListener("click", load);
    needsOnly.addEventListener("change", load);
    yearSel.addEventListener("change", load);
    await load();
  }

  CIS.modules.push({
    id: "supplier_contacts",
    title: "Supplier contacts",
    section: "Production",
    kind: "lookup",
    order: 16,
    icon: "producers",
    description: "Suppliers with no delivery in 90+ days — call list with contact log",
    requires: "production.supplier_contacts",
    render: render,
  });
})();
