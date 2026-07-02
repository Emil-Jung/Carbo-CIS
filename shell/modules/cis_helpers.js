/* Shared helpers for CIS modules. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  CIS.isTrailerVehicle = function (vehicle) {
    var t = (vehicle && vehicle.vehicle_type) || "";
    return t.toLowerCase().indexOf("trailer") !== -1;
  };

  /** Diesel/fuel metrics apply to powered assets, not trailers. */
  CIS.isFuelEligibleVehicle = function (vehicle) {
    if (!vehicle || vehicle.status === "inactive") return false;
    return !CIS.isTrailerVehicle(vehicle);
  };

  CIS.launcherPage = function (container, ctx, opts) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.appendChild(ui.el("h2", { class: "module-title" }, [opts.title]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [opts.description]));
    (opts.notes || []).forEach(function (note) {
      container.appendChild(ui.el("p", { class: "muted launcher-note" }, [note]));
    });
    var actions = ui.el("div", { class: "launcher-actions" });
    if (opts.primaryUrl) {
      actions.appendChild(ui.el("a", {
        class: "btn btn-launch",
        href: opts.primaryUrl,
        target: opts.sameTab ? "_self" : "_blank",
        rel: "noopener noreferrer",
      }, [opts.primaryLabel || "Open application"]));
    }
    if (opts.secondaryUrl) {
      actions.appendChild(ui.el("a", {
        class: "btn-ghost btn-launch-secondary",
        href: opts.secondaryUrl,
        target: "_blank",
        rel: "noopener noreferrer",
      }, [opts.secondaryLabel || "Download"]));
    }
    container.appendChild(actions);
  };
})();
