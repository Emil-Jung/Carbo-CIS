/* Core CIS V1 — floating read-only today’s packing shift (not clickable). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var POLL_MS = 60000;

  var state = {
    timer: null,
    last: null,
    error: null,
    ctx: null,
    onVisHandler: null,
    floatEl: null,
  };

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

  function renderFloatContent() {
    if (!state.floatEl) return;

    if (state.error) {
      state.floatEl.innerHTML =
        '<div class="cis-float-ops-card cis-float-ops-card--error">' +
        '<div class="cis-float-ops-card__title">Today\u2019s shift</div>' +
        '<p class="cis-float-ops-card__body">' +
        esc(state.error) +
        "</p></div>";
      return;
    }

    if (!state.last) {
      state.floatEl.innerHTML =
        '<div class="cis-float-ops-card cis-float-ops-card--idle">' +
        '<div class="cis-float-ops-card__title">Today\u2019s shift</div>' +
        '<p class="cis-float-ops-card__body cis-float-ops-card__muted">Loading…</p></div>';
      return;
    }

    var sh = activeShift(state.last);
    if (!sh) {
      state.floatEl.innerHTML =
        '<div class="cis-float-ops-card cis-float-ops-card--idle">' +
        '<div class="cis-float-ops-card__title">Today\u2019s shift</div>' +
        '<p class="cis-float-ops-card__body cis-float-ops-card__muted">No active packing shift.</p></div>';
      return;
    }

    var skus = sh.product_codes && sh.product_codes.length ? sh.product_codes.join(", ") : "—";
    var lines = ['<p class="cis-float-ops-card__skus">' + esc(skus) + "</p>"];
    if (sh.started_at) {
      lines.push(
        '<p class="cis-float-ops-card__meta">Started ' + esc(fmtShort(sh.started_at)) + "</p>"
      );
    }
    if (sh.notes) {
      lines.push('<p class="cis-float-ops-card__meta">' + esc(sh.notes) + "</p>");
    }

    state.floatEl.innerHTML =
      '<div class="cis-float-ops-card cis-float-ops-card--active">' +
      '<div class="cis-float-ops-card__title">Active packing shift</div>' +
      lines.join("") +
      "</div>";
  }

  function mountFloatNav(nav) {
    if (!nav) return;
    var wrap = document.createElement("div");
    wrap.className = "cis-float-ops-host";
    wrap.setAttribute("aria-live", "polite");
    wrap.setAttribute("aria-label", "Today\u2019s active packing shift");
    nav.appendChild(wrap);
    state.floatEl = wrap;
    renderFloatContent();
  }

  async function refresh(ctx) {
    if (!ctx || !ctx.api) return;
    try {
      state.error = null;
      state.last = await ctx.api.traceability("/reports/operations-summary");
    } catch (e) {
      state.error = CIS.traceabilityApiErrorMessage
        ? CIS.traceabilityApiErrorMessage(e)
        : (e && e.message) || "Could not load shift";
    }
    renderFloatContent();
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
    state.floatEl = null;
    var panel = document.getElementById("cis-ops-summary");
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

  CIS.operationsSummary = { sync: sync, stop: stop, refresh: refresh, mountFloatNav: mountFloatNav };
})();
