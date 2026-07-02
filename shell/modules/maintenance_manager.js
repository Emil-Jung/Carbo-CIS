/* Maintenance Manager — Windows desktop app launcher (not a web embed). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function managerBase(ctx) {
    var cfg = (ctx && ctx.config) || {};
    return (cfg.maintenanceManagerUrl || "/maintenance/manager/").replace(/\/?$/, "/");
  }

  function render(container, ctx) {
    var base = managerBase(ctx);
    CIS.launcherPage(container, ctx, {
      title: "Maintenance Manager",
      description: "Full fleet maintenance desktop app — vehicles, service, fuel, certificates, device keys, and exceptions.",
      notes: [
        "Install on Windows from the download link below.",
        "Device keys for field PWAs are managed in CIS → Device keys.",
      ],
      primaryUrl: base,
      primaryLabel: "Download / update Manager",
      secondaryUrl: base + "version.json",
      secondaryLabel: "Check version",
    });
  }

  CIS.modules.push({
    id: "maintenance_manager",
    title: "Maintenance Manager",
    section: "Maintenance",
    kind: "app",
    order: 5,
    icon: "manager",
    description: "Desktop app — fleet setup, fuel, service, certs",
    requires: "maintenance.manager",
    render: render,
  });
})();
