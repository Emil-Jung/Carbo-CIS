/* Producers Office — embeds the office capture PWA (CIS auth, no separate API key). */

(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];



  function officeUrl(ctx) {

    var cfg = (ctx && ctx.config) || {};

    var base = (cfg.producersOfficeUrl || "/producers/office/").trim();

    var join = base.indexOf("?") === -1 ? "?" : "&";

    // Bust stale index.html / app.js in the CIS iframe after producer-office updates.
    return base + join + "cis=1&pwa=20261123-convert5";

  }



  function render(container, ctx) {

    CIS.embedAuthenticatedIframe(container, {

      title: "Capture Producers",

      src: officeUrl(ctx),

    });

  }



  CIS.modules.push({

    id: "producers_office",

    title: "Capture Producers",

    section: "Production",

    kind: "app",

    order: 15,

    icon: "producers",

    description: "Capture FSC Other / Non FSC, edit names, and convert Non FSC ↔ FSC Other from the producer list",

    requires: "producers.office",

    render: render,

  });

})();

