/* Truck registration — Namibian N-plate or fleet code (e.g. N3990OJ, COLLY1). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var NAMIBIA_TRUCK_REG_RE = /^N\d{1,6}[A-Z]{1,4}$/;
  var FLEET_TRUCK_REG_RE = /^[A-Z0-9]{2,15}$/;

  CIS.normalizeNamibiaTruckReg = function (raw, opts) {
    opts = opts || {};
    var required = !!opts.required;
    var text = String(raw == null ? "" : raw).trim();
    if (!text) {
      if (required) {
        throw new Error(
          "Enter truck registration (e.g. N3990OJ or fleet code COLLY1)."
        );
      }
      return "";
    }
    var cleaned = text.toUpperCase().replace(/[\s.\-_/]+/g, "");
    if (NAMIBIA_TRUCK_REG_RE.test(cleaned)) {
      return cleaned;
    }
    if (FLEET_TRUCK_REG_RE.test(cleaned) && /[A-Z]/.test(cleaned)) {
      return cleaned;
    }
    throw new Error(
      "Use Namibian format (e.g. N3990OJ) or a fleet code of 2–15 letters and numbers (e.g. COLLY1)."
    );
  };

  CIS.optionalNamibiaTruckReg = function (raw) {
    if (!String(raw || "").trim()) return null;
    return CIS.normalizeNamibiaTruckReg(raw, { required: true });
  };
})();