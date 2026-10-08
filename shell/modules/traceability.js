/* Traceability hub — all traceability entry points live here (not top-level dashboard tiles).
   Control Room (factory PC via CIS), Print Labels, etc. Scanner/kiosk uses device keys — not CIS. */

(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var OPTIONS = [
    {
      id: "control_room",
      title: "Control Room",
      description: "Open trucks, capture arrival details, enter factory scale weights.",
      requires: "traceability.control_room",
      icon: "control",
    },
    {
      id: "labels",
      title: "Labels",
      description: "Print bag labels and fence or park stock (testing abroad, pre-scanner, etc.).",
      requiresAny: ["traceability.labels.print", "traceability.labels.deployment"],
      icon: "labels",
    },
    {
      id: "movement_schedule",
      title: "Movement schedule",
      description: "Schedule a load so the scanner confirms each bag with one tap.",
      requires: "traceability.movement_jobs",
      icon: "schedule",
    },
    {
      id: "containers",
      title: "Containers",
      description: "Preload container numbers and bookings for Walvis Bay.",
      requires: "traceability.containers",
      icon: "container",
    },
    {
      id: "pallet_configuration",
      title: "Pallet Configuration",
      description: "Manage packaging products — CH05W, CH10, LF4, pallet weights and bag counts.",
      requires: "traceability.pallet_configuration",
      icon: "config",
    },
    {
      id: "manager_override",
      title: "Manager Override",
      description: "Generate today's PIN for weathering early-release on yard scanners.",
      requires: "traceability.weathering.override",
      icon: "override",
    },
  ];

  var ICONS = {
    control:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5h8V3H3v2zm0 8h8v-2H3v2zm0 8h8v-2H3v2zm10-16v2h8V3h-8zm0 8h8v-2h-8v2zm0 8h8v-2h-8v2z"/></svg>',
    labels:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h10l6 6v10H4V4zm2 2v12h12V11h-5V6H6zm9 1.4V10h2.6L15 7.4zM7 13h6v2H7v-2zm0 4h10v2H7v-2z"/></svg>',
    schedule:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zM5 9h14v10H5V9zm2 2v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2z"/></svg>',
    container:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5h18v14H3V5zm2 2v10h2V7H5zm4 0v10h2V7H9zm4 0v10h2V7h-2zm4 0v10h2V7h-2z"/></svg>',
    override:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 4.65-2H17v2h2v2h2v-2h2v-2h-4.35zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
    config:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96a7.035 7.035 0 0 0-1.63-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.63.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87a.489.489 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.489.489 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>',
  };

  function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content traceability-hub-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Traceability"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Charcoal bag traceability applications. You only see the options assigned to you.",
    ]));
    var shellRev = (ctx && ctx.config && ctx.config.shellRev) || "";
    if (shellRev) {
      container.appendChild(ui.el("p", { class: "muted traceability-shell-rev" }, ["Shell " + shellRev]));
    }

    var grid = ui.el("div", { class: "traceability-hub-grid" });
    var shown = 0;
    OPTIONS.forEach(function (opt) {
      if (opt.requiresAny && opt.requiresAny.length) {
        if (!opt.requiresAny.some(function (p) { return CIS.hasPermission(p); })) return;
      } else if (opt.requires && !CIS.hasPermission(opt.requires)) {
        return;
      }
      shown += 1;
      var mod = (CIS.modules || []).find(function (m) { return m.id === opt.id; });
      var inactive = !!(mod && mod.inactive);
      var tileClass = "dashboard-tile hub-option-tile";
      if (inactive) tileClass += " dashboard-tile-inactive";
      var btn = ui.el("button", {
        class: tileClass,
        type: "button",
        onclick: function () {
          if (CIS.openModule) CIS.openModule(opt.id);
        },
      });
      btn.appendChild(ui.el("div", { class: "dashboard-tile-icon", html: ICONS[opt.icon] || ICONS.labels }));
      btn.appendChild(ui.el("span", { class: "dashboard-tile-title" }, [opt.title]));
      btn.appendChild(ui.el("span", { class: "dashboard-tile-desc" }, [opt.description]));
      if (inactive) {
        btn.appendChild(ui.el("span", { class: "dashboard-tile-lock dashboard-tile-soon" }, ["Coming soon"]));
      }
      grid.appendChild(btn);
    });

    if (!shown) {
      container.appendChild(ui.el("p", { class: "muted" }, [
        "No Traceability options are assigned to your account. Ask an administrator to grant Control Room or Print Labels access.",
      ]));
    } else {
      container.appendChild(grid);
    }

    container.appendChild(ui.el("button", {
      class: "btn-ghost btn-sm hub-back",
      type: "button",
      onclick: function () {
        if (CIS.showDashboard) CIS.showDashboard();
      },
    }, ["Back to dashboard"]));
  }

  CIS.modules.push({
    id: "traceability",
    title: "Traceability",
    kind: "app",
    icon: "traceability",
    description: "Control room, bag labels, and scanning",
    requires: "traceability.access",
    render: render,
  });
})();
