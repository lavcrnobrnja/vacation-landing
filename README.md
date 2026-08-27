# Holiday Landing

An air-traffic-control game for Vacation Tracker, in the style of Firemint's
*Flight Control*. Planes arrive from the edges, you drag each one a route, and
every plane has to land on the runway painted its colour.

**The deliverable is `dist/holiday-landing.html`** — one self-contained file,
~235 KB, no build step, no network, no storage. Open it from `file://` and it
plays.

```
src/game.html            the game (art referenced by placeholder)
assets-src/              the five supplied source images
tools/prep_assets.py     keys, trims and compresses the art
tools/build.js           inlines the art as data URIs -> dist/
dist/holiday-landing.html   standalone
dist/artifact.html          same page without the document skeleton
tests/                   Playwright suite (27 tests)
RUNWAYS.md               the runway corners, and how they were measured
```

```bash
npm install
python3 tools/prep_assets.py     # art  -> assets/
node tools/build.js              # art + code -> dist/
npx playwright test              # 27 tests
```

## Size

| | raw | in the file |
|---|---|---|
| map.webp (1024px, q72) | 126.8 KB | 169 KB |
| 3 plane sprites (WebP, 144px) | 15.5 KB | 21 KB |
| code + CSS | — | 40 KB |
| **total** | | **235 KB** (budget 260 KB) |

WebP rather than the PNG the spec assumed: the sprites drop from ~21 KB each to
~5 KB with no visible loss, which bought the headroom that made a larger, less
compressed map affordable.

## Where this differs from the spec

**1. Runways are quadrilaterals, not rectangles.** The map is a perspective
render, so the near end of every slab is wider than the far end and no rotated
rectangle can sit on one. Each runway is stored as the four corners of its
painted tarmac; the threshold, heading and a landing box that narrows along its
length are all derived from those. Headings moved as well — B's by nearly 6°.
See `RUNWAYS.md`, which also records the three automatic fits that failed and
why.

**2. Turning is defined by a fixed radius, not a fixed rate.** §5.3's constant
`MAX_TURN` means the turn radius grows with speed: a plane that tracked its line
at 38px/s ran 24px wide of it at the end-game 58px/s. `TURN_R` is 20px, so
handling and tracking are identical at every speed.

**3. A moving-average pass before Chaikin.** §5.3 offers "2 passes of Chaikin
*or* a 5-tap moving average"; it needs both. Chaikin converges after two passes
and stops removing hand tremor, and a tightly-tracking plane then follows that
tremor. One 5-tap mean over 12px-spaced points averages ~60px of arc — enough to
erase a wobble, gentle enough to leave a deliberate corner intact.

**4. The corridor clamp measures the rails, not the centreline.** §7 asks for a
20px margin. C's threshold is near the bottom edge and its rails leave the
canvas long before its centre does.

**5. Planes turn back at the edges instead of flying away.** The spec does not
say what happens to a plane that reaches the boundary. Letting them leave would
make the game trivial — you could ignore every plane. They now reflect off the
edge and loiter, which is what makes the concurrency cap the difficulty lever §6
intends it to be.

## Steering

Pure pursuit over a conditioned path (resample to 12px, one 5-tap mean, two
Chaikin passes, cumulative arc length) with a forward-only closest-point search,
so a plane can never latch onto a segment it has already flown. Look-ahead is
`1.2 × TURN_R`, which keeps it at a fixed multiple of the turn radius.

Measured against a fast mouse flick — sparse pointer samples, hard corners, the
shape a player actually draws mid-rush:

| | worst off-path | mean off-path |
|---|---|---|
| fixed turn *rate*, 38px/s | 15.6px | 4.9px |
| fixed turn *rate*, 58px/s | 24.0px | 9.7px |
| fixed turn *radius*, either speed | 7.5px | 1.9px |

Planes also roll into their turns: seen from above a banking aircraft
foreshortens across the wings, so the sprite is squashed on its own x axis in
proportion to a smoothed turn rate.

The §12.4 regression test counts sign changes of the heading rate two ways — raw
and low-passed over ±8 frames — and the suite proves the metric has teeth by
feeding it a synthetic waypoint-chaser trace, which scores 129 against a clean
arc's 1. Two further tests hold the flick figures above and assert that 58px/s
tracks within 2px of 38px/s.

## Tests

27 Playwright tests covering every item in §12, plus the end-to-end player loop
(sweep a curve across the map, finish it down the runway, land). Chromium is
launched from `/opt/pw-browsers/chromium`; adjust `playwright.config.js`
elsewhere.
