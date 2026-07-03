/* Carbo Big-K Bag Stock — placeholder until traceability stock application is live. */

(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];



  function render(container, ctx) {

    CIS.placeholderPage(container, ctx, {

      title: "Carbo Big-K Bag Stock",

      description: "Bag inventory and session totals at Carbo Namibia sites.",

      notes: [

        "This application is not connected yet. It will link to traceability stock data when that service is live on bkweb3.",

      ],

    });

  }



  CIS.modules.push({

    id: "bag_stock",

    title: "Carbo Big-K Bag Stock",

    kind: "app",

    icon: "bags",

    description: "Carbo Namibia bag stock application",

    inactive: true,
    requires: "traceability.stock.view",
    render: render,
  });

})();