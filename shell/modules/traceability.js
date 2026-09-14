/* Traceability hub — nested application tiles, each gated by its own permission. */

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
      id: "print_labels",
      title: "Print Labels",
      description: "Allocate serials and print QR labels on the Zebra.",
      requires: "traceability.labels.print",
      icon: "labels",
    },
  ];

  var ICONS = {
    control:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5h8V3H3v2zm0 8h8v-2H3v2zm0 8h8v-2H3v2zm10-16v2h8V3h-8zm0 8h8v-2h-8v2zm0 8h8v-2h-8v2z"/></svg>',
    labels:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h10l6 6v10H4V4zm2 2v12h12V11h-5V6H6zm9 1.4V10h2.6L15 7.4zM7 13h6v2H7v-2zm0 4h10v2H7v-2z"/></svg>',
  };

  function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content traceability-hub-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Traceability"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Charcoal bag traceability applications. You only see the options assigned to you.",
    ]));

    var grid = ui.el("div", { class: "traceability-hub-grid" });
    var shown = 0;
    OPTIONS.forEach(function (opt) {
      if (!CIS.hasPermission(opt.requires)) return;
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
