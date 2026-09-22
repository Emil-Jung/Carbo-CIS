/* Movement schedule — schedule what a load is doing so scanners confirm instead of retype (CIS). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var ACTIONS = [
    { value: "sold", label: "Sold to a client", needs: "client" },
    { value: "on_truck_walvisbay", label: "In transit — truck to Walvis Bay", needs: null },
    { value: "at_briquette_plant", label: "Out to Briquette Plant", needs: null },
    { value: "at_packaging_plant", label: "Out to Packaging Plant", needs: null },
    { value: "in_container", label: "Into container", needs: "container" },
  ];

  var STREAMS = [
    { value: "", label: "Any product" },
    { value: "fines", label: "Fines" },
    { value: "restaurant", label: "Restaurant" },
    { value: "lumpwood", label: "Lumpwood" },
    { value: "briquettes", label: "Briquettes" },
    { value: "pallet", label: "Pallet" },
  ];

  var STATUS_LABEL = {
    scheduled: "Scheduled",
    active: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  function progressText(job) {
    if (job.expected_bag_count) {
      return fmt(job.applied_bags) + " / " + fmt(job.expected_bag_count);
    }
    return fmt(job.applied_bags);
  }

  function actionSpec(value) {
    return ACTIONS.filter(function (a) { return a.value === value; })[0] || ACTIONS[0];
  }

  async function render(container, ctx) {
    var ui = CIS.ui;
    var jobs = [];
    var containers = [];
    var showClosed = false;

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Movement schedule"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Schedule what a load is doing. The scanner adopts the job, so the operator confirms each bag with one tap instead of retyping the client for every bag.",
      ])
    );

    function labelled(text, control) {
      return ui.el("label", { class: "ct-field" }, [
        ui.el("span", { class: "ct-field-label" }, [text]),
        control,
      ]);
    }

    var actionSelect = ui.el("select", {});
    ACTIONS.forEach(function (a) {
      actionSelect.appendChild(ui.el("option", { value: a.value }, [a.label]));
    });

    var clientInput = ui.el("input", { type: "text", placeholder: "e.g. Erongo Cement", autocomplete: "off" });
    var containerSelect = ui.el("select", {});
    var streamSelect = ui.el("select", {});
    STREAMS.forEach(function (s) {
      streamSelect.appendChild(ui.el("option", { value: s.value }, [s.label]));
    });
    var truckInput = ui.el("input", { type: "text", placeholder: "Optional", autocomplete: "off" });
    var countInput = ui.el("input", { type: "number", min: "1", step: "1", placeholder: "Optional" });

    var clientField = labelled("Client", clientInput);
    var containerField = labelled("Container", containerSelect);

    var form = ui.el("form", { class: "toolbar ct-form" });
    form.appendChild(labelled("Action", actionSelect));
    form.appendChild(clientField);
    form.appendChild(containerField);
    form.appendChild(labelled("Product", streamSelect));
    form.appendChild(labelled("Truck reg", truckInput));
    form.appendChild(labelled("Expected bags", countInput));
    form.appendChild(ui.el("button", { class: "btn", type: "submit" }, ["Schedule job"]));
    container.appendChild(form);

    function syncFields() {
      var needs = actionSpec(actionSelect.value).needs;
      clientField.style.display = needs === "client" ? "" : "none";
      containerField.style.display = needs === "container" ? "" : "none";
    }
    actionSelect.addEventListener("change", syncFields);

    var status = ui.el("p", { class: "muted" }, [""]);
    container.appendChild(status);

    var toggle = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Show completed and cancelled"]);
    toggle.addEventListener("click", function () {
      showClosed = !showClosed;
      toggle.textContent = showClosed
        ? "Hide completed and cancelled"
        : "Show completed and cancelled";
      paint();
    });
    container.appendChild(toggle);

    var body = ui.el("div", {});
    container.appendChild(body);

    function setStatus(text, isError) {
      status.textContent = text || "";
      status.className = isError ? "error-box" : "muted";
    }

    async function act(jobId, payload, describe) {
      if (!window.confirm(describe + "?")) return;
      try {
        await ctx.api.traceability("/movement-jobs/" + encodeURIComponent(jobId), {
          method: "PATCH",
          body: payload,
        });
        await load();
      } catch (e) {
        setStatus("Could not update: " + (e.message || e), true);
      }
    }

    function renderTable(list) {
      var table = ui.el("table", { class: "data" });
      table.innerHTML =
        "<thead><tr>" +
        "<th>Job</th><th>Product</th><th>Truck</th><th>Bags</th><th>Status</th><th></th>" +
        "</tr></thead>";
      var tbody = ui.el("tbody");

      list.forEach(function (j) {
        var tr = ui.el("tr");
        tr.innerHTML =
          "<td><strong>" + ui.escape(j.title) + "</strong></td>" +
          "<td>" + ui.escape(j.product_stream || "Any") + "</td>" +
          "<td>" + ui.escape(j.truck_registration || "—") + "</td>" +
          "<td>" + ui.escape(progressText(j)) + "</td>" +
          "<td>" + ui.escape(STATUS_LABEL[j.status] || j.status) + "</td>";

        var actions = ui.el("td", {});
        if (j.status === "scheduled" || j.status === "active") {
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(j.id, { status: "completed" }, "Close " + j.title);
              },
            }, ["Complete"])
          );
          actions.appendChild(
            ui.el("button", {
              class: "btn btn-sm",
              type: "button",
              onclick: function () {
                act(j.id, { status: "cancelled" }, "Cancel " + j.title);
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
      var list = jobs.filter(function (j) {
        return showClosed || (j.status !== "completed" && j.status !== "cancelled");
      });
      if (!list.length) {
        body.appendChild(ui.el("p", { class: "muted" }, ["Nothing scheduled. Add a job above."]));
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
        var data = await ctx.api.traceability("/movement-jobs");
        jobs = data.jobs || [];

        containerSelect.innerHTML = "";
        try {
          var cd = await ctx.api.traceability("/containers?open_only=true");
          containers = cd.containers || [];
        } catch (e) {
          containers = [];
        }
        if (!containers.length) {
          containerSelect.appendChild(ui.el("option", { value: "" }, ["No open containers"]));
        } else {
          containers.forEach(function (c) {
            containerSelect.appendChild(
              ui.el("option", { value: c.id }, [
                c.container_number + " (" + c.location_display + ", " + c.remaining_bags + " to load)",
              ])
            );
          });
        }

        setStatus("");
        syncFields();
        paint();
      } catch (e) {
        setStatus("Could not load the schedule: " + (e.message || e), true);
      }
    }

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var spec = actionSpec(actionSelect.value);
      var payload = {
        action: actionSelect.value,
        product_stream: streamSelect.value || null,
        truck_registration: truckInput.value.trim() || null,
        expected_bag_count: countInput.value ? parseInt(countInput.value, 10) : null,
      };
      if (spec.needs === "client") {
        payload.client_name = clientInput.value.trim();
        if (!payload.client_name) {
          setStatus("A sale needs a client.", true);
          return;
        }
      }
      if (spec.needs === "container") {
        payload.container_id = containerSelect.value;
        if (!payload.container_id) {
          setStatus("Add a container under Containers first.", true);
          return;
        }
      }
      setStatus("Saving…");
      try {
        await ctx.api.traceability("/movement-jobs", { method: "POST", body: payload });
        clientInput.value = "";
        truckInput.value = "";
        countInput.value = "";
        await load();
      } catch (e) {
        setStatus("Could not schedule: " + (e.message || e), true);
      }
    });

    await load();
  }

  CIS.modules.push({
    id: "movement_schedule",
    title: "Movement schedule",
    section: "Production",
    kind: "lookup",
    order: 18,
    icon: "bags",
    description: "Schedule loads so scanners confirm instead of retyping",
    requires: "traceability.movement_jobs",
    render: render,
  });
})();
