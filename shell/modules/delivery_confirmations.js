/* Delivery Confirmations — charcoal tracker rows after Control Room POST (PJ). */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function fmtNum(n, digits) {
    if (n == null || n === "" || isNaN(n)) return "—";
    return Number(n).toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    return fmtNum(n, 2) + "%";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    return String(iso).slice(0, 10);
  }

  async function loadRows(ctx, status) {
    var q = "/delivery-confirmations?status=" + encodeURIComponent(status) + "&limit=80";
    return ctx.api.traceability(q);
  }

  function rowKey(r) {
    return r.intake_id || "";
  }

  async function saveRow(ctx, intakeId, body) {
    return ctx.api.traceability("/delivery-confirmations/" + encodeURIComponent(intakeId), {
      method: "PATCH",
      body: body,
    });
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content delivery-confirm-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Delivery Confirmations"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Charcoal tracker deliveries — factory capture from Control Room is pre-filled. Complete contact, distance, stitching, loading, and remarks, then mark complete.",
      ])
    );

    var toolbar = ui.el("div", { class: "toolbar", style: "margin:0.75rem 0;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;" });
    var statusSel = ui.el("select", { class: "toolbar select" });
    ["pending", "complete", "all"].forEach(function (s) {
      statusSel.appendChild(ui.el("option", { value: s }, [s === "pending" ? "Awaiting PJ" : s === "complete" ? "Complete" : "All"]));
    });
    var refreshBtn = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Refresh"]);
    toolbar.appendChild(ui.el("label", { class: "muted" }, ["Show "]));
    toolbar.appendChild(statusSel);
    toolbar.appendChild(refreshBtn);
    container.appendChild(toolbar);

    var errEl = ui.el("p", { class: "error", style: "display:none" });
    var okEl = ui.el("p", { class: "muted", style: "display:none;color:#6b9" });
    container.appendChild(errEl);
    container.appendChild(okEl);

    var tableWrap = ui.el("div", {
      class: "delivery-confirm-scroll",
      style: "overflow:auto;max-width:100%;border:1px solid #3d3520;border-radius:6px;",
    });
    container.appendChild(tableWrap);

    var state = { rows: [], status: "pending" };

    function showErr(msg) {
      errEl.textContent = msg || "";
      errEl.style.display = msg ? "block" : "none";
      okEl.style.display = "none";
    }

    function showOk(msg) {
      okEl.textContent = msg || "";
      okEl.style.display = msg ? "block" : "none";
      errEl.style.display = "none";
    }

    function buildTable() {
      tableWrap.innerHTML = "";
      if (!state.rows.length) {
        tableWrap.appendChild(ui.el("p", { class: "muted", style: "padding:1rem" }, ["No rows."]));
        return;
      }

      var table = ui.el("table", { class: "data-table delivery-confirm-table", style: "font-size:0.78rem;min-width:1400px;" });
      var thead = ui.el("thead");
      var hdr = ui.el("tr");
      [
        "Booking",
        "Supplier",
        "Contact",
        "F",
        "GRN",
        "Permit",
        "Transporter",
        "Truck",
        "Km",
        "Weight (t)",
        "Sand&Ash (t)",
        "Unburned (t)",
        "Fines (t)",
        "Lump (t)",
        "Rest. (t)",
        "SCR1 kg",
        "SCR2 kg",
        "Super fines kg",
        "Tot ex S&A (t)",
        "% Rest",
        "% Lump",
        "% Fines",
        "Stitching",
        "Loading",
        "Remarks",
        "",
      ].forEach(function (h) {
        hdr.appendChild(ui.el("th", {}, [h]));
      });
      thead.appendChild(hdr);
      table.appendChild(thead);

      var tbody = ui.el("tbody");
      state.rows.forEach(function (r) {
        var tr = ui.el("tr");
        var pending = r.office_status !== "complete";
        tr.appendChild(ui.el("td", {}, [fmtDate(r.booking_date)]));
        tr.appendChild(ui.el("td", {}, [r.supplier || "—"]));

        var contact = ui.el("input", {
          type: "text",
          value: r.contact_number || "",
          disabled: !pending,
          style: "width:7rem;font-size:inherit;",
        });
        tr.appendChild(ui.el("td", {}, [contact]));

        tr.appendChild(ui.el("td", {}, [r.fsc_flag || "—"]));
        tr.appendChild(ui.el("td", {}, [r.grn || "—"]));
        tr.appendChild(ui.el("td", {}, [r.permit_no || "—"]));
        tr.appendChild(ui.el("td", {}, [r.transporter || "—"]));
        tr.appendChild(ui.el("td", {}, [r.truck_reg || "—"]));

        var km = ui.el("input", {
          type: "number",
          min: "0",
          step: "0.1",
          value: r.distance_km != null ? r.distance_km : "",
          disabled: !pending,
          style: "width:4rem;font-size:inherit;",
        });
        tr.appendChild(ui.el("td", {}, [km]));

        tr.appendChild(ui.el("td", {}, [fmtNum(r.weight_ton, 3)]));
        tr.appendChild(ui.el("td", {}, [fmtNum(r.sand_ash_ton, 3)]));
        tr.appendChild(ui.el("td", {}, [fmtNum(r.unburned_wood_ton, 3)]));
        tr.appendChild(ui.el("td", {}, [fmtNum(r.fines_ton, 3)]));
        tr.appendChild(ui.el("td", {}, [fmtNum(r.lumpwood_ton, 3)]));
        tr.appendChild(ui.el("td", {}, [fmtNum(r.restaurant_ton, 3)]));
        tr.appendChild(ui.el("td", {}, [fmtNum(r.scr1_20_60_kg, 1)]));
        tr.appendChild(ui.el("td", {}, [fmtNum(r.scr2_60_plus_kg, 1)]));
        tr.appendChild(ui.el("td", {}, [fmtNum(r.super_fines_kg, 1)]));
        tr.appendChild(ui.el("td", {}, [fmtNum(r.total_ex_sand_ash_ton, 3)]));
        tr.appendChild(ui.el("td", {}, [fmtPct(r.pct_restaurant)]));
        tr.appendChild(ui.el("td", {}, [fmtPct(r.pct_lumpwood)]));
        tr.appendChild(ui.el("td", {}, [fmtPct(r.pct_fines)]));

        var stitch = ui.el("input", {
          type: "text",
          value: r.bag_stitching || "",
          disabled: !pending,
          style: "width:6rem;font-size:inherit;",
        });
        var load = ui.el("input", {
          type: "text",
          value: r.truck_loading || "",
          disabled: !pending,
          style: "width:6rem;font-size:inherit;",
        });
        var remarks = ui.el("input", {
          type: "text",
          value: r.remarks || "",
          disabled: !pending,
          style: "width:8rem;font-size:inherit;",
        });
        tr.appendChild(ui.el("td", {}, [stitch]));
        tr.appendChild(ui.el("td", {}, [load]));
        tr.appendChild(ui.el("td", {}, [remarks]));

        var actions = ui.el("td", { style: "white-space:nowrap;" });
        if (pending) {
          var saveBtn = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Save"]);
          var doneBtn = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Complete"]);
          saveBtn.addEventListener("click", async function () {
            showErr("");
            try {
              await saveRow(ctx, rowKey(r), {
                contact_number: contact.value.trim(),
                distance_km: km.value === "" ? null : Number(km.value),
                bag_stitching: stitch.value.trim(),
                truck_loading: load.value.trim(),
                remarks: remarks.value.trim(),
                mark_complete: false,
              });
              showOk("Saved " + (r.supplier || rowKey(r)));
              await refresh();
            } catch (e) {
              showErr(String(e.message || e));
            }
          });
          doneBtn.addEventListener("click", async function () {
            showErr("");
            try {
              await saveRow(ctx, rowKey(r), {
                contact_number: contact.value.trim(),
                distance_km: km.value === "" ? null : Number(km.value),
                bag_stitching: stitch.value.trim(),
                truck_loading: load.value.trim(),
                remarks: remarks.value.trim(),
                mark_complete: true,
              });
              showOk("Marked complete — " + (r.supplier || rowKey(r)));
              await refresh();
            } catch (e) {
              showErr(String(e.message || e));
            }
          });
          actions.appendChild(saveBtn);
          actions.appendChild(document.createTextNode(" "));
          actions.appendChild(doneBtn);
        } else {
          actions.appendChild(ui.el("span", { class: "pill" }, ["Complete"]));
        }
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
    }

    async function refresh() {
      showErr("");
      if (!ctx.api.traceability) {
        showErr("Traceability API not configured.");
        return;
      }
      try {
        var data = await loadRows(ctx, state.status);
        state.rows = data.rows || [];
        buildTable();
      } catch (e) {
        showErr(String(e.message || e));
        tableWrap.innerHTML = "";
      }
    }

    statusSel.value = state.status;
    statusSel.addEventListener("change", function () {
      state.status = statusSel.value;
      refresh();
    });
    refreshBtn.addEventListener("click", refresh);

    await refresh();
  }

  CIS.modules.push({
    id: "delivery_confirmations",
    title: "Delivery Confirmations",
    section: "Production",
    kind: "app",
    order: 5,
    icon: "report",
    parentModule: "traceability",
    description: "Charcoal tracker deliveries — complete office fields after Control Room POST",
    requires: "traceability.delivery_confirmations",
    render: render,
  });
})();
