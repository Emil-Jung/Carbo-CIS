/* Namibian horse registration — N + digits + region letters (e.g. N3990OJ). */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  var NAMIBIA_TRUCK_REG_RE = /^N\d{1,6}[A-Z]{1,4}$/;

  CIS.normalizeNamibiaTruckReg = function (raw, opts) {
    opts = opts || {};
    var required = !!opts.required;
    var text = String(raw == null ? "" : raw).trim();
    if (!text) {
      if (required) {
        throw new Error(
          "Enter truck registration — N, then numbers, then region letters (e.g. N3990OJ)."
        );
      }
      return "";
    }
    var cleaned = text.toUpperCase().replace(/[\s.\-_/]+/g, "");
    if (!NAMIBIA_TRUCK_REG_RE.test(cleaned)) {
      throw new Error(
        "Use Namibian format: N, then numbers, then region letters (e.g. N3990OJ). " +
          "No spaces or full stops after N."
      );
    }
    return cleaned;
  };

  CIS.optionalNamibiaTruckReg = function (raw) {
    if (!String(raw || "").trim()) return null;
    return CIS.normalizeNamibiaTruckReg(raw, { required: true });
  };
})();