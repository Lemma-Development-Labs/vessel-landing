/* ==========================================================================
   Vessel — landing v2 behaviour
   Ported from "Vessel Landing v2.dc.html" (DCLogic) + vessel-scroll.js.
   The canvas original polled forever to survive its host re-mounting the DOM;
   on a real page the DOM is stable, so this wires up once and stops.
   ========================================================================== */

(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  /* --- live-looking counters --------------------------------------------- */
  /* Decorative, exactly as designed: these are not wired to chain data. */

  (function counters() {
    var fundingEls = $$("[data-funding]");
    var blockEls   = $$("[data-blocks]");
    if (!fundingEls.length && !blockEls.length) return;

    var funding = 2728.72;
    var blocks  = 41208934;

    function paint() {
      var f = funding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      var b = blocks.toLocaleString("en-US");
      fundingEls.forEach(function (el) { el.textContent = f; });
      blockEls.forEach(function (el) { el.textContent = b; });
    }

    paint();
    if (reduced) return;             // hold the opening values, don't tick
    setInterval(function () {
      funding += Math.random() * 1.4;
      blocks  += 2;
      paint();
    }, 900);
  })();

  /* --- footer wordmark: dissolving dot matrix ----------------------------- */

  (function dots() {
    var cv = $("[data-dots]");
    if (!cv || !cv.parentElement) return;

    function draw() {
      var host = cv.parentElement;
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = w * dpr;
      cv.height = h * dpr;
      var ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Render the wordmark to an offscreen mask, then sample it as a dot grid.
      var off = document.createElement("canvas");
      off.width = w; off.height = h;
      var o = off.getContext("2d");
      if (!o) return;

      var size = Math.min(w / 3.4, h * 1.55);
      o.font = "800 " + size + "px Archivo, sans-serif";
      o.textBaseline = "top";
      o.textAlign = "center";
      o.fillStyle = "#fff";

      var letters = "VESSEL";
      var tracking = size * 0.055;
      var widths = letters.split("").map(function (c) { return o.measureText(c).width; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0) + tracking * (letters.length - 1);
      var x = (w - total) / 2;
      letters.split("").forEach(function (c, i) {
        o.fillText(c, x + widths[i] / 2, -size * 0.06);
        x += widths[i] + tracking;
      });

      var px = o.getImageData(0, 0, w, h).data;
      var step = Math.max(7, Math.round(w / 210));

      for (var gy = 0; gy < h; gy += step) {
        for (var gx = 0; gx < w; gx += step) {
          var a = px[((gy | 0) * w + (gx | 0)) * 4 + 3] / 255;
          if (a < 0.35) continue;
          var fade = 1 - gy / h;                  // dissolve toward the bottom edge
          if (Math.random() > fade * 1.25) continue;
          var r = step * 0.30 * (0.55 + fade * 0.75);
          ctx.beginPath();
          ctx.arc(gx, gy, r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(160,172,196," + (0.16 + fade * 0.5).toFixed(3) + ")";
          ctx.fill();
        }
      }
    }

    // Draw once now, and again once the display face has actually loaded —
    // measuring against a fallback font would place the dots wrong.
    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw).catch(function () {});
    setTimeout(draw, 900);

    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(draw, 180);
    });
  })();

  /* --- scroll choreography (GSAP) ----------------------------------------- */
  /* Fail-safe: if GSAP is blocked or fails to load, nothing here runs and every
     .v-reveal stays visible, because the hidden state is only ever applied by
     the tween itself (immediateRender: false). */

  (function scroll() {
    if (reduced) return;
    if (!window.gsap || !window.ScrollTrigger) return;
    if (!$("#top") || !$$(".v-reveal").length) return;

    gsap.registerPlugin(ScrollTrigger);
    gsap.set(".v-progress", { scaleX: 0 });

    // scroll progress bar
    gsap.to(".v-progress", {
      scaleX: 1, ease: "none",
      scrollTrigger: { start: 0, end: function () { return ScrollTrigger.maxScroll(window); }, scrub: 0.3 },
    });

    // section reveals
    $$(".v-reveal").forEach(function (el) {
      gsap.fromTo(el,
        { y: 54, opacity: 0, scale: 0.985, filter: "blur(6px)" },
        {
          y: 0, opacity: 1, scale: 1, filter: "blur(0px)",
          duration: 1, ease: "power3.out", immediateRender: false,
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
    });

    // hero orbit drifts back and dims on exit
    var orbit = $("[data-orbit]");
    if (orbit) {
      gsap.to(orbit, {
        yPercent: 22, scale: 0.82, opacity: 0.25, ease: "none",
        scrollTrigger: { trigger: "#top", start: "top top", end: "bottom top", scrub: 0.6 },
      });
    }
    var rings = $("[data-rings]");
    if (rings) {
      gsap.to(rings, {
        rotateZ: 120, ease: "none",
        scrollTrigger: { trigger: "#top", start: "top top", end: "bottom top", scrub: 0.8 },
      });
    }

    // capital stack explodes on scrub
    var stack = $("[data-stack]");
    if (stack) {
      var layers = Array.prototype.slice.call(stack.children);
      var depth = [56, 20, -24, -62];
      gsap.fromTo(layers,
        { z: function (i) { return depth[i] * 0.25; } },
        {
          z: function (i) { return depth[i] * 1.5; }, ease: "none",
          scrollTrigger: { trigger: stack, start: "top 85%", end: "bottom 25%", scrub: 0.5 },
        });
    }

    // marquee reacts to scroll velocity and direction
    var track = $("[data-marquee]");
    if (track) {
      ScrollTrigger.create({
        start: 0, end: function () { return ScrollTrigger.maxScroll(window); },
        onUpdate: function (self) {
          var v = Math.min(Math.abs(self.getVelocity()) / 1400, 3.2);
          track.style.animationDuration = (38 / (1 + v)) + "s";
          track.style.animationDirection = self.direction < 0 ? "reverse" : "normal";
        },
      });
    }

    // hedge rows deal in like cards
    var rows = $$("#hedge [data-hedge-row]");
    if (rows.length) {
      gsap.fromTo(rows,
        { x: -40, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.8, stagger: 0.12, ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: "#hedge", start: "top 62%", once: true },
        });
    }

    // engine cards light up one by one
    var cards = $$("#how .v-lift");
    if (cards.length === 3) {
      var tl = gsap.timeline({
        scrollTrigger: { trigger: "#how", start: "top 72%", end: "top 10%", scrub: 0.6 },
      });
      cards.forEach(function (c, i) {
        tl.to(c, { borderColor: "rgba(107,242,192,.85)", backgroundColor: "rgba(107,242,192,.07)", y: -10, duration: 1 }, i)
          .to(c, { borderColor: "rgba(244,241,234,.12)", backgroundColor: "rgba(244,241,234,.03)", y: 0, duration: 1 }, i + 1);
      });
    }

    // board headline settles
    gsap.fromTo("#board h2",
      { yPercent: 18, opacity: 0 },
      {
        yPercent: 0, opacity: 1, duration: 1.1, ease: "power4.out", immediateRender: false,
        scrollTrigger: { trigger: "#board", start: "top 78%", once: true },
      });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); }).catch(function () {});
    }
    ScrollTrigger.refresh();
  })();

  /* --- waitlist ----------------------------------------------------------- */

  (function waitlist() {
    var form = $("[data-waitlist]");
    var success = $("[data-waitlist-success]");
    if (!form || !success) return;

    var email    = $("[data-waitlist-email]", form);
    var honeypot = $("[data-waitlist-hp]", form);
    var submit   = $("[data-waitlist-submit]", form);
    var errorEl  = $("[data-waitlist-error]");
    var countEl  = $("[data-waitlist-count]");

    var API = (window.VESSEL_CONFIG && window.VESSEL_CONFIG.WAITLIST_API) || "";
    API = API.replace(/\/+$/, "");
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
        submit.textContent = on ? "Boarding…" : "Request access →";
      }
      if (email) email.disabled = on;
    }

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
          // `website` is the honeypot and must stay empty for a real person:
          // a non-empty value makes the API discard the signup silently.
          website: honeypot ? honeypot.value : "",
        }),
      })
        .then(function (res) {
          if (res.status === 204) return { ok: true, n: null };
          if (res.status === 429) throw new Error("rate");
          if (res.status === 400) throw new Error("email");
          if (!res.ok) throw new Error("server");
          return res.json();
        })
        .then(function (data) {
          var n = typeof data.n === "number" ? data.n : null;
          success.textContent = n ? "ABOARD — YOU'RE CREW MEMBER #" + n : "ABOARD.";
          form.hidden = true;
          success.hidden = false;
          clearError();
          refreshCount(true);
        })
        .catch(function (err) {
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

    // Crew count: only ever renders a positive number the server returned.
    // Any failure hides it rather than inventing or staling a value.
    function refreshCount(force) {
      if (!countEl || !API) return;
      fetch(API + "/waitlist/count", {
        headers: { Accept: "application/json" },
        cache: force ? "no-store" : "default",
      })
        .then(function (res) { if (!res.ok) throw new Error("count"); return res.json(); })
        .then(function (data) {
          var n = typeof data.count === "number" ? data.count : 0;
          if (n > 0) {
            countEl.textContent = n.toLocaleString("en-US") + " ABOARD";
            countEl.hidden = false;
          } else {
            countEl.hidden = true;
          }
        })
        .catch(function () { countEl.hidden = true; });
    }

    refreshCount();
    setInterval(refreshCount, 10000);
  })();
})();
