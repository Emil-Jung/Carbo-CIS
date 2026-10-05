/* Carbo Print Labels — standalone utility boot (desktop app only). */
(function () {
  "use strict";

  var TOKEN_KEY = "cis_token";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var state = { config: null, token: null, user: null, permissions: [], activeModuleId: null };
  CIS._state = state;

  function token() { return state.token; }

  async function apiFetch(base, path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (token()) headers.Authorization = "Bearer " + token();
    var res = await fetch(base + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401 && state.config && base === state.config.identityApiBase) {
      doLogout(true);
      throw new Error("Session expired. Please sign in again.");
    }
    var data = null;
    var text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
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
      try { if (state.token) await CIS.api.identity("/auth/logout", { method: "POST" }); } catch (e) {}
      localStorage.removeItem(TOKEN_KEY);
      state.token = null;
      state.user = null;
      state.permissions = [];
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
    if (verEl) {
      var shell = (state.config && state.config.cisVersion) || CIS_VERSION_FALLBACK;
      var labels = CIS.printLabelsUiVersion || shell;
      verEl.textContent = "v" + shell + " · labels " + labels;
    }
    syncWindowTitle();
    openPrintLabelsModule();
  }
  CIS._showApp = showApp;
  var CIS_VERSION_FALLBACK = "?";

  function syncWindowTitle() {
    var shell = (state.config && state.config.cisVersion) || CIS_VERSION_FALLBACK;
    var labels = CIS.printLabelsUiVersion || shell;
    var title = "Carbo Print Labels  —  v" + shell + " · labels " + labels;
    document.title = title;
    var api = window.pywebview && window.pywebview.api;
    if (api && api.set_window_title) {
      Promise.resolve(api.set_window_title(title)).catch(function () {});
    }
  }

  async function boot() {
    try {
      state.config = await (await fetch("config.json", { cache: "no-store" })).json();
    } catch (e) {
      state.config = { identityApiBase: "/identity/api", traceabilityApiBase: "/traceability/api/v1" };
    }
    var shellRev = state.config && state.config.shellRev;
    if (shellRev) {
      var revKey = "cis_print_labels_shell_rev";
      var prevRev = localStorage.getItem(revKey);
      if (prevRev && prevRev !== shellRev) {
        localStorage.setItem(revKey, shellRev);
        var u = new URL(window.location.href);
        u.searchParams.set("shellRev", shellRev);
        window.location.replace(u.toString());
        return;
      }
      localStorage.setItem(revKey, shellRev);
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
        localStorage.removeItem(TOKEN_KEY);
        state.token = null;
      }
    }
    if (CIS.authUi) CIS.authUi.checkInviteAndShowLogin();
    else showLogin();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
