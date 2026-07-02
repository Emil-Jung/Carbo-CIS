/* Maintenance — Certificates (placeholder; separate tile from Operations). */

(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];

  function render(container, ctx) {
    CIS.placeholderPage(container, ctx, {
      title: "Maintenance — Certificates",
      description: "Fleet certificates and license disc tracking.",
      notes: [
        "Certificate views will be linked from CIS in a later rollout.",
        "Operations fleet table is available under Maintenance — Operations.",
      ],
    });
  }

  CIS.modules.push({
    id: "maintenance_certs",
    title: "Certificates",
    section: "Maintenance",
    kind: "lookup",
    order: 12,
    icon: "manager",
    description: "Certificates & license discs",
    inactive: true,
    requires: "maintenance.certs.view",
    render: render,
  });

})();
