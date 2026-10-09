/* Carbo Integrated System — shell.

 * Handles login, session token, and permission-gated module loading.

 * Modules register themselves on window.CIS.modules before this runs. */

(function () {

  "use strict";



  const TOKEN_KEY = "cis_token";

  const CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];



  const state = { config: null, token: null, user: null, permissions: [], activeModuleId: null };
  CIS._state = state;

  const floatNavState = { secondary: null };
  const navStack = ["dashboard"];

  /** Parent hub for hierarchical back (module.parentModule overrides). */
  const MODULE_PARENTS = {
    labels: "traceability",
    print_labels: "labels",
    label_deployment: "labels",
    control_room: "traceability",
    delivery_confirmations: "traceability",
    containers: "traceability",
    movement_schedule: "traceability",
    pallet_configuration: "traceability",
    manager_override: "traceability",
    bag_stock: "traceability",
  };

  function getModuleParent(moduleId) {
    const mod = CIS.modules.find(function (m) { return m.id === moduleId; });
    if (mod && mod.parentModule) return mod.parentModule;
    return MODULE_PARENTS[moduleId] || null;
  }

  function moduleNavTitle(moduleId) {
    if (moduleId === "dashboard") return "Dashboard";
    const mod = CIS.modules.find(function (m) { return m.id === moduleId; });
    return mod && mod.title ? mod.title : moduleId;
  }

  function ensureDashboardRoot() {
    if (navStack.length === 0 || navStack[0] !== "dashboard") {
      navStack.length = 0;
      navStack.push("dashboard");
    }
  }

  function pushNavigation(id) {
    if (!id || id === "dashboard") return;
    ensureDashboardRoot();
    const top = navStack[navStack.length - 1];
    if (top === id) return;

    const idx = navStack.indexOf(id);
    if (idx >= 0) {
      navStack.length = idx + 1;
      return;
    }

    const parent = getModuleParent(id);
    if (top === "dashboard" || parent === top) {
      navStack.push(id);
      return;
    }

    navStack.length = 1;
    navStack.push(id);
  }

  function navigationParentId() {
    if (navStack.length > 1) return navStack[navStack.length - 2];
    return "dashboard";
  }

  function navigationBackLabel() {
    return "Back";
  }

  function popNavigation() {
    ensureDashboardRoot();
    if (navStack.length <= 1) {
      showDashboard({ skipStackPush: true });
      return;
    }
    navStack.pop();
    const prevId = navStack[navStack.length - 1];
    if (prevId === "dashboard") showDashboard({ skipStackPush: true });
    else openModule(prevId, { skipStackPush: true });
  }

  function goBack() {
    if (floatNavState.secondary && typeof floatNavState.secondary.onClick === "function") {
      floatNavState.secondary.onClick();
      return;
    }
    popNavigation();
  }

  function goBackToParent() {
    popNavigation();
  }

  function goHome() {
    navStack.length = 0;
    navStack.push("dashboard");
    showDashboard({ skipStackPush: true });
  }

  CIS.goBack = goBack;
  CIS.goHome = goHome;
  CIS.goBackToParent = goBackToParent;

  function floatNavEl() {
    return document.getElementById("cis-float-nav");
  }

  /** One step back: in-module drill (setFloatingBack) first, else previous module on the stack. */
  function floatBackStepLabel() {
    return "Back";
  }

  function renderFloatNav() {
    const nav = floatNavEl();
    const content = document.getElementById("module-content");
    if (!nav) return;

    const onDashboard = !state.activeModuleId || state.activeModuleId === "dashboard";
    nav.innerHTML = "";
    nav.classList.add("hidden");
    nav.setAttribute("aria-hidden", "true");
    if (content) {
      content.classList.remove("has-float-nav");
      content.classList.remove("has-float-nav--stacked");
      content.classList.remove("has-float-nav--deep");
    }

    if (onDashboard) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cis-float-back-btn";
    btn.textContent = floatBackStepLabel();
    btn.title = "Back one step";
    btn.setAttribute("aria-label", floatBackStepLabel());
    btn.addEventListener("click", goBack);
    nav.appendChild(btn);

    nav.classList.remove("hidden");
    nav.setAttribute("aria-hidden", "false");
    if (content) content.classList.add("has-float-nav");
  }

  function setFloatingBack(opts) {
    if (opts && typeof opts.onClick === "function") {
      floatNavState.secondary = { label: opts.label, onClick: opts.onClick };
    } else {
      floatNavState.secondary = null;
    }
    renderFloatNav();
  }

  CIS.setFloatingBack = setFloatingBack;



  // ---- API helpers -----------------------------------------------------

  function token() { return state.token; }



  async function apiFetch(base, path, opts) {

    opts = opts || {};

    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});

    if (token()) headers["Authorization"] = "Bearer " + token();

    const res = await fetch(base + path, {

      method: opts.method || "GET",

      headers,

      body: opts.body != null ? JSON.stringify(opts.body) : undefined,

    });

    if (res.status === 401) {

      const identityBase = state.config && state.config.identityApiBase;

      if (identityBase && base === identityBase) {

        doLogout(true);

        throw new Error("Session expired. Please sign in again.");

      }

    }

    let data = null;

    const text = await res.text();

    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }

    if (!res.ok) {

      let detail = "HTTP " + res.status;

      if (data && data.detail != null) {

        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);

      }

      throw new Error(detail);

    }

    return data;

  }



  CIS.api = {

    identity: (path, opts) => apiFetch(state.config.identityApiBase, path, opts),

    maintenance: (path, opts) => apiFetch(state.config.maintenanceApiBase, path, opts),

    quality: (path, opts) => apiFetch(state.config.qualityApiBase || "/quality/api", path, opts),

    producers: (path, opts) => apiFetch(state.config.producersApiBase || "/producers/api", path, opts),

    qualityReports: (path, opts) => apiFetch(state.config.qualityReportsApiBase || "/quality/reports/api", path, opts),

    supplierTracking: (path, opts) =>
      apiFetch(state.config.supplierTrackingApiBase || "/supplier-tracking/api", path, opts),

    traceability: (path, opts) => {
      const base = (state.config && state.config.traceabilityApiBase) || "/traceability/api/v1";
      return apiFetch(base, path, opts);
    },

  };

  CIS.getToken = () => state.token || localStorage.getItem(TOKEN_KEY);

  CIS.hasPermission = (perm) => state.permissions.indexOf(perm) !== -1;

  CIS.currentUser = () => state.user;



  function canAccessModule(mod) {

    if (mod.requiresAny && mod.requiresAny.length) {
      return mod.requiresAny.some(function (p) { return CIS.hasPermission(p); });
    }

    return !mod.requires || CIS.hasPermission(mod.requires);

  }

  CIS.canAccessModule = canAccessModule;



  function allModules() {

    return CIS.modules.slice();

  }

  CIS.allModules = allModules;

  CIS.visibleModules = allModules;



  // ---- Boot ------------------------------------------------------------

  function stashStartupModule() {
    var params = new URLSearchParams(window.location.search);
    var mod = (params.get("module") || "").trim();
    if (!mod) return;
    sessionStorage.setItem("cis_startup_module", mod);
    if (history.replaceState) {
      var u = new URL(window.location.href);
      u.searchParams.delete("module");
      history.replaceState(null, "", u.toString());
    }
  }

  function takeStartupModule() {
    var mod = sessionStorage.getItem("cis_startup_module");
    if (mod) sessionStorage.removeItem("cis_startup_module");
    return mod;
  }

  function openStartupModuleIfAny() {
    var mod = takeStartupModule();
    if (!mod) return false;
    var found = CIS.modules.find(function (m) { return m.id === mod; });
    if (!found) return false;
    openModule(mod);
    return true;
  }

  async function boot() {

    stashStartupModule();

    try {

      state.config = await (await fetch("config.json", { cache: "no-store" })).json();

    } catch (e) {

      state.config = { identityApiBase: "/identity/api", maintenanceApiBase: "/maintenance/api" };

    }

    if (CIS.syncControlRoomVisibility) CIS.syncControlRoomVisibility(state.config);

    var shellRev = state.config && state.config.shellRev;
    if (shellRev) {
      var revKey = "cis_shell_rev";
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

    state.token = localStorage.getItem(TOKEN_KEY);

    if (CIS.authUi) CIS.authUi.wireAuthForms();

    document.getElementById("logout-btn").addEventListener("click", () => doLogout(false));

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



  async function loadSession() {

    const me = await CIS.api.identity("/auth/me");

    state.user = { user_id: me.user_id, login_id: me.login_id, display_name: me.display_name };

    state.permissions = me.permissions || [];

  }

  CIS.refreshSession = loadSession;



  // ---- Login / logout --------------------------------------------------

  async function doLogout(silent) {

    try { if (state.token) await CIS.api.identity("/auth/logout", { method: "POST" }); } catch (e) {}

    localStorage.removeItem(TOKEN_KEY);

    state.token = null; state.user = null; state.permissions = []; state.activeModuleId = null;
    navStack.length = 0;
    navStack.push("dashboard");

    showLogin();

  }



  // ---- Views -----------------------------------------------------------

  function showLogin() {
    if (CIS.authUi) {
      CIS.authUi.showLoginView();
      return;
    }
    document.getElementById("app-view").classList.add("hidden");
    document.getElementById("login-view").classList.remove("hidden");
    document.getElementById("login-id").focus();
  }



  function showApp() {

    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("setup-view").classList.add("hidden");

    document.getElementById("app-view").classList.remove("hidden");

    document.getElementById("current-user").textContent =

      (state.user.display_name || state.user.login_id);

    const verEl = document.getElementById("app-version");

    if (verEl) verEl.textContent = state.config && state.config.cisVersion ? ("v" + state.config.cisVersion) : "";

    setupUpdateButton();

    if (!openStartupModuleIfAny()) showDashboard();

  }
  CIS._showApp = showApp;



  function updateTopbarContext() {

    const subEl = document.getElementById("topbar-context");

    const onDashboard = !state.activeModuleId || state.activeModuleId === "dashboard";

    if (!subEl) return;

    if (onDashboard) {

      subEl.textContent = "Dashboard";

      return;

    }

    const mod = CIS.modules.find((m) => m.id === state.activeModuleId);

    subEl.textContent = mod ? mod.title : "";

  }



  function showDashboard(opts) {

    opts = opts || {};

    if (!opts.skipStackPush) {
      navStack.length = 0;
      navStack.push("dashboard");
    }

    if (window.pywebview && window.pywebview.api && window.pywebview.api.close_maintenance_manager) {

      window.pywebview.api.close_maintenance_manager().catch(function () {});

    }

    state.activeModuleId = "dashboard";

    floatNavState.secondary = null;
    updateTopbarContext();
    renderFloatNav();

    const content = document.getElementById("module-content");

    content.className = "module-content dashboard-host";

    content.innerHTML = "";

    if (CIS.dashboard && CIS.dashboard.render) {

      CIS.dashboard.render(content, {

        api: CIS.api,

        user: state.user,

        permissions: state.permissions,

        config: state.config,

      });

    } else {

      content.appendChild(CIS.ui.error("Dashboard failed to load."));

    }

  }



  function showAccessDenied(mod) {

    state.activeModuleId = mod.id;

    floatNavState.secondary = null;
    updateTopbarContext();
    renderFloatNav();

    const content = document.getElementById("module-content");

    content.className = "module-content";

    content.innerHTML = "";

    const ui = CIS.ui;

    content.appendChild(ui.el("div", { class: "access-denied" }, [

      ui.el("h2", { class: "module-title" }, [mod.title]),

      ui.el("p", { class: "module-desc" }, [

        "You can see this application on the dashboard, but your account does not have permission to open it.",

      ]),

      ui.el("p", { class: "muted" }, [

        "Ask an administrator to grant the required access for your role.",

      ]),

    ]));

  }



  function openModule(id, opts) {

    opts = opts || {};

    const mod = CIS.modules.find((m) => m.id === id);

    if (!mod) return;

    if (!canAccessModule(mod)) {
      showAccessDenied(mod);
      return;
    }

    if (!opts.skipStackPush) pushNavigation(id);

    state.activeModuleId = id;

    floatNavState.secondary = null;
    updateTopbarContext();
    renderFloatNav();

    const content = document.getElementById("module-content");

    content.className = "module-content";

    content.innerHTML = "";

    (async function () {

      try {

        const result = mod.render(content, {

          api: CIS.api,

          user: state.user,

          permissions: state.permissions,

          config: state.config,

          setFloatingBack: setFloatingBack,

        });

        if (result && typeof result.then === "function") await result;

      } catch (e) {

        content.innerHTML = '<div class="error-box">Module failed to load: ' + (e.message || e) + "</div>";

      }

    })();

  }

  CIS.openModule = openModule;
  CIS.showDashboard = showDashboard;



  // "Check for updates" button — only inside the installed desktop app (pywebview bridge present).

  function setupUpdateButton() {

    const bridge = window.pywebview && window.pywebview.api;

    if (!bridge || document.getElementById("cis-update-btn")) return;

    const btn = document.createElement("button");

    btn.id = "cis-update-btn";

    btn.className = "btn-ghost";

    btn.textContent = "Check for updates";

    const logout = document.getElementById("logout-btn");

    logout.parentNode.insertBefore(btn, logout);

    btn.addEventListener("click", async () => {

      btn.disabled = true;

      const original = btn.textContent;

      btn.textContent = "Checking…";

      try {

        const res = await window.pywebview.api.check_updates();

        if (!res || !res.ok) {

          window.alert("Could not check for updates" + (res && res.error ? ":\n" + res.error : "."));

        } else if (!res.installed) {

          window.alert("Running from source (v" + res.local + "). Updates apply only to the installed app.");

        } else if (res.available) {

          if (window.confirm("Update available.\n\nInstalled: " + res.local + "\nAvailable: " + res.remote +

              "\n\nUpdate now? The app will close, update, and reopen.")) {

            await window.pywebview.api.apply_update();

          }

        } else {

          window.alert("You are up to date (v" + res.local + ").");

        }

      } catch (e) {

        window.alert("Update check failed: " + (e && e.message ? e.message : e));

      } finally {

        btn.disabled = false;

        btn.textContent = original;

      }

    });

  }



  // Shared UI utilities for modules.

  CIS.ui = {

    el(tag, attrs, children) {

      const node = document.createElement(tag);

      if (attrs) Object.keys(attrs).forEach((k) => {

        if (k === "class") node.className = attrs[k];

        else if (k === "html") node.innerHTML = attrs[k];

        else if (k.startsWith("on") && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);

        else node.setAttribute(k, attrs[k]);

      });

      (children || []).forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));

      return node;

    },

    error(msg) {

      const d = document.createElement("div");

      d.className = "error-box";

      d.textContent = msg;

      return d;

    },

    escape(s) {

      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>

        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    },

  };



  document.addEventListener("DOMContentLoaded", boot);

})();

