/* Labels hub — Print Labels and Label Fencing under Traceability. */

(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var OPTIONS = [
    {
      id: "print_labels",
      title: "Print Labels",
      description: "Allocate and print bag identity labels (Zebra + A4 pallet sheets).",
      requires: "traceability.labels.print",
      icon: "print",
    },
    {
      id: "label_deployment",
      title: "Label Fencing",
      description: "Fence serial ranges (known Bag IDs) or park a quantity when serials are unknown.",
      requires: "traceability.labels.deployment",
      icon: "deploy",
    },
  ];

  var ICONS = {
    print:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h10l6 6v10H4V4zm2 2v12h12V11h-5V6H6zm9 1.4V10h2.6L15 7.4zM7 13h6v2H7v-2zm0 4h10v2H7v-2z"/></svg>',
    deploy:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18 6 2.25v4.66c0 3.87-2.55 7.5-6 8.56-3.45-1.06-6-4.69-6-8.56V6.43l6-2.25zM11 7v6l4.25 2.46.75-1.3L12 12.5V7h-1z"/></svg>',
  };

  function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content traceability-hub-host labels-hub-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Labels"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Bag label printing and fencing. Fenced or parked labels stay in the total produced count but are excluded from available stock.",
    ]));

    var grid = ui.el("div", { class: "traceability-hub-grid" });
    var shown = 0;
    OPTIONS.forEach(function (opt) {
      if (!CIS.hasPermission(opt.requires)) return;
      shown += 1;
      var btn = ui.el("button", {
        class: "dashboard-tile hub-option-tile",
        type: "button",
        onclick: function () {
          if (CIS.openModule) CIS.openModule(opt.id);
        },
      });
      btn.appendChild(ui.el("div", { class: "dashboard-tile-icon", html: ICONS[opt.icon] || ICONS.print }));
      btn.appendChild(ui.el("span", { class: "dashboard-tile-title" }, [opt.title]));
      btn.appendChild(ui.el("span", { class: "dashboard-tile-desc" }, [opt.description]));
      grid.appendChild(btn);
    });

    if (!shown) {
      container.appendChild(ui.el("p", { class: "muted" }, [
        "No label options are assigned to your account. Ask an administrator for Print Labels or Label Fencing access.",
      ]));
    } else {
      container.appendChild(grid);
    }

    container.appendChild(ui.el("button", {
      class: "btn-ghost btn-sm hub-back",
      type: "button",
      onclick: function () {
        if (CIS.openModule) CIS.openModule("traceability");
      },
    }, ["Back to Traceability"]));
  }

  CIS.modules.push({
    id: "labels",
    title: "Labels",
    kind: "app",
    icon: "labels",
    description: "Print labels and fence or park stock",
    requires: "traceability.access",
    requiresAny: [
      "traceability.labels.print",
      "traceability.labels.deployment",
    ],
    render: render,
  });
})();
