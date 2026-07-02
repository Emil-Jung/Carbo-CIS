/* Identity Admin module — manage users and roles. Requires identity.admin. */
(function () {
  "use strict";
  const CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  let rolesCache = [];

  async function render(container, ctx) {
    const ui = CIS.ui;
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Identity Administration"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Create people's accounts and control what each can see. Devices/PWAs keep their own keys.",
    ]));

    const usersWrap = ui.el("div", {});

    const toolbar = ui.el("div", { class: "toolbar" });
    toolbar.appendChild(ui.el("button", { class: "btn btn-sm", onclick: () => openUserModal(ctx, null, usersWrap) }, ["+ New user"]));
    container.appendChild(toolbar);

    container.appendChild(usersWrap);
    usersWrap.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));

    try {
      const roleResp = await ctx.api.identity("/roles");
      rolesCache = roleResp.roles || [];
      await refreshUsers(ctx, usersWrap);
    } catch (e) {
      usersWrap.innerHTML = "";
      usersWrap.appendChild(ui.error("Could not load: " + (e.message || e)));
    }
  }

  async function refreshUsers(ctx, wrap) {
    const ui = CIS.ui;
    const resp = await ctx.api.identity("/users");
    const users = resp.users || [];
    wrap.innerHTML = "";
    const table = ui.el("table", { class: "data" });
    table.innerHTML =
      "<thead><tr><th>User ID</th><th>Name</th><th>Roles</th><th>Status</th><th>Last login</th><th></th></tr></thead>";
    const tbody = ui.el("tbody", {});
    users.forEach((u) => {
      const tr = ui.el("tr", {});
      const statusPill = ui.el("span", { class: "pill " + (u.status === "active" ? "ok" : "danger") }, [u.status]);
      tr.appendChild(ui.el("td", {}, [u.login_id]));
      tr.appendChild(ui.el("td", {}, [u.display_name]));
      tr.appendChild(ui.el("td", { class: "muted" }, [(u.roles || []).join(", ") || "—"]));
      tr.appendChild(ui.el("td", {}, [statusPill]));
      tr.appendChild(ui.el("td", { class: "muted" }, [u.last_login_at ? String(u.last_login_at).slice(0, 16).replace("T", " ") : "—"]));
      tr.appendChild(ui.el("td", {}, [ui.el("button", { class: "btn-ghost btn-sm", onclick: () => openUserModal(ctx, u, wrap) }, ["Edit"])]));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function openUserModal(ctx, user, usersWrap) {
    const ui = CIS.ui;
    const isEdit = !!user;
    const backdrop = ui.el("div", { class: "modal-backdrop" });
    const modal = ui.el("div", { class: "modal" });
    backdrop.appendChild(modal);

    modal.appendChild(ui.el("h3", {}, [isEdit ? ("Edit " + user.login_id) : "New user"]));

    const errEl = ui.el("div", { class: "error-box hidden" });
    modal.appendChild(errEl);

    modal.appendChild(ui.el("label", {}, ["User ID (login)"]));
    const loginInput = ui.el("input", { type: "text", value: isEdit ? user.login_id : "" });
    if (isEdit) loginInput.disabled = true;
    modal.appendChild(loginInput);

    modal.appendChild(ui.el("label", {}, ["Display name"]));
    const nameInput = ui.el("input", { type: "text", value: isEdit ? user.display_name : "" });
    modal.appendChild(nameInput);

    modal.appendChild(ui.el("label", {}, [isEdit ? "New password (leave blank to keep)" : "Password (min 6 chars)"]));
    const pwInput = ui.el("input", { type: "text" });
    pwInput.setAttribute("placeholder", isEdit ? "unchanged" : "");
    modal.appendChild(pwInput);

    if (isEdit) {
      modal.appendChild(ui.el("label", {}, ["Status"]));
      const statusSel = ui.el("select", {});
      ["active", "disabled"].forEach((s) => {
        const opt = ui.el("option", { value: s }, [s]);
        if (user.status === s) opt.selected = true;
        statusSel.appendChild(opt);
      });
      modal.appendChild(statusSel);
      modal._statusSel = statusSel;
    }

    modal.appendChild(ui.el("label", {}, ["Roles"]));
    const checks = ui.el("div", { class: "checks" });
    const roleInputs = [];
    rolesCache.forEach((r) => {
      const cb = ui.el("input", { type: "checkbox", value: String(r.role_id) });
      if (isEdit && (user.roles || []).indexOf(r.name) !== -1) cb.checked = true;
      const lbl = ui.el("label", {}, []);
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(r.name + " — " + (r.description || "")));
      checks.appendChild(lbl);
      roleInputs.push({ cb, role_id: r.role_id });
    });
    modal.appendChild(checks);

    const actions = ui.el("div", { class: "modal-actions" });
    const cancelBtn = ui.el("button", { class: "btn-ghost", onclick: () => document.body.removeChild(backdrop) }, ["Cancel"]);
    const saveBtn = ui.el("button", { class: "btn" }, ["Save"]);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(actions);

    saveBtn.addEventListener("click", async () => {
      errEl.classList.add("hidden");
      const roleIds = roleInputs.filter((r) => r.cb.checked).map((r) => r.role_id);
      const pw = pwInput.value.trim();
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      try {
        if (isEdit) {
          const body = { display_name: nameInput.value.trim(), status: modal._statusSel.value, role_ids: roleIds };
          if (pw) body.password = pw;
          await ctx.api.identity("/users/" + user.user_id, { method: "PATCH", body });
        } else {
          await ctx.api.identity("/users", {
            method: "POST",
            body: {
              login_id: loginInput.value.trim(),
              display_name: nameInput.value.trim(),
              password: pw,
              role_ids: roleIds,
            },
          });
        }
        document.body.removeChild(backdrop);
        if (usersWrap) await refreshUsers(ctx, usersWrap);
      } catch (e) {
        errEl.textContent = e.message || "Save failed";
        errEl.classList.remove("hidden");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
      }
    });

    document.body.appendChild(backdrop);
    (isEdit ? nameInput : loginInput).focus();
  }

  CIS.modules.push({
    id: "identity_admin",
    title: "Users & access",
    section: "Administration",
    order: 10,
    icon: "admin",
    description: "Manage logins, roles, and permissions",
    requires: "identity.admin",
    render,
  });
})();
