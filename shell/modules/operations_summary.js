/* Core CIS V1 — floating read-only active operations (sieving, packaging, Walvis). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var POLL_MS = 30000;

  var OPS_DRAG_LS = "cis_float_ops_position_v1";
  var drag = {
    panel: null,
    active: false,
    startX: 0,
    startY: 0,
    startL: 0,
    startT: 0,
    wired: false,
  };

  var state = {
    timer: null,
    last: null,
    error: null,
    ctx: null,
    onVisHandler: null,
    floatEl: null,
  };

  function opsDragHandleHtml() {
    return (
      '<button type="button" class="cis-float-ops-drag-handle" aria-label="Drag to move this panel">' +
      "Drag to move</button>"
    );
  }

  function opsCardOpen(extraClass) {
    return (
      '<div class="cis-float-ops-card ' +
      (extraClass || "") +
      '">' +
      opsDragHandleHtml()
    );
  }

  function opsDragLoadPos() {
    try {
      return JSON.parse(localStorage.getItem(OPS_DRAG_LS));
    } catch (e) {
      return null;
    }
  }

  function opsDragSavePos(left, top) {
    try {
      localStorage.setItem(OPS_DRAG_LS, JSON.stringify({ l: left, t: top }));
    } catch (e) {}
  }

  function opsDragClearPos() {
    try {
      localStorage.removeItem(OPS_DRAG_LS);
    } catch (e) {}
  }

  function opsDragReset(panel) {
    panel.classList.remove("cis-float-ops-panel--moved");
    panel.style.left = "";
    panel.style.top = "";
    panel.style.right = "";
    panel.style.bottom = "";
    opsDragClearPos();
  }

  function opsDragApplySaved(panel) {
    var p = opsDragLoadPos();
    if (!p || p.l == null || p.t == null) return;
    panel.classList.add("cis-float-ops-panel--moved");
    panel.style.left = p.l + "px";
    panel.style.top = p.t + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function opsDragEnsureCoords(panel) {
    var rect = panel.getBoundingClientRect();
    if (!panel.classList.contains("cis-float-ops-panel--moved")) {
      panel.classList.add("cis-float-ops-panel--moved");
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }
    return {
      l: parseFloat(panel.style.left) || rect.left,
      t: parseFloat(panel.style.top) || rect.top,
    };
  }

  function opsDragClamp(panel, left, top) {
    var w = panel.offsetWidth || 200;
    var h = panel.offsetHeight || 80;
    var maxL = Math.max(8, window.innerWidth - w - 8);
    var maxT = Math.max(8, window.innerHeight - h - 8);
    return {
      l: Math.max(8, Math.min(left, maxL)),
      t: Math.max(8, Math.min(top, maxT)),
    };
  }

  function opsDragMoveListener(e) {
    if (!drag.active || !drag.panel) return;
    var next = opsDragClamp(
      drag.panel,
      drag.startL + (e.clientX - drag.startX),
      drag.startT + (e.clientY - drag.startY)
    );
    drag.panel.style.left = next.l + "px";
    drag.panel.style.top = next.t + "px";
  }

  function opsDragEndListener(e) {
    if (!drag.active || !drag.panel) return;
    drag.active = false;
    drag.panel.classList.remove("cis-float-ops-panel--dragging");
    if (drag.panel.classList.contains("cis-float-ops-panel--moved")) {
      opsDragSavePos(parseFloat(drag.panel.style.left) || 0, parseFloat(drag.panel.style.top) || 0);
    }
    document.removeEventListener("pointermove", opsDragMoveListener, true);
    document.removeEventListener("pointerup", opsDragEndListener, true);
    document.removeEventListener("mousemove", opsDragMoveListener, true);
    document.removeEventListener("mouseup", opsDragEndListener, true);
  }

  function opsDragStart(panel, clientX, clientY) {
    var coords = opsDragEnsureCoords(panel);
    drag.panel = panel;
    drag.active = true;
    drag.startX = clientX;
    drag.startY = clientY;
    drag.startL = coords.l;
    drag.startT = coords.t;
    panel.classList.add("cis-float-ops-panel--dragging");
    document.addEventListener("pointermove", opsDragMoveListener, true);
    document.addEventListener("pointerup", opsDragEndListener, true);
    document.addEventListener("mousemove", opsDragMoveListener, true);
    document.addEventListener("mouseup", opsDragEndListener, true);
  }

  function opsDragFromEvent(panel, e) {
    var t = e.target;
    if (!t || !t.closest) return false;
    return !!t.closest(".cis-float-ops-drag-handle, .cis-float-ops-card__title");
  }

  function ensureOpsPanelDrag(panel) {
    if (!panel || drag.wired) return;
    drag.wired = true;
    opsDragApplySaved(panel);

    panel.addEventListener(
      "pointerdown",
      function (e) {
        if (!opsDragFromEvent(panel, e)) return;
        if (e.button != null && e.button !== 0) return;
        opsDragStart(panel, e.clientX, e.clientY);
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    panel.addEventListener(
      "mousedown",
      function (e) {
        if (e.button !== 0) return;
        if (!opsDragFromEvent(panel, e)) return;
        opsDragStart(panel, e.clientX, e.clientY);
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    panel.addEventListener(
      "dblclick",
      function (e) {
        if (!opsDragFromEvent(panel, e)) return;
        opsDragReset(panel);
      },
      true
    );
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

    items.sort(function (a, b) {
      return a.sort - b.sort;
    });
    return items;
  }

  function renderFloatContent() {
    if (!state.floatEl) return;

    if (state.error) {
      state.floatEl.innerHTML =
        opsCardOpen("cis-float-ops-card--error") +
        '<div class="cis-float-ops-card__title">Active operations</div>' +
        '<p class="cis-float-ops-card__body">' +
        esc(state.error) +
        "</p></div>";
      return;
    }

    if (!state.last) {
      state.floatEl.innerHTML =
        opsCardOpen("cis-float-ops-card--idle") +
        '<div class="cis-float-ops-card__title">Active operations</div>' +
        '<p class="cis-float-ops-card__body cis-float-ops-card__muted">Loading…</p></div>';
      return;
    }

    var items = collectItems(state.last);
    if (!items.length) {
      state.floatEl.innerHTML =
        opsCardOpen("cis-float-ops-card--idle") +
        '<div class="cis-float-ops-card__title">Active operations</div>' +
        '<p class="cis-float-ops-card__body cis-float-ops-card__muted">No active sieving, packaging, or Walvis load.</p></div>';
      return;
    }

    state.floatEl.innerHTML =
      opsCardOpen("cis-float-ops-card--active") +
      '<div class="cis-float-ops-card__title">Active operations</div>' +
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
    ensureOpsPanelDrag(panel);
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
    ensureOpsPanelDrag: function () {
      var panel = document.getElementById("cis-float-ops");
      if (panel) ensureOpsPanelDrag(panel);
    },
  };

  CIS.refreshOperationsSummary = function () {
    if (state.ctx) refresh(state.ctx);
  };
})();
