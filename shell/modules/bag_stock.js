/* Carbo Big-K Bag Stock — placeholder until traceability stock view is live. */

(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];



  function render(container, ctx) {

    CIS.placeholderPage(container, ctx, {

      title: "Carbo Big-K Bag Stock",

      description: "Read-only bag inventory and session totals at the Big-K site.",

      notes: [

        "This report is not connected yet. It will link to traceability stock data when that service is live on bkweb3.",

      ],

    });

  }



  CIS.modules.push({

    id: "bag_stock",

    title: "Carbo Big-K Bag Stock",

    kind: "lookup",

    icon: "bags",

    description: "Big-K bag inventory & session totals",

    inactive: true,
    requires: "traceability.stock.view",
    render: render,

  });

})();


