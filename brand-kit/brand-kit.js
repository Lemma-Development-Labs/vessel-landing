/* ==========================================================================
   Vessel — brand kit
   Copy-to-clipboard for the four lockup SVG sources.
   Sources are byte-identical to the SOURCES const in "Vessel Brand Kit.dc.html".
   ========================================================================== */

(function () {
  "use strict";

  var MARK = function (c, l) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none">\n' +
      '  <circle cx="16" cy="16" r="12" stroke="' + c + '" stroke-width="2.5"/>\n' +
      '  <line x1="6" y1="16" x2="26" y2="16" stroke="' + l + '" stroke-width="2.5"/>\n' +
      '</svg>';
  };

  var SOURCES = {
    mark: MARK("#8FA6BC", "#EAEEF3"),

    word: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124 24" width="124" height="24">\n' +
      '  <text x="0" y="19" font-family="Bricolage Grotesque, sans-serif" font-weight="700" font-size="24" letter-spacing="5.28" fill="#EAEEF3">VESSEL</text>\n' +
      '</svg>',

    lockH: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 188 32" width="188" height="32" fill="none">\n' +
      '  <circle cx="16" cy="16" r="12" stroke="#8FA6BC" stroke-width="2.5"/>\n' +
      '  <line x1="6" y1="16" x2="26" y2="16" stroke="#EAEEF3" stroke-width="2.5"/>\n' +
      '  <text x="50" y="25" font-family="Bricolage Grotesque, sans-serif" font-weight="700" font-size="26.5" letter-spacing="5.83" fill="#EAEEF3">VESSEL</text>\n' +
      '</svg>',

    lockV: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 138 78" width="138" height="78" fill="none">\n' +
      '  <g transform="translate(53 0)">\n' +
      '    <circle cx="16" cy="16" r="12" stroke="#8FA6BC" stroke-width="2.5"/>\n' +
      '    <line x1="6" y1="16" x2="26" y2="16" stroke="#EAEEF3" stroke-width="2.5"/>\n' +
      '  </g>\n' +
      '  <text x="66" y="70" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="700" font-size="26.5" letter-spacing="5.83" fill="#EAEEF3">VESSEL</text>\n' +
      '</svg>'
  };

  var LABEL = "COPY SVG";
  var DONE = "COPIED ✓";
  var HOLD = 1600;

  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-copy]"));
  var status = document.querySelector("[data-copy-status]");
  var timer = null;

  function reset() {
    buttons.forEach(function (b) {
      b.textContent = LABEL;
      b.classList.remove("is-copied");
    });
  }

  function markCopied(btn, key) {
    // Only one button reads COPIED at a time — a new copy resets the previous.
    reset();
    clearTimeout(timer);
    btn.textContent = DONE;
    btn.classList.add("is-copied");
    if (status) status.textContent = key + " SVG copied to clipboard";
    timer = setTimeout(function () {
      reset();
      if (status) status.textContent = "";
    }, HOLD);
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.className = "sr-only";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* best effort */ }
    ta.remove();
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-copy");
      var src = SOURCES[key];
      if (!src) return;
      var done = function () { markCopied(btn, key); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        // Resolve and reject both land on done — matching the design's behaviour.
        navigator.clipboard.writeText(src).then(done, function () { legacyCopy(src); done(); });
      } else {
        legacyCopy(src);
        done();
      }
    });
  });
})();
