/* Global read-only “today’s operations” strip — visible on every CIS screen when signed in. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var PERMS_ANY = [
    "traceability.access",
    "traceability.control_room",
    "traceability.packaging_shift",
    "traceability.bags_status",
    "traceability.bags_movement",
    "traceability.movement_jobs",
    "traceability.stock.view",
  ];
  var POLL_MS = 60000;
  var STORAGE_OPEN = "cis_ops_summary_open";

  var state = {
    timer: null,
    open: false,
    last: null,
    error: null,
    ctx: null,
    onVisHandler: null,
  };

  function rootEl() {
    return document.getElementById("cis-ops-summary");
  }

  function canSeeSummary() {
    return PERMS_ANY.some(function (p) {
      return CIS.hasPermission(p);
    });
  }

  function activeCount(data) {
    if (!data) return 0;
    var n = 0;
    if (data.charcoal_intake) n += 1;
    if (data.packaging_shifts && data.packaging_shifts.length) n += 1;
    if (data.walvis_dispatch) n += 1;
    return n;
  }

  function fmtShort(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function setOpen(open) {
    state.open = !!open;
    try {
      sessionStorage.setItem(STORAGE_OPEN, state.open ? "1" : "0");
    } catch (e) {}
    render();
  }

  function render() {
    var root = rootEl();
    if (!root) return;

    var data = state.last;
    var count = activeCount(data);
    var open = state.open;

    root.classList.toggle("cis-ops-summary--open", open);
    root.classList.toggle("cis-ops-summary--idle", count === 0 && !state.error);

    var toggleLabel = open ? "Hide operations" : "Today\u2019s operations";
    if (!open && count > 0) toggleLabel += " (" + count + " active)";

    var html =
      '<button type="button" class="cis-ops-summary__toggle" aria-expanded="' +
      (open ? "true" : "false") +
      '" aria-controls="cis-ops-summary-panel">' +
      esc(toggleLabel) +
      "</button>";

    if (open) {
      html += '<div id="cis-ops-summary-panel" class="cis-ops-summary__panel" role="region" aria-label="Today\u2019s operations">';
      if (state.error) {
        html += '<p class="cis-ops-summary__muted">' + esc(state.error) + "</p>";
      } else if (!data) {
        html += '<p class="cis-ops-summary__muted">Loading…</p>";
      } else {
        html += sectionIntake(data.charcoal_intake);
        html += sectionPackaging(data.packaging_shifts);
        html += sectionWalvis(data.walvis_dispatch);
        if (count === 0) {
          html += '<p class="cis-ops-summary__muted">Nothing active right now.</p>';
        }
        if (data.updated_at) {
          html +=
            '<p class="cis-ops-summary__foot">Updated ' + esc(fmtShort(data.updated_at)) + "</p>";
        }
      }
      html += "</div>";
    }

    root.innerHTML = html;
    var btn = root.querySelector(".cis-ops-summary__toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        setOpen(!state.open);
      });
    }
  }

  function section(title, bodyHtml, active) {
    return (
      '<section class="cis-ops-summary__block' +
      (active ? " cis-ops-summary__block--active" : "") +
      '">' +
      "<h4>" +
      esc(title) +
      "</h4>" +
      bodyHtml +
      "</section>"
    );
  }

  function sectionIntake(intake) {
    if (!intake) {
      return section("Charcoal intake", '<p class="cis-ops-summary__muted">No active truck</p>', false);
    }
    var lines = ["<p><strong>" + esc(intake.display_label) + "</strong></p>"];
    if (intake.truck_registration) {
      lines.push("<p>Truck " + esc(intake.truck_registration) + "</p>");
    }
    if (intake.opened_at) {
      lines.push('<p class="cis-ops-summary__muted">Since ' + esc(fmtShort(intake.opened_at)) + "</p>");
    }
    return section("Charcoal intake", lines.join(""), true);
  }

  function sectionPackaging(shifts) {
    if (!shifts || !shifts.length) {
      return section("Packing", '<p class="cis-ops-summary__muted">No active shift</p>', false);
    }
    var parts = shifts.map(function (sh) {
      var skus =
        sh.product_codes && sh.product_codes.length
          ? sh.product_codes.join(", ")
          : "—";
      var line = "<p><strong>" + esc(skus) + "</strong></p>";
      if (sh.started_at) {
        line += '<p class="cis-ops-summary__muted">Started ' + esc(fmtShort(sh.started_at)) + "</p>";
      }
      return line;
    });
    return section("Packing", parts.join(""), true);
  }

  function sectionWalvis(dispatch) {
    if (!dispatch) {
      return section("Walvis dispatch", '<p class="cis-ops-summary__muted">No open dispatch</p>', false);
    }
    var lines = ["<p><strong>" + esc(dispatch.display_label) + "</strong></p>"];
    var truck = [dispatch.truck_registration, dispatch.transporter].filter(Boolean).join(" · ");
    if (truck) lines.push("<p>" + esc(truck) + "</p>");
    lines.push("<p>Loaded bags: " + esc(String(dispatch.loaded_bags != null ? dispatch.loaded_bags : 0)) + "</p>");
    if (dispatch.opened_at) {
      lines.push('<p class="cis-ops-summary__muted">Opened ' + esc(fmtShort(dispatch.opened_at)) + "</p>");
    }
    return section("Walvis dispatch", lines.join(""), true);
  }

  async function refresh(ctx) {
    if (!ctx || !ctx.api || !canSeeSummary()) return;
    try {
      state.error = null;
      state.last = await ctx.api.traceability("/reports/operations-summary");
    } catch (e) {
      state.error = CIS.traceabilityApiErrorMessage
        ? CIS.traceabilityApiErrorMessage(e)
        : (e && e.message) || "Could not load operations summary";
    }
    render();
  }

  function stop() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    if (state.onVisHandler) {
      document.removeEventListener("visibilitychange", state.onVisHandler);
      state.onVisHandler = null;
    }
    state.ctx = null;
    state.last = null;
    state.error = null;
    var root = rootEl();
    if (root) {
      root.classList.add("hidden");
      root.innerHTML = "";
    }
  }

  function sync(ctx) {
    stop();
    if (!canSeeSummary()) return;

    state.ctx = ctx;

    try {
      state.open = sessionStorage.getItem(STORAGE_OPEN) === "1";
    } catch (e) {
      state.open = false;
    }

    var root = rootEl();
    if (root) root.classList.remove("hidden");
    render();

    refresh(ctx);
    state.timer = setInterval(function () {
      if (state.ctx) refresh(state.ctx);
    }, POLL_MS);

    state.onVisHandler = function () {
      if (document.visibilityState === "visible" && state.timer && state.ctx) {
        refresh(state.ctx);
      }
    };
    document.addEventListener("visibilitychange", state.onVisHandler);
  }

  CIS.operationsSummary = { sync: sync, stop: stop, refresh: refresh };
})();
