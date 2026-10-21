/* CIS shell cache guard — keep browsers on the deployed shell (config.json shellRev). */
(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  var REV_KEY = "cis_shell_rev";
  var FRESH_KEY = "cis_want_fresh_shell";
  var POLL_MS = 90000;

  function bootRev() {
    return (window.CIS_BOOT_SHELL_REV || "").trim();
  }

  function configUrl() {
    return "config.json?_=" + Date.now();
  }

  async function fetchRemoteShellRev() {
    var res = await fetch(configUrl(), { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) throw new Error("config.json HTTP " + res.status);
    var cfg = await res.json();
    return (cfg && cfg.shellRev) || "";
  }

  function hardReload(remoteRev, reason) {
    if (window.__cisShellReloading) return;
    window.__cisShellReloading = true;
    try {
      if (reason) sessionStorage.setItem("cis_shell_reload_reason", reason);
    } catch (e) {}
    var u = new URL(window.location.href);
    if (remoteRev) u.searchParams.set("shellRev", remoteRev);
    u.searchParams.set("_cisBust", String(Date.now()));
    window.location.replace(u.toString());
  }

  function showReloadOverlay(message) {
    if (document.getElementById("cis-shell-reload-overlay")) return;
    var d = document.createElement("div");
    d.id = "cis-shell-reload-overlay";
    d.setAttribute("role", "alert");
    d.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(12,12,12,0.92);color:#f5f5f5;display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center;font-size:1.05rem;line-height:1.45;";
    d.textContent = message || "CIS was updated on the server. Reloading…";
    (document.body || document.documentElement).appendChild(d);
  }

  async function clearBrowserCaches() {
    if (!("caches" in window)) return;
    try {
      var keys = await caches.keys();
      await Promise.all(
        keys.map(function (k) {
          if (/^cis-/i.test(k) || /^carbo-cis/i.test(k)) return caches.delete(k);
          return Promise.resolve(false);
        })
      );
    } catch (e) {
      /* best effort */
    }
  }

  function markFreshShellWantedOnExit() {
    try {
      localStorage.setItem(FRESH_KEY, String(Date.now()));
    } catch (e) {}
    clearBrowserCaches();
  }

  async function applyFreshShellIfRequested() {
    try {
      if (!localStorage.getItem(FRESH_KEY)) return false;
      localStorage.removeItem(FRESH_KEY);
    } catch (e) {
      return false;
    }
    if (/\b_cisBust=/.test(window.location.search)) return false;
    hardReload("", "fresh-after-close");
    return true;
  }

  async function ensureShellMatchesConfig(opts) {
    opts = opts || {};
    var remoteRev = "";
    try {
      remoteRev = await fetchRemoteShellRev();
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
    if (!remoteRev) return { ok: true, remoteRev: "" };

    var htmlRev = bootRev();
    if (htmlRev && htmlRev !== remoteRev) {
      if (/\b_cisBust=/.test(window.location.search)) {
        return { ok: false, error: "shellRev mismatch after reload", remoteRev: remoteRev };
      }
      if (opts.overlay) showReloadOverlay("New CIS version published. Loading fresh shell…");
      hardReload(remoteRev, "html-stale");
      return { ok: false, reloaded: true, remoteRev: remoteRev };
    }

    var stored = "";
    try {
      stored = localStorage.getItem(REV_KEY) || "";
    } catch (e2) {}

    if (stored && stored !== remoteRev) {
      try {
        localStorage.setItem(REV_KEY, remoteRev);
      } catch (e3) {}
      if (opts.overlay) showReloadOverlay("CIS updated — reloading…");
      hardReload(remoteRev, "rev-changed");
      return { ok: false, reloaded: true, remoteRev: remoteRev };
    }

    try {
      localStorage.setItem(REV_KEY, remoteRev);
    } catch (e4) {}

    return { ok: true, remoteRev: remoteRev };
  }

  function startShellRevWatch(runningRev) {
    runningRev = (runningRev || bootRev() || "").trim();
    if (!runningRev || window.__cisShellWatchStarted) return;
    window.__cisShellWatchStarted = true;

    var checking = false;
    async function tick() {
      if (checking || document.hidden) return;
      checking = true;
      try {
        var remoteRev = await fetchRemoteShellRev();
        if (remoteRev && runningRev && remoteRev !== runningRev) {
          showReloadOverlay(
            "A new CIS version is live (" +
              remoteRev +
              "). This tab will reload so you are not on an old screen."
          );
          window.setTimeout(function () {
            hardReload(remoteRev, "watch-stale");
          }, 800);
        }
      } catch (e) {
        /* ignore transient network errors */
      } finally {
        checking = false;
      }
    }

    window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) tick();
    });
    window.addEventListener("focus", tick);
  }

  function wireExitCacheClear() {
    window.addEventListener("pagehide", function (ev) {
      markFreshShellWantedOnExit();
    });
    window.addEventListener("beforeunload", function () {
      markFreshShellWantedOnExit();
    });
  }

  CIS.shellCache = {
    bootRev: bootRev,
    fetchRemoteShellRev: fetchRemoteShellRev,
    ensureShellMatchesConfig: ensureShellMatchesConfig,
    applyFreshShellIfRequested: applyFreshShellIfRequested,
    startShellRevWatch: startShellRevWatch,
    markFreshShellWantedOnExit: markFreshShellWantedOnExit,
    clearBrowserCaches: clearBrowserCaches,
    hardReload: hardReload,
  };

  wireExitCacheClear();
})();
