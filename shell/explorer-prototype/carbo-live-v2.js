/* Carbo Live ticker — V2 shell embed (same APIs as pwa-production-viewer; styling in carbo-live-v2.css). */
(function () {
  "use strict";

  var REFRESH_SEC = 30;
  var REFRESH_MS = REFRESH_SEC * 1000;
  var DISPLAY_TZ = "Africa/Windhoek";
  var TOKEN_KEYS = ["cis_token", "pv_cis_token"];

  var STREAM_META = [
    { key: "restaurant", label: "Restaurant", color: "#c75a5a" },
    { key: "lumpwood", label: "Lumpwood", color: "#2d8a54" },
    { key: "fines", label: "Fines", color: "#c9920a" },
  ];

  var state = {
    timer: null,
    loading: false,
    tickerPaused: false,
    lastLiveSerial: null,
    lastDayBagCount: null,
    lastWeatheringToday: null,
    lastIntakePace: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function token() {
    for (var i = 0; i < TOKEN_KEYS.length; i++) {
      var t = localStorage.getItem(TOKEN_KEYS[i]);
      if (t) return t;
    }
    return null;
  }

  function siteOrigin() {
    return location.origin.replace(/\/$/, "");
  }

  async function apiFetch(url, opts) {
    opts = opts || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    var t = token();
    if (t) headers.Authorization = "Bearer " + t;
    var res = await fetch(url, {
      method: opts.method || "GET",
      headers: headers,
      cache: "no-store",
    });
    var text = await res.text();
    var data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
    }
    if (!res.ok) {
      throw new Error((data && data.detail) || "HTTP " + res.status);
    }
    return data;
  }

  function traceApi(path) {
    var bust = "_=" + Date.now();
    var url = siteOrigin() + "/traceability/api/v1" + path;
    url += (path.indexOf("?") >= 0 ? "&" : "?") + bust;
    return apiFetch(url);
  }

  function fmt(n, d) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString(undefined, {
      minimumFractionDigits: d || 0,
      maximumFractionDigits: d != null ? d : 0,
    });
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString("en-GB", {
        timeZone: DISPLAY_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch (e) {
      return "—";
    }
  }

  function todayLocalIso() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: DISPLAY_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch (e) {
      return "";
    }
  }

  function fmtDateShort(iso) {
    if (!iso) return "—";
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return parseInt(p[2], 10) + " " + months[parseInt(p[1], 10) - 1];
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function todayRows(rows) {
    var today = todayLocalIso();
    return (rows || []).filter(function (r) {
      return r.recorded_date === today;
    });
  }

  function setLiveDot(mode) {
    var dot = $("clv2LiveDot");
    if (!dot) return;
    dot.className = "clv2-live-dot" + (mode ? " clv2-live-dot--" + mode : "");
  }

  function setRefreshNote(text, isError) {
    var el = $("clv2RefreshNote");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", !!isError);
  }

  function streamBadgeHtml(streamKey) {
    var key = String(streamKey || "").toLowerCase();
    var label = key;
    STREAM_META.forEach(function (m) {
      if (m.key === key) label = m.label;
    });
    return (
      "<span class='clv2-stream clv2-stream--" + key + "'>" + escapeHtml(label) + "</span>"
    );
  }

  function dayTotalTileHtml(rows, dayKg, dayBags) {
    var streams = { restaurant: 0, lumpwood: 0, fines: 0 };
    rows.forEach(function (r) {
      var kg = parseFloat(r.net_weight_kg) || 0;
      if (streams[r.product_stream] != null) streams[r.product_stream] += kg;
    });
    var breakdown = STREAM_META.map(function (m) {
      return (
        "<li><span class='clv2-stream-dot' style='background:" + m.color + "'></span>" +
        m.label + " <strong>" + fmt(Math.round(streams[m.key] || 0)) + " kg</strong></li>"
      );
    }).join("");
    return (
      "<p class='clv2-tile-kg'>" + fmt(Math.round(dayKg)) + " <span>kg</span></p>" +
      "<ul class='clv2-tile-streams'>" + breakdown + "</ul>" +
      "<p class='clv2-tile-meta'>" + fmt(dayBags) + " bags · " + fmtDateShort(todayLocalIso()) + "</p>"
    );
  }

  function weatheringTileHtml(wx) {
    if (!wx || !wx.weathered_summary) {
      return "<p class='clv2-tile-meta'>Weathering data loading…</p>";
    }
    var week = wx.weathered_summary.this_week || {};
    var today = wx.weathered_summary.today || {};
    return (
      "<p class='clv2-wx-row'><span>This week</span><strong>" + fmt(week.bags || 0) + "</strong> bags</p>" +
      "<p class='clv2-wx-row'><span>Today</span><strong>" + fmt(today.bags || 0) + "</strong> bags</p>"
    );
  }

  function paceTileHtml(data) {
    var pace = data && data.intake_pace;
    if (!pace || pace.avg_bags_per_day == null) {
      return "<p class='clv2-tile-meta'>Intake pace loading…</p>";
    }
    return (
      "<p class='clv2-tile-pace'>" + fmt(Number(pace.avg_bags_per_day), 1) + "</p>" +
      "<p class='clv2-tile-meta'>bags/day · " + (pace.lookback_days || 14) + "-day avg</p>"
    );
  }

  function liveTile(kind, label, body) {
    return (
      "<article class='clv2-tile clv2-tile--" + kind + "' aria-label='" + escapeHtml(label) + "'>" +
      "<p class='clv2-tile-label'>" + escapeHtml(label) + "</p>" +
      "<div class='clv2-tile-body'>" + body + "</div></article>"
    );
  }

  function renderTicker(data, weatheringData) {
    var track = $("clv2LiveTicker");
    if (!track) return;

    var rows = todayRows(data.rows || []);
    var dayKg = rows.reduce(function (s, r) {
      return s + (parseFloat(r.net_weight_kg) || 0);
    }, 0);
    var dayBags = rows.length;
    var dayHtml = dayTotalTileHtml(rows, dayKg, dayBags);

    var scanHtml;
    if (!rows.length) {
      scanHtml = "<p class='clv2-tile-meta'>Waiting for first scan today…</p>";
      state.lastLiveSerial = null;
    } else {
      var latest = rows.slice().sort(function (a, b) {
        return (b.recorded_at || "").localeCompare(a.recorded_at || "");
      })[0];
      var serial = latest.serial || "";
      scanHtml =
        "<p class='clv2-tile-producer'>" + escapeHtml(latest.producer_name || "—") + "</p>" +
        "<p class='clv2-tile-kg'>" + fmt(latest.net_weight_kg, 0) + " <span>kg</span></p>" +
        "<p class='clv2-tile-meta'>" + streamBadgeHtml(latest.product_stream) +
        " " + escapeHtml(serial) + " · " + fmtTime(latest.recorded_at) + "</p>";
      state.lastLiveSerial = serial;
    }

    var pair =
      liveTile("scan", "Latest scan", scanHtml) +
      liveTile("day", "Today's intake", dayHtml) +
      liveTile("pace", "Intake pace", paceTileHtml(data)) +
      liveTile("weathering", "Weathering clock", weatheringTileHtml(weatheringData));

    track.innerHTML = pair + pair;
    track.classList.toggle("is-paused", state.tickerPaused);
  }

  function setupTickerToggle() {
    var viewport = $("clv2LiveViewport");
    var track = $("clv2LiveTicker");
    if (!viewport || !track || viewport.dataset.clv2Wired) return;
    viewport.dataset.clv2Wired = "1";
    viewport.setAttribute("role", "button");
    viewport.setAttribute("tabindex", "0");
    viewport.setAttribute("aria-label", "Carbo Live — tap to pause or resume");
    function toggle() {
      state.tickerPaused = !state.tickerPaused;
      track.classList.toggle("is-paused", state.tickerPaused);
      viewport.setAttribute("aria-pressed", state.tickerPaused ? "true" : "false");
    }
    viewport.addEventListener("click", toggle);
    viewport.addEventListener("keydown", function (ev) {
      if (ev.key === " " || ev.key === "Enter") {
        ev.preventDefault();
        toggle();
      }
    });
  }

  async function refreshData(manual) {
    if (state.loading) return;
    if (!token()) {
      setRefreshNote("Sign in to CIS for live data — showing layout preview.");
      setLiveDot("");
      renderTicker({ rows: [] }, null);
      setupTickerToggle();
      return;
    }
    state.loading = true;
    setLiveDot("busy");
    if (manual) setRefreshNote("Refreshing…");

    try {
      var results = await Promise.all([
        traceApi("/reports/bags-movement?scope=all&compact=1"),
        traceApi("/reports/bags-weathering").catch(function () {
          return null;
        }),
      ]);
      renderTicker(results[0], results[1]);
      setupTickerToggle();
      setRefreshNote("Updated · next refresh in " + REFRESH_SEC + "s");
      setLiveDot("ok");
    } catch (e) {
      setRefreshNote("Could not load: " + (e.message || e), true);
      setLiveDot("err");
    } finally {
      state.loading = false;
    }
  }

  function startPolling() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(function () {
      refreshData(false);
    }, REFRESH_MS);
  }

  function boot() {
    var host = document.querySelector(".carbo-live-v2");
    if (!host) return;
    refreshData(false);
    startPolling();
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshData(false);
    });
    var btn = $("clv2RefreshBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        refreshData(true);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.CarboLiveV2 = { refresh: function () { refreshData(true); } };
})();
