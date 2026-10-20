/* CIS login, invite links (?user=), and first sign-in password setup. */
(function () {
  "use strict";
  var CIS = (window.CIS = window.CIS || {});

  function parseInviteLoginId() {
    var params = new URLSearchParams(window.location.search);
    return (params.get("user") || params.get("login") || "").trim();
  }

  function inviteUrl(loginId) {
    var base = window.location.origin + window.location.pathname.replace(/\/?index\.html$/i, "");
    if (!/\/$/.test(base)) base += "/";
    return base + "?user=" + encodeURIComponent(loginId);
  }
  CIS.inviteUrl = inviteUrl;

  function hideAppShells() {
    var app = document.getElementById("app-view");
    if (app) app.classList.add("hidden");
    var v2 = document.getElementById("explorer-app-view");
    if (v2) {
      v2.classList.add("hidden");
      v2.hidden = true;
      if ("inert" in v2) v2.inert = true;
    }
  }

  function showLoginView() {
    document.getElementById("setup-view").classList.add("hidden");
    document.getElementById("login-view").classList.remove("hidden");
    hideAppShells();
  }

  function showSetupView(loginId) {
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("setup-view").classList.remove("hidden");
    hideAppShells();
    var idEl = document.getElementById("setup-login-id");
    if (idEl) idEl.textContent = loginId;
    document.getElementById("setup-password").value = "";
    document.getElementById("setup-password2").value = "";
    document.getElementById("setup-error").classList.add("hidden");
    document.getElementById("setup-password").focus();
    CIS._setupLoginId = loginId;
  }

  function finishAuth(result) {
    var TOKEN_KEY = "cis_token";
    CIS._state.token = result.token;
    localStorage.setItem(TOKEN_KEY, result.token);
    CIS._state.user = result.user;
    CIS._state.permissions = result.permissions || [];
    if (CIS._showApp) CIS._showApp();
  }

  async function checkInviteAndShowLogin() {
    var loginId = parseInviteLoginId();
    if (loginId) {
      document.getElementById("login-id").value = loginId;
    }
    showLoginView();
    if (!loginId || !CIS.api) return;
    try {
      var status = await CIS.api.identity("/auth/account-status?login_id=" + encodeURIComponent(loginId));
      if (status.exists && status.needs_password && status.active) {
        showSetupView(loginId);
      }
    } catch (e) {
      /* fall back to normal login */
    }
  }

  function passwordToggleKeepFocus(input, update) {
    var start = input.selectionStart;
    var end = input.selectionEnd;
    update();
    input.focus({ preventScroll: true });
    requestAnimationFrame(function () {
      input.focus({ preventScroll: true });
      try {
        if (start !== null && end !== null) {
          input.setSelectionRange(start, end);
        }
      } catch (err) {}
    });
  }

  var PWD_ICON_SHOW =
    '<svg class="password-toggle__icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 11.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>';
  var PWD_ICON_HIDE =
    '<svg class="password-toggle__icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 6.5c2.5 0 4.65 1.03 6.22 2.68l-1.42 1.42A6.9 6.9 0 0 0 12 8.5c-1.6 0-3.08.55-4.25 1.47L6.34 8.56C7.88 7.2 9.85 6.5 12 6.5zM3.27 3 2 4.27l2.28 2.28A11.8 11.8 0 0 0 1 12.5C2.73 16.89 7 20 12 20c2.09 0 4.04-.53 5.7-1.46L20.73 22 22 20.73 3.27 3zm6.53 6.53 1.41 1.41A2.5 2.5 0 0 1 12 14.5c.69 0 1.31-.28 1.76-.73l1.41 1.41A4.5 4.5 0 0 1 12 16.5a4.5 4.5 0 0 1-4.76-4.47l1.56-1.5z"/></svg>';

  function togglePasswordField(btn) {
    var field = btn.closest(".password-field");
    var input = field && field.querySelector("input");
    if (!input) return;
    passwordToggleKeepFocus(input, function () {
      var show = input.getAttribute("type") === "password";
      input.setAttribute("type", show ? "text" : "password");
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.title = show ? "Hide password" : "Show password";
      btn.innerHTML = (show ? PWD_ICON_HIDE : PWD_ICON_SHOW) +
        '<span class="password-toggle__text">' + (show ? "Hide" : "Show") + "</span>";
    });
  }

  function wirePasswordToggles() {
    document.querySelectorAll(".password-toggle").forEach(function (btn) {
      var touchToggle = false;
      btn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
      });
      btn.addEventListener(
        "touchend",
        function (e) {
          e.preventDefault();
          touchToggle = true;
          togglePasswordField(btn);
        },
        { passive: false }
      );
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (touchToggle) {
          touchToggle = false;
          return;
        }
        togglePasswordField(btn);
      });
    });
  }

  function wireAuthForms() {
    wirePasswordToggles();
    var loginForm = document.getElementById("login-form");
    loginForm.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var btn = document.getElementById("login-btn");
      var errEl = document.getElementById("login-error");
      errEl.classList.add("hidden");
      btn.disabled = true;
      btn.textContent = "Signing in...";
      var loginId = document.getElementById("login-id").value.trim();
      try {
        var result = await CIS.api.identity("/auth/login", {
          method: "POST",
          body: {
            login_id: loginId,
            password: document.getElementById("login-password").value,
          },
        });
        document.getElementById("login-password").value = "";
        finishAuth(result);
      } catch (e) {
        if ((e.message || "") === "password_not_set") {
          showSetupView(loginId);
        } else {
          errEl.textContent = e.message || "Sign in failed";
          errEl.classList.remove("hidden");
        }
      } finally {
        btn.disabled = false;
        btn.textContent = "Sign in";
      }
    });

    document.getElementById("setup-form").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var btn = document.getElementById("setup-btn");
      var errEl = document.getElementById("setup-error");
      errEl.classList.add("hidden");
      var pw = document.getElementById("setup-password").value;
      var pw2 = document.getElementById("setup-password2").value;
      if (pw.length < 6) {
        errEl.textContent = "Password must be at least 6 characters";
        errEl.classList.remove("hidden");
        return;
      }
      if (pw !== pw2) {
        errEl.textContent = "Passwords do not match";
        errEl.classList.remove("hidden");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Saving...";
      try {
        var result = await CIS.api.identity("/auth/set-initial-password", {
          method: "POST",
          body: { login_id: CIS._setupLoginId, password: pw },
        });
        finishAuth(result);
      } catch (e) {
        errEl.textContent = e.message || "Could not set password";
        errEl.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "Create password & sign in";
      }
    });

    document.getElementById("setup-back-btn").addEventListener("click", function () {
      showLoginView();
      document.getElementById("login-id").focus();
    });
  }

  CIS.authUi = {
    wireAuthForms: wireAuthForms,
    checkInviteAndShowLogin: checkInviteAndShowLogin,
    showLoginView: showLoginView,
  };
})();
