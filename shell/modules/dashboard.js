/* Dashboard home — tile grid grouped by section (not a sidebar list). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var SECTION_LABELS = {
    Production: "Production & quality",
    Maintenance: "Maintenance",
    Administration: "Administration",
  };

  var SECTION_ORDER = { Administration: 1, Production: 2, Maintenance: 3 };

  function sectionRank(section) {
    return SECTION_ORDER[section] != null ? SECTION_ORDER[section] : 50;
  }

  function iconSvg(name) {
    var icons = {
      quality:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16v2H4V4zm2 4h12v12H6V8zm2 2v8h8v-8H8zm1 1h6v2H9v-2zm0 3h4v2H9v-2z"/></svg>',
      operations:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 13h2v-2H3v2zm4 0h14v-2H7v2zM5 17h2v-2H5v2zm4 0h10v-2H9v2zM7 9h10V7H7v2z"/></svg>',
      consumption:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 20q-1.65 0-2.825-1.175T2 16V6q0-1.65 1.175-2.825T6 2h12q1.65 0 2.825 1.175T22 6v10q0 1.65-1.175 2.825T18 20H6zm0-2h12q.825 0 1.413-.587T20 16V6q0-.825-.587-1.413T18 4H6q-.825 0-1.413.587T4 6v10q0 .825.587 1.413T6 18zm2-4h8v-2H8v2z"/></svg>',
      admin:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12q-1.65 0-2.825-1.175T8 8q0-1.65 1.175-2.825T12 4q1.65 0 2.825 1.175T16 8q0 1.65-1.175 2.825T12 12zm-8 8v-1.8q0-.85.438-1.55T5.6 16.025q1.75-.875 3.725-1.325T12 14.4q2.025 0 4 .45t3.7 1.325q.725.375 1.163 1.075T21 18.2V20H4z"/></svg>',
    };
    return icons[name] || icons.quality;
  }

  function groupedModules(mods) {
    var bySection = {};
    mods.forEach(function (m) {
      var sec = m.section || "Other";
      if (!bySection[sec]) bySection[sec] = [];
      bySection[sec].push(m);
    });
    return Object.keys(bySection)
      .sort(function (a, b) {
        return sectionRank(a) - sectionRank(b);
      })
      .map(function (sec) {
        return {
          section: sec,
          label: SECTION_LABELS[sec] || sec,
          modules: bySection[sec].slice().sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
          }),
        };
      });
  }

  function render(container, ctx) {
    var ui = CIS.ui;
    var mods = CIS.allModules ? CIS.allModules() : (CIS.modules || []);
    container.innerHTML = "";
    container.className = "module-content dashboard-host";

    var welcome = ui.el("div", { class: "dashboard-welcome" });
    var who = (ctx.user && (ctx.user.display_name || ctx.user.login_id)) || "";
    welcome.appendChild(ui.el("h1", { class: "dashboard-title" }, ["Welcome" + (who ? ", " + who : "")]));
    welcome.appendChild(
      ui.el("p", { class: "dashboard-sub" }, [
        "All Carbo applications are shown below. Your permissions determine which you can open.",
      ])
    );
    container.appendChild(welcome);

    if (!mods.length) {
      container.appendChild(
        ui.error("No applications are configured in CIS yet.")
      );
      return;
    }

    groupedModules(mods).forEach(function (group) {
      container.appendChild(ui.el("h2", { class: "dashboard-section-title" }, [group.label]));
      var grid = ui.el("div", { class: "dashboard-grid" });
      group.modules.forEach(function (mod) {
        var allowed = CIS.canAccessModule ? CIS.canAccessModule(mod) : true;
        var tileClass = "dashboard-tile" + (allowed ? "" : " dashboard-tile-locked");
        var tile = ui.el("button", {
          class: tileClass,
          type: "button",
          onclick: function () {
            if (CIS.openModule) CIS.openModule(mod.id);
          },
        });
        var iconWrap = ui.el("div", {
          class: "dashboard-tile-icon",
          html: iconSvg(mod.icon || "quality"),
        });
        tile.appendChild(iconWrap);
        tile.appendChild(ui.el("span", { class: "dashboard-tile-title" }, [mod.title]));
        if (mod.description) {
          tile.appendChild(ui.el("span", { class: "dashboard-tile-desc" }, [mod.description]));
        }
        if (!allowed) {
          tile.appendChild(ui.el("span", { class: "dashboard-tile-lock" }, ["No access"]));
        }
        grid.appendChild(tile);
      });
      container.appendChild(grid);
    });
  }

  CIS.dashboard = { render: render, groupedModules: groupedModules };
})();
