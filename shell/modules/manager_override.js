/* Manager Override — daily PIN for weathering early-release on yard scanners. */

(function () {
  "use strict";

  var CIS = (window.CIS = window.CIS || {});
  CIS.modules = CIS.modules || [];

  function formatWhen(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      return d.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return iso;
    }
  }

  function render(container, ctx) {
    var ui = CIS.ui;
    container.innerHTML = "";
    container.className = "module-content manager-override-host";

    container.appendChild(ui.el("h2", { class: "module-title" }, ["Manager Override"]));
    container.appendChild(ui.el("p", { class: "module-desc" }, [
      "Generate a 4-digit PIN for today (Windhoek time). Give it to the operator on the yard scanner — it unlocks weathering early-release only, not Walvis Bay.",
    ]));

    container.appendChild(ui.el("button", {
      class: "btn-ghost btn-sm hub-back",
      type: "button",
      onclick: function () {
        if (CIS.openModule) CIS.openModule("traceability");
      },
    }, ["Back to Traceability"]));

    var statusCard = ui.el("section", { class: "manager-override-panel" });
    var statusBody = ui.el("div", { class: "manager-override-panel-body" });
    statusCard.appendChild(ui.el("h3", { class: "print-labels-panel-title" }, ["Today's PIN"]));
    statusCard.appendChild(statusBody);
    container.appendChild(statusCard);

    var pinReveal = ui.el("div", { class: "manager-override-pin-reveal", hidden: true });
    pinReveal.appendChild(ui.el("p", { class: "manager-override-pin-label" }, ["PIN for the operator"]));
    var pinValue = ui.el("p", { class: "manager-override-pin-value" }, ["—"]);
    pinReveal.appendChild(pinValue);
    pinReveal.appendChild(ui.el("p", { class: "manager-override-pin-hint muted" }, [
      "Write this down or tell the operator now. It is not shown again after you leave this screen.",
    ]));
    container.appendChild(pinReveal);

    var msgEl = ui.el("p", { class: "manager-override-msg muted" });
    container.appendChild(msgEl);

    var generateBtn = ui.el("button", {
      class: "btn-sm",
      type: "button",
    }, ["Generate today's PIN"]);
    container.appendChild(generateBtn);

    function setMsg(text, isError) {
      msgEl.textContent = text || "";
      msgEl.className = "manager-override-msg" + (text ? (isError ? " is-error" : "") : " muted");
    }

    function renderStatus(data) {
      statusBody.innerHTML = "";
      if (!data) {
        statusBody.appendChild(ui.el("p", { class: "muted" }, ["Loading…"]));
        return;
      }
      statusBody.appendChild(
        ui.el("p", {}, ["Date: " + (data.valid_date || "—") + " (" + (data.timezone || "Africa/Windhoek") + ")"])
      );
      if (data.configured) {
        var okRow = ui.el("p", {});
        okRow.appendChild(ui.el("span", { class: "pill ok" }, ["PIN active"]));
        statusBody.appendChild(okRow);
        statusBody.appendChild(ui.el("p", { class: "muted" }, [
          "Created " + formatWhen(data.created_at) + (data.created_by ? " by " + data.created_by : ""),
        ]));
        generateBtn.textContent = "Replace today's PIN";
      } else {
        var warnRow = ui.el("p", {});
        warnRow.appendChild(ui.el("span", { class: "pill warn" }, ["No PIN yet"]));
        statusBody.appendChild(warnRow);
        statusBody.appendChild(ui.el("p", { class: "muted" }, [
          "Operators cannot use weathering override on the scanner until you generate one.",
        ]));
        generateBtn.textContent = "Generate today's PIN";
      }
    }

    async function loadStatus() {
      if (!ctx.api || !ctx.api.traceability) {
        renderStatus(null);
        statusBody.innerHTML = "";
        statusBody.appendChild(ui.el("p", { class: "error-box" }, ["Traceability API not configured."]));
        generateBtn.disabled = true;
        return;
      }
      setMsg("");
      try {
        var data = await ctx.api.traceability("/manager-override-pin/today");
        renderStatus(data);
        generateBtn.disabled = false;
      } catch (e) {
        renderStatus(null);
        statusBody.innerHTML = "";
        statusBody.appendChild(ui.el("p", { class: "error-box" }, [String(e.message || e)]));
        generateBtn.disabled = true;
      }
    }

    generateBtn.addEventListener("click", async function () {
      if (!ctx.api || !ctx.api.traceability) return;
      var replacing = generateBtn.textContent.indexOf("Replace") === 0;
      var ok = window.confirm(
        replacing
          ? "Replace today's PIN? The old PIN stops working immediately."
          : "Generate today's manager PIN?"
      );
      if (!ok) return;
      pinReveal.hidden = true;
      setMsg("Generating…");
      generateBtn.disabled = true;
      try {
        var data = await ctx.api.traceability("/manager-override-pin/today", { method: "POST" });
        pinValue.textContent = data.pin || "????";
        pinReveal.hidden = false;
        setMsg("PIN ready — give it to the operator.", false);
        renderStatus(data);
      } catch (e) {
        setMsg(String(e.message || e), true);
      } finally {
        generateBtn.disabled = false;
      }
    });

    loadStatus();
  }

  CIS.modules.push({
    id: "manager_override",
    title: "Manager Override",
    kind: "app",
    icon: "override",
    description: "Daily PIN for weathering early-release on scanners",
    requires: "traceability.weathering.override",
    render: render,
  });
})();
