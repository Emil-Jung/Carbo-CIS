/* Drag the bottom-right Active operations panel by its title bar (desktop + touch). */
(function () {
  "use strict";

  var LS_KEY = "cis_float_ops_position_v1";
  var panel = document.getElementById("cis-float-ops");
  if (!panel) return;

  var dragging = false;
  var startX = 0;
  var startY = 0;
  var startL = 0;
  var startT = 0;

  function loadPos() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY));
    } catch (e) {
      return null;
    }
  }

  function savePos(left, top) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ l: left, t: top }));
    } catch (e) {}
  }

  function clearSavedPos() {
    try {
      localStorage.removeItem(LS_KEY);
    } catch (e) {}
  }

  function resetToDefaultCorner() {
    panel.classList.remove("cis-float-ops-panel--moved");
    panel.style.left = "";
    panel.style.top = "";
    panel.style.right = "";
    panel.style.bottom = "";
    clearSavedPos();
  }

  function applySavedPos() {
    var p = loadPos();
    if (!p || p.l == null || p.t == null) return;
    panel.classList.add("cis-float-ops-panel--moved");
    panel.style.left = p.l + "px";
    panel.style.top = p.t + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function ensureMovedCoords() {
    var rect = panel.getBoundingClientRect();
    if (!panel.classList.contains("cis-float-ops-panel--moved")) {
      panel.classList.add("cis-float-ops-panel--moved");
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }
    return {
      l: parseFloat(panel.style.left) || rect.left,
      t: parseFloat(panel.style.top) || rect.top,
    };
  }

  function clampPosition(left, top) {
    var w = panel.offsetWidth || 200;
    var h = panel.offsetHeight || 80;
    var maxL = Math.max(8, window.innerWidth - w - 8);
    var maxT = Math.max(8, window.innerHeight - h - 8);
    return {
      l: Math.max(8, Math.min(left, maxL)),
      t: Math.max(8, Math.min(top, maxT)),
    };
  }

  function titleFromEvent(e) {
    var t = e.target;
    if (!t || !t.closest) return null;
    return t.closest(".cis-float-ops-card__title");
  }

  panel.addEventListener("pointerdown", function (e) {
    if (!titleFromEvent(e)) return;
    if (e.button != null && e.button !== 0) return;
    var coords = ensureMovedCoords();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startL = coords.l;
    startT = coords.t;
    panel.classList.add("cis-float-ops-panel--dragging");
    if (titleFromEvent(e).setPointerCapture) {
      try {
        titleFromEvent(e).setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    e.preventDefault();
  });

  panel.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var next = clampPosition(startL + (e.clientX - startX), startT + (e.clientY - startY));
    panel.style.left = next.l + "px";
    panel.style.top = next.t + "px";
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove("cis-float-ops-panel--dragging");
    if (panel.classList.contains("cis-float-ops-panel--moved")) {
      savePos(parseFloat(panel.style.left) || 0, parseFloat(panel.style.top) || 0);
    }
    var title = titleFromEvent(e);
    if (title && title.releasePointerCapture) {
      try {
        title.releasePointerCapture(e.pointerId);
      } catch (err2) {}
    }
  }

  panel.addEventListener("pointerup", endDrag);
  panel.addEventListener("pointercancel", endDrag);

  panel.addEventListener(
    "dblclick",
    function (e) {
      if (!titleFromEvent(e)) return;
      resetToDefaultCorner();
    },
    true
  );

  applySavedPos();
})();
