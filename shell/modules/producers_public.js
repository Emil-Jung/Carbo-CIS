/* FSC Public Register — read-only producer lookup. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function publicUrl(ctx) {
    var cfg = (ctx && ctx.config) || {};
    return (cfg.producersPublicUrl || "/producers/public/").trim();
  }

  function render(container, ctx) {
    CIS.launcherPage(container, ctx, {
      title: "FSC Public Register",
      description: "Browse active and inactive FSC Carbo group scheme members.",
      notes: ["Public read-only register for auditors and reference."],
      primaryUrl: publicUrl(ctx),
      primaryLabel: "Open register",
      sameTab: false,
    });
  }

  CIS.modules.push({
    id: "producers_public",
    title: "FSC Public",
    section: "Production",
    kind: "lookup",
    order: 25,
    icon: "register",
    description: "Public FSC Carbo member lookup",
    render: render,
  });
})();
