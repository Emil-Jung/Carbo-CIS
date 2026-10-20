/* Walvis dispatches — truck manifest (GF load) vs received (Walvis storage).
   Display names: Dispatch [DAY] [DATE] #[N] — Windhoek day; N = 1st/2nd/… dispatch that day (API display_label). */
(function () {
  "use strict";
  var WALVIS_DISPATCH_UI_REV = "1.6.68-manifest-list-only";
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

  async function apiPatch(ctx, path, body) {
    return ctx.api.traceability(path, { method: "PATCH", body: body || {} });
  }

  /** Modal with explicit Cancel — avoids prompt() treating cancel as empty OK. */
  function showFormModal(ui, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var backdrop = ui.el("div", { class: "modal-backdrop" });
      var modal = ui.el("div", { class: "modal modal-wide" });
      modal.appendChild(ui.el("h3", {}, [opts.title || "Confirm"]));
      if (opts.message) {
        var p = ui.el("p", { class: "module-desc" });
        p.textContent = opts.message;
        modal.appendChild(p);
      }
      if (opts.detail) {
        var pre = ui.el("pre", {
          style: "white-space:pre-wrap;font-size:12px;max-height:14rem;overflow:auto;margin:0.5rem 0;",
        });
        pre.textContent = opts.detail;
        modal.appendChild(pre);
      }
      var inputs = {};
      (opts.fields || []).forEach(function (f) {
        modal.appendChild(
          ui.el("label", { for: "wd_" + f.key }, [f.label + (f.required ? " *" : "")])
        );
        var inp = ui.el("input", {
          id: "wd_" + f.key,
          type: f.type || "text",
          value: f.value || "",
          placeholder: f.placeholder || "",
        });
        modal.appendChild(inp);
        inputs[f.key] = inp;
      });
      var actions = ui.el("div", { class: "modal-actions" });
      var cancelBtn = ui.el("button", { type: "button", class: "btn-ghost" }, [
        opts.cancelLabel || "Cancel",
      ]);
      var okBtn = ui.el("button", { type: "button", class: "settings-action-btn" }, [
        opts.primaryLabel || "Continue",
      ]);
      function close(result) {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        resolve(result);
      }
      cancelBtn.addEventListener("click", function () {
        close(null);
      });
      okBtn.addEventListener("click", function () {
        var out = {};
        Object.keys(inputs).forEach(function (k) {
          out[k] = inputs[k].value;
        });
        if (opts.validate) {
          var err = opts.validate(out);
          if (err) {
            window.alert(err);
            return;
          }
        }
        close(out);
      });
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop) close(null);
      });
      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      modal.appendChild(actions);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      var firstField = opts.fields && opts.fields[0];
      if (firstField) {
        var focusEl = document.getElementById("wd_" + firstField.key);
        if (focusEl) focusEl.focus();
      }
    });
  }

  function windhoekLabelDateYmd(iso) {
    if (!iso) return "";
    try {
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Windhoek",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(iso));
      var y = "";
      var m = "";
      var d = "";
      parts.forEach(function (p) {
        if (p.type === "year") y = p.value;
        if (p.type === "month") m = p.value;
        if (p.type === "day") d = p.value;
      });
      if (y && m && d) return y + "-" + m + "-" + d;
    } catch (e) {
      /* ignore */
    }
    return "";
  }

  function dispatchDisplayLabel(d) {
    if (!d) return "Dispatch";
    if (d.display_label) return d.display_label;
    var idx =
      d.dispatch_day_index != null && d.dispatch_day_index !== ""
        ? d.dispatch_day_index
        : d.dispatch_number;
    if (d.opened_at) {
      try {
        var dt = new Date(d.opened_at);
        var wd = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Windhoek",
          weekday: "short",
        }).format(dt);
        var day = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Windhoek",
          day: "2-digit",
        }).format(dt);
        var mon = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Windhoek",
          month: "2-digit",
        }).format(dt);
        var yr = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Windhoek",
          year: "2-digit",
        }).format(dt);
        return "Dispatch " + wd + " " + day + "-" + mon + "-" + yr + " #" + idx;
      } catch (e) {
        /* fall through */
      }
    }
    if (d.dispatch_number != null) return "Dispatch #" + d.dispatch_number;
    return "Dispatch";
  }

  function dispatchOpenLabel(d) {
    if (!d) return "No open dispatch";
    return (
      dispatchDisplayLabel(d) +
      (d.truck_registration ? " · " + d.truck_registration : "") +
      " — " +
      fmt(d.loaded_bags) +
      " bag(s) on manifest"
    );
  }

  async function truckDetailsModal(ui, title, message, defaults) {
    return showFormModal(ui, {
      title: title,
      message: message,
      fields: [
        {
          key: "truck_registration",
          label: "Truck registration",
          value: (defaults && defaults.truck_registration) || "",
          placeholder: "Optional — can add later",
        },
        {
          key: "transporter",
          label: "Transporter / contractor",
          value: (defaults && defaults.transporter) || "",
          placeholder: "Optional",
        },
        { key: "notes", label: "Notes", value: (defaults && defaults.notes) || "", placeholder: "Optional" },
      ],
      cancelLabel: "Cancel",
      primaryLabel: "Continue",
    });
  }

  function rowSerial(r) {
    return (r && (r.bag_identifier || r.serial)) || "";
  }

  function applyBreakdownReconcile(detail, breakdown) {
    var manifestIds = {};
    (detail.bags || []).forEach(function (b) {
      manifestIds[b.bag_identifier] = true;
    });
    var all = [];

    function pushFromCategories(categories, otherLabel) {
      (categories || []).forEach(function (cat) {
        (cat.rows || []).forEach(function (r) {
          var serial = rowSerial(r);
          if (!serial) return;
          all.push({
            bag_identifier: serial,
            product_stream: r.product_stream,
            net_weight_kg: r.net_weight_kg,
            on_this_manifest: !!manifestIds[serial],
            other_dispatch_label: manifestIds[serial] ? null : otherLabel,
          });
        });
      });
    }
    (breakdown.dispatches || []).forEach(function (d) {
      var label =
        d.display_label ||
        (d.dispatch_number != null ? "Dispatch #" + d.dispatch_number : "Other dispatch");
      var onThis = String(d.id) === String(detail.id);
      pushFromCategories(d.categories, onThis ? null : label);
    });
    pushFromCategories(
      breakdown.unassigned && breakdown.unassigned.categories,
      null
    );
    (breakdown.pallets && breakdown.pallets.rows || []).forEach(function (r) {
      var serial = rowSerial(r);
      if (!serial) return;
      all.push({
        bag_identifier: serial,
        product_stream: r.product_stream || "pallet",
        net_weight_kg: r.net_weight_kg,
        on_this_manifest: !!manifestIds[serial],
        other_dispatch_label: manifestIds[serial] ? null : null,
      });
    });
    var seen = {};
    all = all.filter(function (b) {
      if (seen[b.bag_identifier]) return false;
      seen[b.bag_identifier] = true;
      return true;
    });
    all.sort(function (a, b) {
      return String(a.bag_identifier).localeCompare(String(b.bag_identifier));
    });
    var gap = all
      .filter(function (b) {
        return !manifestIds[b.bag_identifier];
      })
      .map(function (b) {
        return {
          bag_identifier: b.bag_identifier,
          product_stream: b.product_stream,
          net_weight_kg: b.net_weight_kg,
          other_dispatch_label: b.other_dispatch_label,
        };
      });
    detail.walvis_ground_all = all;
    detail.walvis_ground_total_count = all.length;
    detail.walvis_ground_on_manifest_count = all.filter(function (b) {
      return b.on_this_manifest;
    }).length;
    detail.walvis_ground_not_on_manifest = gap;
    detail.walvis_ground_not_on_manifest_count = gap.length;
    detail._reconcile_from_breakdown = true;
  }

  async function enrichDetailWithGroundReconcile(ctx, detail) {
    return detail;
  }

  async function promptAndAddBagToDispatch(container, ctx, detail, presetSerial) {
    var serial =
      presetSerial != null && String(presetSerial).trim()
        ? String(presetSerial).trim()
        : window.prompt(
            "Bag serial (e.g. BAG-2026-001234):\n\nOne bag per prompt — repeat for each missing bag.\nCancel = stop.",
            ""
          );
    if (serial === null || !String(serial).trim()) return false;
    serial = String(serial).trim();
    var markReceived = window.confirm(
      "Add " +
        serial +
        " to " +
        dispatchDisplayLabel(detail) +
        " and mark received at Walvis?\n\n" +
        "OK = yes (bag is already in Walvis storage).\n" +
        "Cancel = add to manifest only (still on truck)."
    );
    try {
      await apiPost(ctx, "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/bags", {
        bag_identifier: serial,
        mark_received: markReceived,
      });
      await openDetail(container, ctx, detail.id);
      return true;
    } catch (e) {
      window.alert(e.message || String(e));
      return false;
    }
  }

  function clearWalvisFloatingBack(ctx) {
    if (ctx && ctx.setFloatingBack) ctx.setFloatingBack(null);
  }

  function setWalvisDetailFloatingBack(container, ctx) {
    if (!ctx || !ctx.setFloatingBack) return;
    ctx.setFloatingBack({
      label: "Dispatch list",
      onClick: function () {
        return renderList(container, ctx);
      },
    });
  }

  async function appendInTransitLinkBlock(host, container, ctx, ui, detail) {
    var preview;
    try {
      preview = await apiGet(
        ctx,
        "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/preview-in-transit-link"
      );
    } catch (e) {
      return;
    }
    var bags = preview.bags || [];
    if (!bags.length) return;

    var loadDay = preview.loading_date || detail.loading_date || windhoekTodayInputValue();
    var checkboxes = [];

    var box = ui.el("div", { class: "walvis-in-transit-link" });
    box.appendChild(
      ui.el("h4", { class: "walvis-dispatch-panel-title", style: "font-size:0.95rem;margin-top:0.75rem;" }, [
        "Link in-transit bags (select)",
      ])
    );
    box.appendChild(
      ui.el("p", { class: "muted walvis-in-transit-link-hint" }, [
        "Grouped by Windhoek day they went in transit. Select only this load — older in-transit stock can stay unlinked for now.",
      ])
    );

    var dayGroups = preview.by_transit_day || [];
    if (!dayGroups.length) {
      dayGroups = [{ day: "unknown", bag_identifiers: bags.map(function (b) { return b.bag_identifier; }) }];
    }

    var listHost = ui.el("div", { class: "walvis-in-transit-picker" });

    dayGroups.forEach(function (grp) {
      var day = grp.day || "unknown";
      var dayBags = bags.filter(function (b) {
        return (b.in_transit_day_windhoek || "unknown") === day;
      });
      if (!dayBags.length) return;

      var dayHeader = ui.el("div", { class: "walvis-in-transit-day" });
      var dayCheck = ui.el("input", { type: "checkbox", class: "walvis-in-transit-day-cb" });
      var defaultDayOn = day === loadDay;
      dayCheck.checked = defaultDayOn;
      dayHeader.appendChild(dayCheck);
      dayHeader.appendChild(
        ui.el("span", { class: "walvis-in-transit-day-label" }, [
          "In transit " + (day === "unknown" ? "(date unknown)" : day) + " · " + dayBags.length + " bag(s)",
        ])
      );
      if (day === loadDay) {
        dayHeader.appendChild(ui.el("span", { class: "walvis-in-transit-day-tag" }, ["matches load day"]));
      }
      listHost.appendChild(dayHeader);

      var bagList = ui.el("div", { class: "walvis-in-transit-bag-list" });
      dayBags.forEach(function (b) {
        var onOther = b.manifest_status === "on_other_dispatch";
        var row = ui.el("label", { class: "walvis-in-transit-bag-row" + (onOther ? " walvis-in-transit-bag-row--blocked" : "") });
        var cb = ui.el("input", { type: "checkbox", value: b.bag_identifier });
        cb.checked = defaultDayOn && !onOther;
        cb.disabled = onOther;
        cb.dataset.bag = b.bag_identifier;
        if (!onOther) checkboxes.push(cb);
        row.appendChild(cb);
        var meta =
          b.bag_identifier +
          (b.product_label
            ? " · " + b.product_label
            : b.product_code
              ? " · " + b.product_code
              : b.product_stream
                ? " · " + b.product_stream
                : "");
        if (onOther && b.other_dispatch_label) {
          meta += " · locked on " + b.other_dispatch_label;
        } else if (b.manifest_status === "unmanifested") {
          meta += " · no manifest";
        }
        row.appendChild(ui.el("span", {}, [meta]));
        bagList.appendChild(row);
        dayCheck.addEventListener("change", function () {
          bagList.querySelectorAll("input[type=checkbox]").forEach(function (c) {
            c.checked = dayCheck.checked;
          });
        });
      });
      listHost.appendChild(bagList);
    });

    box.appendChild(listHost);

    var actions = ui.el("div", { class: "walvis-in-transit-picker-actions" });
    var selectLoadBtn = ui.el("button", { type: "button", class: "btn-ghost" }, ["Select load day only"]);
    selectLoadBtn.addEventListener("click", function () {
      checkboxes.forEach(function (cb) {
        var bag = bags.find(function (b) { return b.bag_identifier === cb.value; });
        cb.checked = bag && (bag.in_transit_day_windhoek || "") === loadDay;
      });
    });
    actions.appendChild(selectLoadBtn);
    actions.appendChild(
      ui.el("button", {
        type: "button",
        class: "btn-ghost",
        onclick: function () {
          checkboxes.forEach(function (cb) { cb.checked = false; });
        },
      }, ["Clear"])
    );
    box.appendChild(actions);

    var attachBtn = ui.el("button", {
      type: "button",
      class: "settings-action-btn walvis-in-transit-link-btn",
    }, ["Link selected bags"]);
    attachBtn.addEventListener("click", async function () {
      var selected = checkboxes.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      if (!selected.length) {
        window.alert("Select at least one in-transit bag.");
        return;
      }
      if (
        !window.confirm(
          "Link " +
            selected.length +
            " bag(s) to " +
            dispatchDisplayLabel(detail) +
            "?\n\nBag status stays in transit.\nBags on another manifest cannot be selected."
        )
      ) {
        return;
      }
      attachBtn.disabled = true;
      try {
        var updated = await apiPost(
          ctx,
          "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/attach-in-transit",
          { bag_identifiers: selected, reassign_from_other: false }
        );
        updated = await enrichDetailWithGroundReconcile(ctx, updated);
        await renderDetail(container, ctx, updated);
      } catch (e) {
        window.alert(e.message || String(e));
      } finally {
        attachBtn.disabled = false;
      }
    });
    box.appendChild(attachBtn);
    host.appendChild(box);
  }

  async function appendGroundPlanPicker(recon, container, ctx, ui, detail) {
    if (!detail.plan_lines || !detail.plan_lines.length) return;
    var preview;
    try {
      preview = await apiGet(
        ctx,
        "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/preview-ground-link"
      );
    } catch (e) {
      return;
    }
    var planLines = preview.plan_lines || [];
    var anyBags = planLines.some(function (ln) {
      return (ln.bags || []).length > 0;
    });
    if (!anyBags && !(preview.unclassified_count > 0)) return;

    var box = ui.el("div", { class: "walvis-ground-plan-picker" });
    box.appendChild(
      ui.el("h4", { class: "walvis-dispatch-panel-title", style: "font-size:0.95rem;margin:0.75rem 0 0.35rem;" }, [
        "Add from Walvis ground by load plan",
      ])
    );
    box.appendChild(
      ui.el("p", { class: "muted walvis-in-transit-link-hint" }, [
        "Bags are grouped by plan line (e.g. Restaurant FSC vs Non-FSC). Tick serials, then add — ",
        "same product keys as your load plan, not just bag numbers.",
      ])
    );

    var checkboxes = [];

    planLines.forEach(function (ln) {
      var bags = ln.bags || [];
      if (!bags.length && ln.remaining_on_plan <= 0) return;

      var dayHeader = ui.el("div", { class: "walvis-in-transit-day walvis-ground-plan-line" });
      var lineCheck = ui.el("input", { type: "checkbox", class: "walvis-ground-plan-line-cb" });
      dayHeader.appendChild(lineCheck);
      dayHeader.appendChild(
        ui.el("span", { class: "walvis-in-transit-day-label" }, [
          (ln.label || ln.product_key) +
            " · Plan " +
            ln.planned +
            " · On manifest " +
            ln.on_manifest +
            " · At Walvis " +
            ln.at_walvis_count +
            (ln.remaining_on_plan > 0 ? " · Pick up to " + ln.remaining_on_plan : ""),
        ])
      );
      box.appendChild(dayHeader);

      if (!bags.length) {
        box.appendChild(
          ui.el("p", { class: "muted", style: "font-size:0.82rem;margin:0 0 0.5rem 1.5rem;" }, [
            "No Walvis ground bags match this plan line.",
          ])
        );
        return;
      }

      var bagList = ui.el("div", { class: "walvis-in-transit-bag-list" });
      bags.forEach(function (b) {
        var row = ui.el("label", { class: "walvis-in-transit-bag-row" });
        var cb = ui.el("input", { type: "checkbox", value: b.bag_identifier });
        cb.dataset.productKey = ln.product_key || "";
        checkboxes.push(cb);
        row.appendChild(cb);
        row.appendChild(
          ui.el("span", {}, [
            b.bag_identifier +
              (b.product_label && b.product_label !== ln.label ? " · " + b.product_label : ""),
          ])
        );
        bagList.appendChild(row);
      });
      box.appendChild(bagList);

      var capBtn = ui.el("button", { type: "button", class: "btn-ghost" }, ["Select up to plan limit"]);
      capBtn.addEventListener("click", function () {
        var n = ln.remaining_on_plan > 0 ? ln.remaining_on_plan : bags.length;
        var picked = 0;
        checkboxes.forEach(function (cb) {
          if (cb.dataset.productKey !== (ln.product_key || "")) return;
          cb.checked = false;
        });
        checkboxes.forEach(function (cb) {
          if (cb.dataset.productKey !== (ln.product_key || "")) return;
          if (picked >= n) return;
          cb.checked = true;
          picked += 1;
        });
      });
      box.appendChild(capBtn);

      lineCheck.addEventListener("change", function () {
        bagList.querySelectorAll("input[type=checkbox]").forEach(function (c) {
          c.checked = lineCheck.checked;
        });
      });
    });

    if (preview.unclassified_count > 0) {
      box.appendChild(
        ui.el("p", { class: "muted", style: "font-size:0.82rem;margin:0.5rem 0 0;" }, [
          preview.unclassified_count +
            " bag(s) at Walvis could not be matched to a plan product key — use Add bag or check product stream/FSC on the bag.",
        ])
      );
    }
    if (preview.blocked_on_other_dispatch_count > 0) {
      box.appendChild(
        ui.el("p", { class: "walvis-dispatch-missing", style: "font-size:0.82rem;margin:0.5rem 0 0;" }, [
          String(preview.blocked_on_other_dispatch_count),
          " bag(s) at Walvis are ",
          ui.el("strong", {}, ["already on another truck manifest"]),
          " — they are hidden from auto-pick here. Detach or transfer on the correct dispatch if you truly need to move them.",
        ])
      );
    }

    var actions = ui.el("div", { class: "walvis-in-transit-picker-actions" });
    actions.appendChild(
      ui.el("button", {
        type: "button",
        class: "btn-ghost",
        onclick: function () {
          checkboxes.forEach(function (c) { c.checked = false; });
        },
      }, ["Clear"])
    );
    box.appendChild(actions);

    var attachBtn = ui.el("button", {
      type: "button",
      class: "walvis-gold-btn walvis-gold-btn--release",
    }, ["Add selected to manifest (received at Walvis)"]);
    attachBtn.addEventListener("click", async function () {
      var selected = checkboxes.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      if (!selected.length) {
        window.alert("Select at least one bag.");
        return;
      }
      if (
        !window.confirm(
          "Add " +
            selected.length +
            " bag(s) to " +
            dispatchDisplayLabel(detail) +
            " and mark received at Walvis?"
        )
      ) {
        return;
      }
      attachBtn.disabled = true;
      try {
        var updated = await apiPost(
          ctx,
          "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/attach-ground",
          { bag_identifiers: selected, mark_received: true, reassign_from_other: false }
        );
        updated = await enrichDetailWithGroundReconcile(ctx, updated);
        await renderDetail(container, ctx, updated);
      } catch (e) {
        window.alert(e.message || String(e));
      } finally {
        attachBtn.disabled = false;
      }
    });
    box.appendChild(attachBtn);
    recon.appendChild(box);
  }

  async function renderDetail(container, ctx, detail) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content walvis-dispatch-host walvis-dispatch-detail";
    container.setAttribute("data-walvis-ui-rev", WALVIS_DISPATCH_UI_REV);
    setWalvisDetailFloatingBack(container, ctx);

    container.appendChild(
      ui.el("button", {
        type: "button",
        class: "btn-ghost walvis-dispatch-detail-back",
        onclick: function () {
          renderList(container, ctx);
        },
      }, ["← Back to list"])
    );

    var title =
      dispatchDisplayLabel(detail) +
      (detail.truck_registration ? " · " + detail.truck_registration : "");
    container.appendChild(ui.el("h2", { class: "module-title" }, [title]));

    var workspace = ui.el("div", { class: "walvis-dispatch-workspace walvis-dispatch-detail-workspace" });
    var leftPanel = ui.el("section", { class: "walvis-dispatch-panel" });
    var rightPanel = ui.el("section", { class: "walvis-dispatch-panel walvis-dispatch-panel--detail-manifest" });
    leftPanel.appendChild(
      ui.el("h3", { class: "walvis-dispatch-panel-title" }, ["Truck setup"])
    );
    if (detail.status === "open") {
      var closeLoadBox = ui.el("div", { class: "walvis-dispatch-close-load" });
      var openHint =
        "Released for Grootfontein loading. Close the truck when it leaves — bags on the manifest stay as the trace record.";
      closeLoadBox.appendChild(
        ui.el("p", { class: "walvis-dispatch-status-line" }, [openHint])
      );
      if (detail.awaiting_first_load_scan || !(detail.loaded_bags || detail.plan_loaded)) {
        var abortBtn = ui.el("button", {
          type: "button",
          class: "btn-ghost walvis-dispatch-abort-open",
        }, ["Abort release (truck did not load)"]);
        abortBtn.addEventListener("click", async function () {
          if (
            !window.confirm(
              "Abort this released dispatch?\n\nOnly use when the truck never loaded — no bags on the manifest.\n\nCancel = keep open."
            )
          ) {
            return;
          }
          try {
            await apiPost(
              ctx,
              "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/cancel-plan",
              {}
            );
            await renderList(container, ctx);
            if (CIS.refreshOperationsSummary) CIS.refreshOperationsSummary();
          } catch (e) {
            window.alert(e.message || String(e));
          }
        });
        closeLoadBox.appendChild(abortBtn);
      }
      var closeLoadBtn = ui.el("button", {
        type: "button",
        class: "settings-action-btn walvis-dispatch-close-load-btn",
      }, ["Close truck load (finished loading)"]);
      closeLoadBtn.addEventListener("click", function () {
        managerCloseOpen(container, ctx, detail);
      });
      closeLoadBox.appendChild(closeLoadBtn);
      leftPanel.appendChild(closeLoadBox);
    }
    rightPanel.appendChild(
      ui.el("h3", { class: "walvis-dispatch-panel-title" }, ["Manifest"])
    );
    var statusText =
      detail.status === "planned"
        ? "Planned — release when the truck is ready at Grootfontein."
        : detail.status === "open"
          ? "Released — loading in progress at Grootfontein (scanners enforce the plan)."
          : "Truck load closed.";
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        statusText,
        detail.transporter ? " · Transporter: " + detail.transporter : "",
        " · ",
        dispatchDisplayLabel(detail),
        detail.released_at ? " · Released " + fmtDate(detail.released_at) : "",
        detail.closed_at ? " · Closed " + fmtDate(detail.closed_at) : "",
      ])
    );

    if (detail.plan_lines && detail.plan_lines.length) {
      var planBox = ui.el("div", { class: "walvis-dispatch-plan-panel" });
      planBox.appendChild(ui.el("h4", { style: "margin:0 0 0.5rem;" }, ["Load plan"]));
      var planTotal = detail.plan_total != null ? detail.plan_total : 0;
      planBox.appendChild(
        ui.el("p", { class: "muted", style: "margin:0 0 0.5rem;font-size:0.88rem;" }, [
          planTotal + " bag(s) planned · " + fmt(detail.plan_loaded || 0) + " loaded so far",
        ])
      );
      var planTable = ui.el("table", { class: "data-table walvis-dispatch-plan-table" });
      var pHead = ui.el("thead");
      pHead.appendChild(
        ui.el("tr", {}, [
          ui.el("th", { class: "walvis-plan-col-product" }, ["Product"]),
          ui.el("th", { class: "walvis-plan-col-num" }, ["Planned"]),
          ui.el("th", { class: "walvis-plan-col-num" }, ["Loaded"]),
          ui.el("th", { class: "walvis-plan-col-num" }, ["Left"]),
        ])
      );
      planTable.appendChild(pHead);
      var pBody = ui.el("tbody");
      detail.plan_lines.forEach(function (ln) {
        pBody.appendChild(
          ui.el("tr", {}, [
            ui.el("td", { class: "walvis-plan-col-product" }, [ln.product_key]),
            ui.el("td", { class: "walvis-plan-col-num" }, [String(ln.quantity)]),
            ui.el("td", { class: "walvis-plan-col-num" }, [String(ln.loaded != null ? ln.loaded : 0)]),
            ui.el("td", { class: "walvis-plan-col-num" }, [
              String(ln.remaining != null ? ln.remaining : ln.quantity),
            ]),
          ])
        );
      });
      planTable.appendChild(pBody);
      planBox.appendChild(planTable);
      if (detail.status === "planned") {
        var planActions = ui.el("div", { class: "walvis-plan-actions" });
        var releaseBtn = ui.el("button", {
          type: "button",
          class: "walvis-gold-btn walvis-gold-btn--release",
        }, ["Release for loading"]);
        releaseBtn.addEventListener("click", async function () {
          if (
            !window.confirm(
              "Release this dispatch for Grootfontein loading?\n\nScanners will only accept bags on this plan.\n\nCancel = keep as draft."
            )
          ) {
            return;
          }
          releaseBtn.disabled = true;
          try {
            var resp = await apiPost(
              ctx,
              "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/release",
              {}
            );
            var next = resp.dispatch || resp;
            next = await enrichDetailWithGroundReconcile(ctx, next);
            await renderDetail(container, ctx, next);
            if (CIS.refreshOperationsSummary) CIS.refreshOperationsSummary();
          } catch (e) {
            window.alert(e.message || String(e));
          } finally {
            releaseBtn.disabled = false;
          }
        });
        var editPlanBtn = ui.el("button", {
          type: "button",
          class: "walvis-gold-btn",
        }, ["Edit load plan"]);
        editPlanBtn.addEventListener("click", async function () {
          var savedDetail = detail;
          planBox.innerHTML = "";
          planBox.appendChild(ui.el("h4", { style: "margin:0 0 0.35rem;" }, ["Edit load plan"]));
          planBox.appendChild(
            ui.el("p", { class: "muted", style: "font-size:0.85rem;margin:0 0 0.65rem;" }, [
              "Adjust lines and loading day until you release for loading — then the plan is locked.",
            ])
          );
          var editorHost = ui.el("div", { class: "walvis-plan-edit-host" });
          planBox.appendChild(editorHost);
          await mountWalvisPlanForm(editorHost, ctx, ui, {
            dispatchId: detail.id,
            initial: detail,
            showIntro: false,
            moduleContainer: container,
            onCancel: function () {
              renderDetail(container, ctx, savedDetail);
            },
            onSaved: function (updated) {
              renderDetail(container, ctx, updated);
            },
          });
        });
        var cancelPlanBtn = ui.el("button", {
          type: "button",
          class: "btn-ghost",
        }, ["Cancel plan"]);
        cancelPlanBtn.addEventListener("click", async function () {
          if (!window.confirm("Discard this planned dispatch?")) return;
          try {
            await apiPost(
              ctx,
              "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/cancel-plan",
              {}
            );
            await renderList(container, ctx);
          } catch (e) {
            window.alert(e.message || String(e));
          }
        });
        planActions.appendChild(releaseBtn);
        planActions.appendChild(editPlanBtn);
        planActions.appendChild(cancelPlanBtn);
        planBox.appendChild(planActions);
      }
      leftPanel.appendChild(planBox);
    }

    var metaBox = ui.el("section", { class: "walvis-dispatch-meta-panel" });
    metaBox.appendChild(
      ui.el("h4", { class: "walvis-dispatch-meta-panel-title" }, ["Truck & dispatch details"])
    );
    var labelDay =
      detail.loading_date_effective ||
      detail.loading_date ||
      windhoekLabelDateYmd(detail.opened_at) ||
      "—";
    var plannedDay = detail.loading_date || "—";
    metaBox.appendChild(
      ui.el("dl", { class: "walvis-dispatch-meta-dl" }, [
        ui.el("div", { class: "walvis-dispatch-meta-row" }, [
          ui.el("dt", {}, ["Truck registration"]),
          ui.el("dd", {}, [detail.truck_registration || ui.el("span", { class: "muted" }, ["Not set"])]),
        ]),
        ui.el("div", { class: "walvis-dispatch-meta-row" }, [
          ui.el("dt", {}, ["Transporter"]),
          ui.el("dd", {}, [detail.transporter || ui.el("span", { class: "muted" }, ["Not set"])]),
        ]),
        ui.el("div", { class: "walvis-dispatch-meta-row" }, [
          ui.el("dt", {}, ["Dispatch label day"]),
          ui.el("dd", {}, [
            labelDay,
            detail.awaiting_first_load_scan && plannedDay !== labelDay
              ? ui.el("span", { class: "muted" }, [" (planned " + plannedDay + ")"])
              : "",
          ]),
        ]),
        ui.el("div", { class: "walvis-dispatch-meta-row walvis-dispatch-meta-row--notes" }, [
          ui.el("dt", {}, ["Notes"]),
          ui.el("dd", {}, [detail.notes || ui.el("span", { class: "muted" }, ["None"])]),
        ]),
      ])
    );
    metaBox.appendChild(
      ui.el("p", { class: "walvis-dispatch-meta-hint muted" }, [
        "You can update these after the truck load is closed — for paperwork and the dispatch name.",
      ])
    );

    var editMetaBtn = ui.el("button", {
      type: "button",
      class: "walvis-gold-btn",
    }, ["Edit truck, label date, transporter & notes"]);
    editMetaBtn.addEventListener("click", async function () {
      var form = await showFormModal(ui, {
        title: "Edit dispatch details",
        message:
          "Dispatch label day uses Windhoek date (e.g. 2026-10-09 → Dispatch Fri 09-10-26 #1). Cancel closes without saving.",
        fields: [
          {
            key: "label_date",
            label: "Dispatch label day (Windhoek YYYY-MM-DD)",
            value: windhoekLabelDateYmd(detail.opened_at),
            placeholder: "2026-10-09",
            required: true,
          },
          {
            key: "truck_registration",
            label: "Truck registration",
            value: detail.truck_registration || "",
          },
          { key: "transporter", label: "Transporter / contractor", value: detail.transporter || "" },
          { key: "notes", label: "Notes", value: detail.notes || "" },
        ],
        cancelLabel: "Cancel",
        primaryLabel: "Save",
      });
      if (!form) return;
      editMetaBtn.disabled = true;
      try {
        var updated = await apiPatch(ctx, "/walvis-dispatches/" + encodeURIComponent(detail.id), {
          label_date: form.label_date.trim(),
          truck_registration: form.truck_registration.trim(),
          transporter: form.transporter.trim(),
          notes: form.notes.trim(),
        });
        await renderDetail(container, ctx, updated);
      } catch (e) {
        window.alert(e.message || String(e));
      } finally {
        editMetaBtn.disabled = false;
      }
    });
    metaBox.appendChild(editMetaBtn);
    leftPanel.appendChild(metaBox);

    var gfLoaded =
      detail.gf_loaded_bags != null ? detail.gf_loaded_bags : detail.manifest_gf_scan_bags;
    if (gfLoaded == null) {
      gfLoaded = (detail.bags || []).filter(function (b) {
        return (b.load_source || "gf_scan") === "gf_scan";
      }).length;
    }
    rightPanel.appendChild(
      ui.el("p", { class: "muted walvis-manifest-counts", style: "margin:0 0 0.75rem 0;" }, [
        "Loaded ",
        CIS.bagsAndMassText(gfLoaded, detail.kg_loaded),
        " · Received ",
        CIS.bagsAndMassText(detail.received_bags, detail.kg_received),
      ])
    );

    var manifestBags = detail.bags || [];
    var tableWrap = ui.el("div", { class: "walvis-dispatch-list-col walvis-dispatch-table-wrap" });
    var table = ui.el("table", { class: "data-table walvis-dispatch-table" });
    var thead = ui.el("thead");
    thead.appendChild(
      ui.el("tr", {}, [
        ui.el("th", {}, ["Bag"]),
        ui.el("th", {}, ["Stream"]),
        ui.el("th", {}, ["kg"]),
        ui.el("th", {}, ["Loaded"]),
        ui.el("th", {}, ["Received"]),
        ui.el("th", {}, ["Bag status"]),
      ])
    );
    table.appendChild(thead);
    var tbody = ui.el("tbody");
    manifestBags.forEach(function (b) {
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
    tableWrap.appendChild(table);
    rightPanel.appendChild(tableWrap);

    workspace.appendChild(leftPanel);
    workspace.appendChild(rightPanel);
    container.appendChild(workspace);
  }

  async function openDetail(container, ctx, id) {
    container.innerHTML = "<p class=\"muted\">Loading dispatch…</p>";
    try {
      var detail = await apiGet(ctx, "/walvis-dispatches/" + encodeURIComponent(id));
      await renderDetail(container, ctx, detail);
    } catch (e) {
      container.innerHTML = "";
      container.appendChild(CIS.ui.error("Could not load dispatch: " + (e.message || e)));
    }
  }

  async function managerOpenDispatch(container, ctx, ui) {
    if (
      !window.confirm(
        "Open a new truck dispatch for Grootfontein loading?\n\nShorty’s scanner will attach bags to this manifest.\n\nCancel = do nothing."
      )
    ) {
      return;
    }
    var form = await truckDetailsModal(
      ui,
      "Open dispatch (Grootfontein)",
      "Cancel closes without creating a dispatch.",
      null
    );
    if (!form) return;
    if (
      !window.confirm(
        "Create open Dispatch now?\n\nTruck: " +
          (form.truck_registration.trim() || "(not set yet)") +
          "\n\nCancel = abort."
      )
    ) {
      return;
    }
    try {
      await apiPost(ctx, "/walvis-dispatches/open", {
        truck_registration: form.truck_registration.trim() || null,
        transporter: form.transporter.trim() || null,
        notes: form.notes.trim() || null,
      });
      await renderList(container, ctx);
    } catch (e) {
      window.alert(e.message || String(e));
    }
  }

  async function managerSwitchTruck(container, ctx, ui, openDispatch) {
    var warn =
      "Close this truck load?\n\nThis CLOSES " +
      (openDispatch
        ? dispatchDisplayLabel(openDispatch) + " (" + openDispatch.loaded_bags + " bags loaded)"
        : "the current open dispatch") +
      ".\n\nCreate and release the next dispatch plan (#2, #3, … same day) before Shorty loads the next trailer.\n\nCancel = do nothing.";
    if (!window.confirm(warn)) return;
    var form = await truckDetailsModal(
      ui,
      "Next truck",
      "Cancel closes without switching.",
      null
    );
    if (!form) return;
    if (!window.confirm("Confirm close this truck load?")) return;
    try {
      await apiPost(ctx, "/walvis-dispatches/switch-truck", {
        truck_registration: form.truck_registration.trim() || null,
        transporter: form.transporter.trim() || null,
        notes: form.notes.trim() || null,
      });
      await renderList(container, ctx);
    } catch (e) {
      window.alert(e.message || String(e));
    }
  }

  async function managerCloseOpen(container, ctx, openDispatch) {
    if (
      !window.confirm(
        "Close open " +
          dispatchDisplayLabel(openDispatch) +
          "?\n\nNo new dispatch will be opened. Shorty must not load more bags until a manager opens the next dispatch.\n\nCancel = do nothing."
      )
    ) {
      return;
    }
    try {
      await apiPost(ctx, "/walvis-dispatches/close-open", {});
      await renderList(container, ctx);
      if (CIS.refreshOperationsSummary) CIS.refreshOperationsSummary();
    } catch (e) {
      window.alert(e.message || String(e));
    }
  }

  function windhoekDayFromIso(iso) {
    if (!iso) return "";
    try {
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Windhoek",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(iso));
      var y = "";
      var m = "";
      var d = "";
      parts.forEach(function (p) {
        if (p.type === "year") y = p.value;
        if (p.type === "month") m = p.value;
        if (p.type === "day") d = p.value;
      });
      return y && m && d ? y + "-" + m + "-" + d : "";
    } catch (e) {
      return "";
    }
  }

  function windhoekTodayInputValue() {
    try {
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Windhoek",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      var y = "";
      var m = "";
      var d = "";
      parts.forEach(function (p) {
        if (p.type === "year") y = p.value;
        if (p.type === "month") m = p.value;
        if (p.type === "day") d = p.value;
      });
      return y && m && d ? y + "-" + m + "-" + d : "";
    } catch (e) {
      return "";
    }
  }

  function dispatchStatusChip(d) {
    if (!d) return "";
    if (d.status === "planned") {
      var ld = d.loading_date || "";
      var today = windhoekTodayInputValue();
      if (ld && today && ld > today) return "Scheduled";
      return "Planned";
    }
    if (d.status === "open") return "Loading";
    return "Closed";
  }

  function dispatchListSortKey(d) {
    if (!d) return "";
    if (d.loading_date) return String(d.loading_date).slice(0, 10);
    var iso = d.opened_at || d.closed_at || d.released_at || "";
    return iso ? String(iso).slice(0, 10) : "";
  }

  function sortDispatchesForPanel(rows) {
    var copy = (rows || []).slice();
    copy.sort(function (a, b) {
      var da = dispatchListSortKey(a);
      var db = dispatchListSortKey(b);
      if (da !== db) return db < da ? -1 : 1;
      var na = a.dispatch_number != null ? Number(a.dispatch_number) : 0;
      var nb = b.dispatch_number != null ? Number(b.dispatch_number) : 0;
      return nb - na;
    });
    return copy;
  }

  function fillDispatchListColumn(listHost, rows, container, ctx, ui) {
    listHost.innerHTML = "";
    var sorted = sortDispatchesForPanel(rows);
    if (!sorted.length) {
      listHost.appendChild(
        ui.el("p", { class: "muted" }, [
          "No dispatches yet — create one on the left (you can schedule future loading days).",
        ])
      );
      return;
    }
    sorted.forEach(function (d) {
      var chip = dispatchStatusChip(d);
      var card = ui.el("button", {
        type: "button",
        class: "walvis-dispatch-card",
        onclick: function () {
          openDetail(container, ctx, d.id);
        },
      });
      var head = ui.el("div", { class: "walvis-dispatch-card-head" });
      head.appendChild(ui.el("span", { class: "walvis-dispatch-card-title" }, [dispatchDisplayLabel(d)]));
      head.appendChild(
        ui.el("span", { class: "walvis-dispatch-card-chip walvis-dispatch-card-chip--" + d.status }, [
          chip,
        ])
      );
      card.appendChild(head);
      var meta =
        (d.truck_registration ? d.truck_registration + " · " : "") +
        (d.plan_total ? d.plan_total + " planned · " : "") +
        fmt(d.loaded_bags) +
        " loaded · " +
        fmt(d.received_bags) +
        " received";
      if (d.loading_date) {
        meta = "Load " + d.loading_date + " · " + meta;
      }
      card.appendChild(ui.el("span", { class: "walvis-dispatch-card-meta" }, [meta]));
      listHost.appendChild(card);
    });
  }

  async function mountWalvisPlanForm(host, ctx, ui, opts) {
    opts = opts || {};
    host.innerHTML = "";
    host.className = "walvis-dispatch-form";

    var isEdit = !!opts.dispatchId;
    var initial = opts.initial || null;

    if (opts.showIntro !== false && !isEdit) {
      host.appendChild(
        ui.el("p", { class: "muted walvis-dispatch-form-intro" }, [
          "Loading day → ",
          ui.el("strong", {}, ["Dispatch [day] [date] #[N]"]),
          ". Release when Shorty is ready to scan (or schedule ahead for Monday, etc.).",
        ])
      );
    }

    var options = { bulk: [], pallets: [] };
    try {
      options = await apiGet(ctx, "/walvis-dispatches/plan-product-options");
    } catch (e) {
      host.appendChild(ui.error("Could not load product list: " + (e.message || e)));
      return;
    }
    var allOpts = (options.bulk || []).concat(options.pallets || []);

    var initialDate =
      (initial && initial.loading_date) ||
      (initial && windhoekLabelDateYmd(initial.opened_at)) ||
      windhoekTodayInputValue();

    var loadDayRow = ui.el("div", { class: "walvis-plan-load-day-row" });
    var dateField = ui.el("div", { class: "ct-field walvis-plan-load-day-field" });
    var dateInp = ui.el("input", {
      type: "date",
      class: "wd-field-input wd-field-narrow",
      value: initialDate,
    });
    dateField.appendChild(ui.el("span", { class: "ct-field-label" }, ["Loading day (Windhoek)"]));
    dateField.appendChild(dateInp);
    loadDayRow.appendChild(dateField);

    var totalBox = ui.el("div", { class: "walvis-plan-bag-total-box" });
    totalBox.appendChild(ui.el("span", { class: "walvis-plan-bag-total-label" }, ["Bags planned"]));
    var totalCounter = ui.el("span", { class: "walvis-plan-bag-total-value" }, ["0"]);
    totalBox.appendChild(totalCounter);
    loadDayRow.appendChild(totalBox);
    host.appendChild(loadDayRow);

    var truckField = ui.el("div", { class: "ct-field" });
    var truckInp = ui.el("input", {
      type: "text",
      class: "wd-field-input",
      placeholder: "Optional — add later",
      value: (initial && initial.truck_registration) || "",
    });
    truckField.appendChild(ui.el("span", { class: "ct-field-label" }, ["Truck registration"]));
    truckField.appendChild(truckInp);
    host.appendChild(truckField);

    host.appendChild(ui.el("span", { class: "ct-field-label" }, ["Load plan (up to 8 lines)"]));
    var linesHeader = ui.el("div", { class: "walvis-plan-lines-header" });
    linesHeader.appendChild(ui.el("span", { class: "walvis-plan-lines-header-product" }, ["Product"]));
    linesHeader.appendChild(ui.el("span", { class: "walvis-plan-lines-header-qty" }, ["QTY"]));
    host.appendChild(linesHeader);

    var linesHost = ui.el("div", { class: "walvis-plan-lines" });
    var lineRows = [];
    var initialLines = (initial && initial.plan_lines) || [];

    function updatePlanBagTotal() {
      var total = 0;
      lineRows.forEach(function (r) {
        var q = parseInt(r.qty.value, 10);
        if (!isNaN(q) && q > 0) total += q;
      });
      totalCounter.textContent = String(total);
    }

    for (var i = 0; i < 8; i++) {
      (function (idx) {
        var pref = initialLines[idx] || null;
        var row = ui.el("div", { class: "walvis-plan-line-row" });
        var sel = ui.el("select", { class: "wd-field-select" });
        sel.appendChild(ui.el("option", { value: "" }, ["— line " + (idx + 1) + " —"]));
        allOpts.forEach(function (o) {
          sel.appendChild(ui.el("option", { value: o.key }, [o.label]));
        });
        if (pref && pref.product_key) sel.value = pref.product_key;
        var qty = ui.el("input", {
          type: "number",
          min: "1",
          max: "9999",
          placeholder: "0",
          class: "wd-field-input wd-field-qty",
          "aria-label": "Quantity line " + (idx + 1),
          value: pref && pref.quantity ? String(pref.quantity) : "",
        });
        qty.addEventListener("input", updatePlanBagTotal);
        qty.addEventListener("change", updatePlanBagTotal);
        row.appendChild(sel);
        row.appendChild(qty);
        linesHost.appendChild(row);
        lineRows.push({ sel: sel, qty: qty });
      })(i);
    }
    host.appendChild(linesHost);
    updatePlanBagTotal();

    var btnRow = ui.el("div", { class: "walvis-plan-form-actions" });
    var saveBtn = ui.el("button", {
      type: "button",
      class: "walvis-gold-btn walvis-gold-btn--release",
    }, [isEdit ? "Save plan changes" : "Save dispatch plan"]);
    saveBtn.addEventListener("click", async function () {
      var lines = [];
      lineRows.forEach(function (r) {
        var key = r.sel.value;
        var q = parseInt(r.qty.value, 10);
        if (key && q > 0) lines.push({ product_key: key, quantity: q });
      });
      if (!lines.length) {
        window.alert("Add at least one product line with quantity.");
        return;
      }
      saveBtn.disabled = true;
      try {
        var body = {
          loading_date: dateInp.value,
          truck_registration: truckInp.value.trim() || null,
          transporter: (initial && initial.transporter) || null,
          notes: (initial && initial.notes) || null,
          lines: lines,
        };
        var resp;
        if (isEdit) {
          resp = await apiPost(
            ctx,
            "/walvis-dispatches/" + encodeURIComponent(opts.dispatchId) + "/update-plan",
            body
          );
        } else {
          resp = await apiPost(ctx, "/walvis-dispatches/create-plan", body);
        }
        var dispatch = resp.dispatch || resp;
        if (opts.onSaved && dispatch) {
          opts.onSaved(dispatch);
          return;
        }
        var mod = opts.moduleContainer || host.closest(".module-content");
        if (dispatch && dispatch.id) {
          openDetail(mod, ctx, dispatch.id);
        } else if (mod) {
          await renderList(mod, ctx);
        }
      } catch (e) {
        window.alert(e.message || String(e));
      } finally {
        saveBtn.disabled = false;
      }
    });
    btnRow.appendChild(saveBtn);
    if (opts.onCancel) {
      var cancelEditBtn = ui.el("button", { type: "button", class: "btn-ghost" }, ["Cancel"]);
      cancelEditBtn.addEventListener("click", function () {
        opts.onCancel();
      });
      btnRow.appendChild(cancelEditBtn);
    }
    host.appendChild(btnRow);
  }

  async function renderCreateDispatchPlan(host, ctx, ui, openDispatch) {
    host.innerHTML = "";
    host.className = "walvis-dispatch-form";

    if (openDispatch) {
      host.appendChild(
        ui.el("p", { class: "error-box" }, [
          "Loading in progress: ",
          dispatchDisplayLabel(openDispatch),
          ". Close this truck load before creating another plan.",
        ])
      );
      return;
    }

    await mountWalvisPlanForm(host, ctx, ui, { showIntro: true });
  }

  async function renderList(container, ctx) {
    var ui = CIS.ui;
    clearWalvisFloatingBack(ctx);
    container.innerHTML = "";
    container.className = "module-content walvis-dispatch-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Walvis Bay Dispatch"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Truck loads for traceability — release for Grootfontein scanning, close when the truck leaves, read manifest only.",
      ])
    );

    var workspace = ui.el("div", { class: "walvis-dispatch-workspace" });

    var leftPanel = ui.el("section", { class: "walvis-dispatch-panel walvis-dispatch-panel--create" });
    leftPanel.appendChild(
      ui.el("h3", { class: "walvis-dispatch-panel-title" }, ["Create dispatch"])
    );
    var activeLine = ui.el("p", { class: "muted walvis-dispatch-status-line", id: "walvis-active-dispatch-line" }, [
      "Checking…",
    ]);
    leftPanel.appendChild(activeLine);
    var managerBtns = ui.el("div", { class: "walvis-dispatch-toolbar" });
    leftPanel.appendChild(managerBtns);
    var planFormHost = ui.el("div", { class: "walvis-dispatch-form-host" });
    leftPanel.appendChild(planFormHost);

    var rightPanel = ui.el("section", { class: "walvis-dispatch-panel walvis-dispatch-panel--list" });
    rightPanel.appendChild(
      ui.el("h3", { class: "walvis-dispatch-panel-title" }, ["Scheduled & dispatches"])
    );
    rightPanel.appendChild(
      ui.el("p", { class: "muted walvis-dispatch-list-hint" }, [
        "Planned and future loading days appear first. Open a row to release or edit.",
      ])
    );
    var listHost = ui.el("div", { class: "walvis-dispatch-list-col walvis-dispatch-list" });
    listHost.textContent = "Loading…";
    rightPanel.appendChild(listHost);

    workspace.appendChild(leftPanel);
    workspace.appendChild(rightPanel);
    container.appendChild(workspace);

    var openDispatch = null;
    var plannedCount = 0;
    try {
      var activeResp = await apiGet(ctx, "/walvis-dispatches/active");
      openDispatch = activeResp.dispatch || null;
      var plannedList = activeResp.planned_dispatches || (activeResp.planned ? [activeResp.planned] : []);
      plannedCount = plannedList.length;
    } catch (e) {
      openDispatch = null;
      plannedCount = 0;
    }
    activeLine.textContent = openDispatch
      ? "Released for loading: " + dispatchOpenLabel(openDispatch)
      : plannedCount
        ? plannedCount + " dispatch plan(s) waiting — release from the list when loading starts."
        : "No truck released — create a plan (left), then release from the list.";
    managerBtns.innerHTML = "";
    if (openDispatch) {
      managerBtns.appendChild(
        ui.el("button", {
          type: "button",
          class: "settings-action-btn",
          onclick: function () {
            managerSwitchTruck(container, ctx, ui, openDispatch);
          },
        }, ["Close truck load (then plan next #)"])
      );
      managerBtns.appendChild(
        ui.el("button", {
          type: "button",
          class: "btn-ghost",
          onclick: function () {
            managerCloseOpen(container, ctx, openDispatch);
          },
        }, ["Close loading dispatch"])
      );
      managerBtns.appendChild(
        ui.el("button", {
          type: "button",
          class: "btn-ghost",
          onclick: function () {
            openDetail(container, ctx, openDispatch.id);
          },
        }, ["View manifest"])
      );
    }

    await renderCreateDispatchPlan(planFormHost, ctx, ui, openDispatch);

    try {
      var data = await apiGet(ctx, "/walvis-dispatches?limit=50&include_closed=true");
      var rows = data.dispatches || [];
      fillDispatchListColumn(listHost, rows, container, ctx, ui);
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
    title: "Walvis Bay Dispatch",
    kind: "app",
    icon: "traceability",
    description: "Truck loads GF → Walvis — manifest vs received",
    requires: "traceability.walvis_dispatch",
    render: render,
  });
})();
