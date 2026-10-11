/* CIS Shell V2 — nav by department (module ids match production CIS.modules). */
(function () {
  "use strict";

  /** Hidden from V2 sidebar only (modules still load for deep links). */
  window.CIS_V2_NAV_HIDDEN = {
    quality_capture: true,
    permit_status: true,
    traceability: true,
    bag_stock: true,
    maintenance_certs: true,
  };

  window.CIS_V2_NAV = {
    groups: [
      {
        id: "office",
        title: "Office",
        tier: "office",
        icon: "group_office",
        items: [
          { id: "producers_office" },
          { id: "producers_view" },
          { id: "quality_view" },
          { id: "deliveries_register" },
          { id: "supplier_contacts" },
        ],
      },
      {
        id: "logistics",
        title: "Logistics",
        tier: "logistics",
        icon: "group_logistics",
        items: [
          { id: "delivery_confirmations" },
          { id: "walvis_dispatches" },
          { id: "movement_schedule" },
          { id: "containers" },
          { id: "bags_status_report" },
        ],
      },
      {
        id: "control_room_dept",
        title: "Control Room",
        tier: "control_room",
        icon: "group_production",
        items: [{ id: "control_room" }],
      },
      {
        id: "production",
        title: "Production",
        tier: "production",
        icon: "group_production",
        items: [
          { id: "labels" },
          { id: "print_labels", nestUnder: "labels", nestDepth: 1 },
          { id: "label_deployment", nestUnder: "labels", nestDepth: 1 },
          { id: "packaging_shift" },
          { id: "pallet_configuration" },
          { id: "manager_override" },
          { id: "bags_movement_report" },
          { id: "restaurant_report" },
        ],
      },
      {
        id: "maintenance",
        title: "Maintenance",
        tier: "maintenance",
        icon: "group_maintenance",
        items: [
          { id: "maintenance_manager" },
          { id: "maintenance_ops" },
          { id: "consumption" },
        ],
      },
    ],
    dockAdministration: {
      id: "administration",
      title: "Administration",
      tier: "administration",
      icon: "group_administration",
      items: [{ id: "identity_admin" }, { id: "device_keys" }],
    },
  };

  window.CIS_V2_NAV_ICONS = {
    group_administration:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18 7 3.11v4.71c0 4.16-2.84 8.02-7 9.28-4.16-1.26-7-5.12-7-9.28V6.29l7-3.11z"/></svg>',
    group_office:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
    group_logistics:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 18.5a1.5 1.5 0 0 1-1.5-1.5 1.5 1.5 0 0 1 1.5-1.5 1.5 1.5 0 0 1 1.5 1.5 1.5 1.5 0 0 1-1.5 1.5m1.5-9 1.96 2.5H17V9.5M6 18.5A1.5 1.5 0 0 1 4.5 17 1.5 1.5 0 0 1 6 15.5 1.5 1.5 0 0 1 7.5 17 1.5 1.5 0 0 1 6 18.5M20 8h-3V4H3c-1.11 0-2 .89-2 2v11h2a3 3 0 0 0 3 3 3 3 0 0 0 3-3h6a3 3 0 0 0 3 3 3 3 0 0 0 3-3h2v-5l-3-4Z"/></svg>',
    group_production:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2H4V6zm0 5h7v2H4v-2zm0 5h7v2H4v-2zm9-8h7v2h-7V8zm0 5h7v2h-7v-2zm0 5h7v2h-7v-2z"/></svg>',
    group_maintenance:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
    dashboard:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"/></svg>',
    identity_admin:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12q-1.65 0-2.825-1.175T8 8q0-1.65 1.175-2.825T12 4q1.65 0 2.825 1.175T16 8q0 1.65-1.175 2.825T12 12zm-8 8v-1.8q0-.85.438-1.55T5.6 16.025q1.75-.875 3.725-1.325T12 14.4q2.025 0 4 .45t3.7 1.325q.725.375 1.163 1.075T21 18.2V20H4z"/></svg>',
    device_keys:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 14q-2.75 0-4.875-1.675T0 8.5Q0 5.75 2.125 4.075T7 2.4q2.75 0 4.875 1.675T14 8.5q0 1.05-.325 2.025L22 18.85l-1.85 1.85-8.325-8.325Q11.05 14 10 14H7zm0-2h2.525q.5-.675 1.188-1.087T12 10.4q1.65 0 2.825-1.175T16 6.4q0-1.65-1.175-2.825T12 2.4q-1.65 0-2.825 1.175T8 6.4q0 .875.413 1.563T9.5 9.15V12z"/></svg>',
    producers_office:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.8L17 12h-2v6h-2v-6H9v6H7v-6H5l7-6.2z"/></svg>',
    traceability:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2H4V6zm0 5h7v2H4v-2zm0 5h7v2H4v-2zm9-8h7v2h-7V8zm0 5h7v2h-7v-2zm0 5h7v2h-7v-2z"/></svg>',
    quality_capture:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>',
    maintenance_manager:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2zm12 0h4v2h-4v-2z"/></svg>',
    default:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
  };

  window.CIS_V2_NAV_ICON_FOR = function (moduleId) {
    var icons = window.CIS_V2_NAV_ICONS;
    if (icons[moduleId]) return icons[moduleId];
    if (moduleId.indexOf("maintenance") === 0 || moduleId === "consumption" || moduleId === "maintenance_ops") {
      return icons.maintenance_manager;
    }
    if (moduleId.indexOf("quality") === 0 || moduleId === "restaurant_report") return icons.quality_capture;
    if (moduleId.indexOf("bags") === 0 || moduleId === "deliveries_register") return icons.traceability;
    if (moduleId.indexOf("producer") === 0 || moduleId === "supplier_contacts") {
      return icons.producers_office;
    }
    if (
      moduleId === "control_room" ||
      moduleId === "labels" ||
      moduleId === "print_labels" ||
      moduleId === "label_deployment" ||
      moduleId === "delivery_confirmations" ||
      moduleId === "movement_schedule" ||
      moduleId === "walvis_dispatches" ||
      moduleId === "containers" ||
      moduleId === "pallet_configuration" ||
      moduleId === "packaging_shift" ||
      moduleId === "manager_override"
    ) {
      return icons.traceability;
    }
    return icons.default;
  };
})();
