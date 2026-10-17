/* Core CIS V1 — floating “today’s shift” (packing only). Session only; no permission key. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var POLL_MS = 60000;
  var STORAGE_OPEN = "cis_ops_summary_open";

  var state = {
    timer: null,
    open: false,
    last: null,
    error: null,
    ctx: null,
    onVisHandler: null,
    floatToggleEl: null,
  };

  function panelEl() {
    return document.getElementById("cis-ops-summary");
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

  function activeShift(data) {
    if (!data || !data.packaging_shift) return null;
    return data.packaging_shift;
  }

  function floatButtonLabel() {
    if (state.open) return "Hide shift";
    var sh = activeShift(state.last);
    if (sh && sh.product_codes && sh.product_codes.length) {
      return "Shift: " + sh.product_codes.join(", ");
    }
    if (sh) return "Active shift";
    return "Today\u2019s shift";
  }

  function setOpen(open) {
    state.open = !!open;
    try {
      sessionStorage.setItem(STORAGE_OPEN, state.open ? "1" : "0");
    } catch (e) {}
    renderPanel();
    updateFloatToggle();
  }

  function toggle() {
    setOpen(!state.open);
  }

  function updateFloatToggle() {
    if (!state.floatToggleEl) return;
    state.floatToggleEl.textContent = floatButtonLabel();
    state.floatToggleEl.setAttribute("aria-expanded", state.open ? "true" : "false");
    state.floatToggleEl.classList.toggle("cis-float-ops-btn--idle", !activeShift(state.last) && !state.error);
  }

  function renderPanel() {
    var panel = panelEl();
    if (!panel) return;

    if (!state.open) {
      panel.innerHTML = "";
      panel.classList.add("hidden");
      return;
    }

    var inner = "";
    if (state.error) {
      inner += '<p class="cis-ops-summary__muted">' + esc(state.error) + "</p>";
    } else if (!state.last) {
      inner += '<p class="cis-ops-summary__muted">Loading…</p>';
    } else {
      var sh = activeShift(state.last);
      if (!sh) {
        inner += '<p class="cis-ops-summary__muted">No active packing shift today.</p>';
      } else {
        var skus =
          sh.product_codes && sh.product_codes.length ? sh.product_codes.join(", ") : "—";
        inner += "<p><strong>" + esc(skus) + "</strong></p>";
        if (sh.status) {
          inner += "<p>Status: " + esc(sh.status) + "</p>";
        }
        if (sh.started_at) {
          inner +=
            '<p class="cis-ops-summary__muted">Started ' + esc(fmtShort(sh.started_at)) + "</p>";
        }
        if (sh.notes) {
          inner += "<p>" + esc(sh.notes) + "</p>";
        }
      }
      if (state.last.updated_at) {
        inner +=
          '<p class="cis-ops-summary__foot">Updated ' + esc(fmtShort(state.last.updated_at)) + "</p>";
      }
    }

    panel.innerHTML =
      '<div id="cis-ops-summary-panel" class="cis-ops-summary__panel" role="region" aria-label="Active packing shift">' +
      inner +
      "</div>";
    panel.classList.remove("hidden");
  }

  function mountFloatNav(nav) {
    if (!nav) return;
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "cis-float-back-btn cis-float-ops-btn";
    toggle.setAttribute("aria-controls", "cis-ops-summary-panel");
    toggle.setAttribute("aria-expanded", state.open ? "true" : "false");
    toggle.title = "Today\u2019s active packing shift";
    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    nav.appendChild(toggle);
    state.floatToggleEl = toggle;
    updateFloatToggle();
    renderPanel();
  }

  async function refresh(ctx) {
    if (!ctx || !ctx.api) return;
    try {
      state.error = null;
      state.last = await ctx.api.traceability("/reports/operations-summary");
    } catch (e) {
      state.error = CIS.traceabilityApiErrorMessage
        ? CIS.traceabilityApiErrorMessage(e)
        : (e && e.message) || "Could not load shift summary";
    }
    updateFloatToggle();
    renderPanel();
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
    state.open = false;
    state.floatToggleEl = null;
    var panel = panelEl();
    if (panel) {
      panel.classList.add("hidden");
      panel.innerHTML = "";
    }
    if (CIS.renderFloatNav) CIS.renderFloatNav();
  }

  function sync(ctx) {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    state.ctx = ctx;

    try {
      state.open = sessionStorage.getItem(STORAGE_OPEN) === "1";
    } catch (e) {
      state.open = false;
    }

    if (CIS.renderFloatNav) CIS.renderFloatNav();
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

  CIS.operationsSummary = {
    sync: sync,
    stop: stop,
    refresh: refresh,
    toggle: toggle,
    mountFloatNav: mountFloatNav,
  };
})();
