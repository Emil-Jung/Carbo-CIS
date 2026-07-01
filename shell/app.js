/* Carbo Integrated System — shell.
 * Handles login, session token, and permission-gated module loading.
 * Modules register themselves on window.CIS.modules before this runs. */
(function () {
  "use strict";

  const TOKEN_KEY = "cis_token";
  const CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  const state = { config: null, token: null, user: null, permissions: [], activeModuleId: null };

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
      // Session gone — force re-login.
      doLogout(true);
      throw new Error("Session expired. Please sign in again.");
    }
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    if (!res.ok) {
      const detail = data && data.detail ? data.detail : ("HTTP " + res.status);
      throw new Error(detail);
    }
    return data;
  }

  CIS.api = {
    identity: (path, opts) => apiFetch(state.config.identityApiBase, path, opts),
    maintenance: (path, opts) => apiFetch(state.config.maintenanceApiBase, path, opts),
  };
  CIS.hasPermission = (perm) => state.permissions.indexOf(perm) !== -1;
  CIS.currentUser = () => state.user;

  // ---- Boot ------------------------------------------------------------
  async function boot() {
    try {
      state.config = await (await fetch("config.json", { cache: "no-store" })).json();
    } catch (e) {
      state.config = { identityApiBase: "/identity/api", maintenanceApiBase: "/maintenance/api" };
    }
    state.token = localStorage.getItem(TOKEN_KEY);
    wireLogin();
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
    showLogin();
  }

  async function loadSession() {
    const me = await CIS.api.identity("/auth/me");
    state.user = { user_id: me.user_id, login_id: me.login_id, display_name: me.display_name };
    state.permissions = me.permissions || [];
  }

  // ---- Login / logout --------------------------------------------------
  function wireLogin() {
    const form = document.getElementById("login-form");
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = document.getElementById("login-btn");
      const errEl = document.getElementById("login-error");
      errEl.classList.add("hidden");
      btn.disabled = true;
      btn.textContent = "Signing in...";
      try {
        const result = await CIS.api.identity("/auth/login", {
          method: "POST",
          body: {
            login_id: document.getElementById("login-id").value.trim(),
            password: document.getElementById("login-password").value,
          },
        });
        state.token = result.token;
        localStorage.setItem(TOKEN_KEY, result.token);
        state.user = result.user;
        state.permissions = result.permissions || [];
        document.getElementById("login-password").value = "";
        showApp();
      } catch (e) {
        errEl.textContent = e.message || "Sign in failed";
        errEl.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "Sign in";
      }
    });
  }

  async function doLogout(silent) {
    try { if (state.token) await CIS.api.identity("/auth/logout", { method: "POST" }); } catch (e) {}
    localStorage.removeItem(TOKEN_KEY);
    state.token = null; state.user = null; state.permissions = []; state.activeModuleId = null;
    showLogin();
  }

  // ---- Views -----------------------------------------------------------
  function showLogin() {
    document.getElementById("app-view").classList.add("hidden");
    document.getElementById("login-view").classList.remove("hidden");
    document.getElementById("login-id").focus();
  }

  function showApp() {
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");
    document.getElementById("current-user").textContent =
      (state.user.display_name || state.user.login_id);
    const verEl = document.getElementById("app-version");
    if (verEl) verEl.textContent = state.config && state.config.cisVersion ? ("v" + state.config.cisVersion) : "";
    setupUpdateButton();
    renderNav();
  }

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

  function visibleModules() {
    return CIS.modules.filter((m) => !m.requires || CIS.hasPermission(m.requires));
  }

  function renderNav() {
    const nav = document.getElementById("module-nav");
    nav.innerHTML = "";
    const mods = visibleModules();
    if (mods.length === 0) {
      nav.innerHTML = '<div class="nav-empty">No modules available for your account. Ask an administrator to grant access.</div>';
      document.getElementById("module-content").innerHTML = "";
      return;
    }
    mods.forEach((m) => {
      const btn = document.createElement("button");
      btn.className = "nav-item" + (m.id === state.activeModuleId ? " active" : "");
      btn.textContent = m.title;
      btn.addEventListener("click", () => openModule(m.id));
      nav.appendChild(btn);
    });
    if (!state.activeModuleId || !mods.some((m) => m.id === state.activeModuleId)) {
      openModule(mods[0].id);
    }
  }

  function openModule(id) {
    const mod = CIS.modules.find((m) => m.id === id);
    if (!mod) return;
    if (mod.requires && !CIS.hasPermission(mod.requires)) return;
    state.activeModuleId = id;
    renderNav();
    const content = document.getElementById("module-content");
    content.innerHTML = "";
    try {
      mod.render(content, { api: CIS.api, user: state.user, permissions: state.permissions });
    } catch (e) {
      content.innerHTML = '<div class="error-box">Module failed to load: ' + (e.message || e) + "</div>";
    }
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
