/* Bag label ZPL — 203 dpi ZT231. productionSpec() = 54×25 mm (legacy stock); productionSpec6128() = 61×28. */
(function (root) {
  "use strict";

  var DEFAULT_SPEC = {
    dpi: 203,
    widthMm: 54,
    heightMm: 25,
    marginMm: 2.5,
    gapMm: 1.5,
    textReserveMm: 22,
    qrMag: 0,
    qrBoostMag: 0,
    qrLeftInsetMm: 0,
    layoutYOffsetDots: 0,
    symbol: "qr",
  };

  /** +1 QR module size on 54×25 — alignment test batch (Sep 2026). */
  var PRODUCTION_54_QR_BOOST_MAG = 2;

  /** Physically verified on ZT231 61×28 stock — use productionSpec6128() when that stock is loaded. */
  var STOCK_6128_QR_BOOST_MAG = 2;
  var STOCK_6128_LAYOUT_Y_OFFSET_DOTS = 12;
  var STOCK_6128_QR_LEFT_INSET_MM = 1.5;

  /** Zebra ~SD darkness 00–30 (higher = darker). 30 + slow print for dull USB/legacy stock. */
  var PRODUCTION_DARKNESS = 30;

  /** Print speed (ips) — 1 ips = darkest reliable output on ZT231 legacy stock. */
  var PRODUCTION_PRINT_SPEED = 1;
  var PRODUCTION_SLEW_SPEED = 1;

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

  function symbolPayload(serial, spec) {
    var s = (serial || "").trim();
    if (spec.symbol === "datamatrix") {
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

  function estimateTextWidth(text, fontW) {
    return (text || "").length * fontW * 0.58;
  }

  function layoutLabel(serial, spec) {
    var s = Object.assign({}, DEFAULT_SPEC, spec || {});
    var d = specToDots(s);
    var payload = symbolPayload(serial, s);
    var qrLeftInset = mmToDots(parseFloat(s.qrLeftInsetMm) || 0, d.dpi);
    var usableW = d.pw - 2 * d.margin;
    var usableH = d.ll - 2 * d.margin;
    var mag = d.qrMag > 0 ? d.qrMag : autoQrMag(
      payload.data,
      Math.min(usableH, usableW - d.textReserve - d.gap - qrLeftInset)
    );
    if (!d.qrMag && (s.qrBoostMag || 0) > 0) {
      mag = Math.min(mag + parseInt(s.qrBoostMag, 10), 10);
    }
    var modules = estimateQrModules(payload.data.length);
    var qrSize = qrPrintedSize(modules, mag);
    if (qrSize > usableH) {
      mag = Math.max(2, Math.floor(usableH / modules));
      qrSize = qrPrintedSize(modules, mag);
    }
    var maxQrW = usableW - d.textReserve - d.gap - qrLeftInset;
    if (qrSize > maxQrW) {
      mag = Math.max(2, Math.floor(maxQrW / modules));
      qrSize = qrPrintedSize(modules, mag);
    }
    var qrX = d.margin + qrLeftInset;
    var qrY = d.margin + Math.round((usableH - qrSize) / 2);
    var textX = qrX + qrSize + d.gap;
    var textAreaW = Math.max(40, d.pw - d.margin - textX);
    var fontMax = s.heightMm <= 25 ? 26 : 28;
    var fontMin = s.heightMm <= 25 ? 18 : 20;
    var fontH = Math.min(fontMax, Math.max(fontMin, Math.round(usableH * 0.18)));
    var fontW = Math.round(fontH * 0.9);
    while (fontH > fontMin && estimateTextWidth(serial, fontW) > textAreaW) {
      fontH -= 1;
      fontW = Math.round(fontH * 0.9);
    }
    var textY = d.margin + Math.round((usableH - fontH) / 2);
    var yOffset = parseInt(s.layoutYOffsetDots, 10) || 0;
    qrY += yOffset;
    textY += yOffset;
    return {
      dots: d,
      payload: payload,
      mag: mag,
      qrX: qrX,
      qrY: qrY,
      qrSize: qrSize,
      textX: textX,
      textY: textY,
      textAreaW: textAreaW,
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

  function zplTextField(layout) {
    return (
      "^FO" + layout.textX + "," + layout.textY +
      "^A0N," + layout.fontH + "," + layout.fontW +
      "^FB" + layout.textAreaW + ",1,0,L,0^FD" + layout.serial + "^FS\n"
    );
  }

  function parsedDarkness(spec) {
    if (!spec || spec.darkness === false || spec.darkness === null || spec.darkness === "") {
      return null;
    }
    var sd = parseInt(spec.darkness, 10);
    if (isNaN(sd)) return null;
    return Math.max(0, Math.min(30, sd));
  }

  function _sdCommand(sd) {
    return "~SD" + (sd < 10 ? "0" + sd : String(sd)) + "\n";
  }

  /** Start of a multi-label job (USB RAW spooler doc or one LAN socket). */
  function zplJobPreamble(spec) {
    var sd = parsedDarkness(spec);
    if (sd === null) return "";
    return _sdCommand(sd);
  }

  function zplInLabelTuning(spec) {
    var sd = parsedDarkness(spec);
    var printSp = parseInt(spec && spec.printSpeed, 10);
    var slewSp = parseInt(spec && spec.slewSpeed, 10);
    if (isNaN(printSp)) printSp = PRODUCTION_PRINT_SPEED;
    if (isNaN(slewSp)) slewSp = PRODUCTION_SLEW_SPEED;
    printSp = Math.max(1, Math.min(12, printSp));
    slewSp = Math.max(1, Math.min(12, slewSp));
    var out = "^PR" + printSp + "," + slewSp + "\n";
    if (sd !== null) {
      out += _sdCommand(sd);
      out += "^MD30\n";
    }
    return out;
  }

  function zplOneLabelFormat(serial, spec) {
    var layout = layoutLabel(serial, spec);
    var d = layout.dots;
    var sd = parsedDarkness(spec);
    var beforeXa = sd !== null ? _sdCommand(sd) : "";
    return (
      beforeXa +
      "^XA\n^CI28\n" +
      zplInLabelTuning(spec) +
      "^PW" + d.pw + "\n^LL" + d.ll + "\n^LH0,0\n" +
      zplSymbolField(layout) + "\n" +
      zplTextField(layout) +
      "^XZ\n"
    );
  }

  function zplOneLabel(serial, spec) {
    return zplJobPreamble(spec) + zplOneLabelFormat(serial, spec);
  }

  function zplBatch(serials, spec) {
    var list = serials || [];
    if (!list.length) return "";
    return zplJobPreamble(spec) + list.map(function (s) { return zplOneLabelFormat(s, spec); }).join("");
  }

  /** Active production — 54×25 mm legacy stock (ZT231). */
  function productionSpec(overrides) {
    return Object.assign(
      {
        dpi: 203,
        widthMm: 54,
        heightMm: 25,
        marginMm: 2.5,
        gapMm: 1.5,
        textReserveMm: 22,
        qrMag: 0,
        qrBoostMag: PRODUCTION_54_QR_BOOST_MAG,
        qrLeftInsetMm: 0,
        layoutYOffsetDots: 0,
        darkness: PRODUCTION_DARKNESS,
        printSpeed: PRODUCTION_PRINT_SPEED,
        slewSpeed: PRODUCTION_SLEW_SPEED,
        symbol: "qr",
      },
      overrides || {}
    );
  }

  /** When 61×28 mm stock is loaded — switch print_labels.js to call this instead of productionSpec(). */
  function productionSpec6128(overrides) {
    return Object.assign(
      {
        dpi: 203,
        widthMm: 61,
        heightMm: 28,
        marginMm: 2.5,
        gapMm: 1.5,
        textReserveMm: 27,
        qrMag: 0,
        qrBoostMag: STOCK_6128_QR_BOOST_MAG,
        qrLeftInsetMm: STOCK_6128_QR_LEFT_INSET_MM,
        layoutYOffsetDots: STOCK_6128_LAYOUT_Y_OFFSET_DOTS,
        darkness: 22,
        printSpeed: PRODUCTION_PRINT_SPEED,
        slewSpeed: PRODUCTION_SLEW_SPEED,
        symbol: "qr",
      },
      overrides || {}
    );
  }

  root.CIS_LABEL_ZPL = {
    DEFAULT_SPEC: DEFAULT_SPEC,
    PRODUCTION_54_QR_BOOST_MAG: PRODUCTION_54_QR_BOOST_MAG,
    PRODUCTION_DARKNESS: PRODUCTION_DARKNESS,
    mmToDots: mmToDots,
    specToDots: specToDots,
    symbolPayload: symbolPayload,
    layoutLabel: layoutLabel,
    zplOneLabel: zplOneLabel,
    zplOneLabelFormat: zplOneLabelFormat,
    zplBatch: zplBatch,
    zplJobPreamble: zplJobPreamble,
    productionSpec: productionSpec,
    productionSpec6128: productionSpec6128,
  };
})(window);
