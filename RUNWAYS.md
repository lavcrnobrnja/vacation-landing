# Runway geometry

Coordinates are in the game's fixed **1280×853 logical space**, which is scaled
to the display in CSS only. Each runway is stored in `src/game.html` as the
**four corners of the painted tarmac**, in the order near-left, far-left,
far-right, near-right, where "near" is the threshold a plane crosses on
approach.

| Runway | near-left | far-left | far-right | near-right |
|---|---|---|---|---|
| **A** Beach | 398, 455 | 438, 580 | 520, 569 | 457, 453 |
| **B** Ski | 738, 204 | 715, 333 | 793, 336 | 805, 206 |
| **C** City | 1001, 700 | 1123, 595 | 1194, 626 | 1073, 746 |

Everything else is derived from those corners at load: the threshold is the
midpoint of the near edge, the heading is threshold → far-midpoint, and the
landing box narrows from `hwNear` to `hwFar` along the runway's length.

| Runway | heading | length | half-width near | half-width far |
|---|---|---|---|---|
| A | 66.9° | 131 | 27.5 | 39.9 |
| B | 97.7° | 131 | 33.3 | 38.8 |
| C | −42.8° | 166 | 41.3 | 35.5 |

## Why four corners and not a rectangle

The map is drawn in perspective, so no runway on it is a rectangle — the end of
a slab nearer the camera is measurably wider than the far end. A rotated
rectangle can be centred correctly or aligned correctly, but it cannot sit on
the tarmac, and at play size the mismatch is plainly visible.

The headings matter as much as the boxes. B's slab leans: its lower end sits
17px left of its upper end, which is nearly 6° away from the straight-down-the-
screen heading it looks like it has.

## How the corners were measured

Automatic fitting was tried first and abandoned. Three approaches failed for the
same underlying reason — tarmac cannot be separated from its surroundings by any
single pixel predicate:

- **Min-area rectangle / principal axis** on a thresholded mask disagreed with
  the painted centreline by 5–13°, because a perspective parallelogram's area
  axis is not its centreline.
- **IoU-optimised quad**: the dark-neutral mask leaks into the rocks touching two
  of the islands, and IoU's union term then drags the quad out into them.
  Replacing IoU with a coverage score that only charges for non-tarmac helped,
  but the mask was still far too generous — one fitted near-width came out at
  162px against a true 55.
- **Edge-marching on the luminance gradient** was defeated by the painted
  markings. Threshold bars and centreline dashes are bright, so a dark→light
  search perpendicular to an edge finds a marking long before it finds the
  boundary.

Saturation does separate tarmac (3–12) from rock (22–47) — but only once that
was known, and by then reading the corners directly was quicker and verifiable.

So the shipped values were read off the map against a labelled pixel grid and
checked by eye:

```bash
python3 tools/dbg/grid.py A                      # grid over runway A
python3 tools/dbg/grid.py A '[[398,455],...]'    # grid plus a candidate quad
```

`assets/verify/_cand3.png` is the confirming render of all three.

**If you are re-skinning the game with your own map, do this rather than trying
to automate it.** Three runways take about ten minutes to measure and you can
see that they are right.
