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

  /** Skip dummy / sandbox assets (e.g. FL-TEST, TR-TEST) from fleet reports. */
  CIS.isTestVehicle = function (vehicle) {
    if (!vehicle) return false;
    var fields = [
      vehicle.vehicle_id,
      vehicle.vehicle_type,
      vehicle.make,
      vehicle.model,
      vehicle.unique_id,
      vehicle.location,
      vehicle.notes,
    ];
    for (var i = 0; i < fields.length; i++) {
      var val = String(fields[i] || "").toLowerCase();
      if (val.indexOf("test") !== -1) return true;
    }
    return false;
  };

  CIS.filterFleetVehicles = function (vehicles) {
    return (vehicles || []).filter(function (v) {
      return !CIS.isTestVehicle(v);
    });
  };

  CIS.isTestVehicleId = function (vehicleId) {
    return String(vehicleId || "").toLowerCase().indexOf("test") !== -1;
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

  CIS.embedIframe = function (container, opts) {
    container.innerHTML = "";
    container.classList.add("module-iframe-host");
    var iframe = document.createElement("iframe");
    iframe.className = "module-iframe";
    iframe.title = opts.title || "Application";
    iframe.src = opts.src;
    container.appendChild(iframe);
  };

  /**
   * Embed an app that accepts CIS bearer auth via postMessage
   * ({ type: "cis-auth", token }) and replies with { type: "cis-auth-ack" }.
   */
  CIS.embedAuthenticatedIframe = function (container, opts) {
    container.innerHTML = "";
    container.classList.add("module-iframe-host");
    var iframe = document.createElement("iframe");
    iframe.className = "module-iframe";
    iframe.title = opts.title || "Application";
    iframe.src = opts.src;
    container.appendChild(iframe);

    var acked = false;
    var pollTimer = null;

    function onMessage(ev) {
      if (ev.source !== iframe.contentWindow) return;
      if (!ev.data || ev.data.type !== "cis-auth-ack") return;
      acked = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
    window.addEventListener("message", onMessage);

    function sendAuth() {
      var token = CIS.getToken && CIS.getToken();
      if (!token || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage({ type: "cis-auth", token: token }, "*");
    }

    iframe.addEventListener("load", sendAuth);
    sendAuth();
    pollTimer = setInterval(function () {
      if (!acked) sendAuth();
    }, 400);
    setTimeout(function () {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, 15000);
  };

  CIS.placeholderPage = function (container, ctx, opts) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.classList.add("module-placeholder-host");
    container.appendChild(ui.el("h2", { class: "module-title" }, [opts.title]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [opts.description]));
    container.appendChild(ui.el("p", { class: "placeholder-badge" }, ["Coming soon — not active yet"]));
    (opts.notes || []).forEach(function (note) {
      container.appendChild(ui.el("p", { class: "muted launcher-note" }, [note]));
    });
    container.appendChild(ui.el("button", {
      class: "btn-ghost btn-sm",
      type: "button",
      onclick: function () {
        if (CIS.showDashboard) CIS.showDashboard();
      },
    }, ["Back"]));
  };
})();
