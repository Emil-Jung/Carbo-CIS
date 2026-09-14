/* Control Room — factory truck capture PWA embedded in CIS. */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function controlRoomUrl(ctx) {
    var cfg = (ctx && ctx.config) || {};
    var base = (cfg.controlRoomUrl || "/traceability/control-room/").trim();
    var join = base.indexOf("?") === -1 ? "?" : "&";
    return base + join + "cis=1";
  }

  function render(container, ctx) {
    CIS.embedAuthenticatedIframe(container, {
      title: "Control Room",
      src: controlRoomUrl(ctx),
    });
  }

  CIS.modules.push({
    id: "control_room",
    title: "Control Room",
    kind: "app",
    icon: "traceability",
    description: "Open trucks, factory scales, bag handoff",
    requires: "traceability.control_room",
    render: render,
  });
})();
