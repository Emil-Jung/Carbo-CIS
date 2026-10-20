/* Bag label ZPL — 203 dpi ZT231. productionSpec6128() = 62×28 mm (standard); productionSpec() = 54×25 legacy. */
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
    contentShiftMm: 0,
    layoutYOffsetDots: 0,
    symbol: "qr",
  };

  /** Larger QR modules = more heat per cell on dull 54×25 stock. */
  var PRODUCTION_54_QR_BOOST_MAG = 4;

  /** Physically verified on ZT231 62×28 stock — productionSpec6128(); ^PW/^LL set from widthMm/heightMm only. */
  var STOCK_6128_QR_BOOST_MAG = 2;
  /** Center QR + serial on the physical label (does not change QR mag / font size). */
  var STOCK_6128_CENTER_BLOCK = true;
  /** Move QR + serial down on physical 62×28 stock (mm → dots at 203 dpi). */
  var STOCK_6128_LAYOUT_Y_OFFSET_MM = 3;
  var STOCK_6128_LAYOUT_Y_OFFSET_DOTS = mmToDots(STOCK_6128_LAYOUT_Y_OFFSET_MM, 203);
  /** Print strength only (~SD / ^MD) — not layout size. UI/CSS changes do not touch these; only rebuild ships new values. */
  var STOCK_6128_DARKNESS = 24;
  var STOCK_6128_MEDIA_DARKNESS = 10;

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
    var qrLeftInset = s.centerContentBlock
      ? 0
      : mmToDots(parseFloat(s.qrLeftInsetMm) || 0, d.dpi);
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
    var fontMax = s.heightMm <= 25 ? 26 : 28;
    var fontMin = s.heightMm <= 25 ? 18 : 20;
    var fontH = Math.min(fontMax, Math.max(fontMin, Math.round(usableH * 0.18)));
    var fontW = Math.round(fontH * 0.9);
    var textAreaW = Math.max(40, usableW - qrSize - d.gap - qrLeftInset);
    while (fontH > fontMin && estimateTextWidth(serial, fontW) > textAreaW) {
      fontH -= 1;
      fontW = Math.round(fontH * 0.9);
    }
    var qrX;
    var qrY;
    var textX;
    var textY;
    var yOffset = parseInt(s.layoutYOffsetDots, 10) || 0;
    if (s.centerContentBlock) {
      var textPrintW = Math.min(textAreaW, Math.ceil(estimateTextWidth(serial, fontW)));
      var blockW = qrSize + d.gap + textPrintW;
      var biasR = mmToDots(parseFloat(s.contentBiasRightMm) || 0, d.dpi);
      var startX = Math.round((d.pw - blockW) / 2) + biasR;
      var maxStart = d.pw - d.margin - blockW;
      startX = Math.max(d.margin, Math.min(startX, maxStart));
      qrX = startX;
      textX = qrX + qrSize + d.gap;
      textAreaW = Math.max(40, d.pw - d.margin - textX);
      var blockH = Math.max(qrSize, fontH);
      var blockTop = d.margin + Math.round((usableH - blockH) / 2);
      qrY = blockTop + Math.round((blockH - qrSize) / 2);
      textY = blockTop + Math.round((blockH - fontH) / 2);
      qrY += yOffset;
      textY += yOffset;
    } else {
      qrX = d.margin + qrLeftInset;
      qrY = d.margin + Math.round((usableH - qrSize) / 2);
      textX = qrX + qrSize + d.gap;
      textAreaW = Math.max(40, d.pw - d.margin - textX);
      textY = d.margin + Math.round((usableH - fontH) / 2);
      qrY += yOffset;
      textY += yOffset;
      var contentShift = mmToDots(parseFloat(s.contentShiftMm) || 0, d.dpi);
      if (contentShift > 0) {
        var maxShift = Math.max(0, d.pw - d.margin - textX - textAreaW);
        contentShift = Math.min(contentShift, maxShift);
        qrX += contentShift;
        textX += contentShift;
      }
    }
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
      textDoubleStroke: s.textDoubleStroke !== false,
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
    var h = layout.fontH;
    var strokeW = layout.textDoubleStroke ? layout.fontW + 2 : layout.fontW;
    var w = Math.min(999, strokeW);
    var x = layout.textX;
    var y = layout.textY;
    var fb = "^FB" + layout.textAreaW + ",1,0,L,0^FD" + layout.serial + "^FS\n";
    var line = "^FO" + x + "," + y + "^A0N," + h + "," + w + fb;
    if (layout.textDoubleStroke) {
      line += "^FO" + (x + 1) + "," + y + "^A0N," + h + "," + w + fb;
    }
    return line;
  }

  function parsedDarkness(spec) {
    if (!spec || spec.darkness === false || spec.darkness === null || spec.darkness === "") {
      return null;
    }
    var sd = parseInt(spec.darkness, 10);
    if (isNaN(sd)) return null;
    return Math.max(0, Math.min(30, sd));
  }

  function parsedMediaDarkness(spec) {
    if (!spec || spec.mediaDarkness === false || spec.mediaDarkness === null || spec.mediaDarkness === "") {
      return 30;
    }
    var md = parseInt(spec.mediaDarkness, 10);
    if (isNaN(md)) return 30;
    return Math.max(-30, Math.min(30, md));
  }

  function _sdCommand(sd) {
    return "~SD" + (sd < 10 ? "0" + sd : String(sd)) + "\n";
  }

  /** Once per USB RAW job — avoid repeating ~SD on every label (ZT231 can print lighter). */
  function zplJobPreamble(spec) {
    var sd = parsedDarkness(spec);
    if (sd === null) return "";
    var printSp = parseInt(spec && spec.printSpeed, 10);
    var slewSp = parseInt(spec && spec.slewSpeed, 10);
    if (isNaN(printSp)) printSp = PRODUCTION_PRINT_SPEED;
    if (isNaN(slewSp)) slewSp = PRODUCTION_SLEW_SPEED;
    printSp = Math.max(1, Math.min(12, printSp));
    slewSp = Math.max(1, Math.min(12, slewSp));
    var md = parsedMediaDarkness(spec);
    var mdStr = md < 0 ? String(md) : (md < 10 ? "0" + md : String(md));
    return (
      _sdCommand(sd) +
      "^MD" + mdStr + "\n" +
      "^PR" + printSp + "," + slewSp + "\n"
    );
  }

  function zplInLabelTuning(spec) {
    var sd = parsedDarkness(spec);
    if (sd === null) return "";
    var md = parsedMediaDarkness(spec);
    var mdStr = md < 0 ? String(md) : (md < 10 ? "0" + md : String(md));
    return "^MD" + mdStr + "\n";
  }

  function zplOneLabelFormat(serial, spec) {
    var layout = layoutLabel(serial, spec);
    var d = layout.dots;
    return (
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
        qrLeftInsetMm: 1,
        contentShiftMm: 2,
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
        widthMm: 62,
        heightMm: 28,
        marginMm: 2.5,
        gapMm: 1.5,
        textReserveMm: 27,
        qrMag: 0,
        qrBoostMag: STOCK_6128_QR_BOOST_MAG,
        centerContentBlock: STOCK_6128_CENTER_BLOCK,
        contentBiasRightMm: 0,
        qrLeftInsetMm: 0,
        contentShiftMm: 0,
        layoutYOffsetDots: STOCK_6128_LAYOUT_Y_OFFSET_DOTS,
        darkness: STOCK_6128_DARKNESS,
        mediaDarkness: STOCK_6128_MEDIA_DARKNESS,
        textDoubleStroke: false,
        printSpeed: PRODUCTION_PRINT_SPEED,
        slewSpeed: PRODUCTION_SLEW_SPEED,
        symbol: "qr",
      },
      overrides || {}
    );
  }

  function labelDimensions(spec) {
    var s = spec || productionSpec6128();
    var d = specToDots(s);
    return {
      widthMm: s.widthMm,
      heightMm: s.heightMm,
      pw: d.pw,
      ll: d.ll,
      dpi: d.dpi,
    };
  }

  root.CIS_LABEL_ZPL = {
    DEFAULT_SPEC: DEFAULT_SPEC,
    PRODUCTION_54_QR_BOOST_MAG: PRODUCTION_54_QR_BOOST_MAG,
    PRODUCTION_DARKNESS: PRODUCTION_DARKNESS,
    mmToDots: mmToDots,
    specToDots: specToDots,
    symbolPayload: symbolPayload,
    layoutLabel: layoutLabel,
    labelDimensions: labelDimensions,
    zplOneLabel: zplOneLabel,
    zplOneLabelFormat: zplOneLabelFormat,
    zplBatch: zplBatch,
    zplJobPreamble: zplJobPreamble,
    productionSpec: productionSpec,
    productionSpec6128: productionSpec6128,
  };
})(window);
