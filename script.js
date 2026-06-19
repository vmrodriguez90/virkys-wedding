/* ============================================================
   las virkys — scroll-driven parallax engine
   One global scroll progress (0→1) drives every layer.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var track = document.getElementById("scrollTrack");
  var stage = document.getElementById("stage");
  var introWordmark = document.getElementById("introWordmark");
  var wipe = document.getElementById("wipe");
  var textLayer = document.getElementById("layerText");
  var photoEls = document.querySelectorAll(".photo");
  var flood = document.getElementById("flood");
  var formLayer = document.getElementById("layerForm");
  var scrollHint = document.getElementById("scrollHint");

  /* ---- maths helpers --------------------------------------- */
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  // Map global progress p to a local 0..1 inside [start, end].
  function phase(p, start, end) {
    return clamp((p - start) / (end - start), 0, 1);
  }
  // Smooth ease for nicer scrubbing.
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /* ---- phase boundaries (keep in sync with --scroll-track) -- */
  var P = {
    introHold: [0.0, 0.03],
    wipeX: [0.03, 0.13], // square grows horizontally into a bar
    wipeY: [0.13, 0.23], // bar grows vertically -> white fill
    textHold: [0.23, 0.3], // white text settles & holds
    photos: [0.3, 0.66], // photos drift up in front of the pinned text
    floodIn: [0.66, 0.8], // corner square floods to reveal form
    formHold: [0.8, 1.0],
  };

  // Base pixel sizes of the two seed squares (see styles.css).
  var WIPE_DOT = 12;
  var FLOOD_DOT = 13;
  var SAFETY = 1.25; // overshoot so edges are never visible

  var ticking = false;
  var hintHidden = false;

  function render() {
    ticking = false;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var diag = Math.sqrt(vw * vw + vh * vh);

    // Cover scales derived from the live viewport so the wipes always fill it.
    var coverX = (vw / WIPE_DOT) * SAFETY;
    var coverY = (vh / WIPE_DOT) * SAFETY;
    // The flood seed sits near the top-right corner, so it must reach the far
    // (bottom-left) corner: scaled half-diagonal of the square must cover it.
    var coverFlood =
      (diag / ((FLOOD_DOT / 2) * Math.SQRT2)) * SAFETY;

    var trackRect = track.getBoundingClientRect();
    var scrollable = track.offsetHeight - window.innerHeight;
    var progress = scrollable > 0 ? clamp(-trackRect.top / scrollable, 0, 1) : 0;

    /* --- Layer 1: intro wordmark fades as the wipe takes over --- */
    var introFade = phase(progress, P.wipeX[0], P.wipeY[1]);
    introWordmark.style.opacity = String(1 - introFade);

    /* --- Layer 2: white wipe — the centre square itself -------- */
    // Baseline scale(1) IS the visible 12px square. It first stretches
    // horizontally (scaleX, full height retained) into a bar, then grows
    // vertically (scaleY) to flood the screen white.
    var sx = easeInOut(phase(progress, P.wipeX[0], P.wipeX[1]));
    var sy = easeInOut(phase(progress, P.wipeY[0], P.wipeY[1]));
    var wipeScaleX = lerp(1, coverX, sx);
    var wipeScaleY = lerp(1, coverY, sy);
    wipe.style.transform =
      "scaleX(" + wipeScaleX + ") scaleY(" + wipeScaleY + ")";

    /* --- Layer 3: white text scene --------------------------- */
    var textIn = phase(progress, P.wipeY[0], P.wipeY[1]);
    textLayer.style.opacity = String(textIn);
    // Ease into place, then hold pinned through the photos phase.
    var textShift = lerp(24, 0, phase(progress, P.wipeY[0], P.textHold[1]));
    textLayer.style.transform = "translateY(" + textShift + "px)";

    /* --- Floating photos: parallax up + cross-fade ----------- */
    var photosT = phase(progress, P.photos[0], P.photos[1]);
    for (var i = 0; i < photoEls.length; i++) {
      var el = photoEls[i];
      var start = parseFloat(el.dataset.start);
      var end = parseFloat(el.dataset.end);
      var speed = parseFloat(el.dataset.speed) || 1;
      var localP = phase(photosT, start, end);
      // travel from below the viewport (+) up past the top (-)
      var y = lerp(118, -118, localP) * speed;
      // fade in on entry, out on exit (18% of the window at each edge)
      var fade = Math.min(
        clamp(localP / 0.18, 0, 1),
        clamp((1 - localP) / 0.18, 0, 1)
      );
      el.style.transform = "translateY(" + y + "vh)";
      el.style.opacity = String(fade);
    }

    /* --- Layer 4: colour flood ------------------------------- */
    var floodT = easeInOut(phase(progress, P.floodIn[0], P.floodIn[1]));
    flood.style.transform =
      "scale(" + Math.max(lerp(0, coverFlood, floodT), 0.001) + ")";

    /* --- Layer 5: form --------------------------------------- */
    var formIn = phase(progress, P.floodIn[0] + 0.05, P.floodIn[1] + 0.02);
    formLayer.style.opacity = String(formIn);
    var interactive = progress >= P.floodIn[1] - 0.02;
    formLayer.classList.toggle("is-interactive", interactive);

    /* --- one-time scroll hint hide --------------------------- */
    if (!hintHidden && progress > 0.04) {
      hintHidden = true;
      scrollHint.classList.add("is-hidden");
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(render);
    }
  }

  /* ---- toggle + form interaction --------------------------- */
  function setupForm() {
    var btnAqui = document.getElementById("btnAqui");
    var btnAca = document.getElementById("btnAca");
    var form = document.getElementById("rsvpForm");

    function select(btn, theme) {
      btnAqui.classList.toggle("is-selected", btn === btnAqui);
      btnAca.classList.toggle("is-selected", btn === btnAca);
      stage.classList.remove("theme-blue", "theme-coral");
      stage.classList.add("theme-" + theme); // coral -> de aquí, blue -> de acá
    }

    btnAqui.addEventListener("click", function () {
      select(btnAqui, "coral");
    });
    btnAca.addEventListener("click", function () {
      select(btnAca, "blue");
    });

    // The form intentionally performs no action.
    form.addEventListener("submit", function (e) {
      e.preventDefault();
    });
  }

  setupForm();

  if (prefersReduced) {
    // The CSS reduced-motion fallback handles layout; no scroll engine.
    if (scrollHint) scrollHint.style.display = "none";
    return;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  render(); // initial paint
})();
