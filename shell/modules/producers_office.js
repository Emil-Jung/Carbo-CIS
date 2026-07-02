/* Producers Office — add Other FSC / Non-FSC producers. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function officeUrl(ctx) {
    var cfg = (ctx && ctx.config) || {};
    return (cfg.producersOfficeUrl || "/producers/office/").trim();
  }

  function render(container, ctx) {
    CIS.launcherPage(container, ctx, {
      title: "Producers — Office",
      description: "Register Other FSC and Non-FSC producers (identity, farm, classification).",
      notes: [
        "FSC Carbo members are managed in the FSC Management System, not here.",
        "Office API key is configured on the server. Issue or look up the shared key under CIS → Device keys → Producers office.",
      ],
      primaryUrl: officeUrl(ctx),
      primaryLabel: "Open Producers Office",
      sameTab: false,
    });
  }

  CIS.modules.push({
    id: "producers_office",
    title: "Producers — Office",
    section: "Production",
    kind: "app",
    order: 15,
    icon: "producers",
    description: "Capture producer registrations",
    requires: "producers.office",
    render: render,
  });
})();
