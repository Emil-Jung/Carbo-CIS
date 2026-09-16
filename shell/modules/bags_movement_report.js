/* Bags Movement — daily sieve scan-in report (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function fmt(n, d) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString(undefined, {
      minimumFractionDigits: d || 0,
      maximumFractionDigits: d || 0,
    });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + " " + monthShort(parts[1]) + " " + parts[0];
  }

  function monthShort(m) {
    var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var n = parseInt(m, 10);
    return names[n - 1] || m;
  }

  function todayIso() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function shiftDate(iso, deltaDays) {
    var parts = String(iso).split("-");
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + deltaDays);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function streamLabel(s) {
    if (!s) return "—";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function card(ui, label, value) {
    var c = ui.el("div", { class: "card" });
    c.appendChild(ui.el("div", { class: "label" }, [label]));
    c.appendChild(ui.el("div", { class: "value" }, [value]));
    return c;
  }

  function paintReport(body, data, ui) {
    body.innerHTML = "";
    var streams = data.streams || {};

    var cards = ui.el("div", { class: "cards" });
    cards.appendChild(card(ui, "Bags this day", fmt(data.bag_count)));
    cards.appendChild(
      card(
        ui,
        "Restaurant",
        fmt((streams.restaurant && streams.restaurant.bags) || 0) +
          " · " +
          fmt((streams.restaurant && streams.restaurant.kg) || 0, 0) +
          " kg"
      )
    );
    cards.appendChild(
      card(
        ui,
        "Lumpwood",
        fmt((streams.lumpwood && streams.lumpwood.bags) || 0) +
          " · " +
          fmt((streams.lumpwood && streams.lumpwood.kg) || 0, 0) +
          " kg"
      )
    );
    cards.appendChild(
      card(
        ui,
        "Fines",
        fmt((streams.fines && streams.fines.bags) || 0) +
          " · " +
          fmt((streams.fines && streams.fines.kg) || 0, 0) +
          " kg"
      )
    );
    cards.appendChild(card(ui, "Total net weight", fmt(data.total_kg, 0) + " kg"));
    body.appendChild(cards);

    if (!data.rows || !data.rows.length) {
      body.appendChild(
        ui.el("p", { class: "muted" }, ["No bags recorded on this date."])
      );
      return;
    }

    var table = ui.el("table", { class: "data bags-movement-table" });
    table.innerHTML =
      "<thead><tr>" +
      "<th>#</th><th>Producer</th><th>Stream</th><th>Net kg</th>" +
      "<th>Weathering start</th><th>Weathering end</th><th>Days left</th>" +
      "<th>Status</th><th>Tag</th>" +
      "</tr></thead>";
    var tbody = ui.el("tbody");

    data.rows.forEach(function (row) {
      var tr = ui.el("tr");
      var daysClass = row.weathered ? "bags-movement-days bags-movement-days--done" : "bags-movement-days";
      var daysText = row.weathered ? "0 (ready)" : String(row.days_remaining);
      tr.innerHTML =
        "<td>" + ui.escape(String(row.seq)) + "</td>" +
        "<td>" + ui.escape(row.producer_name || "—") + "</td>" +
        "<td>" + ui.escape(streamLabel(row.product_stream)) + "</td>" +
        "<td>" + fmt(row.net_weight_kg, 0) + "</td>" +
        "<td>" + ui.escape(fmtDate(row.weathering_start_date)) + "</td>" +
        "<td>" + ui.escape(fmtDate(row.weathering_end_date)) + "</td>" +
        "<td class='" + daysClass + "'>" + ui.escape(daysText) + "</td>" +
        "<td>" + ui.escape(row.storage_status_display || row.storage_status_label || "—") + "</td>" +
        "<td class='bags-movement-tag'>" + ui.escape(row.serial || "—") + "</td>";
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    body.appendChild(table);

    body.appendChild(
      ui.el("p", { class: "muted" }, [
        "Weathering: " +
          String(data.weathering_days || 21) +
          " calendar days after scan-in · timezone " +
          ui.escape(data.timezone || "Africa/Windhoek") +
          ". New bags default to In Storage until scanned out.",
      ])
    );
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Bags Movement"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Bags scanned in at the sieve, grouped by date — producer, product stream, weathering countdown, and storage status.",
      ])
    );

    var toolbar = ui.el("div", { class: "toolbar" });
    toolbar.appendChild(ui.el("label", { for: "bags-movement-date" }, ["Date"]));
    var dateInput = ui.el("input", {
      id: "bags-movement-date",
      type: "date",
      value: todayIso(),
    });
    toolbar.appendChild(dateInput);

    var prevBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm" }, ["Previous day"]);
    var nextBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm" }, ["Next day"]);
    var todayBtn = ui.el("button", { type: "button", class: "btn-ghost btn-sm" }, ["Today"]);
    toolbar.appendChild(prevBtn);
    toolbar.appendChild(nextBtn);
    toolbar.appendChild(todayBtn);
    container.appendChild(toolbar);

    var status = ui.el("p", { class: "muted" }, ["Loading…"]);
    container.appendChild(status);
    var body = ui.el("div", { class: "report-body" });
    container.appendChild(body);

    async function loadReport(isoDate) {
      status.textContent = "Loading…";
      status.style.display = "";
      body.innerHTML = "";
      if (!ctx.api.traceability) {
        status.style.display = "none";
        body.appendChild(ui.error("Traceability API is not configured in CIS."));
        return;
      }
      try {
        var data = await ctx.api.traceability(
          "/reports/bags-movement?date=" + encodeURIComponent(isoDate)
        );
        status.style.display = "none";
        paintReport(body, data, ui);
      } catch (e) {
        status.textContent = "";
        body.innerHTML = "";
        body.appendChild(ui.error("Could not load report: " + (e.message || e)));
      }
    }

    function currentDate() {
      return dateInput.value || todayIso();
    }

    dateInput.addEventListener("change", function () {
      loadReport(currentDate());
    });
    prevBtn.addEventListener("click", function () {
      dateInput.value = shiftDate(currentDate(), -1);
      loadReport(dateInput.value);
    });
    nextBtn.addEventListener("click", function () {
      dateInput.value = shiftDate(currentDate(), 1);
      loadReport(dateInput.value);
    });
    todayBtn.addEventListener("click", function () {
      dateInput.value = todayIso();
      loadReport(dateInput.value);
    });

    await loadReport(currentDate());
  }

  CIS.modules.push({
    id: "bags_movement_report",
    title: "Bags Movement",
    section: "Production",
    kind: "lookup",
    order: 16,
    icon: "bags",
    description: "Daily bag scan-in — producer, stream, weathering, storage status",
    requires: "traceability.bags_movement",
    render: render,
  });
})();
