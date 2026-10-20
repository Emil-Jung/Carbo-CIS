/* Core CIS V1 — floating read-only active operations (sieving, packaging, Walvis, containers). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var POLL_MS = 30000;

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

  function startedLine(iso) {
    if (!iso) return "";
    return '<p class="cis-float-ops-card__meta">Started ' + esc(fmtShort(iso)) + "</p>";
  }

  function renderItem(kind, mainLine, metaHtml) {
    return (
      '<div class="cis-float-ops-item">' +
      '<div class="cis-float-ops-item__kind">' +
      esc(kind) +
      "</div>" +
      '<p class="cis-float-ops-item__main">' +
      esc(mainLine) +
      "</p>" +
      (metaHtml || "") +
      "</div>"
    );
  }

  function collectItems(data) {
    var items = [];
    if (!data) return items;

    var sieving = data.sieving_truck;
    if (sieving) {
      var sievMain =
        sieving.farm_name || sieving.label || sieving.title || "Active truck";
      items.push({
        sort: 1,
        html: renderItem("Sieving", sievMain, startedLine(sieving.started_at)),
      });
    }

    var shifts = data.packaging_shifts && data.packaging_shifts.length
      ? data.packaging_shifts
      : data.packaging_shift
        ? [data.packaging_shift]
        : [];
    shifts.forEach(function (sh) {
      var skus =
        sh.product_codes && sh.product_codes.length ? sh.product_codes.join(", ") : "—";
      var meta = startedLine(sh.started_at);
      if (sh.notes) {
        meta += '<p class="cis-float-ops-card__meta">' + esc(sh.notes) + "</p>";
      }
      items.push({
        sort: 2,
        html: renderItem("Packaging", skus, meta),
      });
    });

    var wd = data.walvis_dispatch;
    if (wd) {
      var wMain = wd.display_label || wd.title || "Walvis dispatch";
      if (wd.product_summary) wMain += " · " + wd.product_summary;
      if (wd.truck_registration) wMain += " · " + wd.truck_registration;
      var wMeta = startedLine(wd.started_at);
      if (wd.plan_total != null && wd.plan_total > 0) {
        var onPlan = wd.plan_loaded != null ? wd.plan_loaded : wd.loaded_bags;
        wMeta +=
          '<p class="cis-float-ops-card__meta">' +
          esc(String(onPlan != null ? onPlan : 0)) +
          " / " +
          esc(String(wd.plan_total)) +
          " bags on manifest</p>";
      } else if (wd.loaded_bags != null) {
        wMeta +=
          '<p class="cis-float-ops-card__meta">' +
          esc(String(wd.loaded_bags)) +
          " bag(s) on manifest</p>";
      }
      items.push({
        sort: 3,
        html: renderItem("Walvis dispatch", wMain, wMeta),
      });
    }

    (data.container_loading || []).forEach(function (c) {
      var cMain =
        (c.container_number || "Container") +
        (c.location_display ? " · " + c.location_display : "");
      if (c.product_label) cMain += " · " + c.product_label;
      var cMeta = startedLine(c.started_at);
      if (c.loaded_bags != null && c.target_bag_count != null) {
        cMeta +=
          '<p class="cis-float-ops-card__meta">' +
          esc(String(c.loaded_bags)) +
          " / " +
          esc(String(c.target_bag_count)) +
          " bags loaded</p>";
      }
      items.push({
        sort: 4,
        html: renderItem("Container loading", cMain, cMeta),
      });
    });

    items.sort(function (a, b) {
      return a.sort - b.sort;
    });
    return items;
  }

  function renderFloatContent() {
    if (!state.floatEl) return;

    if (state.error) {
      state.floatEl.innerHTML =
        '<div class="cis-float-ops-card cis-float-ops-card--error">' +
        '<div class="cis-float-ops-card__title" title="Drag to move · double-click title to reset">Active operations</div>' +
        '<p class="cis-float-ops-card__body">' +
        esc(state.error) +
        "</p></div>";
      return;
    }

    if (!state.last) {
      state.floatEl.innerHTML =
        '<div class="cis-float-ops-card cis-float-ops-card--idle">' +
        '<div class="cis-float-ops-card__title" title="Drag to move · double-click title to reset">Active operations</div>' +
        '<p class="cis-float-ops-card__body cis-float-ops-card__muted">Loading…</p></div>';
      return;
    }

    var items = collectItems(state.last);
    if (!items.length) {
      state.floatEl.innerHTML =
        '<div class="cis-float-ops-card cis-float-ops-card--idle">' +
        '<div class="cis-float-ops-card__title" title="Drag to move · double-click title to reset">Active operations</div>' +
        '<p class="cis-float-ops-card__body cis-float-ops-card__muted">No active sieving, packaging, Walvis load, or container loading.</p></div>';
      return;
    }

    state.floatEl.innerHTML =
      '<div class="cis-float-ops-card cis-float-ops-card--active">' +
      '<div class="cis-float-ops-card__title" title="Drag to move · double-click title to reset">Active operations</div>' +
      items.map(function (it) {
        return it.html;
      }).join("") +
      "</div>";
  }

  function mountOpsPanel() {
    var panel = document.getElementById("cis-float-ops");
    if (!panel) return;
    panel.classList.remove("hidden");
    panel.setAttribute("aria-hidden", "false");
    if (!state.floatEl || state.floatEl.parentNode !== panel) {
      panel.innerHTML = "";
      var wrap = document.createElement("div");
      wrap.className = "cis-float-ops-host";
      wrap.setAttribute("aria-live", "polite");
      panel.appendChild(wrap);
      state.floatEl = wrap;
    }
    renderFloatContent();
  }

  /** @deprecated ops panel uses #cis-float-ops (bottom-right), not float nav */
  function mountFloatNav(nav) {
    mountOpsPanel();
  }

  async function refresh(ctx) {
    if (!ctx || !ctx.api) return;
    try {
      state.error = null;
      state.last = await ctx.api.traceability("/reports/operations-summary");
    } catch (e) {
      state.error = CIS.traceabilityApiErrorMessage
        ? CIS.traceabilityApiErrorMessage(e)
        : (e && e.message) || "Could not load operations";
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
    var opsPanel = document.getElementById("cis-float-ops");
    if (opsPanel) {
      opsPanel.classList.add("hidden");
      opsPanel.setAttribute("aria-hidden", "true");
      opsPanel.innerHTML = "";
    }
    var legacy = document.getElementById("cis-ops-summary");
    if (legacy) {
      legacy.classList.add("hidden");
      legacy.innerHTML = "";
    }
    if (CIS.renderFloatNav) CIS.renderFloatNav();
  }

  function sync(ctx) {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    state.ctx = ctx;
    mountOpsPanel();
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
    mountOpsPanel: mountOpsPanel,
    mountFloatNav: mountFloatNav,
  };

  CIS.refreshOperationsSummary = function () {
    if (state.ctx) refresh(state.ctx);
  };
})();
