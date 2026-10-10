/* CIS Shell V2.0 — responsive chrome, settings, theme (prototype). */
(function () {
  "use strict";

  var THEME_KEY = "cis_v2_theme";
  var NOTIFY_KEY = "cis_v2_notify_read";

  var NAV_SECTIONS = [
    {
      title: "Administration",
      items: [
        { id: "identity_admin", label: "Identity Admin" },
        { id: "device_keys", label: "Device Keys" },
      ],
    },
    {
      title: "Applications",
      items: [
        { id: "producers_office", label: "Producers Office" },
        { id: "traceability", label: "Traceability" },
        { id: "quality_capture", label: "Quality Capture" },
        { id: "maintenance_manager", label: "Maintenance Manager" },
      ],
    },
    {
      title: "Reports & lookups",
      items: [
        { id: "producers_view", label: "Producers View" },
        { id: "permit_status", label: "Permit Status" },
        { id: "quality_view", label: "Quality View" },
        { id: "maintenance_ops", label: "Maintenance Ops" },
        { id: "consumption", label: "Consumption" },
        { id: "restaurant_report", label: "Restaurant Report" },
        { id: "deliveries_register", label: "Deliveries Register" },
        { id: "bags_movement_report", label: "Bags Movement" },
        { id: "bags_status_report", label: "Bags Status" },
        { id: "supplier_contacts", label: "Supplier Contacts" },
      ],
    },
  ];

  var sidebar = document.getElementById("sidebar");
  var backdrop = document.getElementById("sidebar-backdrop");
  var menuBtn = document.getElementById("header-menu-btn");
  var sidebarClose = document.getElementById("sidebar-close-btn");
  var settingsBackdrop = document.getElementById("settings-backdrop");
  var settingsSheet = document.getElementById("settings-sheet");

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

  function renderNavModules() {
    var host = document.getElementById("sidebar-nav-modules");
    if (!host) return;
    host.innerHTML = "";
    NAV_SECTIONS.forEach(function (section) {
      var title = document.createElement("p");
      title.className = "sidebar-section-title";
      title.textContent = section.title;
      host.appendChild(title);
      section.items.forEach(function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nav-item nav-item--module";
        btn.textContent = item.label;
        btn.title = "Prototype — module wiring in a later phase";
        btn.addEventListener("click", function () {
          setSidebarOpen(false);
        });
        host.appendChild(btn);
      });
    });
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
    document.getElementById("sidebar-settings-btn");
    var sidebarSettings = document.getElementById("sidebar-settings-btn");
    if (sidebarSettings) {
      sidebarSettings.addEventListener("click", function () {
        setSidebarOpen(false);
        setSettingsOpen(true);
      });
    }
  }

  function wireNav() {
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
})();
