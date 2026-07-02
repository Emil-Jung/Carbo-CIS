/* Quality viewer module — embeds the existing read-only Quality viewer PWA. */
(function () {
  "use strict";
  const CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function viewerUrl(ctx) {
    const cfg = (ctx && ctx.config) || {};
    const base = (cfg.qualityViewerUrl || "/quality/viewer/").trim();
    const join = base.indexOf("?") === -1 ? "?" : "&";
    return base + join + "cis=1";
  }

  function render(container, ctx) {
    container.innerHTML = "";
    container.classList.add("module-quality-host");

    const iframe = document.createElement("iframe");
    iframe.className = "module-iframe";
    iframe.title = "Quality viewer";
    iframe.src = viewerUrl(ctx);
    container.appendChild(iframe);

    function sendAuth() {
      const token = CIS.getToken && CIS.getToken();
      if (!token || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage({ type: "cis-auth", token: token }, "*");
    }

    iframe.addEventListener("load", sendAuth);
    setTimeout(sendAuth, 250);
    setTimeout(sendAuth, 1200);
  }

  CIS.modules.push({
    id: "quality_view",
    title: "Quality",
    section: "Production",
    kind: "lookup",
    order: 10,
    icon: "quality",
    description: "Read-only sieving data and producer summaries",
    requires: "quality.view",
    render,
  });
})();
