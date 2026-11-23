/* Manual producer status — Non-FSC <-> Other FSC (office). Historical loads keep their recorded status. */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function kindLabel(kind) {
    return kind === "ext_fsc" ? "Other FSC" : "Non-FSC";
  }

  function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content manual-producer-status-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Producer certification status"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "When a manual producer (Non-FSC or Other FSC) gains or loses FSC under another certificate, convert them here. ",
        "Past truck loads and bags stay on the old status; only new loads after the conversion date use the new profile.",
      ])
    );

    var searchRow = ui.el("div", { class: "delivery-conf-export-row" });
    var searchInput = ui.el("input", {
      type: "search",
      placeholder: "Search name or farm (e.g. Smith, Alwyn 922)",
      class: "modal-field-input",
      style: "max-width:320px",
    });
    var searchBtn = ui.el("button", { type: "button", class: "btn-sm" }, ["Search"]);
    var includeRetired = ui.el("input", { type: "checkbox", id: "mpIncludeRetired" });
    includeRetired.checked = true;
    searchRow.appendChild(searchInput);
    searchRow.appendChild(searchBtn);
    searchRow.appendChild(ui.el("label", { style: "margin-left:12px" }, [includeRetired, " Show retired"]));
    container.appendChild(searchRow);

    var msg = ui.el("p", { class: "device-gate__hint", style: "min-height:1.2em" }, [""]);
    container.appendChild(msg);

    var tableWrap = ui.el("div", { class: "delivery-conf-table-wrap" });
    var table = ui.el("table", { class: "delivery-conf-table" });
    tableWrap.appendChild(table);
    container.appendChild(tableWrap);

    var panel = ui.el("section", { class: "panel", hidden: true });
    var panelTitle = ui.el("h3", {}, ["Convert producer"]);
    var panelDetail = ui.el("p", { class: "device-gate__hint" }, [""]);
    var effInput = ui.el("input", { type: "date", class: "modal-field-input" });
    var noteInput = ui.el("textarea", { class: "modal-field-input", rows: 2, placeholder: "Reason / certificate ref (optional)" });
    var fscInput = ui.el("input", {
      type: "text",
      class: "modal-field-input",
      placeholder: "FSC certificate number (required when converting to Other FSC)",
    });
    var convertBtn = ui.el("button", { type: "button", class: "action-hub__btn action-hub__btn--primary" }, [
      "Save conversion",
    ]);
    panel.appendChild(panelTitle);
    panel.appendChild(panelDetail);
    panel.appendChild(ui.el("label", { class: "modal-field-label" }, ["Effective from (new loads)"]));
    panel.appendChild(effInput);
    panel.appendChild(ui.el("label", { class: "modal-field-label" }, ["FSC number (Other FSC only)"]));
    panel.appendChild(fscInput);
    panel.appendChild(ui.el("label", { class: "modal-field-label" }, ["Note"]));
    panel.appendChild(noteInput);
    panel.appendChild(convertBtn);
    container.appendChild(panel);

    var selected = null;

    function setMsg(text, isErr) {
      msg.textContent = text || "";
      msg.style.color = isErr ? "var(--danger, #c00)" : "";
    }

    function renderTable(rows) {
      table.innerHTML = "";
      var thead = ui.el("thead");
      var hr = ui.el("tr");
      ["Name / farm", "Current", "Status", "Active from", ""].forEach(function (h) {
        hr.appendChild(ui.el("th", {}, [h]));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = ui.el("tbody");
      if (!rows.length) {
        var empty = ui.el("tr");
        empty.appendChild(ui.el("td", { colSpan: 5 }, ["No producers found."]));
        tbody.appendChild(empty);
      }
      rows.forEach(function (row) {
        var tr = ui.el("tr");
        if (row.status === "retired") tr.style.opacity = "0.65";
        tr.appendChild(ui.el("td", {}, [row.display_label || "—"]));
        tr.appendChild(
          ui.el("td", {}, [
            kindLabel(row.kind) + (row.fsc_number ? " · " + row.fsc_number : ""),
          ])
        );
        tr.appendChild(ui.el("td", {}, [row.status === "retired" ? "Retired" : "Active"]));
        tr.appendChild(ui.el("td", {}, [row.active_from || "—"]));
        var btn = ui.el("button", { type: "button", class: "btn-sm" }, ["Convert…"]);
        btn.disabled = row.status !== "active";
        btn.addEventListener("click", function () {
          selectRow(row);
        });
        var td = ui.el("td", {});
        td.appendChild(btn);
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }

    function selectRow(row) {
      selected = row;
      panel.hidden = false;
      var target = row.kind === "non_fsc" ? "Other FSC" : "Non-FSC";
      panelDetail.textContent =
        (row.display_label || "") +
        " will become " +
        target +
        ". Existing deliveries stay " +
        kindLabel(row.kind) +
        ".";
      fscInput.parentElement.hidden = row.kind !== "non_fsc";
      try {
        effInput.value = new Date().toISOString().slice(0, 10);
      } catch (e) {
        effInput.value = "";
      }
    }

    async function loadList() {
      if (!ctx.api || !ctx.api.traceability) {
        setMsg("Traceability API not configured.", true);
        return;
      }
      setMsg("Loading…");
      try {
        var q = encodeURIComponent(searchInput.value.trim());
        var retired = includeRetired.checked ? "true" : "false";
        var data = await ctx.api.traceability(
          "/office/manual-producers?q=" + q + "&include_retired=" + retired,
          { method: "GET" }
        );
        renderTable((data && data.producers) || []);
        setMsg("");
      } catch (err) {
        setMsg((err && err.message) || "Load failed", true);
      }
    }

    convertBtn.addEventListener("click", function () {
      if (!selected || !ctx.api || !ctx.api.traceability) return;
      var toKind = selected.kind === "non_fsc" ? "ext_fsc" : "non_fsc";
      var body = {
        from_kind: selected.kind,
        from_id: selected.id,
        to_kind: toKind,
        effective_from: effInput.value || null,
        note: noteInput.value.trim() || null,
      };
      if (toKind === "ext_fsc") {
        body.fsc_number = fscInput.value.trim();
        if (!body.fsc_number) {
          setMsg("FSC certificate number is required.", true);
          return;
        }
      }
      if (
        !window.confirm(
          "Convert " +
            (selected.display_label || "this producer") +
            " to " +
            (toKind === "ext_fsc" ? "Other FSC" : "Non-FSC") +
            " from " +
            (body.effective_from || "today") +
            "?"
        )
      ) {
        return;
      }
      setMsg("Saving…");
      ctx.api
        .traceability("/office/manual-producers/convert", {
          method: "POST",
          body: JSON.stringify(body),
        })
        .then(function () {
          panel.hidden = true;
          selected = null;
          setMsg("Conversion saved. History lists will show the new active profile only.");
          return loadList();
        })
        .catch(function (err) {
          setMsg((err && err.message) || "Conversion failed", true);
        });
    });

    searchBtn.addEventListener("click", function () {
      void loadList();
    });
    searchInput.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") void loadList();
    });
    includeRetired.addEventListener("change", function () {
      void loadList();
    });

    void loadList();
  }

  CIS.modules.push({
    id: "manual_producer_status",
    title: "Producer certification",
    kind: "app",
    icon: "delivery",
    description: "Convert manual Non-FSC / Other FSC producers without changing past loads",
    requires: "traceability.delivery_confirmations",
    render: render,
  });
})();