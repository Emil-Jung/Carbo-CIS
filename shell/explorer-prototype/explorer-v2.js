/* CIS Shell V2.0 — sidebar, workspace views, settings (prototype). */
(function () {
  "use strict";

  var THEME_KEY = "cis_v2_theme";
  var NOTIFY_KEY = "cis_v2_notify_read";
  var NAV_OPEN_KEY = "cis_v2_nav_open";

  var sidebar = document.getElementById("sidebar");
  var backdrop = document.getElementById("sidebar-backdrop");
  var menuBtn = document.getElementById("header-menu-btn");
  var sidebarClose = document.getElementById("sidebar-close-btn");
  var settingsBackdrop = document.getElementById("settings-backdrop");
  var settingsSheet = document.getElementById("settings-sheet");
  var dashboardView = document.getElementById("workspace-dashboard");
  var moduleView = document.getElementById("workspace-module");
  var navDashboardBtn = document.getElementById("nav-dashboard");

  var activeNavId = "dashboard";

  window.CIS_V2 = {
    showPrototypeDashboard: showPrototypeDashboard,
    showModuleWorkspace: showModuleWorkspace,
    setActiveNav: setActiveNav,
    onBridgeReady: onBridgeReady,
    setSettingsOpen: setSettingsOpen,
    syncSessionUi: syncHeaderFromSession,
  };

  function unreadCount() {
    if (localStorage.getItem(NOTIFY_KEY) === "1") return 0;
    return 1;
  }

  function updateNotifyDots() {
    var n = unreadCount();
    document.querySelectorAll("[data-notify-dot]").forEach(function (el) {
      el.hidden = n === 0;
    });
  }

  function setSidebarOpen(open) {
    if (!sidebar || !backdrop) return;
    sidebar.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && sidebarClose) sidebarClose.focus();
  }

  function setSettingsOpen(open) {
    if (!settingsSheet || !settingsBackdrop) return;
    settingsSheet.classList.toggle("is-open", open);
    settingsBackdrop.classList.toggle("is-open", open);
    settingsSheet.hidden = !open;
    settingsBackdrop.hidden = !open;
    if (open) {
      var closeBtn = document.getElementById("settings-close-btn");
      if (closeBtn) closeBtn.focus();
    }
  }

  function applyTheme(mode) {
    var root = document.documentElement;
    if (mode === "auto") {
      root.setAttribute("data-theme", "auto");
      localStorage.setItem(THEME_KEY, "auto");
    } else if (mode === "light") {
      root.removeAttribute("data-theme");
      localStorage.setItem(THEME_KEY, "light");
    } else {
      root.setAttribute("data-theme", mode);
      localStorage.setItem(THEME_KEY, mode);
    }
    document.querySelectorAll(".theme-option").forEach(function (btn) {
      btn.classList.toggle("is-selected", btn.getAttribute("data-theme") === mode);
    });
  }

  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY) || "light";
    if (saved === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      applyTheme(saved);
    }
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (localStorage.getItem(THEME_KEY) === "auto") {
        document.documentElement.setAttribute(
          "data-theme",
          window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "auto"
        );
        if (!window.matchMedia("(prefers-color-scheme: dark)").matches) {
          document.documentElement.removeAttribute("data-theme");
        }
      }
    });
  }

  function readNavOpenState() {
    try {
      return JSON.parse(localStorage.getItem(NAV_OPEN_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function writeNavOpenState(state) {
    localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(state));
  }

  function modById(id) {
    var mods = window.CIS && CIS.modules ? CIS.modules : [];
    for (var i = 0; i < mods.length; i++) {
      if (mods[i].id === id) return mods[i];
    }
    return null;
  }

  function moduleLabel(id) {
    var mod = modById(id);
    return mod && mod.title ? mod.title : id;
  }

  function navItemVisible(id) {
    if (window.CIS_V2_NAV_HIDDEN && CIS_V2_NAV_HIDDEN[id]) return false;
    return true;
  }

  function navItemLocked(id) {
    var mod = modById(id);
    if (!mod) return false;
    if (mod.inactive) return true;
    if (!window.CIS || !CIS._v2BridgeReady || !CIS.canAccessModule) return false;
    return !CIS.canAccessModule(mod);
  }

  function setActiveNav(id) {
    activeNavId = id;
    document.querySelectorAll(".nav-item[data-module-id]").forEach(function (btn) {
      var on = btn.getAttribute("data-module-id") === id;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    if (navDashboardBtn) {
      var dashOn = id === "dashboard";
      navDashboardBtn.classList.toggle("is-active", dashOn);
      if (dashOn) navDashboardBtn.setAttribute("aria-current", "page");
      else navDashboardBtn.removeAttribute("aria-current");
    }
  }

  function showPrototypeDashboard(opts) {
    opts = opts || {};
    if (dashboardView) {
      dashboardView.hidden = false;
      dashboardView.classList.remove("hidden");
    }
    if (moduleView) {
      moduleView.hidden = true;
      moduleView.classList.add("hidden");
    }
    if (window.CIS && CIS._state) CIS._state.activeModuleId = "dashboard";
    if (window.CIS && CIS._v2HideModuleHosts) CIS._v2HideModuleHosts();
    setActiveNav("dashboard");
    var strong = document.querySelector(".breadcrumb strong");
    if (strong) strong.textContent = "Carbo Namibia";
    if (!opts.skipStackPush && window.CIS && CIS.goHome) {
      /* goHome resets stack; avoid loop when called from goHome */
    }
  }

  function showModuleWorkspace() {
    if (dashboardView) {
      dashboardView.hidden = true;
      dashboardView.classList.add("hidden");
    }
    if (moduleView) {
      moduleView.hidden = false;
      moduleView.classList.remove("hidden");
    }
  }

  function openDestination(id) {
    setSidebarOpen(false);
    if (id === "dashboard") {
      showPrototypeDashboard();
      return;
    }
    if (window.CIS && CIS.openModule) CIS.openModule(id);
  }

  function createNavItem(id, nestDepth) {
    nestDepth = nestDepth || 0;
    if (!navItemVisible(id)) return null;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-item nav-item--module";
    btn.setAttribute("data-module-id", id);
    if (nestDepth > 0) btn.classList.add("nav-item--nested");
    if (nestDepth > 1) btn.classList.add("nav-item--nested-deep");
    if (navItemLocked(id)) btn.classList.add("nav-item--locked");
    btn.innerHTML =
      (window.CIS_V2_NAV_ICON_FOR ? CIS_V2_NAV_ICON_FOR(id) : "") +
      '<span class="nav-item-label">' +
      moduleLabel(id) +
      "</span>";
    if (modById(id) && modById(id).inactive) {
      btn.innerHTML += '<span class="nav-item-soon">Soon</span>';
    }
    btn.addEventListener("click", function () {
      openDestination(id);
    });
    return btn;
  }

  function renderNavGroup(group, host, openState, extraClass) {
    if (!host || !group) return;
    var wrap = document.createElement("div");
    wrap.className = "nav-group" + (extraClass ? " " + extraClass : "");
    wrap.setAttribute("data-nav-group", group.id);
    if (group.tier) wrap.setAttribute("data-nav-tier", group.tier);

    var isOpen = openState[group.id] !== false;
    var header = document.createElement("button");
    header.type = "button";
    header.className = "nav-group-header";
    header.setAttribute("aria-expanded", isOpen ? "true" : "false");
    var groupIcon =
      group.icon && window.CIS_V2_NAV_ICONS && CIS_V2_NAV_ICONS[group.icon]
        ? '<span class="nav-group-icon">' + CIS_V2_NAV_ICONS[group.icon] + "</span>"
        : "";
    header.innerHTML =
      groupIcon +
      '<span class="nav-group-title">' +
      group.title +
      '</span><svg class="nav-group-chevron" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5H7z"/></svg>';

    var body = document.createElement("div");
    body.className = "nav-group-body";
    body.hidden = !isOpen;

    group.items.forEach(function (item) {
      if (item.nestUnder) return;
      var node = createNavItem(item.id, 0);
      if (node) body.appendChild(node);
      group.items.forEach(function (child) {
        if (child.nestUnder !== item.id) return;
        var depth = child.nestDepth || 1;
        var childNode = createNavItem(child.id, depth);
        if (childNode) body.appendChild(childNode);
      });
    });

    header.addEventListener("click", function () {
      var next = body.hidden;
      body.hidden = !next;
      header.setAttribute("aria-expanded", next ? "true" : "false");
      openState[group.id] = next;
      writeNavOpenState(openState);
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    host.appendChild(wrap);
  }

  function renderNavModules() {
    var host = document.getElementById("sidebar-nav-modules");
    var dockHost = document.getElementById("sidebar-nav-dock-admin");
    if (!window.CIS_V2_NAV) return;
    var openState = readNavOpenState();

    if (host) {
      host.innerHTML = "";
      CIS_V2_NAV.groups.forEach(function (group) {
        renderNavGroup(group, host, openState, "nav-group--main");
      });
    }

    if (dockHost && CIS_V2_NAV.dockAdministration) {
      dockHost.innerHTML = "";
      renderNavGroup(CIS_V2_NAV.dockAdministration, dockHost, openState, "nav-group--dock");
    }
  }

  function onBridgeReady() {
    renderNavModules();
    syncHeaderFromSession();
  }

  function syncHeaderFromSession() {
    if (window.CIS && CIS._state && typeof CIS.syncHeaderUser === "function") {
      CIS.syncHeaderUser();
      return;
    }
    if (!window.CIS || !CIS.currentUser) return;
    var user = CIS.currentUser();
    if (!user) return;
    var nameEl = document.querySelector(".user-name");
    var roleEl = document.querySelector(".user-role");
    if (nameEl) nameEl.textContent = user.display_name || user.login_id || "User";
    if (roleEl) roleEl.textContent = user.login_id || "";
  }

  function wireSettings() {
    document.querySelectorAll("[data-open-settings]").forEach(function (el) {
      el.addEventListener("click", function () {
        setSettingsOpen(true);
      });
    });
    document.querySelectorAll(".theme-option").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTheme(btn.getAttribute("data-theme"));
      });
    });
    var markRead = document.getElementById("settings-mark-read");
    if (markRead) {
      markRead.addEventListener("click", function () {
        localStorage.setItem(NOTIFY_KEY, "1");
        updateNotifyDots();
      });
    }
    var closeBtn = document.getElementById("settings-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        setSettingsOpen(false);
      });
    }
    if (settingsBackdrop) {
      settingsBackdrop.addEventListener("click", function () {
        setSettingsOpen(false);
      });
    }
    var sidebarSettings = document.getElementById("sidebar-settings-btn");
    if (sidebarSettings) {
      sidebarSettings.addEventListener("click", function () {
        setSidebarOpen(false);
        setSettingsOpen(true);
      });
    }
    function wireSignOut(btn) {
      if (!btn) return;
      btn.addEventListener("click", function () {
        if (window.CIS && CIS.signOut) CIS.signOut();
      });
    }
    wireSignOut(document.getElementById("settings-sign-out"));
    wireSignOut(document.getElementById("header-sign-out-btn"));
  }

  function wireNav() {
    if (navDashboardBtn) {
      navDashboardBtn.addEventListener("click", function () {
        openDestination("dashboard");
      });
    }
    if (menuBtn) {
      menuBtn.addEventListener("click", function () {
        setSidebarOpen(!sidebar.classList.contains("is-open"));
      });
    }
    if (sidebarClose) {
      sidebarClose.addEventListener("click", function () {
        setSidebarOpen(false);
      });
    }
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        setSidebarOpen(false);
      });
    }
    window.addEventListener("resize", function () {
      if (window.innerWidth > 768) setSidebarOpen(false);
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        setSidebarOpen(false);
        setSettingsOpen(false);
      }
    });
  }

  renderNavModules();
  initTheme();
  updateNotifyDots();
  wireNav();
  wireSettings();
  showPrototypeDashboard();
  setActiveNav("dashboard");
})();
