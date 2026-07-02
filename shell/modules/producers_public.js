/* FSC Public Register — read-only producer lookup (embedded, no device key). */

(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];



  function publicUrl(ctx) {

    var cfg = (ctx && ctx.config) || {};

    return (cfg.producersPublicUrl || "/producers/public/").trim();

  }



  function render(container, ctx) {

    CIS.embedIframe(container, {

      title: "FSC Public Register",

      src: publicUrl(ctx),

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
    requires: "producers.public.view",
    render: render,

  });

})();

