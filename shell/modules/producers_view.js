/* View Producers — read-only office list (CIS auth, no capture). */

(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];



  function viewUrl(ctx) {

    var cfg = (ctx && ctx.config) || {};

    var base = (cfg.producersOfficeUrl || "/producers/office/").trim();

    var join = base.indexOf("?") === -1 ? "?" : "&";

    return base + join + "cis=1&mode=view";

  }



  function render(container, ctx) {

    CIS.embedAuthenticatedIframe(container, {

      title: "View Producers",

      src: viewUrl(ctx),

    });

  }



  CIS.modules.push({

    id: "producers_view",

    title: "View Producers",

    section: "Production",

    kind: "lookup",

    order: 12,

    icon: "producers",

    description: "Read-only producer and farm list",

    requires: "producers.view",

    render: render,

  });

})();
