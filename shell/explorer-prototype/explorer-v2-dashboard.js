/* CIS V2 — home reports dashboard + department tile boards. */
(function () {
  "use strict";

  var DISPLAY_TZ = "Africa/Windhoek";

  function modById(id) {
    var mods = window.CIS && CIS.modules ? CIS.modules : [];
    for (var i = 0; i < mods.length; i++) {
      if (mods[i].id === id) return mods[i];
    }
    return null;
  }

  function moduleAccessible(id) {
    var mod = modById(id);
    if (!mod || mod.inactive) return false;
    if (!window.CIS || !CIS.canAccessModule) return true;
    return CIS.canAccessModule(mod);
  }

  function greetingName() {
    var u = window.CIS && CIS._state && CIS._state.user;
    if (!u) return "there";
    var n = (u.display_name || u.login_id || "").trim();
    if (!n) return "there";
    return n.split(/\s+/)[0];
  }

  function timeGreeting() {
    try {
      var h = parseInt(
        new Date().toLocaleString("en-GB", { timeZone: DISPLAY_TZ, hour: "2-digit", hour12: false }),
        10
      );
      if (h < 12) return "Good morning";
      if (h < 17) return "Good afternoon";
      return "Good evening";
    } catch (e) {
      return "Hello";
    }
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs.text;
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function openModule(id) {
    if (window.CIS && CIS.openModule) CIS.openModule(id);
  }

  function reportRowButton(moduleId) {
    var mod = modById(moduleId);
    if (!mod || !moduleAccessible(moduleId)) return null;
    var btn = el("button", { type: "button", className: "v2-report-row" });
    btn.appendChild(el("span", { className: "v2-report-row__title" }, [mod.title || moduleId]));
    if (mod.description) {
      btn.appendChild(el("span", { className: "v2-report-row__desc muted" }, [mod.description]));
    }
    btn.addEventListener("click", function () {
      openModule(moduleId);
    });
    return btn;
  }

  function reportRowList(moduleIds) {
    var list = el("ul", { className: "v2-report-rows" });
    var any = false;
    moduleIds.forEach(function (id) {
      var row = reportRowButton(id);
      if (row) {
        var li = el("li");
        li.appendChild(row);
        list.appendChild(li);
        any = true;
      }
    });
    return any ? list : el("p", { className: "muted" }, ["Nothing assigned to you in this area."]);
  }

  function renderIntakeHero(host, movement, statusData) {
    var slot = el("div", { className: "v2-charcoal-intake-slot" });
    host.appendChild(slot);
    if (!movement) {
      slot.appendChild(el("p", { className: "muted" }, ["Charcoal Intake report not available."]));
      return;
    }
    if (
      !window.CIS ||
      !CIS.charcoalIntakePreview ||
      !CIS.charcoalIntakePreview.paintDashboardEmbed ||
      !CIS.ui
    ) {
      slot.appendChild(el("p", { className: "muted" }, ["Charcoal Intake module not loaded."]));
      return;
    }
    var opts = { statusData: statusData || null };
    if (moduleAccessible("bags_movement_report")) {
      opts.onOpenCharcoal = function () {
        openModule("bags_movement_report");
      };
      opts.onDrillDown = opts.onOpenCharcoal;
    }
    if (moduleAccessible("bags_status_report")) {
      opts.onOpenBagsStatus = function () {
        openModule("bags_status_report");
      };
    }
    CIS.charcoalIntakePreview.paintDashboardEmbed(slot, movement, opts);
  }

  function renderReportsGrid(host) {
    var section = el("section", { className: "panel" });
    section.appendChild(el("h2", { className: "panel-title" }, ["Reports & lookups"]));
    section.appendChild(
      el("p", { className: "muted v2-panel-lead" }, [
        "Read-only reports and lookups. Departments and apps are in the left menu.",
      ])
    );
    var ids = window.CIS_V2_REPORT_MODULE_IDS || [];
    var seen = {};
    var ordered = [];
    ids.forEach(function (id) {
      if (!seen[id] && moduleAccessible(id)) {
        seen[id] = true;
        ordered.push(id);
      }
    });
    (window.CIS.modules || []).forEach(function (m) {
      if (m.kind === "lookup" && !seen[m.id] && moduleAccessible(m.id)) {
        seen[m.id] = true;
        ordered.push(m.id);
      }
    });
    section.appendChild(reportRowList(ordered));
    host.appendChild(section);
  }

  async function fetchLandingData() {
    var movement = null;
    var statusData = null;
    var canMove = moduleAccessible("bags_movement_report");
    var canStatus = moduleAccessible("bags_status_report");
    if (canMove && window.CIS && CIS.api && CIS.api.traceability) {
      try {
        movement = await CIS.api.traceability("/reports/bags-movement?scope=all&compact=1");
      } catch (e) {
        movement = null;
      }
    }
    if (canStatus && window.CIS && CIS.api && CIS.api.traceability) {
      try {
        statusData = await CIS.api.traceability("/reports/bags-status");
      } catch (e) {
        statusData = null;
      }
    }
    return { movement: movement, statusData: statusData };
  }

  function renderLandingShell(host) {
    host.innerHTML = "";
    var head = el("header", { className: "v2-dash-head" });
    head.appendChild(
      el("h1", { className: "v2-dash-greeting" }, [timeGreeting() + ", " + greetingName() + "."])
    );
    head.appendChild(
      el("p", { className: "v2-dash-tagline" }, [
        "Reports and operational summaries — use the menu for Office, Logistics, Production, and Maintenance.",
      ])
    );
    host.appendChild(head);
    var loading = el("p", { className: "muted", id: "v2-dash-loading" }, ["Loading live totals…"]);
    host.appendChild(loading);
  }

  window.CIS_V2_renderHomeDashboard = function (host) {
    if (!host) return;
    renderLandingShell(host);
    var loadingEl = document.getElementById("v2-dash-loading");
    fetchLandingData().then(function (data) {
      if (loadingEl && loadingEl.parentNode) loadingEl.remove();
      if (data.movement || data.statusData) {
        renderIntakeHero(host, data.movement, data.statusData);
      } else if (loadingEl) {
        loadingEl.textContent = "Sign in with report permissions to see intake totals.";
      }
      renderReportsGrid(host);
    });
  };

  window.CIS_V2_renderDepartmentDashboard = function (host, deptId) {
    if (!host) return;
    host.innerHTML = "";
    var nav = window.CIS_V2_NAV;
    var group =
      deptId === "administration"
        ? nav && nav.dockAdministration
        : (nav.groups || []).filter(function (g) {
            return g.id === deptId;
          })[0];
    if (!group) {
      host.appendChild(el("p", { className: "error-box" }, ["Unknown department."]));
      return;
    }
    var head = el("header", { className: "v2-dash-head" });
    head.appendChild(el("h1", { className: "v2-dash-greeting" }, [group.title]));
    if (group.blurb) head.appendChild(el("p", { className: "v2-dash-tagline" }, [group.blurb]));
    host.appendChild(head);
    var ids = window.CIS_V2_departmentModuleIds ? CIS_V2_departmentModuleIds(deptId) : [];
    host.appendChild(reportRowList(ids));
  };
})();
