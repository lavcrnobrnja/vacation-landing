const { test, expect } = require('@playwright/test');
const { load, startClean, sim } = require('./helpers');

/** Place a plane `back` px before a runway threshold, on its centreline. */
async function onApproach(page, type, rwKey, back, routed = true, headingOffsetDeg = 0) {
  return page.evaluate(([type, rwKey, back, routed, off]) => {
    const r = window.__HL.RW[rwKey];
    const x = r.tx - r.ux * back, y = r.ty - r.uy * back;
    return window.__HL.add(type, x, y, r.deg + off, routed);
  }, [type, rwKey, back, routed, headingOffsetDeg]);
}

test('a correct landing scores, tallies and despawns (12.7)', async ({ page }) => {
  await load(page);
  await startClean(page);
  const id = await onApproach(page, 'a', 'A', 90);
  await sim(page, 6);
  const s = await page.evaluate(id => ({
    score: window.__HL.S.score,
    tally: window.__HL.S.tally,
    gone: !window.__HL.get(id),
    phase: window.__HL.S.phase,
    shown: document.getElementById('score').textContent,
  }), id);
  expect(s.phase).toBe('play');
  expect(s.score).toBe(1);
  expect(s.tally).toEqual({ A: 1, B: 0, C: 0 });
  expect(s.gone, 'the plane should have rolled out and despawned').toBe(true);
  expect(s.shown).toBe('1');
});

test('the wrong island ends the shift and names both destinations (12.8)', async ({ page }) => {
  await load(page);
  await startClean(page);
  await onApproach(page, 'a', 'B', 90);          // green plane, ski runway
  await sim(page, 6);
  const s = await page.evaluate(() => ({
    phase: window.__HL.S.phase,
    over: window.__HL.S.over && window.__HL.S.over.kind,
    text: document.getElementById('card').innerText,
    hidden: document.getElementById('veil').hidden,
  }));
  expect(s.phase).toBe('over');
  expect(s.over).toBe('wrong');
  expect(s.hidden).toBe(false);
  expect(s.text).toMatch(/Wrong island/i);
  expect(s.text, 'card must name where it was booked for').toMatch(/Beach \(A\)/);
  expect(s.text, 'card must name where it actually went').toMatch(/Ski \(B\)/);
  expect(s.text).toMatch(/green/i);
});

test('the proximity warning always precedes the crash (12.9)', async ({ page }) => {
  await load(page);
  await startClean(page);
  await page.evaluate(() => {
    window.__HL.add('a', 500, 400, 0, false);
    window.__HL.add('b', 760, 400, 180, false);
  });
  const trace = await page.evaluate(() => {
    const H = window.__HL, dt = 1 / 60;
    let firstWarn = -1, over = -1;
    for (let i = 0; i < 1200; i++) {
      H.step(dt);
      if (firstWarn < 0 && H.S.planes.some(p => p.warn > 0.5)) firstWarn = i;
      if (H.S.phase === 'over') { over = i; break; }
    }
    return { firstWarn, over, kind: H.S.over && H.S.over.kind };
  });
  expect(trace.firstWarn, 'a warning must have been raised').toBeGreaterThanOrEqual(0);
  expect(trace.over, 'the pair must eventually crash').toBeGreaterThan(0);
  expect(trace.firstWarn, 'warning must come strictly before the crash').toBeLessThan(trace.over);
  expect(trace.kind).toBe('crash');
});

test('an un-routed plane on B\'s centreline flies over, it does not land (12.10)', async ({ page }) => {
  await load(page);
  await startClean(page);
  const id = await onApproach(page, 'b', 'B', 120, false);   // right colour, never routed
  await sim(page, 12);
  const s = await page.evaluate(id => {
    const p = window.__HL.get(id), r = window.__HL.RW.B;
    const d = p ? ((p.x - r.cx) * r.ux + (p.y - r.cy) * r.uy) : null;
    return { phase: window.__HL.S.phase, score: window.__HL.S.score, alive: !!p, past: d };
  }, id);
  expect(s.phase, 'an un-routed plane must not be able to end the game').toBe('play');
  expect(s.score).toBe(0);
  expect(s.alive).toBe(true);
  expect(s.past, 'it should have flown past the far end of the runway').toBeGreaterThan(0);
});

test('crossing a runway at 90 degrees flies over, it does not land (12.11)', async ({ page }) => {
  await load(page);
  await startClean(page);
  const id = await page.evaluate(() => {
    const r = window.__HL.RW.A;
    const px = -r.uy, py = r.ux;                  // approach from the side
    return window.__HL.add('a', r.cx - px * 130, r.cy - py * 130, r.deg + 90, true);
  });
  await sim(page, 8);
  const s = await page.evaluate(id => ({
    phase: window.__HL.S.phase, score: window.__HL.S.score, alive: !!window.__HL.get(id),
  }), id);
  expect(s.phase).toBe('play');
  expect(s.score, 'a 90-degree crossing is not a landing').toBe(0);
  expect(s.alive).toBe(true);
});

test('a wrong-end approach is rejected by the heading gate (5.4)', async ({ page }) => {
  await load(page);
  await startClean(page);
  await page.evaluate(() => {
    const r = window.__HL.RW.A;
    window.__HL.add('a', r.ex + r.ux * 90, r.ey + r.uy * 90, r.deg + 180, true);
  });
  await sim(page, 8);
  const s = await page.evaluate(() => ({ phase: window.__HL.S.phase, score: window.__HL.S.score }));
  expect(s.phase).toBe('play');
  expect(s.score).toBe(0);
});

/* The whole loop as a player actually performs it: grab a plane, sweep a
   curved line across the map, finish it straight down the runway, let go. */
test('drawing a curve that finishes down the runway lands the plane', async ({ page }) => {
  const errs = [];
  await load(page, errs);
  await startClean(page);
  const id = await page.evaluate(() => window.__HL.add('a', 200, 250, 20, false));

  const way = await page.evaluate(() => {
    const r = window.__HL.RW.A;
    const on = d => ({ x: r.tx - r.ux * d, y: r.ty - r.uy * d });   // d px before the threshold
    return [{ x: 200, y: 250 }, { x: 268, y: 268 }, { x: 330, y: 305 },
            on(120), on(90), on(55), on(20), on(-30), on(-75)];
  });
  // interpolate to ~9px steps so it looks like a real gesture, not 9 jumps
  const pts = [];
  for (let i = 0; i < way.length - 1; i++) {
    const a = way[i], b = way[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 9));
    for (let k = 0; k < n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
  }
  pts.push(way[way.length - 1]);

  const b = await page.evaluate(() => {
    const q = document.getElementById('cv').getBoundingClientRect();
    return { left: q.left, top: q.top, w: q.width, h: q.height, W: window.__HL.W, H: window.__HL.H };
  });
  const S = p => ({ x: b.left + p.x * b.w / b.W, y: b.top + p.y * b.h / b.H });
  const a0 = S(pts[0]);
  await page.mouse.move(a0.x, a0.y);
  await page.mouse.down();
  for (const p of pts.slice(1)) { const s = S(p); await page.mouse.move(s.x, s.y); }
  await page.mouse.up();

  await sim(page, 20);
  const out = await page.evaluate(() => ({
    score: window.__HL.S.score, tally: window.__HL.S.tally, phase: window.__HL.S.phase,
  }));
  expect(out.phase, 'a clean approach must not end the game').toBe('play');
  expect(out.score, 'the plane should have landed on A').toBe(1);
  expect(out.tally.A).toBe(1);
  expect(errs).toEqual([]);
});
