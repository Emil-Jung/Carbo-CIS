/* Traceability — scanner / supervisor PWA launcher. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function scannerUrl(ctx) {
    var cfg = (ctx && ctx.config) || {};
    return (cfg.traceabilityScannerUrl || "/traceability/scanner/").trim();
  }

  function render(container, ctx) {
    CIS.launcherPage(container, ctx, {
      title: "Traceability",
      description: "Bag scanning and traceability capture in the field.",
      notes: [
        "Register device keys under CIS → Administration → Device keys.",
        "Supervisor tools are on the server when enabled.",
      ],
      primaryUrl: scannerUrl(ctx),
      primaryLabel: "Open Traceability",
      sameTab: false,
    });
  }

  CIS.modules.push({
    id: "traceability",
    title: "Traceability",
    kind: "app",
    icon: "traceability",
    description: "Field bag scanning PWA",
    requires: "traceability.access",
    render: render,
  });
})();
