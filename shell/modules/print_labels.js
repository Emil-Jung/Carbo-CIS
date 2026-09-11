/* Print Labels — Traceability application shell (label workflow added in a later step). */

(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function render(container, ctx) {
    CIS.placeholderPage(container, ctx, {
      title: "Print Labels",
      description: "Allocate bag identity serials and print labels for the factory kiosk.",
      notes: [
        "This is the application shell. Label allocation, Zebra printing, and GS1 encoding will be connected in the next step.",
        "Access is controlled by the traceability.labels.print permission in Users & access.",
      ],
      backModule: "traceability",
      backLabel: "Back to Traceability",
    });

    if (ctx.api && ctx.api.traceability) {
      ctx.api.traceability("/applications/print-labels")
        .then(function () {
          /* Confirms backend permission gate; shell stays visible on success. */
        })
        .catch(function (e) {
          var host = container.querySelector(".module-placeholder-host") || container;
          var err = CIS.ui.el("p", { class: "error-box" }, [
            "Backend denied access: " + (e.message || e),
          ]);
          host.appendChild(err);
        });
    }
  }

  CIS.modules.push({
    id: "print_labels",
    title: "Print Labels",
    kind: "app",
    icon: "labels",
    description: "Allocate and print bag identity labels",
    requires: "traceability.labels.print",
    render: render,
  });
})();
