/* CIS V2 — home reports dashboard + department tile boards. */
(function () {
  "use strict";

  var DISPLAY_TZ = "Africa/Windhoek";

  function modById(id) {
    var mods = window.CIS && CIS.modules ? CIS.modules : [];
    for (var i = 0; i < mods.length; i++) {
      if (mods[i].id === id) return mods[i];
    }
    return null;
  }

  function moduleAccessible(id) {
    var mod = modById(id);
    if (!mod || mod.inactive) return false;
    if (!window.CIS || !CIS.canAccessModule) return true;
    return CIS.canAccessModule(mod);
  }

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  function fmtMass(kg) {
    if (window.CIS && CIS.formatMassFromKg) {
      return CIS.formatMassFromKg(kg);
    }
    var v = Number(kg);
    if (!isFinite(v)) return "—";
    if (Math.abs(v) >= 1000) {
      return (v / 1000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " t";
    }
    return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
  }

  /** V2 home: tonnage first (production / office), bag count in brackets (logistics cue). */
  function bagCountLabel(bags) {
    var b = Number(bags || 0);
    if (!isFinite(b)) return "— bags";
    return fmt(b) + (b === 1 ? " bag" : " bags");
  }

  function massThenBags(bags, kg) {
    return fmtMass(kg) + " (" + bagCountLabel(bags) + ")";
  }

  function bagsMass(bags, kg) {
    return massThenBags(bags, kg);
  }

  function greetingName() {
    var u = window.CIS && CIS._state && CIS._state.user;
    if (!u) return "there";
    var n = (u.display_name || u.login_id || "").trim();
    if (!n) return "there";
    return n.split(/\s+/)[0];
  }

  function timeGreeting() {
    try {
      var h = parseInt(
        new Date().toLocaleString("en-GB", { timeZone: DISPLAY_TZ, hour: "2-digit", hour12: false }),
        10
      );
      if (h < 12) return "Good morning";
      if (h < 17) return "Good afternoon";
      return "Good evening";
    } catch (e) {
      return "Hello";
    }
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs.text;
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function openModule(id) {
    if (window.CIS && CIS.openModule) CIS.openModule(id);
  }

  function reportRowButton(moduleId) {
    var mod = modById(moduleId);
    if (!mod || !moduleAccessible(moduleId)) return null;
    var btn = el("button", { type: "button", className: "v2-report-row" });
    btn.appendChild(el("span", { className: "v2-report-row__title" }, [mod.title || moduleId]));
    if (mod.description) {
      btn.appendChild(el("span", { className: "v2-report-row__desc muted" }, [mod.description]));
    }
    btn.addEventListener("click", function () {
      openModule(moduleId);
    });
    return btn;
  }

  function reportRowList(moduleIds) {
    var list = el("ul", { className: "v2-report-rows" });
    var any = false;
    moduleIds.forEach(function (id) {
      var row = reportRowButton(id);
      if (row) {
        var li = el("li");
        li.appendChild(row);
        list.appendChild(li);
        any = true;
      }
    });
    return any ? list : el("p", { className: "muted" }, ["Nothing assigned to you in this area."]);
  }

  function statusBucket(group, key) {
    var list = (group && group.statuses) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i];
    }
    return { bags: 0, kg: 0 };
  }

  function groupByKey(statusData, key) {
    var groups = (statusData && statusData.groups) || [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].key === key) return groups[i];
    }
    return null;
  }

  function palletSummaryBucket(palletSummary, key) {
    var buckets = (palletSummary && palletSummary.buckets) || [];
    for (var i = 0; i < buckets.length; i++) {
      if (buckets[i].key === key) return buckets[i];
    }
    return { bags: 0, kg: 0 };
  }

  function streamBagsInGroup(group, streamKey) {
    var n = 0;
    (group && group.statuses ? group.statuses : []).forEach(function (st) {
      n += (st.streams && st.streams[streamKey]) || 0;
    });
    return n;
  }

  function streamKgInGroup(group, streamKey) {
    var kg = 0;
    (group && group.statuses ? group.statuses : []).forEach(function (st) {
      var sb = (st.streams && st.streams[streamKey]) || 0;
      if (!sb || !st.bags) return;
      kg += (st.kg || 0) * (sb / st.bags);
    });
    return Math.round(kg * 1000) / 1000;
  }

  var INTAKE_STREAMS = [
    { key: "restaurant", label: "Restaurant" },
    { key: "lumpwood", label: "Lumpwood" },
    { key: "fines", label: "Fines" },
  ];

  /** Walvis / AGL container loading — restaurant & lumpwood only (no fines on snapshot). */
  var COAST_BULK_STREAMS = [
    { key: "restaurant", label: "Restaurant" },
    { key: "lumpwood", label: "Lumpwood" },
  ];

  var FACTORY_PALLET_YARD_STATUSES = ["in_storage", "in_storage_weathering", "in_storage_released_early"];

  function streamBagsInStatus(st, streamKey) {
    return (st && st.streams && st.streams[streamKey]) || 0;
  }

  function streamKgInStatus(st, streamKey) {
    var sb = streamBagsInStatus(st, streamKey);
    if (!sb || !st.bags) return 0;
    return Math.round((st.kg || 0) * (sb / st.bags) * 1000) / 1000;
  }

  function appendStorageSection(parent, title, accentColor) {
    var sec = el("div", { className: "v2-storage-section" });
    var head = el("div", { className: "v2-storage-section-head" });
    if (accentColor) {
      var sw = el("span", { className: "v2-storage-section-accent" });
      sw.style.background = accentColor;
      head.appendChild(sw);
    }
    head.appendChild(document.createTextNode(title));
    sec.appendChild(head);
    parent.appendChild(sec);
    return sec;
  }

  function appendMassBagsValue(parentClass, bags, kg) {
    var val = el("span", { className: parentClass });
    val.appendChild(document.createTextNode(fmtMass(kg) + " "));
    val.appendChild(
      el("span", { className: "v2-mass-bags-bracket muted" }, ["(" + bagCountLabel(bags) + ")"])
    );
    return val;
  }

  function appendStreamSubrow(parent, label, bags, kg) {
    var row = el("div", { className: "v2-storage-subrow" });
    row.appendChild(el("span", { className: "v2-storage-subrow__label" }, [label]));
    row.appendChild(appendMassBagsValue("v2-storage-subrow__value", bags, kg));
    parent.appendChild(row);
  }

  function palletProductsAtStatuses(statusData, effectiveStatuses) {
    var out = {};
    (statusData && statusData.physical_pallets && statusData.physical_pallets.by_product
      ? statusData.physical_pallets.by_product
      : []
    ).forEach(function (bucket) {
      (bucket.rows || []).forEach(function (row) {
        var eff = row.effective_status || row.storage_status || "";
        if (effectiveStatuses.indexOf(eff) < 0) return;
        var code = (row.product_code || "").trim() || "—";
        if (!out[code]) out[code] = { code: code, bags: 0, kg: 0 };
        out[code].bags += 1;
        out[code].kg += Number(row.net_weight_kg) || 0;
      });
    });
    return Object.keys(out)
      .sort()
      .map(function (k) {
        out[k].kg = Math.round(out[k].kg * 1000) / 1000;
        return out[k];
      });
  }

  function factoryPalletProductsInYard(statusData) {
    return palletProductsAtStatuses(statusData, FACTORY_PALLET_YARD_STATUSES);
  }

  function appendCoastBulkStreams(parent, statusSt) {
    COAST_BULK_STREAMS.forEach(function (s) {
      appendStreamSubrow(parent, s.label, streamBagsInStatus(statusSt, s.key), streamKgInStatus(statusSt, s.key));
    });
  }

  function appendPalletSkuBlock(parent, title, statusData, effectiveStatuses) {
    var sec = appendStorageSection(parent, title, "#c2185b");
    var products = palletProductsAtStatuses(statusData, effectiveStatuses);
    if (products.length) {
      products.forEach(function (p) {
        appendStreamSubrow(sec, p.code, p.bags, p.kg);
      });
    } else {
      appendStreamSubrow(sec, "—", 0, 0);
    }
  }

  function renderOpenModuleAction(moduleId, label) {
    if (!moduleAccessible(moduleId)) return null;
    var actions = el("div", { className: "v2-panel-actions" });
    var btn = el("button", { type: "button", className: "v2-action-btn v2-action-btn--primary" }, [
      label || "Open",
    ]);
    btn.addEventListener("click", function () {
      openModule(moduleId);
    });
    actions.appendChild(btn);
    return actions;
  }

  function makeInfoBox(title, accentColor) {
    var box = el("div", { className: "v2-info-box" });
    var head = el("div", { className: "v2-info-box__head" });
    if (accentColor) {
      var sw = el("span", { className: "v2-storage-section-accent" });
      sw.style.background = accentColor;
      head.appendChild(sw);
    }
    head.appendChild(el("span", { className: "v2-info-box__title" }, [title]));
    box.appendChild(head);
    var body = el("div", { className: "v2-info-box__body" });
    box.appendChild(body);
    return { box: box, body: body };
  }

  function appendStreamsBlock(parent, statusSt) {
    INTAKE_STREAMS.forEach(function (s) {
      appendStreamSubrow(parent, s.label, streamBagsInStatus(statusSt, s.key), streamKgInStatus(statusSt, s.key));
    });
  }

  function factoryBriquetteTotals(factory) {
    var briquetteBags = streamBagsInGroup(factory, "briquettes");
    var briquetteKg = streamKgInGroup(factory, "briquettes");
    var atPlant = statusBucket(factory, "at_briquette_plant");
    if (atPlant.bags && !briquetteBags) {
      briquetteBags = atPlant.bags;
      briquetteKg = atPlant.kg;
    }
    return { bags: briquetteBags, kg: briquetteKg };
  }

  function renderFactorySnapshotRow(factory, statusData, lead) {
    var block = el("div", { className: "v2-snapshot-location-block" });
    var headRow = el("div", { className: "v2-snapshot-location-head" });
    headRow.appendChild(el("h3", { className: "v2-location-title" }, ["At Carbo (factory)"]));
    headRow.appendChild(el("span", { className: "v2-snapshot-location-total muted" }, [lead]));
    block.appendChild(headRow);

    var wx = statusBucket(factory, "in_storage_weathering");
    var weathered = statusBucket(factory, "in_storage");
    var briq = factoryBriquetteTotals(factory);
    var products = factoryPalletProductsInYard(statusData);

    var cols = el("div", { className: "v2-snapshot-three-col" });

    var wxBox = makeInfoBox("Bulk bags", "var(--status-amber)");
    wxBox.body.classList.add("v2-info-box__body--stacked");
    var secWx = appendStorageSection(wxBox.body, "Still weathering", "var(--status-amber)");
    appendStreamsBlock(secWx, wx);
    var secReady = appendStorageSection(wxBox.body, "Weathered", "var(--status-green)");
    appendStreamsBlock(secReady, weathered);
    cols.appendChild(wxBox.box);

    var palBox = makeInfoBox("Pallets in storage", "#c2185b");
    if (products.length) {
      products.forEach(function (p) {
        appendStreamSubrow(palBox.body, p.code, p.bags, p.kg);
      });
    } else {
      appendStreamSubrow(palBox.body, "—", 0, 0);
    }
    cols.appendChild(palBox.box);

    var briqBox = makeInfoBox("Briquettes", "#8d6e63");
    briqBox.body.appendChild(
      el("p", { className: "v2-info-box__stat" }, [massThenBags(briq.bags, briq.kg)])
    );
    cols.appendChild(briqBox.box);

    block.appendChild(cols);
    return block;
  }

  /** Carbo Yard or AGL yard at Walvis — bulk R/L + pallet SKUs (same layout for both). */
  function renderCoastYardBox(title, accentColor, statusSt, statusData, palletEffectiveStatuses) {
    var boxWrap = makeInfoBox(title, accentColor);
    appendCoastBulkStreams(boxWrap.body, statusSt);
    appendPalletSkuBlock(boxWrap.body, "Pallets", statusData, palletEffectiveStatuses);
    return boxWrap.box;
  }

  function renderInContainerBox(coast, statusData) {
    var boxWrap = makeInfoBox("In container", "#059669");
    appendCoastBulkStreams(boxWrap.body, statusBucket(coast, "in_container"));
    appendPalletSkuBlock(boxWrap.body, "Pallets", statusData, ["in_container"]);
    return boxWrap.box;
  }

  function renderHomeTraceRow(host, data) {
    var row = el("div", { className: "content-grid v2-home-trace-grid" });
    var any = false;

    if (moduleAccessible("bags_movement_report") && data.intakeData) {
      any = true;
      var intake = data.intakeData;
      var cardIn = el("section", { className: "panel v2-snapshot-tile v2-home-trace-card" });
      cardIn.appendChild(el("h3", { className: "v2-location-title" }, ["Charcoal intake"]));
      cardIn.appendChild(
        el("p", { className: "v2-stat-primary" }, [
          massThenBags(intake.bag_count, intake.total_kg) + " sieved",
        ])
      );
      var streams = intake.streams || {};
      var streamBlock = el("div", { className: "v2-factory-breakdown v2-home-trace-detail" });
      INTAKE_STREAMS.forEach(function (s) {
        var st = streams[s.key] || { bags: 0, kg: 0 };
        appendStreamSubrow(streamBlock, s.label, st.bags || 0, st.kg || 0);
      });
      cardIn.appendChild(streamBlock);
      if (intake.intake_pace && intake.intake_pace.avg_bags_per_day != null) {
        cardIn.appendChild(
          el("p", { className: "muted v2-home-trace-foot" }, [
            "Pace: " +
              fmt(intake.intake_pace.avg_bags_per_day) +
              " bags/day (" +
              (intake.intake_pace.lookback_days || 14) +
              " days)",
          ])
        );
      }
      var openIn = renderOpenModuleAction("bags_movement_report", "Open Charcoal intake");
      if (openIn) cardIn.appendChild(openIn);
      row.appendChild(cardIn);
    }

    if (moduleAccessible("bags_status_report") && data.statusData) {
      any = true;
      var sd = data.statusData;
      var cardBs = el("section", { className: "panel v2-snapshot-tile v2-home-trace-card" });
      cardBs.appendChild(el("h3", { className: "v2-location-title" }, ["Bags Status"]));
      var inSys = sd.in_system || { bags: 0, kg: 0 };
      cardBs.appendChild(
        el("p", { className: "v2-stat-primary" }, [massThenBags(inSys.bags, inSys.kg) + " in system"])
      );
      var factory = groupByKey(sd, "factory");
      var transit = transitBagsFromStatus(sd);
      var walvis = groupByKey(sd, "walvis_storage");
      var detailBs = el("div", { className: "v2-factory-breakdown v2-home-trace-detail" });
      appendStreamSubrow(
        detailBs,
        "At Carbo (factory)",
        factory ? factory.bags : 0,
        factory ? factory.kg : 0
      );
      appendStreamSubrow(detailBs, "In transit", transit.bags, transit.kg);
      appendStreamSubrow(
        detailBs,
        "Walvis Bay storage",
        walvis ? walvis.bags : 0,
        walvis ? walvis.kg : 0
      );
      cardBs.appendChild(detailBs);
      var openBs = renderOpenModuleAction("bags_status_report", "Open Bags Status");
      if (openBs) cardBs.appendChild(openBs);
      row.appendChild(cardBs);
    }

    if (any) host.appendChild(row);
  }

  function appendLegendLine(list, label, bags, kg, color) {
    if (!bags && !kg) return;
    var li = el("li");
    var sw = el("span", { className: "legend-swatch" });
    sw.style.background = color;
    li.appendChild(sw);
    li.appendChild(document.createTextNode(label + ": " + bagsMass(bags, kg)));
    list.appendChild(li);
  }

  function renderLocationPanel(title, lead, lines) {
    var panel = el("section", { className: "panel v2-snapshot-tile" });
    panel.appendChild(el("h3", { className: "v2-location-title" }, [title]));
    if (lead) panel.appendChild(el("p", { className: "v2-stat-primary" }, [lead]));
    var list = el("ul", { className: "legend v2-storage-legend" });
    (lines || []).forEach(function (line) {
      appendLegendLine(list, line.label, line.bags, line.kg, line.color);
    });
    if (list.childNodes.length) panel.appendChild(list);
    else panel.appendChild(el("p", { className: "muted" }, ["Nothing in this location right now."]));
    return panel;
  }

  function renderStorageSnapshot(host, statusData) {
    var wrap = el("section", { className: "panel v2-storage-snapshot v2-snapshot-tile v2-snapshot-hero" });
    wrap.appendChild(el("h2", { className: "panel-title" }, ["Carbo Namibia storage snapshot"]));
    wrap.appendChild(
      el("p", { className: "muted v2-panel-lead" }, [
        "Factory yard, Carbo Yard and AGL yard at Walvis Bay, and containers staged for dispatch.",
      ])
    );

    var factory = groupByKey(statusData, "factory") || { statuses: [] };
    var walvis = groupByKey(statusData, "walvis_storage") || { statuses: [] };
    var coast = groupByKey(statusData, "coast") || { statuses: [] };
    var carboLead = factory.bags != null ? bagsMass(factory.bags, factory.kg) : massThenBags(0, 0);

    var mainGrid = el("div", { className: "v2-snapshot-main-grid" });
    var primaryCol = el("div", { className: "v2-snapshot-main-grid__primary" });
    primaryCol.appendChild(renderFactorySnapshotRow(factory, statusData, carboLead));
    mainGrid.appendChild(primaryCol);

    var asideCol = el("div", { className: "v2-snapshot-main-grid__aside" });
    asideCol.appendChild(
      renderCoastYardBox(
        "Carbo Yard — Walvis Bay",
        "var(--status-blue)",
        statusBucket(walvis, "storage_walvisbay"),
        statusData,
        ["storage_walvisbay"]
      )
    );
    asideCol.appendChild(
      renderCoastYardBox(
        "AGL yard — Walvis Bay",
        "#059669",
        statusBucket(coast, "storage_agl"),
        statusData,
        ["storage_agl"]
      )
    );
    asideCol.appendChild(renderInContainerBox(coast, statusData));
    mainGrid.appendChild(asideCol);
    wrap.appendChild(mainGrid);
    if (statusData.in_system) {
      var closed = statusData.closed || { bags: 0, kg: 0 };
      wrap.appendChild(
        el("p", { className: "muted v2-footnote" }, [
          "Active inventory in traceability (factory, transit, yards, and in container): " +
            bagsMass(statusData.in_system.bags, statusData.in_system.kg) +
            ". Excludes sold, dispatched, and bags consumed at packaging or briquettes" +
            (closed.bags
              ? " (" + massThenBags(closed.bags, closed.kg) + " closed)."
              : ". Not cumulative intake — sieved history is under Charcoal intake."),
        ])
      );
    }
    host.appendChild(wrap);
  }

  async function fetchLandingData() {
    var statusData = null;
    var intakeData = null;
    if (window.CIS && CIS.api && CIS.api.traceability) {
      if (moduleAccessible("bags_status_report")) {
        try {
          statusData = await CIS.api.traceability("/reports/bags-status");
        } catch (e) {
          statusData = null;
        }
      }
      if (moduleAccessible("bags_movement_report")) {
        try {
          intakeData = await CIS.api.traceability("/reports/bags-movement?scope=all&compact=1");
        } catch (e) {
          intakeData = null;
        }
      }
    }
    return { statusData: statusData, intakeData: intakeData };
  }

  function renderLandingShell(host) {
    host.innerHTML = "";
    var head = el("header", { className: "v2-dash-head" });
    head.appendChild(
      el("h1", { className: "v2-dash-greeting" }, [timeGreeting() + ", " + greetingName() + "."])
    );
    head.appendChild(
      el("p", { className: "v2-dash-tagline" }, [
        "Storage snapshot first, then charcoal intake and Bags Status. Departments are in the left menu.",
      ])
    );
    host.appendChild(head);
    host.appendChild(
      el("p", { className: "muted v2-dash-loading-first", id: "v2-dash-loading" }, [
        "Loading storage snapshot…",
      ])
    );
  }

  window.CIS_V2_renderHomeDashboard = function (host) {
    if (!host) return;
    renderLandingShell(host);
    var loadingEl = document.getElementById("v2-dash-loading");
    fetchLandingData().then(function (data) {
      if (loadingEl && loadingEl.parentNode) loadingEl.remove();
      if (data.statusData) {
        renderStorageSnapshot(host, data.statusData);
      }
      renderHomeTraceRow(host, data);
      if (!data.statusData && !data.intakeData) {
        host.appendChild(
          el("p", { className: "muted" }, [
            "Charcoal intake and Bags Status are not assigned to your account yet.",
          ])
        );
      }
    });
  };

  function makeStatCard(title, moduleId, openLabel) {
    var card = el("section", { className: "panel v2-stat-card" });
    card.appendChild(el("h3", { className: "v2-location-title" }, [title]));
    var primaryEl = el("p", { className: "v2-stat-primary" }, ["…"]);
    var detailEl = el("p", { className: "muted v2-stat-secondary" }, ["Loading…"]);
    card.appendChild(primaryEl);
    card.appendChild(detailEl);
    if (moduleId && moduleAccessible(moduleId)) {
      var actions = el("div", { className: "v2-panel-actions" });
      var btn = el(
        "button",
        { type: "button", className: "v2-action-btn v2-action-btn--primary" },
        [openLabel || "Open"]
      );
      btn.addEventListener("click", function () {
        openModule(moduleId);
      });
      actions.appendChild(btn);
      card.appendChild(actions);
    }
    return { card: card, primaryEl: primaryEl, detailEl: detailEl };
  }

  function appendDeptHub(host, cards) {
    if (!cards.length) return;
    var hub = el("section", { className: "v2-dept-hub" });
    var grid = el("div", { className: "content-grid v2-dept-hub-grid" });
    cards.forEach(function (c) {
      grid.appendChild(c);
    });
    hub.appendChild(grid);
    host.appendChild(hub);
  }

  function transitBagsFromStatus(statusData) {
    var transit = groupByKey(statusData, "in_transit");
    var coast = groupByKey(statusData, "coast");
    var bags = (transit && transit.bags) || 0;
    var kg = (transit && transit.kg) || 0;
    if (coast) {
      bags += coast.bags || 0;
      kg += coast.kg || 0;
    }
    return { bags: bags, kg: kg };
  }

  async function loadLogisticsHub(host) {
    if (!host || !window.CIS || !CIS.api || !CIS.api.traceability) return;
    var cards = [];
    var walvisCard = null;
    var transitCard = null;
    var dcCard = null;

    if (moduleAccessible("walvis_dispatches")) {
      walvisCard = makeStatCard("Walvis dispatch", "walvis_dispatches", "Walvis dispatches");
      cards.push(walvisCard.card);
    }
    if (moduleAccessible("bags_status_report")) {
      transitCard = makeStatCard("In transit", "bags_status_report", "Bags Status");
      cards.push(transitCard.card);
    }
    if (moduleAccessible("delivery_confirmations")) {
      dcCard = makeStatCard("Delivery confirmations", "delivery_confirmations", "Confirm deliveries");
      cards.push(dcCard.card);
    }
    appendDeptHub(host, cards);

    var jobs = [];

    if (walvisCard) {
      jobs.push(
        (async function () {
          try {
            var activeResp = await CIS.api.traceability("/walvis-dispatches/active");
            var open = activeResp && activeResp.dispatch;
            var br = await CIS.api.traceability("/walvis-dispatches/storage-at-walvis-breakdown");
            if (open) {
              walvisCard.primaryEl.textContent =
                (open.loaded_bags || 0) + " on manifest";
              walvisCard.detailEl.textContent =
                "Open: " + (open.display_label || "Dispatch #" + open.dispatch_number);
            } else {
              walvisCard.primaryEl.textContent = "No open dispatch";
              walvisCard.detailEl.textContent =
                "Open a dispatch before Shorty loads at Grootfontein.";
            }
            var walvisBulk = 0;
            (br.dispatches || []).forEach(function (d) {
              walvisBulk += d.bags_in_storage || 0;
            });
            var un = (br.unassigned && br.unassigned.bags_in_storage) || 0;
            var ground = "Walvis ground: " + walvisBulk + " bag(s)";
            if (un) ground += " · " + un + " unassigned";
            walvisCard.detailEl.textContent += open ? " · " + ground : ground;
          } catch (e) {
            walvisCard.primaryEl.textContent = "Unavailable";
            walvisCard.detailEl.textContent = "Walvis API could not be reached.";
          }
        })()
      );
    }

    if (transitCard) {
      jobs.push(
        (async function () {
          try {
            var statusData = await CIS.api.traceability("/reports/bags-status");
            var t = transitBagsFromStatus(statusData);
            transitCard.primaryEl.textContent = fmt(t.bags) + " bags";
            transitCard.detailEl.textContent =
              t.bags ? bagsMass(t.bags, t.kg) + " — trucks & coast" : "Nothing in transit right now.";
          } catch (e) {
            transitCard.primaryEl.textContent = "Unavailable";
            transitCard.detailEl.textContent = "Bags Status report could not be loaded.";
          }
        })()
      );
    }

    if (dcCard) {
      jobs.push(
        (async function () {
          try {
            var dc = await CIS.api.traceability(
              "/delivery-confirmations?status=pending&limit=200"
            );
            var n = dc.count != null ? dc.count : (dc.rows || []).length;
            dcCard.primaryEl.textContent = fmt(n) + (n >= 200 ? "+" : "");
            dcCard.detailEl.textContent =
              n === 1
                ? "Truck waiting for office confirmation."
                : n
                  ? "Factory-posted loads pending PJ / office fields."
                  : "No pending confirmations.";
          } catch (e) {
            dcCard.primaryEl.textContent = "Unavailable";
            dcCard.detailEl.textContent = "Delivery confirmations could not be loaded.";
          }
        })()
      );
    }

    await Promise.all(jobs);
  }

  async function loadOfficeHub(host) {
    if (!host || !window.CIS || !CIS.api) return;
    var cards = [];
    var dcCard = null;
    var regCard = null;

    if (moduleAccessible("delivery_confirmations") && CIS.api.traceability) {
      dcCard = makeStatCard("Deliveries to confirm", "delivery_confirmations", "Delivery confirmations");
      cards.push(dcCard.card);
    } else if (moduleAccessible("deliveries_register") && CIS.api.qualityReports) {
      regCard = makeStatCard("Deliveries register", "deliveries_register", "Open register");
      cards.push(regCard.card);
    }
    appendDeptHub(host, cards);

    if (dcCard) {
      try {
        var dc = await CIS.api.traceability("/delivery-confirmations?status=pending&limit=200");
        var n = dc.count != null ? dc.count : (dc.rows || []).length;
        dcCard.primaryEl.textContent = fmt(n) + (n >= 200 ? "+" : "");
        dcCard.detailEl.textContent = n
          ? "Pending office confirmation after factory POST."
          : "All caught up on delivery confirmations.";
      } catch (e) {
        dcCard.primaryEl.textContent = "Unavailable";
        dcCard.detailEl.textContent = String(e.message || e);
      }
    } else if (regCard) {
      try {
        var year = String(new Date().getFullYear());
        var reg = await CIS.api.qualityReports("/deliveries-register?year=" + encodeURIComponent(year));
        var n = reg.count != null ? reg.count : (reg.rows || []).length;
        regCard.primaryEl.textContent = fmt(n) + " rows";
        regCard.detailEl.textContent = "Charcoal Tracker deliveries — calendar year " + year + ".";
      } catch (e) {
        regCard.primaryEl.textContent = "Unavailable";
        regCard.detailEl.textContent = String(e.message || e);
      }
    }
  }

  async function loadProductionHub(host) {
    if (!host || !window.CIS || !CIS.api || !CIS.api.traceability) return;
    var cards = [];
    var shiftCard = null;

    if (moduleAccessible("packaging_shift")) {
      shiftCard = makeStatCard("Packaging shift", "packaging_shift", "Packaging shift");
      cards.push(shiftCard.card);
    }
    if (moduleAccessible("print_labels")) {
      cards.push(makeStatCard("Print labels", "print_labels", "Print labels").card);
    }
    appendDeptHub(host, cards);

    if (shiftCard) {
      try {
        var data = await CIS.api.traceability("/packaging-shifts");
        var active = null;
        (data.shifts || []).forEach(function (s) {
          if (s.status === "active") active = s;
        });
        if (active) {
          shiftCard.primaryEl.textContent = "Active";
          shiftCard.detailEl.textContent =
            (active.product_codes || []).join(", ") || active.title || "Shift in progress";
        } else {
          shiftCard.primaryEl.textContent = "None active";
          shiftCard.detailEl.textContent = "Start a shift when Candy / wrap should scan scheduled SKUs.";
        }
      } catch (e) {
        shiftCard.primaryEl.textContent = "Unavailable";
        shiftCard.detailEl.textContent = String(e.message || e);
      }
    }
  }

  window.CIS_V2_renderDepartmentDashboard = function (host, deptId) {
    if (!host) return;
    host.innerHTML = "";
    var nav = window.CIS_V2_NAV;
    var group =
      deptId === "administration"
        ? nav && nav.dockAdministration
        : (nav.groups || []).filter(function (g) {
            return g.id === deptId;
          })[0];
    if (!group) {
      host.appendChild(el("p", { className: "error-box" }, ["Unknown department."]));
      return;
    }
    var head = el("header", { className: "v2-dash-head" });
    head.appendChild(el("h1", { className: "v2-dash-greeting" }, [group.title]));
    if (group.blurb) head.appendChild(el("p", { className: "v2-dash-tagline" }, [group.blurb]));
    host.appendChild(head);
    if (deptId === "logistics") {
      void loadLogisticsHub(host);
    } else if (deptId === "office") {
      void loadOfficeHub(host);
    } else if (deptId === "production") {
      void loadProductionHub(host);
    }
    var ids = window.CIS_V2_departmentModuleIds ? CIS_V2_departmentModuleIds(deptId) : [];
    host.appendChild(reportRowList(ids));
  };
})();
