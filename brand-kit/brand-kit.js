/* ==========================================================================
   Vessel — brand kit
   Copy-to-clipboard for the four lockup SVG sources.
   Sources are byte-identical to the SOURCES const in "Vessel Brand Kit.dc.html".
   ========================================================================== */

(function () {
  "use strict";

  // Payloads are byte-identical to the files in /brand.
  var SOURCES = {
    mark:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40" fill="none">\n' +
      '  <circle cx="20" cy="20" r="14.4" stroke="#F4F1EA" stroke-width="2.6"/>\n' +
      '  <path d="M3 20H37" stroke="#F4F1EA" stroke-width="2.6"/>\n' +
      '  <path d="M20 20V34.4" stroke="#FF5B29" stroke-width="2.6"/>\n' +
      '</svg>\n',

    word:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 20" width="150" height="20">\n' +
      '  <text x="0" y="15" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="15" letter-spacing="3.9" fill="#F4F1EA">VESSEL</text>\n' +
      '</svg>\n',

    lockH:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 40" width="212" height="40" fill="none">\n' +
      '  <circle cx="20" cy="20" r="14.4" stroke="#F4F1EA" stroke-width="2.6"/>\n' +
      '  <path d="M3 20H37" stroke="#F4F1EA" stroke-width="2.6"/>\n' +
      '  <path d="M20 20V34.4" stroke="#FF5B29" stroke-width="2.6"/>\n' +
      '  <text x="55" y="26" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="16" letter-spacing="4.16" fill="#F4F1EA">VESSEL</text>\n' +
      '</svg>\n',

    lockV:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 78" width="150" height="78" fill="none">\n' +
      '  <g transform="translate(55 0)">\n' +
      '    <circle cx="20" cy="20" r="14.4" stroke="#F4F1EA" stroke-width="2.6"/>\n' +
      '    <path d="M3 20H37" stroke="#F4F1EA" stroke-width="2.6"/>\n' +
      '    <path d="M20 20V34.4" stroke="#FF5B29" stroke-width="2.6"/>\n' +
      '  </g>\n' +
      '  <text x="75" y="70" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="16" letter-spacing="4.16" fill="#F4F1EA">VESSEL</text>\n' +
      '</svg>\n'
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
