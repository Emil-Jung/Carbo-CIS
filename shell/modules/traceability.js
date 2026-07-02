/* Traceability — placeholder until field PWA is connected on Big-K. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function render(container, ctx) {
    CIS.placeholderPage(container, ctx, {
      title: "Traceability",
      description: "Bag scanning and charcoal traceability in the field and at Big-K.",
      notes: [
        "This application is not connected yet. Device keys and the scanner PWA will be enabled in a later rollout.",
      ],
    });
  }

  CIS.modules.push({
    id: "traceability",
    title: "Traceability",
    kind: "app",
    icon: "traceability",
    description: "Field bag scanning PWA",
    inactive: true,
    render: render,
  });
})();
