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

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  function fmtMass(kg) {
    if (window.CIS && CIS.formatMassFromKg) {
      return CIS.formatMassFromKg(kg, { forceKg: true });
    }
    var v = Number(kg);
    if (!isFinite(v)) return "—";
    return v.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " kg";
  }

  function bagsMass(bags, kg) {
    if (window.CIS && CIS.bagsAndMassText) return CIS.bagsAndMassText(bags, kg);
    return fmt(bags) + " bags · " + fmtMass(kg);
  }

  function fmtDayHeading(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso + "T12:00:00");
      return d.toLocaleDateString("en-GB", {
        timeZone: DISPLAY_TZ,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return iso;
    }
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

  function statusBucket(group, key) {
    var list = (group && group.statuses) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i];
    }
    return { bags: 0, kg: 0 };
  }

  function buildDailySections(rows) {
    var byDay = {};
    (rows || []).forEach(function (row) {
      var day = row.recorded_date || "";
      if (!day) return;
      if (!byDay[day]) byDay[day] = { date: day, bags: 0, kg: 0 };
      byDay[day].bags += 1;
      byDay[day].kg += Number(row.net_weight_kg || 0);
    });
    return Object.keys(byDay)
      .sort(function (a, b) {
        return b.localeCompare(a);
      })
      .map(function (k) {
        var s = byDay[k];
        s.kg = Math.round(s.kg * 10) / 10;
        return s;
      });
  }

  /** Same shape as Charcoal Intake module (nested bags/kg per stream). */
  function streamCountKg(streams, key) {
    var s = streams || {};
    var node = s[key];
    if (node && typeof node === "object") {
      return { bags: node.bags, kg: node.kg };
    }
    return { bags: s[key], kg: s[key + "_kg"] };
  }

  function weekTotalsFromRows(rows) {
    var bags = 0;
    var kg = 0;
    var streams = { restaurant: 0, lumpwood: 0, fines: 0, restaurant_kg: 0, lumpwood_kg: 0, fines_kg: 0 };
    (rows || []).forEach(function (row) {
      bags += 1;
      var w = Number(row.net_weight_kg || 0);
      kg += w;
      var st = String(row.product_stream || "").toLowerCase();
      if (st === "restaurant") {
        streams.restaurant += 1;
        streams.restaurant_kg += w;
      } else if (st === "lumpwood") {
        streams.lumpwood += 1;
        streams.lumpwood_kg += w;
      } else if (st === "fines") {
        streams.fines += 1;
        streams.fines_kg += w;
      }
    });
    return {
      bags: bags,
      kg: Math.round(kg * 10) / 10,
      streams: streams,
    };
  }

  var PRODUCTION_REPORT_MODULE_IDS = {
    bags_movement_report: true,
    bags_status_report: true,
  };

  function renderBusinessSummary(host, movement, statusData) {
    var grid = el("div", { className: "content-grid v2-intake-grid" });

    var factoryPanel = el("section", { className: "panel" });
    factoryPanel.appendChild(el("h2", { className: "panel-title" }, ["Factory storage snapshot"]));

    var weekRows = (movement && movement.rows) || [];
    var week = weekTotalsFromRows(weekRows);
    if (movement && week.bags) {
      factoryPanel.appendChild(
        el("p", { className: "v2-stat-primary" }, [bagsMass(week.bags, week.kg) + " sieved this week"])
      );
      if (movement.current_week_start) {
        factoryPanel.appendChild(
          el("p", { className: "v2-stat-secondary" }, [
            "Week from " + fmtDayHeading(movement.current_week_start),
          ])
        );
      }
      var streamLine = el("ul", { className: "legend v2-stream-legend" });
      [
        { key: "restaurant", label: "Restaurant", color: "var(--status-orange)" },
        { key: "lumpwood", label: "Lumpwood", color: "var(--status-green)" },
        { key: "fines", label: "Fines", color: "var(--status-amber)" },
      ].forEach(function (s) {
        var part = streamCountKg(week.streams, s.key);
        if (!part.bags && !part.kg) return;
        var li = el("li");
        var sw = el("span", { className: "legend-swatch" });
        sw.style.background = s.color;
        li.appendChild(sw);
        li.appendChild(
          document.createTextNode(s.label + ": " + fmt(part.bags) + " · " + fmtMass(part.kg))
        );
        streamLine.appendChild(li);
      });
      if (streamLine.childNodes.length) factoryPanel.appendChild(streamLine);
    } else if (movement) {
      factoryPanel.appendChild(
        el("p", { className: "muted" }, ["No bags recorded this week yet — open Charcoal Intake for history."])
      );
    } else {
      factoryPanel.appendChild(el("p", { className: "muted" }, ["Charcoal Intake not available."]));
    }

    if (statusData) {
      var factory = (statusData.groups || []).filter(function (g) {
        return g.key === "factory";
      })[0];
      var wx = statusBucket(factory, "in_storage_weathering");
      var early = statusBucket(factory, "in_storage_released_early");
      var weathered = statusBucket(factory, "in_storage");
      factoryPanel.appendChild(el("hr", { className: "v2-panel-divider" }));
      factoryPanel.appendChild(el("h3", { className: "v2-subpanel-title" }, ["Weathering at factory"]));
      var wxList = el("ul", { className: "legend v2-wx-legend" });
      [
        { label: "Still weathering", bags: wx.bags, kg: wx.kg, color: "var(--status-amber)" },
        { label: "Released early", bags: early.bags, kg: early.kg, color: "var(--status-orange)" },
        { label: "Weathered (ready)", bags: weathered.bags, kg: weathered.kg, color: "var(--status-green)" },
      ].forEach(function (s) {
        var li = el("li");
        var sw = el("span", { className: "legend-swatch" });
        sw.style.background = s.color;
        li.appendChild(sw);
        li.appendChild(document.createTextNode(s.label + ": " + bagsMass(s.bags, s.kg)));
        wxList.appendChild(li);
      });
      factoryPanel.appendChild(wxList);
      if (statusData.in_system) {
        factoryPanel.appendChild(
          el("p", { className: "muted v2-footnote" }, [
            "Tracked in system: " + bagsMass(statusData.in_system.bags, statusData.in_system.kg),
          ])
        );
      }
    }

    grid.appendChild(factoryPanel);

    var daily = el("section", { className: "panel" });
    daily.appendChild(el("h2", { className: "panel-title" }, ["Intake by day — this week"]));
    if (movement && movement.rows && movement.rows.length) {
      var days = buildDailySections(movement.rows);
      if (movement.current_week_start) {
        daily.appendChild(
          el("p", { className: "muted" }, ["Week from " + fmtDayHeading(movement.current_week_start)])
        );
      }
      if (days.length) {
        var scroll = el("div", { className: "table-scroll" });
        var table = el("table", { className: "data-table" });
        table.innerHTML = "<thead><tr><th>Day</th><th>Bags</th><th>kg</th></tr></thead>";
        var tbody = el("tbody");
        days.slice(0, 7).forEach(function (d) {
          var tr = el("tr");
          tr.appendChild(el("td", {}, [fmtDayHeading(d.date)]));
          tr.appendChild(el("td", {}, [fmt(d.bags)]));
          tr.appendChild(el("td", {}, [fmtMass(d.kg)]));
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        scroll.appendChild(table);
        daily.appendChild(scroll);
      } else {
        daily.appendChild(el("p", { className: "muted" }, ["No bags recorded this week yet."]));
      }
    } else if (movement) {
      daily.appendChild(el("p", { className: "muted" }, ["No bags recorded this week yet."]));
    } else {
      daily.appendChild(el("p", { className: "muted" }, ["—"]));
    }
    grid.appendChild(daily);

    host.appendChild(grid);
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

  function renderReportOpenButtons(parent, opts) {
    opts = opts || {};
    if (!parent) return null;
    var canBm = moduleAccessible("bags_movement_report");
    var canBs = moduleAccessible("bags_status_report");
    if (!canBm && !canBs) return null;
    var bar = el("div", {
      className: opts.stacked
        ? "v2-landing-report-btns v2-landing-report-btns--stacked"
        : "v2-landing-report-btns",
    });
    if (canBm) {
      var b1 = el("button", { type: "button", className: "v2-action-btn v2-action-btn--primary" }, [
        "Charcoal Intake",
      ]);
      b1.addEventListener("click", function () {
        openModule("bags_movement_report");
      });
      bar.appendChild(b1);
    }
    if (canBs) {
      var b2 = el("button", { type: "button", className: "v2-action-btn" }, ["Bags Status"]);
      b2.addEventListener("click", function () {
        openModule("bags_status_report");
      });
      bar.appendChild(b2);
    }
    parent.appendChild(bar);
    return bar;
  }

  function renderProductionDepartment(host, group, moduleIds) {
    var grid = el("div", { className: "content-grid v2-dept-production-grid" });
    var appsPanel = el("section", { className: "panel" });
    appsPanel.appendChild(el("h2", { className: "panel-title" }, ["Production apps"]));
    appsPanel.appendChild(
      el("p", { className: "muted v2-panel-lead" }, ["Floor tools and configuration for this shift."])
    );
    var appIds = moduleIds.filter(function (id) {
      return !PRODUCTION_REPORT_MODULE_IDS[id];
    });
    appsPanel.appendChild(reportRowList(appIds));
    grid.appendChild(appsPanel);

    var reportsPanel = el("section", { className: "panel v2-dept-reports-panel" });
    reportsPanel.appendChild(el("h2", { className: "panel-title" }, ["Reports"]));
    reportsPanel.appendChild(
      el("p", { className: "muted v2-panel-lead" }, [
        "Full Charcoal Intake and Bags Status — same as production /cis/.",
      ])
    );
    renderReportOpenButtons(reportsPanel, { stacked: true });
    grid.appendChild(reportsPanel);
    host.appendChild(grid);
  }

  function renderLandingShell(host) {
    host.innerHTML = "";
    var head = el("header", { className: "v2-dash-head" });
    head.appendChild(
      el("h1", { className: "v2-dash-greeting" }, [timeGreeting() + ", " + greetingName() + "."])
    );
    head.appendChild(
      el("p", { className: "v2-dash-tagline" }, [
        "This week’s intake and factory weathering at a glance — open reports below for full detail.",
      ])
    );
    host.appendChild(head);
    renderReportOpenButtons(host);
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
        renderBusinessSummary(host, data.movement, data.statusData);
      } else if (loadingEl) {
        loadingEl.textContent = "Sign in with report permissions to see intake totals.";
      }
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
    if (deptId === "production") {
      renderProductionDepartment(host, group, ids);
    } else {
      host.appendChild(reportRowList(ids));
    }
  };
})();
