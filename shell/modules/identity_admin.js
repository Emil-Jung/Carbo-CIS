/* Identity Admin module — manage users and roles. Requires identity.admin. */
(function () {
  "use strict";
  const CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  let rolesCache = [];

  function fullInviteUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return window.location.origin + path;
  }

  async function render(container, ctx) {
    const ui = CIS.ui;
    container.appendChild(ui.el("h2", { class: "module-title" }, ["Identity Administration"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Create accounts with User ID and roles only — leave password blank and send each person their personal CIS link. Device keys for PWAs are under Device keys.",
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
      "<thead><tr><th>User ID</th><th>Name</th><th>Roles</th><th>Password</th><th>Status</th><th>Last login</th><th></th></tr></thead>";
    const tbody = ui.el("tbody", {});
    users.forEach((u) => {
      const tr = ui.el("tr", {});
      const statusPill = ui.el("span", { class: "pill " + (u.status === "active" ? "ok" : "danger") }, [u.status]);
      const pwPill = ui.el("span", {
        class: "pill " + (u.needs_password ? "warn" : "ok"),
      }, [u.needs_password ? "Awaiting setup" : "Set"]);
      tr.appendChild(ui.el("td", {}, [u.login_id]));
      tr.appendChild(ui.el("td", {}, [u.display_name]));
      tr.appendChild(ui.el("td", { class: "muted" }, [(u.roles || []).join(", ") || "—"]));
      tr.appendChild(ui.el("td", {}, [pwPill]));
      tr.appendChild(ui.el("td", {}, [statusPill]));
      tr.appendChild(ui.el("td", { class: "muted" }, [u.last_login_at ? String(u.last_login_at).slice(0, 16).replace("T", " ") : "—"]));
      const actions = ui.el("td", {});
      if (u.needs_password && CIS.inviteUrl) {
        actions.appendChild(ui.el("button", {
          class: "btn-ghost btn-sm",
          onclick: () => copyInvite(u),
        }, ["Copy link"]));
      }
      actions.appendChild(ui.el("button", { class: "btn-ghost btn-sm", onclick: () => openUserModal(ctx, u, wrap) }, ["Edit"]));
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function inviteEmailText(loginId, displayName, link) {
    var who = (displayName || loginId || "there").trim();
    return (
      "Hello " + who + ",\n\n" +
      "You have been given access to the Carbo Integrated System (CIS) — Carbo’s " +
      "central sign-in for quality, production, and other operational tools. " +
      "CIS brings the applications you need into one place, with access controlled " +
      "by your role.\n\n" +
      "FIRST-TIME SIGN-IN\n\n" +
      "1. Open your personal link below in a web browser (Chrome or Edge recommended).\n" +
      "2. Your User ID is already filled in: " + loginId + "\n" +
      "3. You will be asked to create a password (minimum 6 characters). " +
      "Choose something you can remember, and keep it somewhere safe — for example " +
      "in a password manager or a secure note. If you clear your browser history or " +
      "site data, you may need this password again; CIS does not email password " +
      "reminders, so please store it.\n" +
      "4. After setting your password, you will be signed in to the CIS dashboard.\n\n" +
      "Your invite link:\n" +
      link + "\n\n" +
      "This link is personal to you. Please do not share it or forward this email.\n\n" +
      "PLEASE IGNORE OLD INSTRUCTIONS\n\n" +
      "If you were previously given device keys, direct app links, or bookmarked URLs " +
      "to Quality, Maintenance, or other Carbo tools, please ignore those for now. " +
      "Sign in only through the CIS link in this email and your new User ID and password. " +
      "Older keys and links may no longer work or may not reflect your current access.\n\n" +
      "IMPORTANT — TEMPORARY WEB ACCESS\n\n" +
      "For now, CIS is accessed through the website above (a web app in your browser). " +
      "This route is temporary. A downloadable desktop app is being prepared that will " +
      "install on your PC and update automatically when new versions are released. " +
      "We will let you know when that is ready to use.\n\n" +
      "WHAT TO EXPECT\n\n" +
      "CIS is being rolled out in stages. You will see tiles on the dashboard for " +
      "applications and reports; only the areas assigned to your account can be opened. " +
      "Other tiles may show as unavailable or “Coming soon” — more modules will be " +
      "added over time as they are connected and tested.\n\n" +
      "If you have trouble signing in or are unsure which applications you should use, " +
      "please contact your administrator.\n\n" +
      "Kind regards,\n" +
      "Carbo Integrated System"
    );
  }

  function copyText(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (onDone) onDone();
      }).catch(function () {
        window.prompt("Copy this text:", text);
      });
    } else {
      window.prompt("Copy this text:", text);
    }
  }

  function showInviteDialog(loginId, displayName, link) {
    if (!link) return;
    var ui = CIS.ui;
    var backdrop = ui.el("div", { class: "modal-backdrop" });
    var modal = ui.el("div", { class: "modal modal-wide" });
    backdrop.appendChild(modal);

    modal.appendChild(ui.el("h3", {}, ["Send invite to " + loginId]));
    modal.appendChild(ui.el("p", { class: "muted" }, [
      "Copy the email text below into your mail app, or copy the link only.",
    ]));

    var emailBody = inviteEmailText(loginId, displayName, link);

    modal.appendChild(ui.el("label", {}, ["Email text (select all and copy)"]));
    var emailArea = ui.el("textarea", { readonly: "readonly" });
    emailArea.value = emailBody;
    modal.appendChild(emailArea);

    modal.appendChild(ui.el("label", {}, ["Invite link only"]));
    var linkInput = ui.el("input", { type: "text", readonly: "readonly", value: link });
    linkInput.style.fontFamily = "Consolas, monospace";
    linkInput.style.fontSize = "13px";
    modal.appendChild(linkInput);

    var statusEl = ui.el("div", { class: "copy-status" });
    modal.appendChild(statusEl);

    function flash(msg) {
      statusEl.textContent = msg;
      setTimeout(function () {
        if (statusEl.textContent === msg) statusEl.textContent = "";
      }, 2500);
    }

    var copyEmailBtn = ui.el("button", { class: "btn btn-sm", type: "button" }, ["Copy email"]);
    var copyLinkBtn = ui.el("button", { class: "btn-ghost btn-sm", type: "button" }, ["Copy link"]);
    var closeBtn = ui.el("button", { class: "btn-ghost", type: "button" }, ["Close"]);

    copyEmailBtn.addEventListener("click", function () {
      copyText(emailBody, function () { flash("Email text copied."); });
    });
    copyLinkBtn.addEventListener("click", function () {
      copyText(link, function () { flash("Link copied."); });
    });
    closeBtn.addEventListener("click", function () {
      document.body.removeChild(backdrop);
    });

    emailArea.addEventListener("focus", function () { emailArea.select(); });
    linkInput.addEventListener("focus", function () { linkInput.select(); });

    var row = ui.el("div", { class: "modal-actions" });
    row.appendChild(copyEmailBtn);
    row.appendChild(copyLinkBtn);
    row.appendChild(closeBtn);
    modal.appendChild(row);

    document.body.appendChild(backdrop);
    emailArea.select();
  }

  function copyInvite(user) {
    var loginId = typeof user === "string" ? user : user.login_id;
    var displayName = typeof user === "string" ? user : user.display_name;
    var url = CIS.inviteUrl ? CIS.inviteUrl(loginId) : "";
    if (!url) return;
    showInviteDialog(loginId, displayName, url);
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

    modal.appendChild(ui.el("label", {}, [
      isEdit ? "New password (leave blank to keep)" : "Password (leave blank — user sets on first sign-in)",
    ]));
    const pwInput = ui.el("input", { type: "password", autocomplete: "new-password" });
    pwInput.setAttribute("placeholder", isEdit ? "unchanged" : "optional");
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
      if (!isEdit && r.name === "quality_viewer") cb.checked = true;
      if (!isEdit && r.name === "admin") cb.checked = false;
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
      const pw = pwInput.value;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      try {
        if (isEdit) {
          const body = { display_name: nameInput.value.trim(), status: modal._statusSel.value, role_ids: roleIds };
          if (pw.trim()) body.password = pw.trim();
          await ctx.api.identity("/users/" + user.user_id, { method: "PATCH", body });
          document.body.removeChild(backdrop);
          if (usersWrap) await refreshUsers(ctx, usersWrap);
        } else {
          const body = {
            login_id: loginInput.value.trim(),
            display_name: nameInput.value.trim(),
            role_ids: roleIds,
          };
          if (pw.trim()) body.password = pw.trim();
          const created = await ctx.api.identity("/users", { method: "POST", body });
          document.body.removeChild(backdrop);
          if (usersWrap) await refreshUsers(ctx, usersWrap);
          var link = fullInviteUrl(created.invite_url) || (CIS.inviteUrl && CIS.inviteUrl(created.login_id));
          if (link) {
            showInviteDialog(created.login_id, created.display_name || nameInput.value.trim(), link);
          }
        }
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
    kind: "app",
    order: 10,
    icon: "admin",
    description: "Manage logins, roles, and permissions",
    requires: "identity.admin",
    render,
  });
})();
