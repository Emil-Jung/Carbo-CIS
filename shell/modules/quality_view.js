/* Quality viewer module — embeds the existing read-only Quality viewer PWA. */
(function () {
  "use strict";
  const CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function viewerUrl(ctx) {
    const cfg = (ctx && ctx.config) || {};
    const base = (cfg.qualityViewerUrl || "/quality/viewer/").trim();
    const join = base.indexOf("?") === -1 ? "?" : "&";
    return base + join + "cis=1";
  }

  function render(container, ctx) {
    CIS.embedAuthenticatedIframe(container, {
      title: "Quality viewer",
      src: viewerUrl(ctx),
    });
  }

  CIS.modules.push({
    id: "quality_view",
    title: "Quality Analysis",
    section: "Production",
    kind: "lookup",
    order: 10,
    icon: "quality",
    description: "Read-only sieving sheets and producer summaries",
    requires: "quality.view",
    render,
  });
})();
