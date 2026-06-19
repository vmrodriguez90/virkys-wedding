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
  var thanks = document.getElementById("thanks");
  var thanksText = document.getElementById("thanksText");

  var seed = {}; // seed-square geometry, recomputed on resize (see layoutSeeds)

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

  var ticking = false;
  var hintHidden = false;

  // Size the seed squares to the viewport so they can be scaled DOWN to a dot
  // and back up with crisp edges (every displayed scale stays <= 1). Recomputed
  // on load + resize.
  function layoutSeeds() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var diag = Math.sqrt(vw * vw + vh * vh);

    // White wipe: a square centred on the screen.
    var wSide = diag * 1.06;
    seed.wBase = 12 / wSide; // appears as a 12px dot
    seed.wMaxX = (vw * 1.06) / wSide; // covers full width  (<= 1)
    seed.wMaxY = (vh * 1.06) / wSide; // covers full height (<= 1)
    wipe.style.width = wipe.style.height = wSide + "px";
    wipe.style.left = vw / 2 - wSide / 2 + "px";
    wipe.style.top = vh / 2 - wSide / 2 + "px";

    // Colour flood: a square centred on the top-right corner dot.
    var rem = 16;
    var topOff = Math.min(Math.max(1.5 * rem, 0.055 * vw), 2.6 * rem);
    var rightOff = Math.min(Math.max(1.5 * rem, 0.06 * vw), 2.6 * rem);
    var half = 6.5;
    var cx = vw - rightOff - half;
    var cy = topOff + half;
    var reach = Math.max(cx, vw - cx, cy, vh - cy);
    var fSide = 2 * reach * 1.08;
    seed.fBase = 13 / fSide; // appears as the 13px corner dot
    seed.fMax = 1; // at scale 1 the square covers the viewport
    flood.style.width = flood.style.height = fSide + "px";
    flood.style.left = cx - fSide / 2 + "px";
    flood.style.top = cy - fSide / 2 + "px";
    flood.style.right = "auto";
  }

  function render() {
    ticking = false;

    var trackRect = track.getBoundingClientRect();
    var scrollable = track.offsetHeight - window.innerHeight;
    var progress = scrollable > 0 ? clamp(-trackRect.top / scrollable, 0, 1) : 0;

    /* --- Layer 1: intro wordmark fades as the wipe takes over --- */
    var introFade = phase(progress, P.wipeX[0], P.wipeY[1]);
    introWordmark.style.opacity = String(1 - introFade);

    /* --- Layer 2: white wipe — a crisp square grown from centre -- */
    // The seed square is scaled DOWN to a 12px dot then back up, so every
    // displayed scale is <= 1 and the edges stay sharp. It widens first
    // (scaleX), then grows tall (scaleY) to flood the screen white.
    var sx = easeInOut(phase(progress, P.wipeX[0], P.wipeX[1]));
    var sy = easeInOut(phase(progress, P.wipeY[0], P.wipeY[1]));
    var wipeScaleX = lerp(seed.wBase, seed.wMaxX, sx);
    var wipeScaleY = lerp(seed.wBase, seed.wMaxY, sy);
    wipe.style.transform =
      "scaleX(" + wipeScaleX + ") scaleY(" + wipeScaleY + ")";

    /* --- Layer 3: white text scene --------------------------- */
    var textOpen = phase(progress, P.wipeY[0], P.wipeY[1]);
    textLayer.style.opacity = String(textOpen);
    // Zoom in as the white opens: the text grows to full size exactly when
    // the panel finishes opening, then eases its drift and holds pinned.
    var textScale = lerp(0.62, 1, easeInOut(textOpen));
    var textShift = lerp(24, 0, phase(progress, P.wipeY[0], P.textHold[1]));
    textLayer.style.transform =
      "translateY(" + textShift + "px) scale(" + textScale + ")";

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

    /* --- Layer 4: colour flood (crisp square from the dot) --- */
    var floodT = easeInOut(phase(progress, P.floodIn[0], P.floodIn[1]));
    flood.style.transform = "scale(" + lerp(seed.fBase, seed.fMax, floodT) + ")";

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

  // Google Apps Script web-app URL (ends in /exec). Leave empty to skip the
  // network call; paste your deployed endpoint to start saving to the Sheet.
  var RSVP_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwA01s3w3OKi-6cs-UxWqyYTJ9XF1IYLhKmZwpGxpl-pu2E0hh15rDi65PhooUisxk/exec";

  // localStorage key: once someone confirms, we remember it so the thank-you
  // (not the form) shows on every future visit. Value = chosen theme.
  var RSVP_KEY = "lasvirkys_rsvp";

  /* ---- toggle + form interaction --------------------------- */
  function setupForm() {
    var btnAqui = document.getElementById("btnAqui");
    var btnAca = document.getElementById("btnAca");
    var form = document.getElementById("rsvpForm");
    var origen = ""; // "de aquí" / "de acá" — whichever pill is selected
    var theme = ""; // "coral" / "blue" — for restoring the colour on return

    function select(btn, t, label) {
      btnAqui.classList.toggle("is-selected", btn === btnAqui);
      btnAca.classList.toggle("is-selected", btn === btnAca);
      stage.classList.remove("theme-blue", "theme-coral");
      stage.classList.add("theme-" + t); // coral -> de aquí, blue -> de acá
      origen = label;
      theme = t;
    }

    btnAqui.addEventListener("click", function () {
      select(btnAqui, "coral", "de aquí");
    });
    btnAca.addEventListener("click", function () {
      select(btnAca, "blue", "de acá");
    });

    // On OK: save the RSVP, remember it, then reveal the thank-you + countdown.
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      saveRsvp(form, origen);
      remember(RSVP_KEY, theme || "1");
      showThanks(form);
    });

    // Returning visitor who already confirmed: show the thank-you straight away.
    var prior = recall(RSVP_KEY);
    if (prior) {
      if (prior === "blue" || prior === "coral") {
        stage.classList.add("theme-" + prior);
      }
      showThanks(form);
    }
  }

  // Reveal the thank-you message + live countdown in place of the form.
  function showThanks(form) {
    form.style.display = "none";
    thanks.hidden = false;
    updateCountdown();
    if (!showThanks.timer) {
      showThanks.timer = setInterval(updateCountdown, 30000);
    }
  }

  // localStorage helpers (guarded for private mode / disabled storage).
  function remember(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {}
  }
  function recall(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  // Fire-and-forget GET to the Apps Script endpoint with the form data as query
  // params. "no-cors" lets the request through without needing a CORS response.
  function saveRsvp(form, origen) {
    if (!RSVP_ENDPOINT) return;
    var params = new URLSearchParams({
      nombre: form.elements["nombre"].value,
      correo: form.elements["correo"].value,
      mensaje: form.elements["mensaje"].value,
      origen: origen
    });
    fetch(RSVP_ENDPOINT + "?" + params.toString(), {
      method: "GET",
      mode: "no-cors"
    }).catch(function () {});
  }

  // Live countdown to the wedding: 29 May 2027, 19:30 Madrid (CEST = UTC+2).
  var WEDDING = Date.UTC(2027, 4, 29, 17, 30, 0);
  function updateCountdown() {
    var diff = Math.max(0, WEDDING - Date.now());
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    thanksText.textContent =
      "gracias, ahora solo queda esperar " +
      days +
      " días y " +
      hours +
      "h horas.";
  }

  setupForm();

  if (prefersReduced) {
    // The CSS reduced-motion fallback handles layout; no scroll engine.
    if (scrollHint) scrollHint.style.display = "none";
    return;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  layoutSeeds();
  render(); // initial paint

  function onResize() {
    layoutSeeds();
    onScroll();
  }
})();
