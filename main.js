/* ==========================================================================
   Vessel — landing page behaviour
   Ported from the "Vessel Landing.dc.html" canvas logic (DCLogic component).
   ========================================================================== */

(function () {
  "use strict";

  /* --- Config ------------------------------------------------------------
     These were the design's editable props. Change them here.
     ---------------------------------------------------------------------- */
  var CONFIG = {
    fundingApr: 11.2,          // 2 – 28, in percent
    phase: "testnet",          // "testnet" | "pre-testnet"
    heroMotion: true
  };

  var BASE_FUNDING = 1204.5518;
  var BASE_BLOCK = 1204551;

  var FAQS = [
    {
      q: "Where does the yield come from?",
      a: "Funding paid by leveraged longs on Perpl, plus staking yield when the spot leg is a liquid staking token. It is market-derived and variable — Hull fixes your share of it; it doesn't invent yield."
    },
    {
      q: "What happens when funding goes negative?",
      a: "Ballast absorbs it first, then the protocol reserve. Hull's rate is defended by that waterfall, and the engine de-risks or rotates legs when regimes invert. Negative-funding periods are normal; the structure exists because of them."
    },
    {
      q: "Is Vessel audited?",
      a: "Not yet. Vessel is testnet-only, and an external review is a hard gate before any mainnet deposit. Current status lives in the docs and won't be blurred."
    },
    {
      q: "How is this different from other synthetic dollars?",
      a: "The hedge venue. Ours is a fully on-chain order book — you can verify the short book block by block instead of trusting custodial attestations."
    },
    {
      q: "What is vUSD?",
      a: "The dollar minted against the delta-neutral book, planned for mainnet. Until then, deposits hold ERC-4626 vault shares."
    },
    {
      q: "Can I exit anytime?",
      a: "Ballast, yes — subject to buffer rules. Hull runs to maturity; exiting early means selling your position at market."
    }
  ];

  /* --- Derived state ------------------------------------------------------ */

  var reduced = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  var motionOn = CONFIG.heroMotion && !reduced;

  var apr = isNaN(parseFloat(CONFIG.fundingApr)) ? 11.2 : parseFloat(CONFIG.fundingApr);
  var aprStr = apr.toFixed(1) + "%";
  var isPre = CONFIG.phase === "pre-testnet";

  var tickerItems = isPre
    ? ["MONAD — 10,000 TPS", "BLOCK TIME — 400MS", "GAS — NEAR ZERO", "EVM — 100% COMPATIBLE", "PERPL — FULLY ON-CHAIN ORDER BOOK", "VESSEL TESTNET — SOON"]
    : ["ETH FUNDING 7D — " + aprStr + " APR", "NET DELTA — 0.0031", "PERPL OI HEDGED — $——", "BLOCKS VERIFIED — 1,204,551", "TESTNET — LIVE"];

  var phaseNote = isPre ? "PRE-TESTNET — PUBLIC CHAIN DATA ONLY" : "TESTNET — LIVE";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var fmt = function (n) { return n.toLocaleString("en-US"); };

  /* --- Static text bindings ---------------------------------------------- */

  $$("[data-apr]").forEach(function (el) { el.textContent = aprStr; });
  $$("[data-phase-note]").forEach(function (el) { el.textContent = phaseNote; });

  /* --- Ticker ------------------------------------------------------------- */

  $$("[data-ticker-group]").forEach(function (group) {
    group.textContent = "";
    tickerItems.forEach(function (item) {
      var span = document.createElement("span");
      span.className = "ticker__item";
      span.appendChild(document.createTextNode(item));
      var sep = document.createElement("span");
      sep.className = "ticker__sep";
      sep.textContent = "·";
      span.appendChild(sep);
      group.appendChild(span);
    });
  });

  /* --- FAQ accordion ------------------------------------------------------ */

  (function buildFaq() {
    var list = $("[data-faq]");
    if (!list) return;

    var open = null;
    var buttons = [], icons = [], answers = [];

    function sync() {
      for (var j = 0; j < FAQS.length; j++) {
        var isOpen = open === j;
        buttons[j].setAttribute("aria-expanded", isOpen ? "true" : "false");
        icons[j].textContent = isOpen ? "\u2212" : "+";
        answers[j].hidden = !isOpen;
      }
    }

    FAQS.forEach(function (f, i) {
      var item = document.createElement("div");
      item.className = "faq__item";

      var btn = document.createElement("button");
      btn.className = "faq__q";
      btn.type = "button";
      btn.id = "faq-q-" + i;
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", "faq-a-" + i);

      var label = document.createElement("span");
      label.textContent = f.q;

      var icon = document.createElement("span");
      icon.className = "faq__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "+";

      btn.appendChild(label);
      btn.appendChild(icon);

      var answer = document.createElement("p");
      answer.className = "faq__a";
      answer.id = "faq-a-" + i;
      answer.setAttribute("role", "region");
      answer.setAttribute("aria-labelledby", "faq-q-" + i);
      answer.textContent = f.a;
      answer.hidden = true;

      btn.addEventListener("click", function () {
        open = open === i ? null : i;
        sync();
      });

      item.appendChild(btn);
      item.appendChild(answer);
      list.appendChild(item);

      buttons.push(btn);
      icons.push(icon);
      answers.push(answer);
    });
  })();

  /* --- Waitlist ----------------------------------------------------------- */

  (function waitlist() {
    var form = $("[data-waitlist]");
    var success = $("[data-waitlist-success]");
    if (!form || !success) return;

    var email = $("[data-waitlist-email]", form);
    var honeypot = $("[data-waitlist-hp]", form);
    var submit = $("[data-waitlist-submit]", form);
    var errorEl = $("[data-waitlist-error]");
    var countEl = $("[data-waitlist-count]");

    var API = (window.VESSEL_CONFIG && window.VESSEL_CONFIG.WAITLIST_API) || "";
    API = API.replace(/\/+$/, "");           // tolerate a trailing slash in config
    var pending = false;

    function showError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
    function clearError() {
      if (!errorEl) return;
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
    function setPending(on) {
      pending = on;
      if (submit) {
        submit.disabled = on;
        submit.textContent = on ? "Boarding…" : "Get testnet access";
      }
      if (email) email.disabled = on;
    }

    /* --- signup ---------------------------------------------------------- */

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (pending) return;
      clearError();

      if (email && !email.checkValidity()) {
        email.setAttribute("aria-invalid", "true");
        email.focus();
        showError("That email doesn't look right.");
        return;
      }
      if (email) email.removeAttribute("aria-invalid");

      if (!API) {
        showError("Waitlist isn't configured yet. Try again shortly.");
        return;
      }

      setPending(true);

      fetch(API + "/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email ? email.value : "",
          website: honeypot ? honeypot.value : ""
        })
      })
        .then(function (res) {
          // 204 is the honeypot path — a real submission never sees it.
          if (res.status === 204) return { ok: true, n: null };
          if (res.status === 429) throw new Error("rate");
          if (res.status === 400) throw new Error("email");
          if (!res.ok) throw new Error("server");
          return res.json();
        })
        .then(function (data) {
          // Only ever render a number the server gave us.
          var n = typeof data.n === "number" ? data.n : null;
          success.textContent = n
            ? "Aboard. You're crew member #" + n
            : "Aboard.";
          form.hidden = true;
          success.hidden = false;
          clearError();
          refreshCount(true);
        })
        .catch(function (err) {
          // Keep the form: the visitor must be able to retry.
          setPending(false);
          if (err && err.message === "rate") {
            showError("Too many attempts. Try again in a few minutes.");
          } else if (err && err.message === "email") {
            showError("That email doesn't look right.");
          } else {
            showError("Couldn't reach the crew list. Try again in a moment.");
          }
        });
    });

    if (email) {
      email.addEventListener("input", function () {
        email.removeAttribute("aria-invalid");
        clearError();
      });
    }

    /* --- live count ------------------------------------------------------ */

    // Shown only when the server reports a real, positive number. On any
    // failure the element stays hidden — never invent or stale-render a count.
    function refreshCount(force) {
      if (!countEl || !API) return;
      // The endpoint sets Cache-Control: max-age=5. Straight after a signup we
      // must not read a stale count out of that window, so bypass the cache.
      fetch(API + "/waitlist/count", {
        headers: { Accept: "application/json" },
        cache: force ? "no-store" : "default"
      })
        .then(function (res) {
          if (!res.ok) throw new Error("count");
          return res.json();
        })
        .then(function (data) {
          var n = typeof data.count === "number" ? data.count : 0;
          if (n > 0) {
            countEl.textContent = n.toLocaleString("en-US") + " ABOARD";
            countEl.hidden = false;
          } else {
            countEl.hidden = true;
          }
        })
        .catch(function () {
          countEl.hidden = true;
        });
    }

    refreshCount();
    setInterval(refreshCount, 10000);
  })();

  /* --- Live counters (block height + accrued funding) ---------------------- */

  var blockEls = $$("[data-block]");
  var counterEl = $("[data-funding]");
  var block = BASE_BLOCK;
  var t0 = performance.now();

  function writeFunding(value) {
    if (!counterEl) return;
    counterEl.textContent = "+$" + value.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  }

  blockEls.forEach(function (el) { el.textContent = fmt(block); });

  if (motionOn) {
    setInterval(function () {
      block += 1;
      var bs = fmt(block);
      blockEls.forEach(function (el) { el.textContent = bs; });
      var rate = (apr / 100) * 3700000 / (365 * 86400);
      writeFunding(BASE_FUNDING + (rate * (performance.now() - t0)) / 1000);
    }, 400);
  } else {
    writeFunding(BASE_FUNDING);
  }

  /* --- Hero instrument canvas --------------------------------------------- */

  (function instrument() {
    var canvas = $("[data-instrument]");
    if (!canvas || !canvas.parentElement) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var W = 0, H = 0, storm = null, staticDrawn = false;
    var N = 1400;

    function sizeCanvas() {
      var rect = canvas.parentElement.getBoundingClientRect();
      var d = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.max(1, Math.round(rect.width * d));
      canvas.height = Math.max(1, Math.round(rect.height * d));
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }

    // Deterministic pseudo-random walk — the "storm" trace behind the hero.
    function buildStorm() {
      var seed = 42;
      var rnd = function () {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      var pts = [];
      var v = 0, y = 0;
      for (var i = 0; i < N; i++) {
        var shock = rnd() < 0.018 ? (rnd() - 0.5) * 4 : 0;
        v = v * 0.9 + (rnd() - 0.5) * 0.6 + shock;
        y = (y + v) * 0.982;
        pts.push(y);
      }
      // Cross-fade the tail into the head so the loop is seamless.
      var K = 140;
      for (var j = 0; j < K; j++) {
        var idx = N - K + j, w = j / K;
        pts[idx] = pts[idx] * (1 - w) + pts[j] * w;
      }
      var mx = 0;
      for (var k = 0; k < pts.length; k++) mx = Math.max(mx, Math.abs(pts[k]));
      storm = pts.map(function (p) { return p / mx; });
    }

    function draw(t) {
      if (!W || !H || !storm) return;
      ctx.clearRect(0, 0, W, H);

      var levelY = H * 0.62;
      var amp = H * 0.26;

      // Dashed guide rails
      ctx.save();
      ctx.setLineDash([2, 7]);
      ctx.strokeStyle = "rgba(143,166,188,0.09)";
      ctx.lineWidth = 1;
      [levelY - H * 0.19, levelY + H * 0.19].forEach(function (gy) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      });
      ctx.restore();

      // Two parallax passes of the trace
      var layers = [
        { sp: 17, a: 0.09, s: 1.3, off: 520 },
        { sp: 29, a: 0.21, s: 1.0, off: 0 }
      ];
      layers.forEach(function (L) {
        ctx.beginPath();
        for (var x = 0; x <= W; x += 3) {
          var idx = (x * 0.35 + t * L.sp + L.off) % N;
          if (idx < 0) idx += N;
          var i0 = Math.floor(idx) % N;
          var i1 = (i0 + 1) % N;
          var f = idx - Math.floor(idx);
          var yv = storm[i0] * (1 - f) + storm[i1] * f;
          var y = levelY + yv * amp * L.s;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(143,166,188," + L.a + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Tick marks along the waterline
      ctx.strokeStyle = "rgba(234,238,243,0.18)";
      ctx.lineWidth = 1;
      for (var x2 = 40; x2 < W; x2 += 90) {
        ctx.beginPath();
        ctx.moveTo(x2, levelY - 3);
        ctx.lineTo(x2, levelY + 3);
        ctx.stroke();
      }

      // The waterline itself, fading out at both edges
      var g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, "rgba(234,238,243,0)");
      g.addColorStop(0.1, "rgba(234,238,243,0.9)");
      g.addColorStop(0.9, "rgba(234,238,243,0.9)");
      g.addColorStop(1, "rgba(234,238,243,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, levelY);
      ctx.lineTo(W, levelY);
      ctx.stroke();

      // The hull, riding the line
      var vx = W * 0.74;
      ctx.fillStyle = "#070B10";
      ctx.strokeStyle = "rgba(234,238,243,0.95)";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(vx - 13, levelY);
      ctx.lineTo(vx - 7, levelY + 7);
      ctx.lineTo(vx + 7, levelY + 7);
      ctx.lineTo(vx + 13, levelY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(vx, levelY);
      ctx.lineTo(vx, levelY - 11);
      ctx.stroke();
    }

    sizeCanvas();
    buildStorm();

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        sizeCanvas();
        staticDrawn = false;
        if (!motionOn) { draw(4.2); staticDrawn = true; }
      }).observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", function () {
        sizeCanvas();
        if (!motionOn) draw(4.2);
      });
    }

    if (motionOn) {
      (function tick() {
        draw((performance.now() - t0) / 1000);
        requestAnimationFrame(tick);
      })();
    } else if (!staticDrawn) {
      draw(4.2);
      staticDrawn = true;
    }
  })();

  /* --- Footer wordmark: particle field ------------------------------------ */

  (function wordmark() {
    var canvas = $("[data-mark]");
    if (!canvas || !canvas.parentElement) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var pts = null, mW = 0, mH = 0;
    var mx = -9999, my = -9999;
    var raf = null;
    var resizeTimer = null;

    function build() {
      var W = (mW = canvas.parentElement.clientWidth || 600);
      var font = function (s) { return "800 " + s + 'px "Bricolage Grotesque", sans-serif'; };
      var text = "VESSEL";

      // Measure at a reference size, then scale to fill 94% of the width.
      var probe = document.createElement("canvas").getContext("2d");
      probe.font = font(100);
      var size = (100 * (W * 0.94)) / probe.measureText(text).width;
      var mh = Math.ceil(size * 1.7);

      var off = document.createElement("canvas");
      off.width = W;
      off.height = mh;
      var octx = off.getContext("2d");
      octx.font = font(size);
      octx.fillText(text, Math.max(0, (W - octx.measureText(text).width) / 2), Math.round(size * 1.25));

      var mask = octx.getImageData(0, 0, W, mh).data;

      // Ink bounds
      var minX = W, maxX = -1, minY = mh, maxY = -1;
      for (var y = 0; y < mh; y++) {
        for (var x = 0; x < W; x++) {
          if (mask[(y * W + x) * 4 + 3] > 128) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX <= minX || maxY <= minY) return;

      var capH = maxY - minY + 1;
      var CROP = 0.75;                 // the mark is cropped — it sinks off-page
      var H = (mH = Math.round(capH * CROP));
      var fade = capH;

      // Re-centre on the visible (cropped) portion only.
      var vMinX = W, vMaxX = -1;
      for (var y2 = minY; y2 < minY + H; y2++) {
        for (var x3 = minX; x3 <= maxX; x3++) {
          if (mask[(y2 * W + x3) * 4 + 3] > 128) {
            if (x3 < vMinX) vMinX = x3;
            if (x3 > vMaxX) vMaxX = x3;
          }
        }
      }
      if (vMaxX < vMinX) { vMinX = minX; vMaxX = maxX; }
      var shift = Math.round((W - (vMaxX - vMinX + 1)) / 2) - vMinX;

      var d = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.height = H + "px";
      canvas.width = Math.round(W * d);
      canvas.height = Math.round(H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);

      var PITCH = Math.max(4, Math.round(W / 250));
      pts = [];
      for (var y3 = minY; y3 < minY + H; y3 += PITCH) {
        for (var x4 = minX; x4 <= maxX; x4 += PITCH) {
          if (mask[(y3 * W + x4) * 4 + 3] > 128) {
            var px = x4 + shift, py = y3 - minY;
            var t = Math.min(1, py / fade);
            pts.push({
              hx: px, hy: py, x: px, y: py, vx: 0, vy: 0,
              r: PITCH * 0.28 * (0.75 + Math.random() * 0.6),
              o: (0.5 + Math.random() * 0.45) * Math.max(0.06, 1 - t * 1.55),
              cr: Math.round(175 - 44 * t),
              cg: Math.round(194 - 84 * t),
              cb: Math.round(214 + 35 * t)
            });
          }
        }
      }
      drawStatic();
    }

    function drawStatic() {
      if (!ctx || !pts) return;
      ctx.clearRect(0, 0, mW, mH);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + p.cr + "," + p.cg + "," + p.cb + "," + p.o + ")";
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
    }

    // Particles are pushed away from the pointer, then spring back home.
    function step() {
      raf = null;
      if (!ctx || !pts) return;
      var REPEL = 88, FORCE = 0.9, SPRING = 0.035, FRICTION = 0.93, SWELL = 1.6;
      var moving = false;
      ctx.clearRect(0, 0, mW, mH);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var dx = p.x - mx, dy = p.y - my;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var f = 0;
        if (dist < REPEL) {
          f = (REPEL - dist) / REPEL;
          p.vx += (dx / dist) * f * FORCE * 6;
          p.vy += (dy / dist) * f * FORCE * 6;
        }
        p.vx += (p.hx - p.x) * SPRING;
        p.vy += (p.hy - p.y) * SPRING;
        p.vx *= FRICTION;
        p.vy *= FRICTION;
        p.x += p.vx;
        p.y += p.vy;
        if (Math.abs(p.vx) + Math.abs(p.vy) > 0.008 ||
            Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y) > 0.15) moving = true;
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + p.cr + "," + p.cg + "," + p.cb + "," + p.o + ")";
        ctx.arc(p.x, p.y, p.r * (1 + f * SWELL), 0, 6.2832);
        ctx.fill();
      }
      if (moving || mx > -9000) raf = requestAnimationFrame(step);
    }

    function wake() {
      if (!motionOn || raf !== null || !pts) return;
      raf = requestAnimationFrame(step);
    }

    // Wait for the display face so the mask is measured against the real glyphs.
    if (document.fonts && document.fonts.load) {
      document.fonts.load('800 100px "Bricolage Grotesque"').then(build).catch(build);
    } else {
      build();
    }

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(build, 150);
      }).observe(canvas.parentElement);
    }

    if (motionOn) {
      window.addEventListener("pointermove", function (e) {
        if (!canvas.isConnected) return;
        var b = canvas.getBoundingClientRect();
        var x = e.clientX - b.left, y = e.clientY - b.top;
        var pad = 90;
        if (x > -pad && x < b.width + pad && y > -pad && y < b.height + pad) {
          mx = x; my = y;
        } else if (mx > -9000) {
          mx = -9999; my = -9999;
        } else {
          return;
        }
        wake();
      }, true);
    }
  })();
})();
