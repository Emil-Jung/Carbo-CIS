/* Containers — preload booked containers so the Walvis Bay yard can load against them (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var LOCATIONS = [
    { value: "walvisbay", label: "Walvisbay" },
    { value: "agl", label: "AGL" },
  ];

  var STATUS_LABEL = {
    booked: "Booked",
    loading: "Loading",
    full: "Full",
    dispatched: "Dispatched",
    cancelled: "Cancelled",
  };

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-GB", {
        timeZone: "Africa/Windhoek",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return "—";
    }
  }

  function fmtShipDate(isoDate) {
    if (!isoDate) return "—";
    try {
      var parts = String(isoDate).split("-");
      if (parts.length !== 3) return isoDate;
      var d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch (e) {
      return isoDate;
    }
  }

  function progressText(c) {
    return fmt(c.loaded_bags) + " / " + fmt(c.target_bag_count);
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var rows = [];
    var showClosed = false;

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Containers"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Preload containers from the booking (ship date and bag target). ",
        ui.el("strong", {}, ["Release for loading"]),
        " activates the yard assignment — Wynand’s scanner only offers ",
        ui.el("strong", {}, ["Into container"]),
        " when a released booking exists at that yard (same idea as packaging shift and Walvis dispatch).",
      ])
    );

    var form = ui.el("form", { class: "toolbar ct-form" });
    var numberInput = ui.el("input", {
      type: "text",
      placeholder: "Container number, e.g. ABCD1234567",
      required: "required",
      autocomplete: "off",
    });
    var countInput = ui.el("input", {
      type: "number",
      min: "1",
      step: "1",
      placeholder: "Bags",
      required: "required",
    });
    var locationSelect = ui.el("select", {});
    LOCATIONS.forEach(function (loc) {
      locationSelect.appendChild(ui.el("option", { value: loc.value }, [loc.label]));
    });
    var bookingInput = ui.el("input", { type: "text", placeholder: "Booking ref (optional)", autocomplete: "off" });
    var shipDateInput = ui.el("input", { type: "date", autocomplete: "off" });

    function labelled(text, control) {
      return ui.el("label", { class: "ct-field" }, [
        ui.el("span", { class: "ct-field-label" }, [text]),
        control,
      ]);
    }

    form.appendChild(labelled("Container number", numberInput));
    form.appendChild(labelled("Bags when full", countInput));
    form.appendChild(labelled("Yard", locationSelect));
    form.appendChild(labelled("Expected ship date", shipDateInput));
    form.appendChild(labelled("Booking ref", bookingInput));
    form.appendChild(ui.el("button", { class: "btn", type: "submit" }, ["Add container"]));
    container.appendChild(form);

    var status = ui.el("p", { class: "muted" }, [""]);
    container.appendChild(status);

    var toggle = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Show dispatched and cancelled"]);
    toggle.addEventListener("click", function () {
      showClosed = !showClosed;
      toggle.textContent = showClosed
        ? "Hide dispatched and cancelled"
        : "Show dispatched and cancelled";
      paint();
    });
    container.appendChild(toggle);

    var body = ui.el("div", {});
    container.appendChild(body);

    function setStatus(text, isError) {
      status.textContent = text || "";
      status.className = isError ? "error-box" : "muted";
    }

    async function act(containerId, path, payload, describe) {
      if (!window.confirm(describe + "?")) return;
      try {
        if (path) {
          await ctx.api.traceability(path, { method: "POST", body: payload || {} });
        } else {
          await ctx.api.traceability("/containers/" + encodeURIComponent(containerId), {
            method: "PATCH",
            body: payload,
          });
        }
        await load();
      } catch (e) {
        setStatus("Could not update: " + (e.message || e), true);
      }
    }

    function renderTable(list) {
      var table = ui.el("table", { class: "data" });
      table.innerHTML =
        "<thead><tr>" +
        "<th>Container</th><th>Yard</th><th>Ship date</th><th>Booking</th>" +
        "<th>Loaded</th><th>Status</th><th>Released</th><th></th>" +
        "</tr></thead>";
      var tbody = ui.el("tbody");

      list.forEach(function (c) {
        var tr = ui.el("tr");
        tr.innerHTML =
          "<td><strong>" + ui.escape(c.container_number) + "</strong></td>" +
          "<td>" + ui.escape(c.location_display) + "</td>" +
          "<td>" + ui.escape(fmtShipDate(c.expected_ship_date)) + "</td>" +
          "<td>" + ui.escape(c.booking_ref || "—") + "</td>" +
          "<td>" + ui.escape(progressText(c)) + "</td>" +
          "<td>" + ui.escape(STATUS_LABEL[c.status] || c.status) + "</td>" +
          "<td>" +
          ui.escape(c.released_for_loading ? fmtDate(c.released_for_loading_at) : "Not released") +
          "</td>";

        var actions = ui.el("td", {});
        if ((c.status === "booked" || c.status === "loading") && !c.released_for_loading) {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(
                  c.id,
                  "/containers/" + encodeURIComponent(c.id) + "/release-for-loading",
                  {},
                  "Release " + c.container_number + " for yard loading"
                );
              },
            }, ["Release for loading"])
          );
        }
        if (c.status === "full" || c.status === "loading") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(c.id, null, { status: "dispatched" }, "Mark " + c.container_number + " dispatched");
              },
            }, ["Dispatched"])
          );
        }
        if (c.status === "booked") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(c.id, null, { status: "cancelled" }, "Cancel the booking for " + c.container_number);
              },
            }, ["Cancel"])
          );
        }
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      return table;
    }

    function paint() {
      body.innerHTML = "";
      var list = rows.filter(function (c) {
        return showClosed || (c.status !== "dispatched" && c.status !== "cancelled");
      });
      if (!list.length) {
        body.appendChild(ui.el("p", { class: "muted" }, ["No containers yet. Add the next booking above."]));
        return;
      }
      body.appendChild(renderTable(list));
    }

    async function load() {
      setStatus("Loading…");
      if (!ctx.api.traceability) {
        setStatus("Traceability API is not configured in CIS.", true);
        return;
      }
      try {
        var data = await ctx.api.traceability("/containers");
        rows = data.containers || [];
        setStatus("");
        paint();
      } catch (e) {
        setStatus("Could not load containers: " + (e.message || e), true);
      }
    }

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var number = numberInput.value.trim().toUpperCase();
      var count = parseInt(countInput.value, 10);
      if (!number || !count || count < 1) {
        setStatus("Enter a container number and the bag count that fills it.", true);
        return;
      }
      setStatus("Saving…");
      try {
        var bodyPayload = {
          container_number: number,
          target_bag_count: count,
          location: locationSelect.value,
          booking_ref: bookingInput.value.trim() || null,
        };
        if (shipDateInput.value) {
          bodyPayload.expected_ship_date = shipDateInput.value;
        }
        await ctx.api.traceability("/containers", {
          method: "POST",
          body: bodyPayload,
        });
        numberInput.value = "";
        countInput.value = "";
        bookingInput.value = "";
        shipDateInput.value = "";
        await load();
      } catch (e) {
        setStatus("Could not add container: " + (e.message || e), true);
      }
    });

    await load();
  }

  CIS.modules.push({
    id: "containers",
    title: "Containers",
    section: "Production",
    kind: "lookup",
    order: 17,
    icon: "bags",
    description: "Preload and release containers for Walvis / AGL Into container scans",
    requires: "traceability.containers",
    render: render,
  });
})();
