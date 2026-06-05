# las virkys

A one-page, scroll-driven (parallax / wipe) wedding announcement + RSVP site.

> nos casamos. 29 de mayo de 2027. madrid.

Built with plain **HTML / CSS / JS** — no build step, no dependencies.

## The scroll journey

As you scroll, a single pinned stage moves through four scenes. The expanding
circles double as the next scene's background:

1. **Black intro** — "las virkys" with a white dot below center.
2. **Wipe** — the white dot grows horizontally into a line, then vertically to
   flood the screen white.
3. **White text** — the announcement, with the wordmark top-left and a dark dot
   top-right. As you keep scrolling, the screen stays pinned while square photos
   drift upward in front of the text (parallax + cross-fade).
4. **Colour flood → form** — once the photos have passed, the top-right dot
   expands to flood the screen and
   reveal the RSVP form. Clicking the **`de aquí`** / **`de acá`** toggle selects
   it and recolours the background (`de aquí` → coral, `de acá` → blue).

The form is intentionally inert — submitting does nothing.

## Run it

It's a static site. Open `index.html` directly, or serve it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tuning the animation

The scroll timing lives in two places that must stay roughly in sync:

- `styles.css` → `.scroll-track { height: 560vh }` controls total scroll
  distance.
- `script.js` → the `P` object holds the phase boundaries (0→1 global progress)
  for each transition. `COVER` is how far the wipe/flood circles scale to cover
  the viewport.

## Swapping the photos

The floating photos are placeholders pulled from `i.pravatar.cc` (random square
portraits). To use real photos, drop image files into an `images/` folder and
change the `src` of each `<img class="photo">` in `index.html` (e.g.
`src="images/childhood-1.jpg"`). Each photo's scroll behaviour is controlled by
its inline `left`/`width` and the `data-start` / `data-end` (window within the
photos phase) / `data-speed` (parallax depth) attributes.

## Accessibility

- Respects `prefers-reduced-motion`: the scroll-scrub engine is skipped and the
  scenes render as plain stacked, snap-scrolled full screens (the form still
  works).
- Semantic `<form>`, real `<label>`s, and keyboard-focusable controls.

## Files

| File         | Purpose                                            |
| ------------ | -------------------------------------------------- |
| `index.html` | Markup for all layers/scenes + Google Fonts link.  |
| `styles.css` | Layout, layers, typography, theme & toggle states. |
| `script.js`  | Scroll-progress engine + toggle/form interaction.  |
