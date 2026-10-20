/* Carbo Print Labels — standalone utility boot (desktop app only). */
(function () {
  "use strict";

  var TOKEN_KEY = "cis_token";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var state = { config: null, token: null, user: null, permissions: [], activeModuleId: null };
  CIS._state = state;

  function token() { return state.token; }

  /** Never attach a stale Bearer to sign-in calls (was causing 401 → “session expired” loop). */
  var IDENTITY_ANON_PATHS = /^\/auth\/(login|set-initial-password|account-status)(\/|\?|$)/;

  function clearStoredSession() {
    localStorage.removeItem(TOKEN_KEY);
    state.token = null;
    state.user = null;
    state.permissions = [];
  }

  async function apiFetch(base, path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    var anonIdentity = state.config && base === state.config.identityApiBase && IDENTITY_ANON_PATHS.test(path);
    if (token() && !anonIdentity) headers.Authorization = "Bearer " + token();
    var res = await fetch(base + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    var data = null;
    var text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    if (res.status === 401 && state.config && base === state.config.identityApiBase) {
      if (anonIdentity) {
        var loginDetail = "Sign in failed — check user ID and password.";
        if (data && data.detail != null) {
          loginDetail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        }
        throw new Error(loginDetail);
      }
      clearStoredSession();
      showLogin();
      throw new Error("Session expired. Please sign in again.");
    }
    if (!res.ok) {
      var detail = "HTTP " + res.status;
      if (data && data.detail != null) {
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
      throw new Error(detail);
    }
    return data;
  }

  CIS.api = {
    identity: function (path, opts) { return apiFetch(state.config.identityApiBase, path, opts); },
    traceability: function (path, opts) {
      var base = (state.config && state.config.traceabilityApiBase) || "/traceability/api/v1";
      return apiFetch(base, path, opts);
    },
  };

  CIS.getToken = function () { return state.token || localStorage.getItem(TOKEN_KEY); };
  CIS.hasPermission = function (perm) { return state.permissions.indexOf(perm) !== -1; };
  CIS.currentUser = function () { return state.user; };

  CIS.ui = {
    el: function (tag, attrs, children) {
      var node = document.createElement(tag);
      if (attrs) Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2), attrs[k]);
        } else node.setAttribute(k, attrs[k]);
      });
      (children || []).forEach(function (c) {
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
      return node;
    },
    error: function (msg) {
      var d = document.createElement("div");
      d.className = "error-box";
      d.textContent = msg;
      return d;
    },
  };

  async function loadSession() {
    var me = await CIS.api.identity("/auth/me");
    state.user = { user_id: me.user_id, login_id: me.login_id, display_name: me.display_name };
    state.permissions = me.permissions || [];
  }
  CIS.refreshSession = loadSession;

  function showLogin() {
    if (CIS.authUi) CIS.authUi.showLoginView();
    else document.getElementById("login-view").classList.remove("hidden");
  }

  function doLogout(silent) {
    return (async function () {
      var hadToken = state.token;
      clearStoredSession();
      try {
        if (hadToken) await CIS.api.identity("/auth/logout", { method: "POST" });
      } catch (e) {}
      showLogin();
    })();
  }

  function openPrintLabelsModule() {
    var mod = CIS.modules.find(function (m) { return m.id === "print_labels"; });
    var content = document.getElementById("module-content");
    if (!mod) {
      content.textContent = "Print Labels module failed to load.";
      return;
    }
    if (!CIS.hasPermission("traceability.labels.print")) {
      content.innerHTML = "";
      content.appendChild(CIS.ui.error(
        "Your account does not have Print Labels permission. Ask an administrator to grant traceability.labels.print."
      ));
      return;
    }
    mod.render(content, { api: CIS.api, user: state.user, permissions: state.permissions, config: state.config });
  }

  function showApp() {
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("setup-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");
    document.getElementById("current-user").textContent =
      (state.user.display_name || state.user.login_id);
    var verEl = document.getElementById("app-version");
    function setFooterVersion(text, title) {
      if (!verEl) return;
      verEl.textContent = text;
      if (title) verEl.title = title;
    }
    if (verEl) {
      var shell = (state.config && state.config.cisVersion) || CIS_VERSION_FALLBACK;
      var labels = CIS.printLabelsUiVersion || shell;
      setFooterVersion("Labels UI " + labels + " · checking app…", "");
    }
    syncWindowTitle();
    var api = window.pywebview && window.pywebview.api;
    if (api && api.app_info) {
      Promise.resolve(api.app_info()).then(function (info) {
        if (!info) return;
        var labels = CIS.printLabelsUiVersion || "?";
        var build = info.build || "?";
        var mode = info.shell_mode === "bundled" ? "bundled installer" : "legacy";
        var rel = CIS.printLabelsReleaseId || "";
        var line =
          "App " +
          (info.version || "?") +
          " · " +
          build +
          " · labels " +
          labels +
          (rel ? " · " + rel : "") +
          " · " +
          mode;
        setFooterVersion(line, line);
      }).catch(function () {
        setFooterVersion("Labels UI " + (CIS.printLabelsUiVersion || "?") + " · app info unavailable", "");
      });
    }
    openPrintLabelsModule();
  }
  CIS._showApp = showApp;
  var CIS_VERSION_FALLBACK = "?";

  function syncWindowTitle() {
    document.title = "Carbo Print Labels";
    var api = window.pywebview && window.pywebview.api;
    if (api && api.set_window_title) {
      Promise.resolve(api.set_window_title("Carbo Print Labels")).catch(function () {});
    }
  }

  async function boot() {
    try {
      state.config = await (await fetch("config.json", { cache: "no-store" })).json();
    } catch (e) {
      state.config = { identityApiBase: "/identity/api", traceabilityApiBase: "/traceability/api/v1" };
    }
    syncWindowTitle();

    state.token = localStorage.getItem(TOKEN_KEY);
    if (CIS.authUi) CIS.authUi.wireAuthForms();
    document.getElementById("logout-btn").addEventListener("click", function () { doLogout(false); });

    if (state.token) {
      try {
        await loadSession();
        showApp();
        return;
      } catch (e) {
        clearStoredSession();
      }
    }
    if (CIS.authUi) CIS.authUi.checkInviteAndShowLogin();
    else showLogin();
  }

  function warnIfBrowserTab() {
    var host = (window.location.hostname || "").toLowerCase();
    if (host === "127.0.0.1" || host === "localhost") return;
    window.setTimeout(function () {
      var trap = document.getElementById("pl-browser-trap");
      if (!trap) return;
      var title = trap.querySelector("h2");
      var body = trap.querySelector(".print-labels-browser-trap__body");
      if (window.pywebview && window.pywebview.api) {
        if (title) title.textContent = "Wrong build — reinstall Print Labels";
        if (body) {
          body.innerHTML =
            "<p>This install is loading the website instead of the bundled app. Printers will not work reliably.</p>" +
            "<p>Run <strong>CarboPrintLabels-Setup.exe</strong> on this PC, then open the Start menu shortcut again.</p>";
        }
      }
      trap.classList.remove("hidden");
    }, 1200);
  }

  function paintLoginBuildHint() {
    var hint = document.getElementById("login-build-hint");
    if (!hint) return;
    var labels = CIS.printLabelsUiVersion || "?";
    var rel = CIS.printLabelsReleaseId || "";
    hint.textContent =
      (rel ? "Release " + rel + " · " : "") +
      "UI " +
      labels +
      " · desktop shortcut = Start menu · status bar after sign-in";
  }

  document.addEventListener("DOMContentLoaded", function () {
    paintLoginBuildHint();
    warnIfBrowserTab();
    boot();
  });
})();
