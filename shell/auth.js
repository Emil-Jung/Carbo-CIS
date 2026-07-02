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

  function showLoginView() {
    document.getElementById("setup-view").classList.add("hidden");
    document.getElementById("login-view").classList.remove("hidden");
    document.getElementById("app-view").classList.add("hidden");
  }

  function showSetupView(loginId) {
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("setup-view").classList.remove("hidden");
    document.getElementById("app-view").classList.add("hidden");
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

  function wireAuthForms() {
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
