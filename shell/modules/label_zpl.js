/* Bag label ZPL — 203 dpi ZT231, 61×28 mm. Symbol layer swappable (QR now, GS1 Data Matrix later). */
(function (root) {
  "use strict";

  var DEFAULT_SPEC = {
    dpi: 203,
    widthMm: 61,
    heightMm: 28,
    marginMm: 2.5,
    gapMm: 1.5,
    textReserveMm: 27,
    qrMag: 0,
    qrBoostMag: 0,
    symbol: "qr",
  };

  /** Physically verified on ZT231 61×28 stock — do not change without a new physical test. */
  var PRODUCTION_QR_BOOST_MAG = 2;

  /** Nudge entire layout down on 28 mm face (QR + text together). ~1.5 mm @ 203 dpi. */
  var PRODUCTION_LAYOUT_Y_OFFSET_DOTS = 12;

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
    var textAreaW = Math.max(40, d.pw - d.margin - textX);
    var fontH = Math.min(28, Math.max(20, Math.round(usableH * 0.18)));
    var fontW = Math.round(fontH * 0.9);
    while (fontH > 18 && estimateTextWidth(serial, fontW) > textAreaW) {
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

  function zplOneLabel(serial, spec) {
    var layout = layoutLabel(serial, spec);
    var d = layout.dots;
    return (
      "^XA\n^CI28\n^PW" + d.pw + "\n^LL" + d.ll + "\n^LH0,0\n" +
      zplSymbolField(layout) + "\n" +
      zplTextField(layout) +
      "^XZ\n"
    );
  }

  function zplBatch(serials, spec) {
    return (serials || []).map(function (s) { return zplOneLabel(s, spec); }).join("");
  }

  function productionSpec(overrides) {
    return Object.assign(
      {
        dpi: 203,
        widthMm: 61,
        heightMm: 28,
        marginMm: 2.5,
        gapMm: 1.5,
        textReserveMm: 27,
        qrMag: 0,
        qrBoostMag: PRODUCTION_QR_BOOST_MAG,
        layoutYOffsetDots: PRODUCTION_LAYOUT_Y_OFFSET_DOTS,
        symbol: "qr",
      },
      overrides || {}
    );
  }

  root.CIS_LABEL_ZPL = {
    DEFAULT_SPEC: DEFAULT_SPEC,
    PRODUCTION_QR_BOOST_MAG: PRODUCTION_QR_BOOST_MAG,
    PRODUCTION_LAYOUT_Y_OFFSET_DOTS: PRODUCTION_LAYOUT_Y_OFFSET_DOTS,
    mmToDots: mmToDots,
    specToDots: specToDots,
    symbolPayload: symbolPayload,
    layoutLabel: layoutLabel,
    zplOneLabel: zplOneLabel,
    zplBatch: zplBatch,
    productionSpec: productionSpec,
  };
})(window);
