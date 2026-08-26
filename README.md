# Holiday Landing

An air-traffic-control game for Vacation Tracker, in the style of Firemint's
*Flight Control*. Planes arrive from the edges, you drag each one a route, and
every plane has to land on the runway painted its colour.

**The deliverable is `dist/holiday-landing.html`** — one self-contained file,
~230 KB, no build step, no network, no storage. Open it from `file://` and it
plays.

```
src/game.html            the game (art referenced by placeholder)
assets-src/              the five supplied source images
tools/prep_assets.py     keys, trims and compresses the art
tools/build.js           inlines the art as data URIs -> dist/
dist/holiday-landing.html   standalone
dist/artifact.html          same page without the document skeleton
tests/                   Playwright suite (30 tests)
RUNWAYS.md               how the runway geometry was measured
```

```bash
npm install
python3 tools/prep_assets.py     # art  -> assets/
node tools/build.js              # art + code -> dist/
npx playwright test              # 30 tests
```

## Size

| | raw | in the file |
|---|---|---|
| map.webp (1024px, q72) | 126.8 KB | 169 KB |
| 3 plane sprites (WebP, 144px) | 15.5 KB | 21 KB |
| code + CSS | — | 40 KB |
| **total** | | **230 KB** (budget 260 KB) |

WebP rather than the PNG the spec assumed: the sprites drop from ~21 KB each to
~5 KB with no visible loss, which bought the headroom that made a larger, less
compressed map affordable.

## Three things that differ from the spec

**1. Two runway boxes moved.** §4.1's headings are correct, but its centres for
B and C are not — B's box sat ~21 px up-slope, half off the tarmac and onto the
snow. Boxes were re-fitted to the painted asphalt and checked by eye; see
`RUNWAYS.md`. Fitting the slab orientation automatically does *not* work, for
exactly the reason §4.1 gives: the runways are perspective parallelograms, so a
min-area rect and a principal-axis fit disagree with the painted centreline by
5–13°.

**2. The corridor clamp measures the rails, not the centreline.** §7 asks for a
20 px margin. C's threshold is near the bottom edge and its *rails* leave the
canvas long before its centre does — clamping on the centreline alone left the
lower rail 12 px from the edge. C's guide now clamps to ~86 px, A and B keep the
full 100.

**3. Planes turn back at the edges instead of flying away.** The spec does not
say what happens to a plane that reaches the boundary. Letting them leave would
make the game trivial — you could ignore every plane. They now reflect off the
edge and loiter, so a plane you have not dealt with stays your problem. This is
what makes the concurrency cap the difficulty lever §6 intends it to be.

## Steering

Pure pursuit, per §5.3, with the path conditioned on commit (resample to 12 px,
two Chaikin passes, cumulative arc length) and a forward-only closest-point
search so a plane can never latch onto a segment it has already flown.

`LOOKAHEAD` is **40 px**, not the 34 the spec suggests as a starting point.
Sweeping 30–42 (`tools/dbg/final.js`) showed the tracker is underdamped below
~38: on a hand-drawn S the low-passed heading rate changes sign 4 times at 34
and 2 times at 40, with identical path tracking (15.7 px worst deviation) either
way. 40 is still within the spec's stated 28–42 range.

The §12.4 regression test counts sign changes of the heading rate two ways —
raw, and low-passed over ±8 frames — and the suite proves the metric has teeth
by feeding it a synthetic waypoint-chaser trace, which scores 129 against a
clean arc's 1.

## Tests

30 Playwright tests covering every item in §12, plus the end-to-end player loop
(sweep a curve across the map, finish it down the runway, land). Chromium is
launched from `/opt/pw-browsers/chromium`; adjust `playwright.config.js`
elsewhere.
