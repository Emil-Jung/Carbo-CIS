/* Walvis dispatches — truck manifest (GF load) vs received (Walvis storage).
   Display names: Dispatch [DAY] [DATE] #[N] — Windhoek day; N = 1st/2nd/… dispatch that day (API display_label). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var RESET_CONFIRM = "WALVIS_RESET";

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
    var hasGround =
      (detail.walvis_ground_total_count != null && detail.walvis_ground_total_count > 0) ||
      (detail.walvis_ground_all && detail.walvis_ground_all.length > 0);
    if (hasGround) return detail;
    try {
      var recon = await apiGet(
        ctx,
        "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/ground-reconcile"
      );
      detail.walvis_ground_all = recon.walvis_ground_all;
      detail.walvis_ground_total_count = recon.walvis_ground_total_count;
      detail.walvis_ground_on_manifest_count = recon.walvis_ground_on_manifest_count;
      detail.walvis_ground_not_on_manifest = recon.walvis_ground_not_on_manifest;
      detail.walvis_ground_not_on_manifest_count = recon.walvis_ground_not_on_manifest_count;
      return detail;
    } catch (e) {
      /* old API — fall back to Bags Status breakdown (already deployed). */
    }
    try {
      var breakdown = await apiGet(ctx, "/walvis-dispatches/storage-at-walvis-breakdown");
      applyBreakdownReconcile(detail, breakdown);
      if (detail.walvis_ground_total_count > 0) return detail;
    } catch (e2) {
      /* bags-status report works on older API builds too */
    }
    try {
      var report = await apiGet(
        ctx,
        "/reports/bags-status?status=" + encodeURIComponent("storage_walvisbay")
      );
      var manifestIds = {};
      (detail.bags || []).forEach(function (b) {
        manifestIds[b.bag_identifier] = true;
      });
      var all = [];
      (report.event_sections || []).forEach(function (sec) {
        (sec.rows || []).forEach(function (r) {
          var serial = rowSerial(r);
          if (!serial) return;
          all.push({
            bag_identifier: serial,
            product_stream: r.product_stream,
            net_weight_kg: r.net_weight_kg,
            on_this_manifest: !!manifestIds[serial],
          });
        });
      });
      all.sort(function (a, b) {
        return a.bag_identifier.localeCompare(b.bag_identifier);
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
          };
        });
      detail.walvis_ground_all = all;
      detail.walvis_ground_total_count = all.length;
      detail.walvis_ground_on_manifest_count = all.filter(function (b) {
        return b.on_this_manifest;
      }).length;
      detail.walvis_ground_not_on_manifest = gap;
      detail.walvis_ground_not_on_manifest_count = gap.length;
      detail._reconcile_from_bags_status = true;
    } catch (e3) {
      detail._reconcile_unavailable = true;
    }
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

  function renderDetail(container, ctx, detail) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content walvis-dispatch-host";

    var title =
      dispatchDisplayLabel(detail) +
      (detail.truck_registration ? " · " + detail.truck_registration : "");
    container.appendChild(ui.el("h2", { class: "module-title" }, [title]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        detail.status === "open" ? "Loading in progress at Grootfontein." : "Truck load closed.",
        detail.transporter ? " · Transporter: " + detail.transporter : "",
        " Opened ",
        fmtDate(detail.opened_at),
        detail.closed_at ? " · Closed " + fmtDate(detail.closed_at) : "",
      ])
    );
    if (detail.notes) {
      container.appendChild(ui.el("p", { class: "muted" }, ["Notes: ", detail.notes]));
    }

    var editMetaBtn = ui.el("button", {
      type: "button",
      class: "btn-ghost",
      style: "margin-bottom: 0.75rem;",
    }, ["Edit truck, label date, transporter, notes"]);
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
        renderDetail(container, ctx, updated);
      } catch (e) {
        window.alert(e.message || String(e));
      } finally {
        editMetaBtn.disabled = false;
      }
    });
    container.appendChild(editMetaBtn);

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {
          window.prompt("Copy these serials:", text);
        });
      } else {
        window.prompt("Copy these serials:", text);
      }
    }

    var groundAll = detail.walvis_ground_all || [];
    var groundGap = detail.walvis_ground_not_on_manifest || [];
    var groundTotal =
      detail.walvis_ground_total_count != null
        ? detail.walvis_ground_total_count
        : groundAll.length;
    var onManifest =
      detail.walvis_ground_on_manifest_count != null
        ? detail.walvis_ground_on_manifest_count
        : groundAll.filter(function (b) {
            return b.on_this_manifest;
          }).length;

    var recon = ui.el("div", {
      class: "walvis-dispatch-summary",
      style: "border:1px solid var(--border-subtle,#444);padding:0.75rem;margin:0.75rem 0;",
    });
    recon.appendChild(ui.el("h4", { style: "margin:0 0 0.5rem 0;" }, [
      "Walvis Bay ground stock vs this manifest",
    ]));
    recon.appendChild(
      ui.el("p", { class: "muted", style: "margin:0 0 0.5rem 0;" }, [
        "Every bag currently in storage at Walvis Bay (",
        String(groundTotal),
        "), compared to what is recorded on ",
        dispatchDisplayLabel(detail),
        " — not grouped by other dispatch tiles.",
      ])
    );
    recon.appendChild(
      ui.el("p", { style: "margin:0.25rem 0;" }, [
        ui.el("strong", {}, ["At Walvis now: "]),
        String(groundTotal),
        " · On this manifest and at Walvis: ",
        String(onManifest),
        " · ",
        ui.el("strong", {}, ["Missing from this manifest: "]),
        String(groundGap.length),
      ])
    );

    var reconActions = ui.el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;margin:0.5rem 0;" });
    var copyAllBtn = ui.el("button", { type: "button", class: "btn-ghost" }, [
      "Copy all Walvis serials",
    ]);
    copyAllBtn.addEventListener("click", function () {
      copyText(
        groundAll
          .map(function (b) {
            return b.bag_identifier;
          })
          .join("\n")
      );
    });
    reconActions.appendChild(copyAllBtn);
    if (groundGap.length) {
      var copyGapBtn = ui.el("button", { type: "button", class: "settings-action-btn" }, [
        "Copy missing serials (" + groundGap.length + ")",
      ]);
      copyGapBtn.addEventListener("click", function () {
        copyText(
          groundGap
            .map(function (b) {
              return b.bag_identifier;
            })
            .join("\n")
        );
      });
      reconActions.appendChild(copyGapBtn);
    }
    recon.appendChild(reconActions);

    if (groundAll.length) {
      var allPre = ui.el("details", { style: "margin:0.5rem 0;" });
      allPre.appendChild(
        ui.el("summary", {}, ["All bags at Walvis Bay (" + groundAll.length + ")"])
      );
      allPre.appendChild(
        ui.el(
          "pre",
          {
            style:
              "white-space:pre-wrap;font-size:12px;max-height:12rem;overflow:auto;margin:0.35rem 0;",
          },
          [
            groundAll
              .map(function (b) {
                var mark = b.on_this_manifest ? "✓ manifest" : "— not on manifest";
                return b.bag_identifier + "  " + mark;
              })
              .join("\n"),
          ]
        )
      );
      recon.appendChild(allPre);
    }

    if (detail._reconcile_unavailable) {
      recon.appendChild(
        ui.el("p", { class: "walvis-dispatch-missing" }, [
          "Could not load Walvis ground stock. Restart charcoal-traceability on bkweb3, then Ctrl+F5.",
        ])
      );
    } else if (
      groundTotal === 0 &&
      (detail.bags || []).some(function (b) {
        return b.storage_status === "storage_walvisbay";
      })
    ) {
      recon.appendChild(
        ui.el("p", { class: "muted" }, ["Loading reconcile counts… use “Add bag” below if this stays at 0 after refresh."])
      );
    }

    var addPrimaryBtn = ui.el("button", {
      type: "button",
      class: "settings-action-btn",
      style: "max-width: 100%; margin: 0.5rem 0;",
    }, ["Add bag to this dispatch…"]);
    addPrimaryBtn.addEventListener("click", function () {
      addPrimaryBtn.disabled = true;
      promptAndAddBagToDispatch(container, ctx, detail).finally(function () {
        addPrimaryBtn.disabled = false;
      });
    });
    recon.appendChild(addPrimaryBtn);
    recon.appendChild(
      ui.el("p", { class: "muted", style: "margin:0 0 0.5rem 0;font-size:12px;" }, [
        "Use for each missing serial: confirm ",
        ui.el("strong", {}, ["mark received at Walvis"]),
        " when the bag is already on the ground (typical for the 7 missed GF scans).",
      ])
    );

    if (groundGap.length) {
      recon.appendChild(
        ui.el("p", { class: "walvis-dispatch-missing", style: "margin:0.5rem 0 0.25rem 0;" }, [
          ui.el("strong", {}, [
            String(groundGap.length) + " missing from this manifest — add each (Add next to serial):",
          ]),
        ])
      );
      var gapList = ui.el("ul", {
        style: "list-style:none;padding:0;margin:0.25rem 0;max-height:14rem;overflow:auto;",
      });
      groundGap.forEach(function (b) {
        var row = ui.el("li", {
          style: "display:flex;flex-wrap:wrap;align-items:center;gap:0.35rem;margin:0.35rem 0;",
        });
        row.appendChild(ui.el("code", {}, [b.bag_identifier]));
        if (b.other_dispatch_label) {
          row.appendChild(
            ui.el("span", { class: "muted", style: "font-size:12px;" }, [
              "(" + b.other_dispatch_label + ")",
            ])
          );
        }
        var addOne = ui.el("button", { type: "button", class: "btn-ghost", style: "padding:0.2rem 0.5rem;" }, [
          "Add",
        ]);
        addOne.addEventListener("click", function () {
          addOne.disabled = true;
          promptAndAddBagToDispatch(container, ctx, detail, b.bag_identifier).finally(function () {
            addOne.disabled = false;
          });
        });
        row.appendChild(addOne);
        gapList.appendChild(row);
      });
      recon.appendChild(gapList);
    } else if (groundTotal > 0 && onManifest === groundTotal) {
      recon.appendChild(
        ui.el("p", { class: "muted" }, [
          "Ground stock matches this manifest — every Walvis bag is on this dispatch.",
        ])
      );
    }
    container.appendChild(recon);

    var summary = ui.el("div", { class: "walvis-dispatch-summary" });
    summary.appendChild(
      ui.el("p", {}, [
        ui.el("strong", {}, ["Manifest: "]),
        CIS.bagsAndMassText(detail.loaded_bags, detail.kg_loaded) +
          " loaded · Received at Walvis: " +
          CIS.bagsAndMassText(detail.received_bags, detail.kg_received),
      ])
    );
    if (detail.manifest_audit_line) {
      summary.appendChild(
        ui.el("p", { class: "muted" }, [
          ui.el("strong", {}, ["Audit trail: "]),
          detail.manifest_audit_line,
          " — ",
          ui.el("strong", {}, ["GF scan"]),
          " = Shorty load scan; ",
          ui.el("strong", {}, ["CIS addendum"]),
          " = retro manifest fix (offload / paper reconcile), kept on the same dispatch.",
        ])
      );
    }
    if (detail.missing_count) {
      summary.appendChild(
        ui.el("p", { class: "walvis-dispatch-missing" }, [
          ui.el("strong", {}, [
            String(detail.missing_count) +
              " on manifest but not yet received at Walvis (Received column empty)",
          ]),
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

    var deleteRow = ui.el("div", { style: "margin: 1.5rem 0 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle,#333);" });
    deleteRow.appendChild(
      ui.el("p", { class: "muted" }, [
        "Remove a mistaken dispatch record (#2, #3, …) after bags are on the correct manifest. ",
        "Deletes only the dispatch header and its manifest rows — bags stay in Walvis storage.",
      ])
    );
    var deleteBtn = ui.el("button", {
      type: "button",
      class: "btn-ghost",
      style: "max-width: 26rem; color: var(--danger, #c44);",
    }, ["Delete this dispatch record…"]);
    deleteBtn.addEventListener("click", async function () {
      var num = detail.dispatch_number;
      var token = "DELETE_DISPATCH_" + num;
      var typed = window.prompt(
        "Permanently delete " +
          dispatchDisplayLabel(detail) +
          "?\n\nType exactly:\n" +
          token +
          "\n\nCancel = stop."
      );
      if (typed === null || String(typed).trim() !== token) {
        if (typed !== null && String(typed).trim()) {
          window.alert("Confirmation did not match " + token + ". Nothing deleted.");
        }
        return;
      }
      deleteBtn.disabled = true;
      try {
        var result = await apiPost(
          ctx,
          "/walvis-dispatches/" + encodeURIComponent(detail.id) + "/delete",
          { confirm: token }
        );
        window.alert(
          "Deleted " +
            (result.display_label || "dispatch #" + result.dispatch_number) +
            ". Manifest rows removed: " +
            (result.manifest_rows_removed || 0) +
            "."
        );
        renderList(container, ctx);
      } catch (e) {
        window.alert(e.message || String(e));
      } finally {
        deleteBtn.disabled = false;
      }
    });
    deleteRow.appendChild(deleteBtn);
    container.appendChild(deleteRow);

    var table = ui.el("table", { class: "data-table walvis-dispatch-table" });
    var thead = ui.el("thead");
    thead.appendChild(
      ui.el("tr", {}, [
        ui.el("th", {}, ["Bag"]),
        ui.el("th", {}, ["Stream"]),
        ui.el("th", {}, ["kg"]),
        ui.el("th", {}, ["Loaded"]),
        ui.el("th", {}, ["Received Walvis"]),
        ui.el("th", {}, ["On manifest"]),
        ui.el("th", {}, ["Status now"]),
      ])
    );
    table.appendChild(thead);
    var tbody = ui.el("tbody");
    (detail.bags || []).forEach(function (b) {
      var src = b.load_source || (b.manifest_addendum ? "cis_addendum" : "gf_scan");
      var srcLabel =
        src === "cis_addendum"
          ? "CIS addendum"
          : src === "fence_bulk"
            ? "Fenced bulk"
            : "GF scan";
      tbody.appendChild(
        ui.el("tr", {}, [
          ui.el("td", {}, [b.bag_identifier]),
          ui.el("td", {}, [b.product_stream || "—"]),
          ui.el("td", {}, [CIS.formatMassFromKg(b.net_weight_kg, { forceKg: true })]),
          ui.el("td", {}, [fmtDate(b.loaded_at)]),
          ui.el("td", {}, [b.received_at ? fmtDate(b.received_at) : "—"]),
          ui.el("td", {}, [srcLabel]),
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
      detail = await enrichDetailWithGroundReconcile(ctx, detail);
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
    var ui = CIS.ui;
    if (
      !window.confirm(
        "Open the Walvis reset wizard?\n\nThis is for fixing history (e.g. Dispatch #1). Cancel = stop here."
      )
    ) {
      return;
    }
    var preview;
    try {
      preview = await buildResetPreview(ctx);
    } catch (e) {
      window.alert("Could not load dispatch summary: " + (e.message || e));
      return;
    }
    var detailLines = [
      "This DELETES all Walvis dispatch records and restarts numbering at Dispatch #1.",
      "",
      "Current dispatch rows: " + preview.dispatch_rows,
      preview.walvis_storage_bags != null
        ? "Bags in Walvis storage now: " + preview.walvis_storage_bags
        : "Bags in Walvis storage: count from live DB at create time",
      "",
    ];
    (preview.dispatches || []).forEach(function (d) {
      detailLines.push(
        "  · #" + d.dispatch_number + " (" + d.status + ") — " + d.bag_count + " bag(s)"
      );
    });
    detailLines.push("");
    detailLines.push("A new CLOSED Dispatch #1 will include every Walvis storage bag.");

    var step1 = await showFormModal(ui, {
      title: "Reset — type to continue",
      message: "Type " + RESET_CONFIRM + " exactly, or Cancel to abort.",
      detail: detailLines.join("\n"),
      fields: [
        {
          key: "confirm",
          label: "Confirmation",
          placeholder: RESET_CONFIRM,
          required: true,
        },
      ],
      cancelLabel: "Cancel",
      primaryLabel: "Next",
      validate: function (out) {
        if (String(out.confirm || "").trim() !== RESET_CONFIRM) {
          return "Type " + RESET_CONFIRM + " exactly, or click Cancel.";
        }
        return null;
      },
    });
    if (!step1) return;

    var step2 = await showFormModal(ui, {
      title: "Dispatch #1 details",
      message: "Optional now — you can edit later on the dispatch screen. Cancel = abort (nothing created).",
      fields: [
        { key: "truck_registration", label: "Truck registration", placeholder: "Optional" },
        { key: "transporter", label: "Transporter / contractor", placeholder: "Optional" },
        {
          key: "notes",
          label: "Notes",
          value: "Dispatch #1 — first Walvis offload",
          placeholder: "Optional",
        },
        {
          key: "extra_bags",
          label: "Extra bag serial(s)",
          placeholder: "Comma-separated, optional",
        },
      ],
      cancelLabel: "Cancel",
      primaryLabel: "Review",
    });
    if (!step2) return;

    var extraList = (step2.extra_bags || "")
      .split(/[,;\s]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);

    var summary =
      "Create closed Dispatch #1 with all Walvis storage bags" +
      (extraList.length ? " plus " + extraList.length + " extra serial(s)" : "") +
      ".\n\nThis deletes " +
      preview.dispatch_rows +
      " existing dispatch row(s).\n\nProceed?";
    if (!window.confirm(summary)) return;

    try {
      var created = await apiPost(ctx, "/walvis-dispatches/admin/reset-and-fence-first", {
        confirm: RESET_CONFIRM,
        truck_registration: step2.truck_registration.trim() || null,
        transporter: step2.transporter.trim() || null,
        notes: step2.notes.trim() || null,
        extra_bag_identifiers: extraList,
      });
      renderDetail(container, ctx, created);
    } catch (e) {
      window.alert(e.message || String(e));
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
      "Switch truck?\n\nThis CLOSES " +
      (openDispatch
        ? dispatchDisplayLabel(openDispatch) + " (" + openDispatch.loaded_bags + " bags loaded)"
        : "the current open dispatch") +
      " and opens a NEW dispatch for the next trailer.\n\nCancel = do nothing.";
    if (!window.confirm(warn)) return;
    var form = await truckDetailsModal(
      ui,
      "Next truck",
      "Cancel closes without switching.",
      null
    );
    if (!form) return;
    if (!window.confirm("Confirm switch truck and open the new dispatch?")) return;
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
        "Managers open or switch dispatches here before Shorty loads at Grootfontein. ",
        "Use ",
        ui.el("strong", {}, ["Reset & fence Dispatch #1"]),
        " once only to fix history.",
      ])
    );

    var managerHost = ui.el("div", {
      class: "walvis-dispatch-manager",
      style: "margin-bottom: 1.25rem; padding: 1rem; border: 1px solid var(--border, #ccc); border-radius: 8px;",
    });
    managerHost.appendChild(
      ui.el("h3", { class: "module-title", style: "font-size: 1.05rem; margin: 0 0 0.5rem;" }, [
        "Grootfontein loading (manager)",
      ])
    );
    var activeLine = ui.el("p", { class: "muted", id: "walvis-active-dispatch-line" }, ["Checking open dispatch…"]);
    managerHost.appendChild(activeLine);
    var managerHint = ui.el("p", {
      class: "muted",
      id: "walvis-manager-hint",
      style: "font-size:0.88rem;margin:0.35rem 0 0;line-height:1.35;",
    }, [""]);
    managerHost.appendChild(managerHint);
    var managerBtns = ui.el("div", { style: "display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.75rem;" });
    managerHost.appendChild(managerBtns);
    container.appendChild(managerHost);

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
          "Create a new closed dispatch for Walvis storage bags not on any manifest?\n\nCancel = stop.\nThis does NOT delete existing dispatches."
        )
      ) {
        return;
      }
      var form = await truckDetailsModal(
        ui,
        "Fence unassigned bags",
        "Cancel closes without creating a dispatch.",
        null
      );
      if (!form) return;
      if (!window.confirm("Create this closed dispatch now?")) return;
      fenceBtn.disabled = true;
      try {
        var detail = await apiPost(ctx, "/walvis-dispatches/fence-unassigned-storage", {
          truck_registration: form.truck_registration.trim() || null,
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

    var openDispatch = null;
    try {
      var activeResp = await apiGet(ctx, "/walvis-dispatches/active");
      openDispatch = activeResp.dispatch || null;
    } catch (e) {
      openDispatch = null;
    }
    activeLine.textContent = openDispatch
      ? "Open for loading: " + dispatchOpenLabel(openDispatch)
      : "No open dispatch — open one before Shorty scans bags onto the truck.";
    managerHint.textContent = openDispatch
      ? "Only one open manifest at a time. Use Switch truck when the trailer is full — that closes this dispatch and opens the next number."
      : "Use Open dispatch for Shorty when the next trailer is ready at Grootfontein. This is separate from bags already on the road (Bag Status → in transit to Walvis). Closed Dispatch #1 with Walvis stock does not block opening #2.";
    managerBtns.innerHTML = "";
    if (openDispatch) {
      managerBtns.appendChild(
        ui.el("button", {
          type: "button",
          class: "settings-action-btn",
          onclick: function () {
            managerSwitchTruck(container, ctx, ui, openDispatch);
          },
        }, ["Switch truck (close + new dispatch)"])
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
        }, ["View open dispatch"])
      );
    } else {
      managerBtns.appendChild(
        ui.el("button", {
          type: "button",
          class: "settings-action-btn",
          onclick: function () {
            managerOpenDispatch(container, ctx, ui);
          },
        }, ["Open dispatch for Shorty"])
      );
    }

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
          dispatchDisplayLabel(d) +
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
