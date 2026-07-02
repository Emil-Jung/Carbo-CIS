/* Dashboard — sections with Applications vs Reports & lookups. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var SECTION_LABELS = {
    Administration: "Administration",
    Production: "Production & quality",
    Maintenance: "Maintenance",
  };

  var SECTION_ORDER = { Administration: 1, Production: 2, Maintenance: 3 };

  var KIND_LABELS = {
    app: "Applications",
    lookup: "Reports & lookups",
  };

  var KIND_ORDER = { app: 1, lookup: 2 };

  function sectionRank(section) {
    return SECTION_ORDER[section] != null ? SECTION_ORDER[section] : 50;
  }

  function kindRank(kind) {
    return KIND_ORDER[kind || "app"] || 50;
  }

  function iconSvg(name) {
    var icons = {
      quality:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16v2H4V4zm2 4h12v12H6V8zm2 2v8h8v-8H8zm1 1h6v2H9v-2zm0 3h4v2H9v-2z"/></svg>',
      capture:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>',
      producers:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.8L17 12h-2v6h-2v-6H9v6H7v-6H5l7-6.2z"/></svg>',
      register:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
      manager:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2zm12 0h4v2h-4v-2z"/></svg>',
      operations:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 13h2v-2H3v2zm4 0h14v-2H7v2zM5 17h2v-2H5v2zm4 0h10v-2H9v2zM7 9h10V7H7v2z"/></svg>',
      consumption:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 20q-1.65 0-2.825-1.175T2 16V6q0-1.65 1.175-2.825T6 2h12q1.65 0 2.825 1.175T22 6v10q0 1.65-1.175 2.825T18 20H6zm0-2h12q.825 0 1.413-.587T20 16V6q0-.825-.587-1.413T18 4H6q-.825 0-1.413.587T4 6v10q0 .825.587 1.413T6 18zm2-4h8v-2H8v2z"/></svg>',
      admin:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12q-1.65 0-2.825-1.175T8 8q0-1.65 1.175-2.825T12 4q1.65 0 2.825 1.175T16 8q0 1.65-1.175 2.825T12 12zm-8 8v-1.8q0-.85.438-1.55T5.6 16.025q1.75-.875 3.725-1.325T12 14.4q2.025 0 4 .45t3.7 1.325q.725.375 1.163 1.075T21 18.2V20H4z"/></svg>',
      keys:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 14q-2.75 0-4.875-1.675T0 8.5Q0 5.75 2.125 4.075T7 2.4q2.75 0 4.875 1.675T14 8.5q0 1.05-.325 2.025L22 18.85l-1.85 1.85-8.325-8.325Q11.05 14 10 14H7zm0-2h2.525q.5-.675 1.188-1.087T12 10.4q1.65 0 2.825-1.175T16 6.4q0-1.65-1.175-2.825T12 2.4q-1.65 0-2.825 1.175T8 6.4q0 .875.413 1.563T9.5 9.15V12z"/></svg>',
    };
    return icons[name] || icons.quality;
  }

  function groupedModules(mods) {
    var bySection = {};
    mods.forEach(function (m) {
      var sec = m.section || "Other";
      if (!bySection[sec]) bySection[sec] = {};
      var kind = m.kind || "app";
      if (!bySection[sec][kind]) bySection[sec][kind] = [];
      bySection[sec][kind].push(m);
    });
    return Object.keys(bySection)
      .sort(function (a, b) { return sectionRank(a) - sectionRank(b); })
      .map(function (sec) {
        var kinds = Object.keys(bySection[sec])
          .sort(function (a, b) { return kindRank(a) - kindRank(b); })
          .map(function (kind) {
            return {
              kind: kind,
              label: KIND_LABELS[kind] || kind,
              modules: bySection[sec][kind].slice().sort(function (a, b) {
                return (a.order || 0) - (b.order || 0);
              }),
            };
          });
        return {
          section: sec,
          label: SECTION_LABELS[sec] || sec,
          kinds: kinds,
        };
      });
  }

  function renderTile(ui, mod) {
    var allowed = CIS.canAccessModule ? CIS.canAccessModule(mod) : true;
    var tileClass = "dashboard-tile" + (allowed ? "" : " dashboard-tile-locked");
    var tile = ui.el("button", {
      class: tileClass,
      type: "button",
      onclick: function () {
        if (CIS.openModule) CIS.openModule(mod.id);
      },
    });
    tile.appendChild(ui.el("div", {
      class: "dashboard-tile-icon",
      html: iconSvg(mod.icon || "quality"),
    }));
    tile.appendChild(ui.el("span", { class: "dashboard-tile-title" }, [mod.title]));
    if (mod.description) {
      tile.appendChild(ui.el("span", { class: "dashboard-tile-desc" }, [mod.description]));
    }
    if (!allowed) {
      tile.appendChild(ui.el("span", { class: "dashboard-tile-lock" }, ["No access"]));
    }
    return tile;
  }

  function render(container, ctx) {
    var ui = CIS.ui;
    var mods = CIS.allModules ? CIS.allModules() : (CIS.modules || []);
    container.innerHTML = "";
    container.className = "module-content dashboard-host";

    var welcome = ui.el("div", { class: "dashboard-welcome" });
    var who = (ctx.user && (ctx.user.display_name || ctx.user.login_id)) || "";
    welcome.appendChild(ui.el("h1", { class: "dashboard-title" }, ["Welcome" + (who ? ", " + who : "")]));
    welcome.appendChild(ui.el("p", { class: "dashboard-sub" }, [
      "One Carbo system for everyone. Applications are for capture and management; reports are read-only lookups.",
    ]));
    container.appendChild(welcome);

    if (!mods.length) {
      container.appendChild(ui.error("No applications are configured in CIS yet."));
      return;
    }

    groupedModules(mods).forEach(function (group) {
      container.appendChild(ui.el("h2", { class: "dashboard-section-title" }, [group.label]));
      group.kinds.forEach(function (kindGroup) {
        container.appendChild(ui.el("h3", { class: "dashboard-kind-title" }, [kindGroup.label]));
        var grid = ui.el("div", { class: "dashboard-grid" });
        kindGroup.modules.forEach(function (mod) {
          grid.appendChild(renderTile(ui, mod));
        });
        container.appendChild(grid);
      });
    });
  }

  CIS.dashboard = { render: render, groupedModules: groupedModules };
})();
