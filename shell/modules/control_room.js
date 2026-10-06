/* Control Room — factory truck capture PWA embedded in CIS. */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function controlRoomUrl(ctx) {
    var cfg = (ctx && ctx.config) || {};
    var base = (cfg.controlRoomUrl || "/traceability/control-room/").trim();
    var join = base.indexOf("?") === -1 ? "?" : "&";
    var rev = (cfg.controlRoomRev || cfg.shellRev || "").trim();
    var url = base + join + "cis=1";
    if (rev) url += "&rev=" + encodeURIComponent(rev);
    return url;
  }

  function render(container, ctx) {
    CIS.embedAuthenticatedIframe(container, {
      title: "Control Room",
      src: controlRoomUrl(ctx),
    });
  }

  function syncControlRoomVisibility(cfg) {
    var mod = (CIS.modules || []).find(function (m) {
      return m.id === "control_room";
    });
    if (mod) mod.inactive = !(cfg && cfg.controlRoomLive === true);
  }

  CIS.syncControlRoomVisibility = syncControlRoomVisibility;

  CIS.modules.push({
    id: "control_room",
    title: "Control Room",
    section: "Production",
    kind: "app",
    order: 4,
    icon: "control",
    description: "Open trucks, factory scales, bag handoff (pilot — truck open blocked until server go-live)",
    requires: "traceability.control_room",
    inactive: true,
    render: render,
  });
})();
