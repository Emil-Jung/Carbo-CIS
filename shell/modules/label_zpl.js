/* Bag label ZPL — 203 dpi ZT231, 54×25 mm. Symbol layer swappable (QR now, GS1 Data Matrix later). */
(function (root) {
  "use strict";

  var MM_TO_DOTS_203 = 8; // 203 dpi ≈ 8 dots/mm

  var DEFAULT_SPEC = {
    dpi: 203,
    widthMm: 54,
    heightMm: 25,
    marginMm: 2.5,
    gapMm: 1.5,
    textReserveMm: 22,
    qrMag: 0,
    qrBoostMag: 0,
    symbol: "qr",
  };

  var TEST_SERIAL = "TEST-000001";
  var PHYSICAL_TEST_COUNT = 10;

  function mmToDots(mm, dpi) {
    return Math.round((mm * dpi) / 25.4);
  }

  function specToDots(spec) {
    var dpi = spec.dpi === 300 ? 300 : 203;
    return {
      dpi: dpi,
      pw: mmToDots(spec.widthMm, dpi),
      ll: mmToDots(spec.heightMm, dpi),
      margin: mmToDots(spec.marginMm, dpi),
      gap: mmToDots(spec.gapMm, dpi),
      textReserve: mmToDots(spec.textReserveMm, dpi),
      qrMag: parseInt(spec.qrMag, 10) || 0,
      symbol: spec.symbol === "datamatrix" ? "datamatrix" : "qr",
    };
  }

  /** What goes inside the 2D symbol — QR carries internal Bag ID only until GS1 is activated. */
  function symbolPayload(serial, spec) {
    var s = (serial || "").trim();
    if (spec.symbol === "datamatrix") {
      // Future: return GS1 element string from backend when GTIN exists — not used yet.
      return { kind: "datamatrix", data: s, field: "FD" };
    }
    return { kind: "qr", data: s, field: "QA" };
  }

  function estimateQrModules(dataLen) {
    if (dataLen <= 14) return 21;
    if (dataLen <= 20) return 25;
    if (dataLen <= 34) return 29;
    return 33;
  }

  function autoQrMag(payload, maxDots) {
    var modules = estimateQrModules(payload.length);
    var quietModules = 8;
    var mag = Math.floor(maxDots / (modules + quietModules));
    return Math.max(2, Math.min(mag, 10));
  }

  function qrPrintedSize(modules, mag) {
    return modules * mag;
  }

  function layoutLabel(serial, spec) {
    var s = Object.assign({}, DEFAULT_SPEC, spec || {});
    var d = specToDots(s);
    var payload = symbolPayload(serial, s);
    var usableW = d.pw - 2 * d.margin;
    var usableH = d.ll - 2 * d.margin;
    var mag = d.qrMag > 0 ? d.qrMag : autoQrMag(payload.data, Math.min(usableH, usableW - d.textReserve - d.gap));
    if (!d.qrMag && (s.qrBoostMag || 0) > 0) {
      mag = Math.min(mag + parseInt(s.qrBoostMag, 10), 10);
    }
    var modules = estimateQrModules(payload.data.length);
    var qrSize = qrPrintedSize(modules, mag);
    if (qrSize > usableH) {
      mag = Math.max(2, Math.floor(usableH / modules));
      qrSize = qrPrintedSize(modules, mag);
    }
    var maxQrW = usableW - d.textReserve - d.gap;
    if (qrSize > maxQrW) {
      mag = Math.max(2, Math.floor(maxQrW / modules));
      qrSize = qrPrintedSize(modules, mag);
    }
    var qrX = d.margin;
    var qrY = d.margin + Math.round((usableH - qrSize) / 2);
    var textX = qrX + qrSize + d.gap;
    var fontH = Math.min(32, Math.max(22, Math.round(usableH * 0.18)));
    var fontW = Math.round(fontH * 0.9);
    var textY = d.margin + Math.round((usableH - fontH) / 2);
    return {
      dots: d,
      payload: payload,
      mag: mag,
      qrX: qrX,
      qrY: qrY,
      qrSize: qrSize,
      textX: textX,
      textY: textY,
      fontH: fontH,
      fontW: fontW,
      serial: serial,
    };
  }

  function zplSymbolField(layout) {
    var p = layout.payload;
    var mag = layout.mag;
    if (p.kind === "datamatrix") {
      return "^FO" + layout.qrX + "," + layout.qrY + "^BXN,4," + mag + ",,,,_^FD" + p.data + "^FS";
    }
    return "^FO" + layout.qrX + "," + layout.qrY + "^BQN,2," + mag + "^FD" + p.field + "," + p.data + "^FS";
  }

  function zplOneLabel(serial, spec) {
    var layout = layoutLabel(serial, spec);
    var d = layout.dots;
    return (
      "^XA\n^CI28\n^PW" + d.pw + "\n^LL" + d.ll + "\n^LH0,0\n" +
      zplSymbolField(layout) + "\n" +
      "^FO" + layout.textX + "," + layout.textY +
      "^A0N," + layout.fontH + "," + layout.fontW + "^FD" + layout.serial + "^FS\n" +
      "^XZ\n"
    );
  }

  function zplBatch(serials, spec) {
    return (serials || []).map(function (s) { return zplOneLabel(s, spec); }).join("");
  }

  /** ~2–3 mm larger QR vs auto-only; keeps margins and vertical centring unchanged. */
  function physicalTestSpec(spec) {
    return Object.assign({}, spec || {}, { qrBoostMag: 1 });
  }

  function physicalTestSerials() {
    var out = [];
    for (var i = 1; i <= PHYSICAL_TEST_COUNT; i++) {
      out.push("TEST-" + String(i).padStart(6, "0"));
    }
    return out;
  }

  root.CIS_LABEL_ZPL = {
    DEFAULT_SPEC: DEFAULT_SPEC,
    TEST_SERIAL: TEST_SERIAL,
    PHYSICAL_TEST_COUNT: PHYSICAL_TEST_COUNT,
    mmToDots: mmToDots,
    specToDots: specToDots,
    symbolPayload: symbolPayload,
    layoutLabel: layoutLabel,
    zplOneLabel: zplOneLabel,
    zplBatch: zplBatch,
    physicalTestSpec: physicalTestSpec,
    physicalTestSerials: physicalTestSerials,
    zplTestLabel: function (spec) {
      return zplOneLabel(TEST_SERIAL, physicalTestSpec(spec));
    },
    zplPhysicalTestBatch: function (spec) {
      return zplBatch(physicalTestSerials(), physicalTestSpec(spec));
    },
  };
})(window);
