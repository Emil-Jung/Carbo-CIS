/* CIS Shell V2.0 — load production modules into the workspace (prototype bridge). */
(function () {
  "use strict";

  var TOKEN_KEY = "cis_token";
  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  var state = {
    config: null,
    token: null,
    user: null,
    permissions: [],
    activeModuleId: null,
  };
  CIS._state = state;

  var floatNavState = { secondary: null };
  var navStack = ["dashboard"];

  var MODULE_PARENTS = {
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

  function moduleContentEl() {
    return document.getElementById("cis-module-content");
  }

  function floatNavEl() {
    return document.getElementById("cis-float-nav");
  }

  function token() {
    return state.token;
  }

  async function apiFetch(base, path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (token()) headers.Authorization = "Bearer " + token();
    var res = await fetch(base + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      state.token = null;
      state.user = null;
      state.permissions = [];
    }
    var text = await res.text();
    var data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
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

  function bindApi() {
    CIS.api = {
      identity: function (path, opts) {
        return apiFetch(state.config.identityApiBase, path, opts);
      },
      maintenance: function (path, opts) {
        return apiFetch(state.config.maintenanceApiBase, path, opts);
      },
      quality: function (path, opts) {
        return apiFetch(state.config.qualityApiBase || "/quality/api", path, opts);
      },
      producers: function (path, opts) {
        return apiFetch(state.config.producersApiBase || "/producers/api", path, opts);
      },
      qualityReports: function (path, opts) {
        return apiFetch(state.config.qualityReportsApiBase || "/quality/reports/api", path, opts);
      },
      supplierTracking: function (path, opts) {
        return apiFetch(state.config.supplierTrackingApiBase || "/supplier-tracking/api", path, opts);
      },
      traceability: function (path, opts) {
        var base = (state.config && state.config.traceabilityApiBase) || "/traceability/api/v1";
        return apiFetch(base, path, opts);
      },
    };
  }

  CIS.getToken = function () {
    return state.token || localStorage.getItem(TOKEN_KEY);
  };

  CIS.hasPermission = function (perm) {
    return state.permissions.indexOf(perm) !== -1;
  };

  CIS.canAccessModule = function (mod) {
    if (!mod) return false;
    if (mod.requiresAny && mod.requiresAny.length) {
      return mod.requiresAny.some(function (p) {
        return CIS.hasPermission(p);
      });
    }
    return !mod.requires || CIS.hasPermission(mod.requires);
  };

  CIS.currentUser = function () {
    return state.user;
  };

  CIS.ui = {
    el: function (tag, attrs, children) {
      var node = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach(function (k) {
          if (k === "class") node.className = attrs[k];
          else if (k === "html") node.innerHTML = attrs[k];
          else if (k.startsWith("on") && typeof attrs[k] === "function") {
            node.addEventListener(k.slice(2), attrs[k]);
          } else node.setAttribute(k, attrs[k]);
        });
      }
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
    escape: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },
  };

  function ensureDashboardRoot() {
    if (navStack.length === 0 || navStack[0] !== "dashboard") {
      navStack.length = 0;
      navStack.push("dashboard");
    }
  }

  function pushNavigation(id) {
    if (!id || id === "dashboard") return;
    ensureDashboardRoot();
    var top = navStack[navStack.length - 1];
    if (top === id) return;
    var idx = navStack.indexOf(id);
    if (idx >= 0) {
      navStack.length = idx + 1;
      return;
    }
    var parent = MODULE_PARENTS[id];
    if (top === "dashboard" || parent === top) {
      navStack.push(id);
      return;
    }
    navStack.length = 1;
    navStack.push(id);
  }

  function popNavigation() {
    ensureDashboardRoot();
    if (navStack.length <= 1) {
      if (window.CIS_V2 && CIS_V2.showPrototypeDashboard) CIS_V2.showPrototypeDashboard({ skipStackPush: true });
      return;
    }
    navStack.pop();
    var prevId = navStack[navStack.length - 1];
    if (prevId === "dashboard") {
      if (window.CIS_V2 && CIS_V2.showPrototypeDashboard) CIS_V2.showPrototypeDashboard({ skipStackPush: true });
    } else openModule(prevId, { skipStackPush: true });
  }

  function goBack() {
    if (floatNavState.secondary && typeof floatNavState.secondary.onClick === "function") {
      floatNavState.secondary.onClick();
      return;
    }
    popNavigation();
  }

  CIS.goBack = goBack;
  CIS.goHome = function () {
    navStack.length = 0;
    navStack.push("dashboard");
    if (window.CIS_V2 && CIS_V2.showPrototypeDashboard) CIS_V2.showPrototypeDashboard({ skipStackPush: true });
  };

  function renderFloatNav() {
    var nav = floatNavEl();
    var content = moduleContentEl();
    if (!nav) return;
    nav.innerHTML = "";
    nav.classList.add("hidden");
    nav.setAttribute("aria-hidden", "true");
    if (content) {
      content.classList.remove("has-float-nav");
      content.classList.remove("has-float-nav--stacked");
      content.classList.remove("has-float-nav--deep");
    }
    if (!state.activeModuleId || state.activeModuleId === "dashboard") return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cis-float-back-btn";
    btn.textContent = "Back";
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

  function updateBreadcrumb(title) {
    var el = document.querySelector(".breadcrumb strong");
    if (el) el.textContent = title || "Carbo Namibia";
  }

  function showSignInRequired() {
    var host = moduleContentEl();
    if (!host) return;
    host.className = "module-content";
    host.innerHTML = "";
    host.appendChild(
      CIS.ui.el("div", { class: "access-denied" }, [
        CIS.ui.el("h2", { class: "module-title" }, ["Sign in required"]),
        CIS.ui.el("p", { class: "module-desc" }, [
          "Open a CIS module here after you sign in. Your session is shared with production CIS on this site.",
        ]),
        CIS.ui.el("p", {}, [
          CIS.ui.el("a", { href: "../index.html", class: "settings-action-btn" }, ["Sign in at /cis/"]),
        ]),
      ])
    );
  }

  function showAccessDenied(mod) {
    state.activeModuleId = mod.id;
    floatNavState.secondary = null;
    renderFloatNav();
    updateBreadcrumb(mod.title);
    var content = moduleContentEl();
    content.className = "module-content";
    content.innerHTML = "";
    content.appendChild(
      CIS.ui.el("div", { class: "access-denied" }, [
        CIS.ui.el("h2", { class: "module-title" }, [mod.title]),
        CIS.ui.el("p", { class: "module-desc" }, [
          "You can see this destination in the menu, but your account does not have permission to open it.",
        ]),
        CIS.ui.el("p", { class: "muted" }, ["Ask an administrator to grant the required access for your role."]),
      ])
    );
  }

  function openModule(id, opts) {
    opts = opts || {};
    if (!state.token) {
      if (window.CIS_V2 && CIS_V2.showModuleWorkspace) CIS_V2.showModuleWorkspace();
      showSignInRequired();
      return;
    }
    var mod = CIS.modules.find(function (m) {
      return m.id === id;
    });
    if (!mod) return;
    if (!CIS.canAccessModule(mod)) {
      if (window.CIS_V2 && CIS_V2.showModuleWorkspace) CIS_V2.showModuleWorkspace();
      showAccessDenied(mod);
      if (window.CIS_V2 && CIS_V2.setActiveNav) CIS_V2.setActiveNav(id);
      return;
    }
    if (!opts.skipStackPush) pushNavigation(id);
    state.activeModuleId = id;
    floatNavState.secondary = null;
    renderFloatNav();
    updateBreadcrumb(mod.title);
    if (window.CIS_V2 && CIS_V2.showModuleWorkspace) CIS_V2.showModuleWorkspace();
    if (window.CIS_V2 && CIS_V2.setActiveNav) CIS_V2.setActiveNav(id);

    var content = moduleContentEl();
    content.className = "module-content";
    content.innerHTML = "";
    (async function () {
      try {
        var result = mod.render(content, {
          api: CIS.api,
          user: state.user,
          permissions: state.permissions,
          config: state.config,
          setFloatingBack: setFloatingBack,
        });
        if (result && typeof result.then === "function") await result;
      } catch (e) {
        content.innerHTML =
          '<div class="error-box">Module failed to load: ' + CIS.ui.escape(e.message || e) + "</div>";
      }
    })();
  }

  CIS.openModule = openModule;

  async function loadSession() {
    var me = await CIS.api.identity("/auth/me");
    state.user = { user_id: me.user_id, login_id: me.login_id, display_name: me.display_name };
    state.permissions = me.permissions || [];
  }

  CIS.refreshSession = loadSession;

  function syncHeaderUser() {
    var nameEl = document.querySelector(".user-name");
    var roleEl = document.querySelector(".user-role");
    if (!state.user) return;
    if (nameEl) {
      nameEl.textContent = state.user.display_name || state.user.login_id || "User";
    }
    if (roleEl) roleEl.textContent = state.user.login_id || "";
  }

  async function initBridge() {
    try {
      state.config = await (await fetch("../config.json", { cache: "no-store" })).json();
    } catch (e) {
      state.config = { identityApiBase: "/identity/api", maintenanceApiBase: "/maintenance/api" };
    }
    bindApi();
    if (CIS.syncControlRoomVisibility) CIS.syncControlRoomVisibility(state.config);

    state.token = localStorage.getItem(TOKEN_KEY);
    if (state.token) {
      try {
        await loadSession();
        syncHeaderUser();
      } catch (err) {
        localStorage.removeItem(TOKEN_KEY);
        state.token = null;
      }
    }

    CIS._v2BridgeReady = true;
    if (window.CIS_V2 && CIS_V2.onBridgeReady) CIS_V2.onBridgeReady();
  }

  document.addEventListener("DOMContentLoaded", initBridge);
})();
