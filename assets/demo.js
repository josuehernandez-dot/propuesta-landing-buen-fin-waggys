/* Solo para la vista de propuesta en GitHub Pages:
   carrito simulado y selector de fecha. No se sube a Shopify. */
(function () {
  "use strict";
  var WBF = (window.WBF = window.WBF || {});

  var SIM = {
    pre: "2026-11-10T12:00:00-06:00",
    "buen-fin": "2026-11-15T09:30:00-06:00",
    extension: "2026-11-21T10:00:00-06:00",
    black: "2026-11-28T10:00:00-06:00",
    ended: "2026-12-03T10:00:00-06:00"
  };

  function setPhase(id) {
    WBF.nowOffset = Date.parse(SIM[id]) - Date.now();
    Array.prototype.forEach.call(document.querySelectorAll("[data-demo-phase]"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-demo-phase") === id ? "true" : "false");
    });
    try { history.replaceState(null, "", "?fase=" + id + location.hash); } catch (e) {}
    if (WBF.applyPhase) WBF.applyPhase();
  }

  var m = /[?&]fase=([\w-]+)/.exec(location.search);
  var start = m && SIM[m[1]] ? m[1] : "buen-fin";
  WBF.nowOffset = Date.parse(SIM[start]) - Date.now();

  // carrito simulado
  var items = {};
  WBF.demoAdd = function (id, unit) {
    items[id] = items[id] || { qty: 0, unit: unit };
    items[id].qty += 1;
  };
  WBF.demoCart = function () {
    var count = 0, total = 0;
    Object.keys(items).forEach(function (k) { count += items[k].qty; total += items[k].qty * items[k].unit; });
    var s = WBF.getState ? WBF.getState() : null;
    var pct = s && s.state === "active" ? s.phase.percent : 0;
    var el = document.querySelector("[data-demo-count]");
    if (el) el.textContent = count;
    return { item_count: count, original_total_price: total, total_price: Math.round(total * (100 - pct) / 100) };
  };

  document.addEventListener("DOMContentLoaded", function () {
    setPhase(start);
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-demo-phase]");
      if (b) { setPhase(b.getAttribute("data-demo-phase")); return; }
      if (e.target.closest("[data-demo-clear]")) { items = {}; WBF.refreshCart(); }
    });
    if (window.matchMedia("(max-width: 760px)").matches) {
      var p = document.querySelector(".demo-panel");
      if (p) p.open = false;
    }
  });
})();
