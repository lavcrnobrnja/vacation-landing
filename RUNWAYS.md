# Runway geometry

Logical space is 1280×853. Each runway is stored as the **four corners of the
painted tarmac**, in the order near-left, far-left, far-right, near-right, where
"near" is the threshold a plane crosses on approach.

| Runway | near-left | far-left | far-right | near-right |
|---|---|---|---|---|
| **A** Beach | 398, 455 | 438, 580 | 520, 569 | 457, 453 |
| **B** Ski | 738, 204 | 715, 333 | 793, 336 | 805, 206 |
| **C** City | 1001, 700 | 1123, 595 | 1194, 626 | 1073, 746 |

Everything else is derived from those corners at load: the threshold is the
midpoint of the near edge, the heading is threshold→far-midpoint, and the
landing box narrows from `hwNear` to `hwFar` along its length.

| Runway | heading | length | half-width near | half-width far |
|---|---|---|---|---|
| A | 66.9° | 131 | 27.5 | 39.9 |
| B | 97.7° | 131 | 33.3 | 38.8 |
| C | −42.8° | 166 | 41.3 | 35.5 |

## Why quadrilaterals, and not the rectangles in spec §4.1

The map is a perspective render, so no runway on it is a rectangle — the end of
a slab nearer the camera is measurably wider than the far end. A rotated
rectangle can be centred correctly or aligned correctly, but it cannot sit on
the tarmac, and the mismatch is plainly visible at play size. §4.1 says as much
("the runways are parallelograms, not rectangles") and then asks for a rectangle
anyway; that is the part that did not survive contact with the art.

The headings moved too, B's by nearly 6°. §4.1's 92° has B landing straight down
the screen, but the slab leans: its lower end sits 17px left of its upper end.

## How the corners were measured

Automatic fitting was tried first and abandoned. Three approaches all failed for
the same underlying reason — the tarmac cannot be separated from its
surroundings by any single pixel predicate:

- **Min-area rectangle / principal axis** on a thresholded mask: disagreed with
  the painted centreline by 5–13°, because a perspective parallelogram's area
  axis is not its centreline.
- **IoU-optimised quad**: the dark-neutral mask leaks into the rocks that touch
  A and C, and IoU's union term then drags the quad out into them. Replacing IoU
  with a coverage score that only charges for non-tarmac helped, but the mask
  was still far too generous — A's fitted near-width came out at 162px against a
  true 55.
- **Edge-marching on the luminance gradient**: defeated by the painted markings.
  The threshold bars and centreline dashes are bright, so a dark→light search
  perpendicular to an edge finds a marking long before it finds the boundary.

Saturation does separate tarmac (3–12) from rock (22–47) — but only after that
was known, and by then reading the corners directly was quicker and verifiable.

So the shipped values were read off the map against a labelled pixel grid and
checked by eye:

```bash
python3 tools/dbg/grid.py A                      # grid over runway A
python3 tools/dbg/grid.py A '[[398,455],...]'    # grid plus a candidate quad
```

`assets/verify/_cand3.png` is the confirming render of all three.
