/* Maintenance Manager — placeholder until desktop app rollout via CIS. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function render(container, ctx) {
    CIS.placeholderPage(container, ctx, {
      title: "Maintenance",
      description: "Fleet maintenance desktop app — vehicles, service, fuel, certificates, and exceptions.",
      notes: [
        "The Maintenance Manager app is not available through CIS yet.",
        "Operations and Consumption reports will be enabled in a later rollout.",
      ],
    });
  }

  CIS.modules.push({
    id: "maintenance_manager",
    title: "Maintenance",
    section: "Maintenance",
    kind: "app",
    order: 5,
    icon: "manager",
    description: "Desktop app — fleet setup, fuel, service, certs",
    inactive: true,
    render: render,
  });
})();
