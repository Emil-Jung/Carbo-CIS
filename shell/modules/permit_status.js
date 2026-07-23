/* Permit Status — FSC Carbo harvesting permit expiry (read-only, CIS auth). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function pill(ui, status, label) {
    var map = {
      expired: ["danger", "Expired"],
      due_soon: ["warn", "Due soon"],
      not_issued: ["", "Not issued"],
      ok: ["ok", "OK"],
    };
    var pair = map[status] || ["", label || status || "—"];
    return ui.el("span", { class: "pill " + pair[0] }, [label || pair[1]]);
  }

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

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.classList.add("maintenance-ops-host");
    container.appendChild(
      ui.el("h2", { class: "module-title" }, ["Permit Status"])
    );
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "FSC® certified members only — harvesting permit expiry and member status. " +
          "Permits and suspensions are managed in FSC Management System; this view refreshes from cloud sync.",
      ])
    );

    var cards = ui.el("div", { class: "cards maintenance-ops-cards" });
    var body = ui.el("div", { class: "maintenance-ops-body" });
    container.appendChild(cards);
    container.appendChild(body);
    body.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));

    var cfg = (ctx && ctx.config) || {};
    var apiBase = (cfg.producersApiBase || "/producers/api").replace(/\/$/, "");

    try {
      var data = await CIS.api.producers("/permit-status?members=active");
      var rows = data.rows || [];
      var summary = data.summary || {};

      cards.innerHTML = "";
      cards.appendChild(card(ui, "FSC farm rows", String(summary.total != null ? summary.total : rows.length)));
      cards.appendChild(card(ui, "Expired", String(summary.expired || 0), "card-danger"));
      cards.appendChild(card(ui, "Due within 30 days", String(summary.due_soon || 0), "card-warn"));
      cards.appendChild(card(ui, "Suspended", String(summary.suspended_members || 0)));

      body.innerHTML = "";
      if (!rows.length) {
        body.appendChild(
          ui.el("p", { class: "muted" }, [
            "No FSC Carbo rows found. Run Sync Now in FSC Management and refresh the producers database on the server.",
          ])
        );
        return;
      }

      var wrap = ui.el("div", { class: "maintenance-ops-table-wrap" });
      var table = ui.el("table", { class: "data maintenance-ops-table" });
      table.innerHTML =
        "<thead><tr>" +
        "<th>Member / farm</th><th>Member status</th><th>Permit #</th><th>Expiry</th>" +
        "<th>Days</th><th>Permit</th>" +
        "</tr></thead>";
      var tbody = ui.el("tbody", {});

      rows.forEach(function (r) {
        var tr = ui.el("tr", { class: "fleet-row-" + (r.permit_status === "expired" ? "due" : r.permit_status === "due_soon" ? "soon" : "ok") });
        tr.appendChild(ui.el("td", {}, [r.display_label || "—"]));
        var ms = r.member_status || "—";
        if (r.member_status === "Suspended" && r.suspension_reason) {
          ms = ms + " — " + r.suspension_reason;
        }
        tr.appendChild(ui.el("td", {}, [ms]));
        tr.appendChild(ui.el("td", {}, [r.harvesting_permit_number || "—"]));
        tr.appendChild(ui.el("td", {}, [formatDate(r.harvesting_permit_expiry)]));
        var days = r.days_until_expiry;
        tr.appendChild(
          ui.el("td", {}, [days == null ? "—" : String(days)])
        );
        tr.appendChild(
          ui.el("td", {}, [pill(ui, r.permit_status, r.permit_status_label)])
        );
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      wrap.appendChild(table);
      body.appendChild(wrap);

      if (data.generated_at) {
        body.appendChild(
          ui.el("p", { class: "muted", style: "margin-top:0.75rem" }, [
            "Data as of " + data.generated_at.replace("T", " ").replace("+00:00", " UTC"),
          ])
        );
      }
    } catch (err) {
      body.innerHTML = "";
      body.appendChild(ui.el("p", { class: "error" }, [String(err.message || err)]));
    }
  }

  CIS.modules.push({
    id: "permit_status",
    title: "Permit Status",
    section: "Production",
    kind: "lookup",
    order: 11,
    icon: "register",
    description: "FSC member harvesting permit expiry and suspension status (management report)",
    requires: "producers.permit_status",
    render: render,
  });
})();
