/* Maintenance Manager — desktop .exe embedded in CIS shell (Windows desktop app). */

(function () {

  "use strict";

  var CIS = (window.CIS = window.CIS || {});

  CIS.modules = CIS.modules || [];



  function hasDesktopBridge() {

    return !!(window.pywebview && window.pywebview.api && window.pywebview.api.open_maintenance_manager);

  }



  function renderBrowserFallback(container, ctx) {

    var cfg = (ctx && ctx.config) || {};

    var downloadUrl = (cfg.maintenanceManagerUrl || "/maintenance/api/manager/").trim();

    CIS.launcherPage(container, ctx, {

      title: "Maintenance",

      description: "Fleet maintenance desktop app — vehicles, service, fuel, certificates, and exceptions.",

      notes: [

        "Maintenance Manager is a Windows desktop application.",

        "It opens inside the installed Carbo Integrated System app on office PCs — sign in to CIS, then open this tile.",

        "Install CIS from your IT link, then place the Manager .exe in the CIS Maintenance Manager folder (next to the CIS app, not on C:\\).",

      ],

      primaryUrl: downloadUrl,

      primaryLabel: "Download Manager update files",

    });

  }



  function renderDesktopEmbed(container, ctx) {

    var ui = CIS.ui;

    container.innerHTML = "";

    container.classList.add("module-native-host");



    container.appendChild(ui.el("h2", { class: "module-title" }, ["Maintenance"]));

    container.appendChild(ui.el("p", { class: "module-desc" }, [

      "Opening Maintenance Manager inside CIS…",

    ]));

    var status = ui.el("p", { class: "muted launcher-note", id: "mm-launch-status" }, [

      "Starting the desktop module. The CIS dashboard will return when you choose “Back to CIS dashboard” in the app menu.",

    ]);

    container.appendChild(status);



    var token = CIS.getToken && CIS.getToken();

    window.pywebview.api.open_maintenance_manager(token || null).then(function (res) {

      if (!res || !res.ok) {

        status.textContent = (res && res.error) || "Could not start Maintenance Manager.";

        status.classList.add("error-text");

        window.pywebview.api.maintenance_manager_install_dir().then(function (info) {

          if (info && info.path) {

            container.appendChild(ui.el("p", { class: "muted launcher-note" }, [

              "Install folder: " + info.path,

            ]));

          }

        }).catch(function () {});

      }

    }).catch(function (err) {

      status.textContent = err && err.message ? err.message : "Could not start Maintenance Manager.";

      status.classList.add("error-text");

    });

  }



  function render(container, ctx) {

    if (hasDesktopBridge()) {

      renderDesktopEmbed(container, ctx);

      return;

    }

    renderBrowserFallback(container, ctx);

  }



  CIS.modules.push({

    id: "maintenance_manager",

    title: "Maintenance",

    section: "Maintenance",

    kind: "app",

    order: 5,

    icon: "manager",

    description: "Desktop app — fleet setup, fuel, service, certs",

    requires: "maintenance.manager",

    render: render,

  });

})();
