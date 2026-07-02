/* Producers Office — embeds the office capture PWA (CIS auth, no separate API key). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function officeUrl(ctx) {
    var cfg = (ctx && ctx.config) || {};
    var base = (cfg.producersOfficeUrl || "/producers/office/").trim();
    var join = base.indexOf("?") === -1 ? "?" : "&";
    return base + join + "cis=1";
  }

  function render(container, ctx) {
    CIS.embedAuthenticatedIframe(container, {
      title: "Producers Office",
      src: officeUrl(ctx),
    });
  }

  CIS.modules.push({
    id: "producers_office",
    title: "Producers",
    section: "Production",
    kind: "app",
    order: 15,
    icon: "producers",
    description: "Capture producer registrations",
    requires: "producers.office",
    render: render,
  });
})();
