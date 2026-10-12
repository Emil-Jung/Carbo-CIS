/* Fixed viewport + zoom for Charcoal Tracker Deliveries grid. */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  var ZOOM_OPTS = [75, 90, 100, 110, 125];
  var STORAGE_KEY = "cis.deliveryTrackerZoom";

  function readZoom() {
    var z = parseInt(localStorage.getItem(STORAGE_KEY) || "90", 10);
    if (ZOOM_OPTS.indexOf(z) < 0) z = 90;
    return z;
  }

  /**
   * Wrap a <table> in a framed viewport (vertical + horizontal scroll inside the frame).
   * @returns {HTMLElement} frame root
   */
  CIS.wrapDeliveryTrackerTable = function (ui, table) {
    var zoom = readZoom();
    var frame = ui.el("div", { class: "delivery-conf-tracker-frame" });
    var bar = ui.el("div", { class: "delivery-conf-tracker-frame-bar" });
    bar.appendChild(ui.el("span", { class: "delivery-conf-tracker-frame-label" }, [
      "Deliveries sheet",
    ]));
    var zoomLabel = ui.el("label", { class: "delivery-conf-tracker-zoom-label" }, ["Zoom"]);
    var sel = ui.el("select", {
      class: "delivery-conf-tracker-zoom",
      title: "Make columns smaller or larger",
    });
    ZOOM_OPTS.forEach(function (p) {
      sel.appendChild(ui.el("option", { value: String(p) }, [p + "%"]));
    });
    sel.value = String(zoom);
    bar.appendChild(zoomLabel);
    bar.appendChild(sel);
    frame.appendChild(bar);

    var viewport = ui.el("div", { class: "delivery-conf-tracker-viewport" });
    var sheet = ui.el("div", {
      class: "delivery-conf-tracker-scroll delivery-conf-tracker-sheet",
      style: "--tracker-zoom: " + zoom / 100,
    });
    sheet.appendChild(table);
    viewport.appendChild(sheet);
    frame.appendChild(viewport);

    sel.addEventListener("change", function () {
      var v = parseInt(sel.value, 10);
      localStorage.setItem(STORAGE_KEY, String(v));
      sheet.style.setProperty("--tracker-zoom", String(v / 100));
    });

    return frame;
  };
})();
