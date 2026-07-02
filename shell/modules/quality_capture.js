/* Quality Capture — Sieving Sheet PWA (field / Jessica). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function captureUrl(ctx) {
    var cfg = (ctx && ctx.config) || {};
    return (cfg.qualityCaptureUrl || "/quality/").trim();
  }

  function render(container, ctx) {
    CIS.launcherPage(container, ctx, {
      title: "Sieving Sheet",
      description: "Capture truck sieving test samples in the field or office.",
      notes: [
        "Register the device key from CIS → Administration → Device keys.",
        "Add to your phone home screen for fastest access.",
      ],
      primaryUrl: captureUrl(ctx),
      primaryLabel: "Open Sieving Sheet",
      sameTab: false,
    });
  }

  CIS.modules.push({
    id: "quality_capture",
    title: "Sieving Sheet",
    section: "Production",
    kind: "app",
    order: 5,
    icon: "capture",
    description: "Capture sieving samples (field PWA)",
    requires: "quality.capture",
    render: render,
  });
})();
