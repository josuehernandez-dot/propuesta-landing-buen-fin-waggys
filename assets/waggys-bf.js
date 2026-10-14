/* =============================================================
   Waggy's · Landing Buen Fin 2026 (propuesta CRO Weecom)
   - Cambia la landing sola según la fase (Buen Fin / Extensión / Black Weekend)
   - Cuenta regresiva al cierre de la fase
   - Precios con el % de la fase vigente
   - Barra de regalos conectada al carrito real (/cart.js)
   - Agregar al carrito sin salir de la landing
   La configuración vive en <script id="wbf-config" type="application/json">
   (la imprime la sección "WBF · Hero y fases").
   ============================================================= */
(function () {
  "use strict";
  if (window.WBF && window.WBF.__ready) return;

  var WBF = (window.WBF = window.WBF || {});
  WBF.__ready = true;

  /* ---------------- configuración ---------------- */
  function readConfig() {
    var el = document.getElementById("wbf-config");
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { console.warn("WBF config inválida", e); return null; }
  }
  var cfg = readConfig();
  if (!cfg) return;
  WBF.config = cfg;

  cfg.phases = (cfg.phases || [])
    .map(function (p) {
      p.startMs = Date.parse(p.start);
      p.endMs = Date.parse(p.end);
      p.percent = Number(p.percent) || 0;
      return p;
    })
    .filter(function (p) { return !isNaN(p.startMs) && !isNaN(p.endMs); })
    .sort(function (a, b) { return a.startMs - b.startMs; });

  var T = cfg.thresholds || {};
  var tiers = [
    { key: "shipping", amount: Number(T.shipping) || 0, label: cfg.labels && cfg.labels.shipping || "Envío gratis" },
    { key: "gift1", amount: Number(T.gift1) || 0, label: cfg.labels && cfg.labels.gift1 || "Regalo 1" },
    { key: "gift2", amount: Number(T.gift2) || 0, label: cfg.labels && cfg.labels.gift2 || "Regalo 2" }
  ].filter(function (t) { return t.amount > 0; });
  tiers.forEach(function (t) { t.goal = (cfg.labels && cfg.labels[t.key + "_goal"]) || t.label; });

  /* ---------------- utilidades ---------------- */
  var fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: cfg.currency || "MXN", minimumFractionDigits: 0, maximumFractionDigits: 2 });
  function money(cents) {
    var v = Math.round(cents) / 100;
    var s = fmt.format(v);
    // $1,491.3 -> $1,491.30
    return s.replace(/(\.\d)$/, "$10");
  }
  WBF.money = money;
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Para previsualizar otra fecha: ?wbf_fecha=2026-11-15T10:00:00-06:00 (solo cambia la vista, no el descuento real)
  WBF.nowOffset = WBF.nowOffset || 0;
  (function () {
    var m = /[?&]wbf_fecha=([^&]+)/.exec(location.search);
    if (m) { var t = Date.parse(decodeURIComponent(m[1])); if (!isNaN(t)) WBF.nowOffset = t - Date.now(); }
  })();
  function now() { return Date.now() + WBF.nowOffset; }

  /* ---------------- fase vigente ---------------- */
  function getState() {
    var t = now();
    for (var i = 0; i < cfg.phases.length; i++) {
      var p = cfg.phases[i];
      if (t >= p.startMs && t < p.endMs) return { state: "active", phase: p, next: cfg.phases[i + 1] || null };
    }
    if (cfg.phases.length && t < cfg.phases[0].startMs) return { state: "pre", phase: null, next: cfg.phases[0] };
    return { state: "ended", phase: null, next: null };
  }
  WBF.getState = getState;

  function currentPercent(s) { return s.state === "active" ? s.phase.percent : 0; }

  /* ---------------- pintar fase ---------------- */
  function applyPhase() {
    var s = getState();
    WBF.state = s;
    var html = document.documentElement;
    html.setAttribute("data-wbf-state", s.state);
    html.setAttribute("data-wbf-phase", s.phase ? s.phase.id : s.state);
    html.setAttribute("data-wbf-theme", s.phase && s.phase.theme === "dark" ? "dark" : "light");

    var src = s.state === "active" ? s.phase : s.state === "pre" ? cfg.pre || {} : cfg.ended || {};
    var pct = currentPercent(s);
    var upcoming = s.state === "pre" && s.next ? s.next.percent : 0;

    $$("[data-wbf-text]").forEach(function (el) {
      var key = el.getAttribute("data-wbf-text");
      var val = src[key];
      if (key === "percent") val = pct || upcoming || "";
      if (val == null || val === "") return;
      if (el.textContent !== String(val)) el.textContent = val;
    });
    $$("[data-wbf-href]").forEach(function (el) {
      var val = src[el.getAttribute("data-wbf-href")];
      if (val) el.setAttribute("href", val);
    });

    renderPrices(s);
    renderKits(s);
    renderGolden(s);
    renderCart();
  }
  WBF.applyPhase = applyPhase;

  /* ---------------- precios ---------------- */
  function discounted(cents, pct) { return Math.round(cents * (100 - pct) / 100); }

  function renderPrices(s) {
    var pct = currentPercent(s);
    var upcoming = s.state === "pre" && s.next ? s.next.percent : 0;
    $$("[data-wbf-price]").forEach(function (box) {
      var price = Number(box.getAttribute("data-wbf-price"));
      var compare = Number(box.getAttribute("data-wbf-compare")) || 0;
      var nowEl = box.querySelector(".wbf-price__now");
      var wasEl = box.querySelector(".wbf-price__was");
      var hintEl = box.querySelector(".wbf-price__hint");
      var card = box.closest(".wbf-card");
      var badge = card && card.querySelector(".wbf-card__badge");
      if (pct) {
        nowEl.textContent = money(discounted(price, pct));
        wasEl.textContent = money(price);
        wasEl.hidden = false;
        if (hintEl) hintEl.textContent = "Precio con " + pct + "% aplicado en tu carrito";
        if (badge) { badge.textContent = "-" + pct + "%"; badge.hidden = false; }
      } else {
        nowEl.textContent = money(price);
        wasEl.textContent = compare > price ? money(compare) : "";
        wasEl.hidden = !(compare > price);
        if (hintEl) hintEl.textContent = upcoming ? "En Buen Fin: " + money(discounted(price, upcoming)) : "";
        if (badge) badge.hidden = true;
      }
    });
  }

  /* ---------------- base para umbrales ---------------- */
  // "original": el umbral se mide sobre el subtotal ANTES del descuento de temporada.
  // "discounted": se mide sobre lo que paga el cliente (después del %).
  function basisAmount(originalCents, pct) {
    return cfg.basis === "discounted" ? discounted(originalCents, pct) : originalCents;
  }

  /* ---------------- kits ---------------- */
  function renderKits(s) {
    var pct = currentPercent(s);
    $$("[data-wbf-kit]").forEach(function (kit) {
      var price = Number(kit.getAttribute("data-wbf-kit"));
      var amount = basisAmount(price, pct);
      var list = kit.querySelector("[data-wbf-kit-unlocks]");
      var nudge = kit.querySelector("[data-wbf-kit-nudge]");
      var giftsActive = s.state === "active";
      var html = "";
      var next = null;
      tiers.forEach(function (t) {
        if (t.key !== "shipping" && !giftsActive) return;
        if (amount >= t.amount) html += '<li class="wbf-chip">' + t.label + " incluido</li>";
        else if (!next) next = t;
      });
      if (list) list.innerHTML = html;
      if (nudge) {
        var gap = next ? next.amount - amount : 0;
        var maxNudge = Number(cfg.nudge_max) || 30000;
        nudge.textContent = next && gap <= maxNudge
          ? "Te faltan " + money(gap) + " para " + next.goal + ". " + (cfg.labels && cfg.labels.addon_hint || "Súmale unos Bites.")
          : "";
      }
    });
  }

  /* ---------------- suscripción Golden ---------------- */
  function renderGolden(s) {
    var pct = currentPercent(s) || (s.state === "pre" && s.next ? s.next.percent : 0);
    var sub = Number(cfg.golden_percent) || 15;
    $$("[data-wbf-golden]").forEach(function (box) {
      var price = Number(box.getAttribute("data-wbf-golden"));
      var first = box.querySelector("[data-wbf-golden-first]");
      var rec = box.querySelector("[data-wbf-golden-rec]");
      var firstLabel = box.querySelector("[data-wbf-golden-first-label]");
      if (first) first.textContent = money(discounted(price, pct));
      if (firstLabel) firstLabel.textContent = "Tu primera entrega (" + pct + "% de temporada)";
      if (rec) rec.textContent = money(discounted(price, sub));
    });
  }

  /* ---------------- carrito ---------------- */
  WBF.cart = null;

  function fetchCart() {
    if (cfg.demo) return Promise.resolve(WBF.demoCart());
    return fetch((window.Shopify && Shopify.routes && Shopify.routes.root || "/") + "cart.js", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); });
  }

  function refreshCart() {
    return fetchCart().then(function (c) { WBF.cart = c; renderCart(); return c; }).catch(function () {});
  }
  WBF.refreshCart = refreshCart;

  function renderCart() {
    var s = WBF.state || getState();
    var pct = currentPercent(s);
    var c = WBF.cart || { original_total_price: 0, total_price: 0, item_count: 0 };
    var amount = cfg.basis === "discounted" ? c.total_price : c.original_total_price;
    var giftsActive = s.state === "active";
    var visibleTiers = tiers.filter(function (t) { return t.key === "shipping" || giftsActive; });
    var top = visibleTiers.length ? visibleTiers[visibleTiers.length - 1].amount : 1;
    var next = null;
    visibleTiers.forEach(function (t) { if (!next && amount < t.amount) next = t; });

    var msg;
    if (!c.item_count) {
      msg = giftsActive
        ? "Agrega productos y desbloquea envío gratis y regalos."
        : "Agrega productos y llega a " + money(tiers[0] ? tiers[0].amount : 0) + " para tu envío gratis.";
    } else if (next) {
      msg = "Te faltan " + money(next.amount - amount) + " para " + next.goal + ".";
    } else {
      msg = giftsActive ? "¡Listo! Tienes envío gratis y tus dos regalos." : "¡Listo! Tu envío es gratis.";
    }

    // Los pasos toman su monto del config (una sola fuente de verdad)
    $$("[data-wbf-tier]").forEach(function (step) {
      var t = tiers.filter(function (x) { return x.key === step.getAttribute("data-wbf-tier"); })[0];
      if (!t) return;
      step.setAttribute("data-wbf-step", t.amount);
      var a = step.querySelector(".wbf-step__amount");
      if (a) a.textContent = "Desde " + money(t.amount);
    });

    $$("[data-wbf-progress]").forEach(function (box) {
      var fill = box.querySelector(".wbf-track__fill");
      if (fill) fill.style.width = Math.min(100, (amount / top) * 100) + "%";
      var m = box.querySelector("[data-wbf-progress-msg]");
      if (m) m.textContent = msg;
      var tot = box.querySelector("[data-wbf-progress-total]");
      if (tot) tot.textContent = money(amount);
      $$("[data-wbf-step]", box).forEach(function (step) {
        var amt = Number(step.getAttribute("data-wbf-step"));
        var ok = amount >= amt && c.item_count > 0;
        step.classList.toggle("is-unlocked", ok);
        var st = step.querySelector(".wbf-step__state");
        if (st) st.textContent = ok ? "Desbloqueado" : "Te faltan " + money(amt - amount);
      });
    });
    $$("[data-wbf-sticky-msg]").forEach(function (el) { el.textContent = msg; });
  }
  WBF.renderCart = renderCart;

  /* ---------------- agregar al carrito ---------------- */
  function toast(text, linkText, href) {
    var t = document.querySelector(".wbf-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "wbf-toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.innerHTML = "<span></span>" + (linkText ? '<a href="' + href + '">' + linkText + "</a>" : "");
    t.firstChild.textContent = text;
    t.classList.add("is-visible");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("is-visible"); }, 3800);
  }
  WBF.toast = toast;

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-wbf-add]");
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute("data-wbf-add");
    var title = btn.getAttribute("data-wbf-title") || "Producto";
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Agregando…";

    var p = cfg.demo
      ? Promise.resolve(WBF.demoAdd(id, Number(btn.getAttribute("data-wbf-unit")) || 0, title))
      : fetch((window.Shopify && Shopify.routes && Shopify.routes.root || "/") + "cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ items: [{ id: Number(id), quantity: 1 }] })
        }).then(function (r) { if (!r.ok) throw r; return r.json(); });

    p.then(function () {
      return refreshCart();
    }).then(function () {
      btn.textContent = "Agregado";
      var s = WBF.state || getState();
      var msgEl = document.querySelector("[data-wbf-progress-msg]");
      toast(title + " está en tu carrito. " + (msgEl ? msgEl.textContent : ""), "Ver carrito", cfg.cart_url || "/cart");
      // Avisar al tema para que actualice su cart drawer / contador
      document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));
      document.documentElement.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));
      setTimeout(function () { btn.textContent = original; btn.disabled = false; }, 1600);
    }).catch(function () {
      btn.textContent = original;
      btn.disabled = false;
      toast("No se pudo agregar. Puede que el producto esté agotado: ábrelo para elegir otra opción.");
    });
  });

  // Si el tema cambia el carrito (drawer, upsell), actualizamos la barra.
  if (!cfg.demo && window.fetch) {
    var _fetch = window.fetch;
    window.fetch = function () {
      var url = arguments[0] && (arguments[0].url || String(arguments[0]));
      var res = _fetch.apply(this, arguments);
      if (/\/cart\/(add|change|update|clear)/.test(url)) {
        res.then(function () { setTimeout(refreshCart, 150); }).catch(function () {});
      }
      return res;
    };
  }

  /* ---------------- cuenta regresiva ---------------- */
  function tick() {
    var s = getState();
    if (!WBF.state || WBF.state.state !== s.state || (s.phase && WBF.state.phase !== s.phase)) applyPhase();
    var target = s.state === "active" ? s.phase.endMs : s.state === "pre" ? s.next.startMs : 0;
    var diff = Math.max(0, target - now());
    var d = Math.floor(diff / 864e5);
    var h = Math.floor(diff / 36e5) % 24;
    var m = Math.floor(diff / 6e4) % 60;
    var sec = Math.floor(diff / 1e3) % 60;
    $$("[data-wbf-clock]").forEach(function (c) {
      var set = function (k, v) { var el = c.querySelector('[data-u="' + k + '"]'); if (el) el.textContent = v; };
      set("d", d); set("h", pad(h)); set("m", pad(m)); set("s", pad(sec));
      var dayUnit = c.querySelector('[data-u="d"]');
      if (dayUnit) dayUnit.parentNode.hidden = d === 0;
    });
  }

  /* ---------------- CTA fijo mobile ---------------- */
  function initSticky() {
    var bar = document.querySelector(".wbf-sticky");
    var hero = document.querySelector(".wbf-hero");
    if (!bar || !hero || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      bar.classList.toggle("is-visible", !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  /* ---------------- formulario de aviso (pre) ---------------- */
  document.addEventListener("submit", function (e) {
    var f = e.target.closest && e.target.closest("[data-wbf-notify]");
    if (!f || !cfg.demo) return; // en Shopify el form 'customer' se envía normal
    e.preventDefault();
    var ok = f.parentNode.querySelector(".wbf-notify__ok");
    if (ok) ok.hidden = false;
    f.hidden = true;
  });

  /* ---------------- arranque ---------------- */
  function init() {
    applyPhase();
    tick();
    setInterval(tick, 1000);
    refreshCart();
    initSticky();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
