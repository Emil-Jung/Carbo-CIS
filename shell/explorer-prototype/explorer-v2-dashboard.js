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

  function tileButton(moduleId) {
    var mod = modById(moduleId);
    if (!mod || !moduleAccessible(moduleId)) return null;
    var btn = el("button", { type: "button", className: "v2-dash-tile" });
    var icon = window.CIS_V2_NAV_ICON_FOR ? CIS_V2_NAV_ICON_FOR(moduleId) : "";
    btn.innerHTML =
      (icon ? '<span class="v2-dash-tile__icon">' + icon + "</span>" : "") +
      '<span class="v2-dash-tile__title">' +
      (mod.title || moduleId) +
      "</span>" +
      (mod.description
        ? '<span class="v2-dash-tile__desc">' + mod.description + "</span>"
        : "");
    btn.addEventListener("click", function () {
      openModule(moduleId);
    });
    return btn;
  }

  function tileGrid(moduleIds) {
    var grid = el("div", { className: "v2-dash-tile-grid" });
    var any = false;
    moduleIds.forEach(function (id) {
      var t = tileButton(id);
      if (t) {
        grid.appendChild(t);
        any = true;
      }
    });
    return any ? grid : el("p", { className: "muted" }, ["Nothing assigned to you in this area."]);
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

  function renderIntakeHero(host, movement, statusData) {
    var section = el("section", { className: "v2-dash-panel v2-dash-panel--hero" });
    section.appendChild(
      el("h2", { className: "v2-dash-panel__title" }, ["Charcoal intake & factory storage"])
    );

    var grid = el("div", { className: "v2-dash-intake-grid" });

    var cum = el("article", { className: "v2-dash-intake-card" });
    cum.appendChild(el("h3", { className: "v2-dash-intake-card__title" }, ["Cumulative intake (database)"]));
    if (movement) {
      cum.appendChild(
        el("p", { className: "v2-dash-intake-card__lead" }, [
          bagsMass(movement.bag_count, movement.total_kg),
        ])
      );
      var streams = movement.streams || {};
      var streamLine = el("ul", { className: "v2-dash-stream-list" });
      [
        { key: "restaurant", label: "Restaurant", color: "#e57373" },
        { key: "lumpwood", label: "Lumpwood", color: "#81c784" },
        { key: "fines", label: "Fines", color: "#ffb74d" },
      ].forEach(function (s) {
        var li = el("li");
        li.innerHTML =
          '<span class="v2-dash-stream-dot" style="background:' +
          s.color +
          '"></span>' +
          s.label +
          ": " +
          fmt(streams[s.key]) +
          " · " +
          fmtMass(streams[s.key + "_kg"]);
        streamLine.appendChild(li);
      });
      cum.appendChild(streamLine);
    } else {
      cum.appendChild(el("p", { className: "muted" }, ["Charcoal Intake report not available."]));
    }

    if (statusData) {
      var factory = (statusData.groups || []).filter(function (g) {
        return g.key === "factory";
      })[0];
      var wx = statusBucket(factory, "in_storage_weathering");
      var early = statusBucket(factory, "in_storage_released_early");
      var weathered = statusBucket(factory, "in_storage");
      cum.appendChild(el("hr", { className: "v2-dash-divider" }));
      cum.appendChild(el("h4", { className: "v2-dash-subhead" }, ["Factory storage — weathering (Bags Status)"]));
      var wxList = el("ul", { className: "v2-dash-wx-list" });
      wxList.appendChild(
        el("li", {}, ["Still weathering: " + bagsMass(wx.bags, wx.kg)])
      );
      wxList.appendChild(
        el("li", {}, ["Released early: " + bagsMass(early.bags, early.kg)])
      );
      wxList.appendChild(
        el("li", {}, ["Weathered (ready): " + bagsMass(weathered.bags, weathered.kg)])
      );
      cum.appendChild(wxList);
      if (statusData.in_system) {
        cum.appendChild(
          el("p", { className: "muted v2-dash-footnote" }, [
            "In system now: " + bagsMass(statusData.in_system.bags, statusData.in_system.kg),
          ])
        );
      }
    }

    var actions = el("div", { className: "v2-dash-intake-actions" });
    if (moduleAccessible("bags_movement_report")) {
      var b1 = el("button", { type: "button", className: "v2-btn v2-btn--primary" }, ["Open Charcoal Intake"]);
      b1.addEventListener("click", function () {
        openModule("bags_movement_report");
      });
      actions.appendChild(b1);
    }
    if (moduleAccessible("bags_status_report")) {
      var b2 = el("button", { type: "button", className: "v2-btn v2-btn--secondary" }, ["Open Bags Status"]);
      b2.addEventListener("click", function () {
        openModule("bags_status_report");
      });
      actions.appendChild(b2);
    }
    cum.appendChild(actions);
    grid.appendChild(cum);

    var daily = el("article", { className: "v2-dash-intake-card" });
    daily.appendChild(el("h3", { className: "v2-dash-intake-card__title" }, ["Daily intake — current week"]));
    if (movement && movement.rows && movement.rows.length) {
      var days = buildDailySections(movement.rows);
      if (movement.current_week_start) {
        daily.appendChild(
          el("p", { className: "muted" }, [
            "Week from " + fmtDayHeading(movement.current_week_start),
          ])
        );
      }
      var table = el("table", { className: "v2-dash-day-table" });
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
      daily.appendChild(table);
      if (!days.length) {
        daily.appendChild(el("p", { className: "muted" }, ["No bags recorded this week yet."]));
      }
    } else if (movement) {
      daily.appendChild(el("p", { className: "muted" }, ["No bags recorded this week yet."]));
    } else {
      daily.appendChild(el("p", { className: "muted" }, ["—"]));
    }
    grid.appendChild(daily);

    section.appendChild(grid);
    host.appendChild(section);
  }

  function renderReportsGrid(host) {
    var section = el("section", { className: "v2-dash-panel" });
    section.appendChild(el("h2", { className: "v2-dash-panel__title" }, ["Reports & lookups"]));
    section.appendChild(
      el("p", { className: "muted v2-dash-panel__lead" }, [
        "Everything you can open read-only or for analysis. Apps and departments live in the left menu.",
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
    section.appendChild(tileGrid(ordered));
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
    host.appendChild(tileGrid(ids));
  };
})();
