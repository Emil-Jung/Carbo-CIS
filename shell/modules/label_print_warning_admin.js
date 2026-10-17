/* Admin — SMS numbers for Label print warning (Africa's Talking on server). */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  async function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content label-sms-admin-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Label print warning"]));
    container.appendChild(
      ui.el("p", { class: "module-desc" }, [
        "Staff SMS when Zebra or A4 label stock drops below about ",
        ui.el("strong", {}, ["3"]),
        " then ",
        ui.el("strong", {}, ["2"]),
        " days of average use. ",
        "Configure Africa's Talking on the server (",
        ui.el("code", {}, ["AT_USERNAME"]),
        ", ",
        ui.el("code", {}, ["AT_API_KEY"]),
        "). Cron runs ",
        ui.el("code", {}, ["run_label_sms_warnings.py"]),
        " on bkweb3.",
      ])
    );

    var listHost = ui.el("div", { class: "label-sms-list" });
    var form = ui.el("div", { class: "toolbar label-sms-form" });
    var phoneIn = ui.el("input", {
      type: "tel",
      placeholder: "+26481… or 081…",
      class: "label-sms-phone",
    });
    var nameIn = ui.el("input", {
      type: "text",
      placeholder: "Name (optional)",
      class: "label-sms-name",
    });
    var addBtn = ui.el("button", { type: "button", class: "btn-primary" }, ["Add number"]);
    form.appendChild(phoneIn);
    form.appendChild(nameIn);
    form.appendChild(addBtn);
    container.appendChild(form);
    container.appendChild(listHost);
    var msg = ui.el("p", { class: "muted label-sms-msg" }, [""]);
    container.appendChild(msg);

    async function load() {
      listHost.innerHTML = "";
      msg.textContent = "Loading…";
      try {
        var data = await ctx.api.traceability("/admin/label-print-warning/recipients");
        msg.textContent = "";
        var rec = data.recipients || [];
        if (!rec.length) {
          listHost.appendChild(ui.el("p", { class: "muted" }, ["No numbers yet."]));
          return;
        }
        var ul = ui.el("ul", { class: "label-sms-recipients" });
        rec.forEach(function (r) {
          var li = ui.el("li", {});
          li.appendChild(
            document.createTextNode(
              (r.display_name ? r.display_name + " — " : "") + r.phone_e164
            )
          );
          var rm = ui.el("button", { type: "button", class: "btn-link" }, ["Remove"]);
          rm.addEventListener("click", function () {
            void ctx.api
              .traceability("/admin/label-print-warning/recipients/" + r.id, {
                method: "DELETE",
              })
              .then(load)
              .catch(function (e) {
                msg.textContent = e.message || String(e);
              });
          });
          li.appendChild(rm);
          ul.appendChild(li);
        });
        listHost.appendChild(ul);
      } catch (e) {
        msg.textContent = "";
        listHost.appendChild(ui.error(e.message || String(e)));
      }
    }

    addBtn.addEventListener("click", function () {
      msg.textContent = "";
      void ctx.api
        .traceability("/admin/label-print-warning/recipients", {
          method: "POST",
          body: { phone: phoneIn.value.trim(), display_name: nameIn.value.trim() || null },
        })
        .then(function () {
          phoneIn.value = "";
          nameIn.value = "";
          return load();
        })
        .catch(function (e) {
          msg.textContent = e.message || String(e);
        });
    });

    await load();
  }

  CIS.modules.push({
    id: "label_print_warning_admin",
    title: "Label print warning",
    section: "Administration",
    kind: "admin",
    order: 25,
    icon: "admin",
    description: "SMS recipients when label stock is low",
    requires: "traceability.labels.sms_warning_admin",
    render: render,
  });
})();
