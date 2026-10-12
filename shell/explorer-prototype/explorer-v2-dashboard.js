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
      return CIS.formatMassFromKg(kg);
    }
    var v = Number(kg);
    if (!isFinite(v)) return "—";
    if (Math.abs(v) >= 1000) {
      return (v / 1000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " t";
    }
    return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
  }

  function bagsMass(bags, kg) {
    if (window.CIS && CIS.bagsAndMassText) return CIS.bagsAndMassText(bags, kg);
    return fmt(bags) + " bags · " + fmtMass(kg);
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

  function groupByKey(statusData, key) {
    var groups = (statusData && statusData.groups) || [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].key === key) return groups[i];
    }
    return null;
  }

  function palletSummaryBucket(palletSummary, key) {
    var buckets = (palletSummary && palletSummary.buckets) || [];
    for (var i = 0; i < buckets.length; i++) {
      if (buckets[i].key === key) return buckets[i];
    }
    return { bags: 0, kg: 0 };
  }

  function streamBagsInGroup(group, streamKey) {
    var n = 0;
    (group && group.statuses ? group.statuses : []).forEach(function (st) {
      n += (st.streams && st.streams[streamKey]) || 0;
    });
    return n;
  }

  function streamKgInGroup(group, streamKey) {
    var kg = 0;
    (group && group.statuses ? group.statuses : []).forEach(function (st) {
      var sb = (st.streams && st.streams[streamKey]) || 0;
      if (!sb || !st.bags) return;
      kg += (st.kg || 0) * (sb / st.bags);
    });
    return Math.round(kg * 1000) / 1000;
  }

  function appendLegendLine(list, label, bags, kg, color) {
    if (!bags && !kg) return;
    var li = el("li");
    var sw = el("span", { className: "legend-swatch" });
    sw.style.background = color;
    li.appendChild(sw);
    li.appendChild(document.createTextNode(label + ": " + bagsMass(bags, kg)));
    list.appendChild(li);
  }

  function renderLocationPanel(title, lead, lines) {
    var panel = el("section", { className: "panel" });
    panel.appendChild(el("h3", { className: "v2-location-title" }, [title]));
    if (lead) panel.appendChild(el("p", { className: "v2-stat-primary" }, [lead]));
    var list = el("ul", { className: "legend v2-storage-legend" });
    (lines || []).forEach(function (line) {
      appendLegendLine(list, line.label, line.bags, line.kg, line.color);
    });
    if (list.childNodes.length) panel.appendChild(list);
    else panel.appendChild(el("p", { className: "muted" }, ["Nothing in this location right now."]));
    return panel;
  }

  function renderStorageSnapshot(host, statusData) {
    var wrap = el("section", { className: "panel v2-storage-snapshot" });
    wrap.appendChild(el("h2", { className: "panel-title" }, ["Carbo Namibia storage snapshot"]));
    wrap.appendChild(
      el("p", { className: "muted v2-panel-lead" }, [
        "Stock in the system at Carbo factory and Walvis Bay — charcoal jumbos, briquettes, and pallets.",
      ])
    );

    var factory = groupByKey(statusData, "factory");
    var walvis = groupByKey(statusData, "walvis_storage");
    var palletSummary = statusData.pallet_summary || {};

    var grid = el("div", { className: "content-grid v2-intake-grid" });

    var carboLead = factory ? bagsMass(factory.bags, factory.kg) : null;
    var carboLines = [];
    if (factory) {
      var wx = statusBucket(factory, "in_storage_weathering");
      var early = statusBucket(factory, "in_storage_released_early");
      var weathered = statusBucket(factory, "in_storage");
      carboLines.push(
        { label: "Still weathering", bags: wx.bags, kg: wx.kg, color: "var(--status-amber)" },
        { label: "Released early", bags: early.bags, kg: early.kg, color: "var(--status-orange)" },
        { label: "Weathered (ready)", bags: weathered.bags, kg: weathered.kg, color: "var(--status-green)" }
      );
      var briquetteBags = streamBagsInGroup(factory, "briquettes");
      var briquetteKg = streamKgInGroup(factory, "briquettes");
      var atPlant = statusBucket(factory, "at_briquette_plant");
      if (atPlant.bags && !briquetteBags) {
        briquetteBags = atPlant.bags;
        briquetteKg = atPlant.kg;
      }
      carboLines.push({
        label: "Briquettes",
        bags: briquetteBags,
        kg: briquetteKg,
        color: "#8d6e63",
      });
      var palStore = palletSummaryBucket(palletSummary, "in_storage");
      carboLines.push({
        label: "Pallets in storage",
        bags: palStore.bags,
        kg: palStore.kg,
        color: "#c2185b",
      });
      var palPack = palletSummaryBucket(palletSummary, "at_packaging");
      if (palPack.bags) {
        carboLines.push({
          label: "Pallets at packaging",
          bags: palPack.bags,
          kg: palPack.kg,
          color: "#ad1457",
        });
      }
    }
    grid.appendChild(renderLocationPanel("At Carbo (factory)", carboLead, carboLines));

    var walvisLead = walvis ? bagsMass(walvis.bags, walvis.kg) : null;
    var walvisLines = [];
    if (walvis) {
      var bulk = statusBucket(walvis, "storage_walvisbay");
      var bulkBags = bulk.bags;
      var bulkKg = bulk.kg;
      var palWalvis = palletSummaryBucket(palletSummary, "storage_walvisbay");
      bulkBags = Math.max(0, bulkBags - (palWalvis.bags || 0));
      bulkKg = Math.max(0, bulkKg - (palWalvis.kg || 0));
      walvisLines.push({
        label: "Bulk bags in storage",
        bags: bulkBags,
        kg: bulkKg,
        color: "var(--status-blue)",
      });
      walvisLines.push({
        label: "Pallets in storage",
        bags: palWalvis.bags,
        kg: palWalvis.kg,
        color: "#c2185b",
      });
      var briquetteW = streamBagsInGroup(walvis, "briquettes");
      if (briquetteW) {
        walvisLines.push({
          label: "Briquettes",
          bags: briquetteW,
          kg: streamKgInGroup(walvis, "briquettes"),
          color: "#8d6e63",
        });
      }
    }
    grid.appendChild(renderLocationPanel("Walvis Bay storage", walvisLead, walvisLines));

    wrap.appendChild(grid);
    if (statusData.in_system) {
      wrap.appendChild(
        el("p", { className: "muted v2-footnote" }, [
          "All locations tracked in system: " +
            bagsMass(statusData.in_system.bags, statusData.in_system.kg),
        ])
      );
    }
    host.appendChild(wrap);
  }

  async function fetchLandingData() {
    var statusData = null;
    if (moduleAccessible("bags_status_report") && window.CIS && CIS.api && CIS.api.traceability) {
      try {
        statusData = await CIS.api.traceability("/reports/bags-status");
      } catch (e) {
        statusData = null;
      }
    }
    return { statusData: statusData };
  }

  function renderLandingShell(host) {
    host.innerHTML = "";
    var head = el("header", { className: "v2-dash-head" });
    head.appendChild(
      el("h1", { className: "v2-dash-greeting" }, [timeGreeting() + ", " + greetingName() + "."])
    );
    head.appendChild(
      el("p", { className: "v2-dash-tagline" }, [
        "Where charcoal, briquettes, and pallets sit today — use the left menu for your department.",
      ])
    );
    host.appendChild(head);
    var loading = el("p", { className: "muted", id: "v2-dash-loading" }, ["Loading storage snapshot…"]);
    host.appendChild(loading);
  }

  window.CIS_V2_renderHomeDashboard = function (host) {
    if (!host) return;
    renderLandingShell(host);
    var loadingEl = document.getElementById("v2-dash-loading");
    fetchLandingData().then(function (data) {
      if (loadingEl && loadingEl.parentNode) loadingEl.remove();
      if (data.statusData) {
        renderStorageSnapshot(host, data.statusData);
      } else if (loadingEl) {
        loadingEl.textContent = "Storage snapshot is not available for your account yet.";
      }
    });
  };

  async function loadLogisticsOpsSnapshot(lineEl) {
    if (!lineEl || !window.CIS || !CIS.api || !CIS.api.traceability) {
      if (lineEl) lineEl.textContent = "";
      return;
    }
    try {
      var activeResp = await CIS.api.traceability("/walvis-dispatches/active");
      var open = activeResp && activeResp.dispatch;
      var br = await CIS.api.traceability("/walvis-dispatches/storage-at-walvis-breakdown");
      var parts = [];
      if (open) {
        parts.push(
          "GF loading: " +
            (open.display_label || "Dispatch #" + open.dispatch_number) +
            " · " +
            (open.loaded_bags || 0) +
            " on manifest"
        );
      } else {
        parts.push("No open Walvis dispatch — open one in Walvis dispatches before Shorty loads.");
      }
      var walvisBulk = 0;
      (br.dispatches || []).forEach(function (d) {
        walvisBulk += d.bags_in_storage || 0;
      });
      var un = (br.unassigned && br.unassigned.bags_in_storage) || 0;
      parts.push("Walvis ground (bulk): " + walvisBulk + " bag(s) on dispatch tiles");
      if (un) parts.push(un + " unassigned on ground");
      lineEl.textContent = parts.join(" · ");
    } catch (e) {
      lineEl.textContent =
        "Walvis summary unavailable — open Walvis dispatches or Bags Status (API may need a refresh on bkweb3).";
    }
  }

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
    if (deptId === "logistics" && moduleAccessible("walvis_dispatches")) {
      var ops = el("section", { className: "panel v2-logistics-ops", style: "margin-bottom: 1rem;" });
      ops.appendChild(el("h3", { className: "v2-location-title" }, ["Walvis & loads"]));
      var opsLine = el("p", { className: "muted", id: "v2-logistics-ops-line" }, ["Loading…"]);
      ops.appendChild(opsLine);
      host.appendChild(ops);
      loadLogisticsOpsSnapshot(opsLine);
    }
    var ids = window.CIS_V2_departmentModuleIds ? CIS_V2_departmentModuleIds(deptId) : [];
    host.appendChild(reportRowList(ids));
  };
})();
