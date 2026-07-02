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

  /** Skip dummy / sandbox assets and inactive units from fleet reports. */
  CIS.isTestVehicle = function (vehicle) {
    if (!vehicle) return false;
    if (String(vehicle.status || "").toLowerCase() === "inactive") return true;
    var id = String(vehicle.vehicle_id || "").trim();
    if (/test/i.test(id)) return true;
    var fields = [
      vehicle.vehicle_type,
      vehicle.make,
      vehicle.model,
      vehicle.unique_id,
      vehicle.location,
      vehicle.notes,
    ];
    for (var i = 0; i < fields.length; i++) {
      if (/\btest\b/i.test(String(fields[i] || ""))) return true;
    }
    return false;
  };

  CIS.isTestVehicleId = function (vehicleId) {
    var id = String(vehicleId || "").trim();
    return /test/i.test(id);
  };

  CIS.filterFleetVehicles = function (vehicles) {
    return (vehicles || []).filter(function (v) {
      return v && !CIS.isTestVehicle(v);
    });
  };

  /** Sort key for fleet table — mirrors Maintenance Manager hub buckets. */
  CIS.fleetCategoryRank = function (vehicle) {
    var t = String((vehicle && vehicle.vehicle_type) || "").trim().toLowerCase();
    var isTrailer = t.indexOf("trailer") !== -1;
    var isFork = !t || t.indexOf("fork") !== -1 || t === "forklift" || t === "fork lift" || t === "fl";
    var isTruck = t.indexOf("truck") !== -1 || t === "lorry" || t.indexOf("rigid") !== -1;
    if (isTrailer) return 30;
    if (isFork && !isTrailer) return 10;
    if (isTruck && !isFork && !isTrailer) return 20;
    if (t.indexOf("compressor") !== -1) return 50;
    if (t.indexOf("generator") !== -1) return 60;
    if (t.indexOf("workshop") !== -1) return 70;
    if (t.indexOf("conveyor") !== -1) return 80;
    if (t.indexOf("extinguish") !== -1 || (t.indexOf("fire") !== -1 && t.indexOf("fighting") !== -1)) return 90;
    if (t && (t.indexOf("production") !== -1 && t.indexOf("machine") !== -1)) return 40;
    return t ? 35 : 10;
  };

  CIS.compareVehicleIds = function (a, b) {
    return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
  };

  /** Maintenance service maths — mirrors Maintenance-Platform/calculations.py */
  CIS.defaultServiceInterval = function (vehicle) {
    return CIS.isTrailerVehicle(vehicle) ? 40000 : 250;
  };

  CIS.serviceSoonThreshold = function (vehicle) {
    var configured = vehicle && vehicle.service_red_threshold;
    if (configured != null && !isNaN(Number(configured)) && Number(configured) >= 1) {
      return Number(configured);
    }
    return CIS.isTrailerVehicle(vehicle) ? 3000 : 30;
  };

  CIS.meterUnit = function (vehicle) {
    return CIS.isTrailerVehicle(vehicle) ? "km" : "h";
  };

  CIS.formatMeter = function (value, vehicle) {
    if (value == null || isNaN(Number(value))) return "—";
    var n = Number(value);
    var text = (Math.round(n * 10) / 10).toString().replace(/\.0$/, "");
    return text + " " + CIS.meterUnit(vehicle);
  };

  CIS.effectiveCurrentHours = function (vehicle) {
    if (vehicle.current_hours != null && !isNaN(Number(vehicle.current_hours))) {
      return Number(vehicle.current_hours);
    }
    if (vehicle.starting_hours != null && !isNaN(Number(vehicle.starting_hours))) {
      return Number(vehicle.starting_hours);
    }
    return null;
  };

  CIS.calculateService = function (vehicle) {
    var interval = vehicle.service_interval_hours;
    if (interval == null || isNaN(Number(interval)) || Number(interval) < 1) {
      interval = CIS.defaultServiceInterval(vehicle);
    } else {
      interval = Number(interval);
    }
    var soon = CIS.serviceSoonThreshold(vehicle);
    var current = CIS.effectiveCurrentHours(vehicle);
    var baseline = vehicle.last_service_hours;
    if (baseline == null || isNaN(Number(baseline))) {
      baseline = vehicle.starting_hours != null ? Number(vehicle.starting_hours) : 0;
    } else {
      baseline = Number(baseline);
    }
    if (current == null) {
      return {
        state: "unknown",
        statusLabel: "—",
        remaining: null,
        nextService: null,
        dueInLabel: "—",
      };
    }
    var nextService = baseline + interval;
    var remaining = nextService - current;
    var unit = CIS.meterUnit(vehicle);
    var state = "ok";
    var statusLabel = "In Service";
    if (remaining < 0) {
      state = "due";
      statusLabel = "Overdue";
    } else if (remaining <= soon) {
      state = "soon";
      statusLabel = "Service Soon";
    }
    var dueInLabel;
    if (remaining >= 0) {
      dueInLabel = Math.round(remaining) + " " + unit;
    } else {
      dueInLabel = Math.round(Math.abs(remaining)) + " " + unit + " overdue";
    }
    return {
      state: state,
      statusLabel: statusLabel,
      remaining: remaining,
      nextService: nextService,
      dueInLabel: dueInLabel,
    };
  };

  CIS.modelTypeLabel = function (vehicle) {
    var make = String(vehicle.make || "").trim();
    var model = String(vehicle.model || "").trim();
    var type = String(vehicle.vehicle_type || "").trim();
    var ident = [make, model].filter(Boolean).join(" ");
    if (ident && type) return ident + " / " + type;
    return ident || type || "—";
  };

  CIS.formatChecklistWhen = function (iso) {
    if (!iso) return "Never";
    var s = String(iso).trim().replace(" ", "T").slice(0, 19);
    var dt = new Date(s);
    if (isNaN(dt.getTime())) return "Never";
    var now = new Date();
    var dayMs = 86400000;
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var checkDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    var deltaDays = Math.round((today - checkDay) / dayMs);
    var status;
    if (deltaDays === 0) status = "Today ✔";
    else if (deltaDays === 1) status = "Yesterday ✔";
    else status = deltaDays + " days ago";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var dateStr = dt.getDate() + " " + months[dt.getMonth()] + " " + dt.getFullYear();
    var hh = dt.getHours();
    var mm = dt.getMinutes();
    if (hh || mm) {
      return dateStr + ", " + String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + " — " + status;
    }
    return dateStr + " — " + status;
  };

  CIS.formatLastUpdate = function (iso) {
    if (!iso) return "—";
    var s = String(iso).trim().replace(" ", "T").slice(0, 19);
    var dt = new Date(s);
    if (isNaN(dt.getTime())) return "—";
    var now = new Date();
    var dayMs = 86400000;
    var secs = Math.floor((now - dt) / 1000);
    if (secs < 3600 && secs >= 0) {
      var mins = Math.floor(secs / 60);
      return mins > 0 ? mins + " min ago" : "Just now";
    }
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var day = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    if (+day === +today) {
      return "Today " + String(dt.getHours()).padStart(2, "0") + ":" + String(dt.getMinutes()).padStart(2, "0");
    }
    var yesterday = new Date(today.getTime() - dayMs);
    if (+day === +yesterday) return "Yesterday";
    var deltaDays = Math.round((today - day) / dayMs);
    if (deltaDays > 1 && deltaDays < 7) return deltaDays + " days ago";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return dt.getDate() + " " + months[dt.getMonth()];
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
