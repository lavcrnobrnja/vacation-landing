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
dist/holiday-landing-og.jpg link-preview image (1200x630)
tools/make-og.js            renders that image
tests/                   Playwright suite (41 tests)
RUNWAYS.md               the runway corners, and how they were measured
```

```bash
npm install
python3 tools/prep_assets.py     # art  -> assets/
node tools/build.js              # art + code -> dist/
node tools/make-og.js            # link-preview image
npx playwright test              # 41 tests
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

**5. The plane flies the line as it is being drawn.** §5.2 commits the route on
`pointerup`, which means the plane holds its old heading through the whole drag
and then snaps onto the new line when the mouse comes up. It now re-conditions
the drag on every pointer move and hands it straight to the plane, so the plane
is flying your line while you are still drawing it — and if it catches up with
the end of the line, it homes on the cursor rather than dropping the route.

**6. A stepped difficulty curve.** §6's ramps continuously and tops out between
10 and 14 minutes; two minutes in it had added one aircraft, shaved 0.6s off the
arrival gap and 3px/s off the speed. This steps once per elapsed minute and
reaches full pressure at four. See below.

**7. The separation warning grows with speed.** §5.5's fixed 78px gives a
head-on pair 0.6s of warning at the opening 38px/s but only 0.35s at the top
speed. The radius is now `max(78, 31 + speed × 1.15)`, so the warning always
arrives about as long before contact — 78px early on, 109px at full speed.

**8. Arrival types come from a shuffled bag.** §5.1 picks "uniformly from a/b/c",
which produces runs of six or seven. See **Arrivals** below.

**9. The portrait gate is limited to touch devices.** §10.5 asks for a portrait
gate on small screens. Keyed on width and orientation alone it also fires on a
desktop: a narrow window, or an embedded side panel like the artifact preview
pane, is portrait and under 640px too — but a 610x660 panel still yields a
580x387 playfield, larger than the landscape-phone case the spec accepts. The
gate now also requires `pointer:coarse`, and the cards compact so they fit
inside a short playfield rather than scrolling out of reach.

**10. Planes turn back at the edges instead of flying away.** The spec does not
say what happens to a plane that reaches the boundary. Letting them leave would
make the game trivial — you could ignore every plane. They now reflect off the
edge and loiter, which is what makes the concurrency cap the difficulty lever §6
intends it to be.

## Difficulty

| Elapsed | aircraft cap | arrival gap | speed |
|---|---|---|---|
| 0:00 | 3 | 6.2s | 38 |
| 1:00 | 5 | 4.9s | 46 |
| 2:00 | 7 | 3.9s | 54 |
| 3:00 | 9 | 3.0s | 61 |
| 4:00+ | 11 | 2.3s | 68 |

One discrete step per elapsed minute, topping out at four. Tiers rather than a
continuous ramp: nothing announces the change, so each step has to be big enough
to feel at the moment it lands. A shift clock in the header is the only readout.

§6's original curve ramped continuously and reached full pressure somewhere
between 10 and 14 minutes; at four minutes it gave 5 aircraft / 5.7s / 44px/s,
where this is already at its ceiling.

## Arrivals

Types come from a shuffled bag holding two of each colour, not an independent
roll per arrival. A uniform roll genuinely does hand out long runs — over a
300-arrival session it produces a run of four or more *every time*, and a run of
six or more in about half of them, with runs of ten observed.

The bag keeps the mix even over every six arrivals; a hard cap stops a fourth of
the same colour; and a nudge toward whatever the sky holds least of stops one
runway getting swamped. Measured over 2,500 arrivals: an exact 33.3/33.3/33.3
split, longest run 3, and about one arrival in five still repeats the last
colour — a sequence that never repeats reads as mechanical, so the cap is a
ceiling rather than a target.

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

Routes are built live during the drag. Rebuilding is cheap, and the prefix of a
re-conditioned path is stable, so the plane's progress along the line carries
across each rebuild. A drag under 25px is still a tap: it restores whatever
route the plane already had.

The §12.4 regression test counts sign changes of the heading rate two ways — raw
and low-passed over ±8 frames — and the suite proves the metric has teeth by
feeding it a synthetic waypoint-chaser trace, which scores 129 against a clean
arc's 1. Two further tests hold the flick figures above and assert that top speed tracks
within 2px of the opening speed, and one steps time *between* pointer moves to
prove the plane is flying the line mid-drag rather than waiting for the mouse.

## Tests

41 Playwright tests covering every item in §12, plus the end-to-end player loop
(sweep a curve across the map, finish it down the runway, land). Chromium is
launched from `/opt/pw-browsers/chromium`; adjust `playwright.config.js`
elsewhere.

## Link previews

`dist/holiday-landing.html` carries Open Graph and Twitter card tags, and
`dist/holiday-landing-og.jpg` is the 1200x630 preview image. Host the two side
by side and the link unfurls with the game's title, description and artwork.

`og:image` is deliberately relative, so the file contains no absolute URLs and
stays portable across hosts; every common unfurler resolves it against the page
URL. Make it absolute if a particular one does not.

**This cannot be made to work for a claude.ai artifact link.** That route serves
static Open Graph metadata — fetched as a link scraper, a made-up artifact id
returns exactly the same `Claude Artifact` / `Try out Artifacts created by Claude
users` preview as a real one, none of the page's own words reach the scraper,
and the response carries `x-robots-tag: none` with `robots: noindex, nofollow`.
The title and description set at publish time drive the artifact gallery and the
browser tab, not link previews.
