/* Quality Capture — Sieving Sheet PWA embedded in CIS (office / Jessica). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function captureUrl(ctx) {
    var cfg = (ctx && ctx.config) || {};
    var base = (cfg.qualityCaptureUrl || "/quality/").trim();
    var join = base.indexOf("?") === -1 ? "?" : "&";
    return base + join + "cis=1";
  }

  function render(container, ctx) {
    CIS.embedAuthenticatedIframe(container, {
      title: "Quality capture",
      src: captureUrl(ctx),
    });
  }

  CIS.modules.push({
    id: "quality_capture",
    title: "Quality",
    section: "Production",
    kind: "app",
    order: 5,
    icon: "capture",
    description: "Capture sieving samples (office or field)",
    requires: "quality.capture",
    render: render,
  });
})();
