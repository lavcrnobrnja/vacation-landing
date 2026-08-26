# Runway geometry (verified against the map art)

Spec §4.1 gave headings that check out, but two of the three centres were off.
Values below were fitted to the painted asphalt on `map.png` and confirmed
visually (`assets/verify/_verify_cand.png`). Logical space is 1280×853.

| Runway | cx | cy | heading | length | width | change from spec §4.1 |
|---|---|---|---|---|---|---|
| A Beach | 457 | 524 | 65° | 150 | 86 | centre +5,+5 — spec was close |
| B Ski | 762 | 280 | 92° | 146 | 78 | **centre +21px down** — spec box sat half off the tarmac onto snow |
| C City | 1103 | 686 | −41° | 200 | 108 | **centre −6,+4 and 16px longer** — spec box overhung the rocks |

Normalised (survives a change of map encoding size):

| Runway | cx/W | cy/H | len/W | wid/W |
|---|---|---|---|---|
| A | 0.3570 | 0.6143 | 0.1172 | 0.0672 |
| B | 0.5953 | 0.3283 | 0.1141 | 0.0609 |
| C | 0.8617 | 0.8042 | 0.1563 | 0.0844 |

Method: mask dark neutral pixels inside a per-runway ROI, take the component
containing the centre, then project onto the spec heading and take robust
percentiles of the core band. Free-fitting the slab orientation does **not**
work — the runways are perspective parallelograms, so a min-area rect and a
principal-axis fit both disagree with the painted centreline by 5–13°, exactly
as §4.1 warns. The headings in the spec are correct; only the boxes moved.
