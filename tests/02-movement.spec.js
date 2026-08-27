const { test, expect } = require('@playwright/test');
const { load, startClean } = require('./helpers');

/* A human-shaped drag: a real S, high-frequency hand tremor, and the slow
   drift a wrist makes across a long stroke. Never a straight line (10.6). */
function handDrawnS(x0, y0) {
  const pts = [];
  for (let i = 0; i <= 74; i++) {
    const t = i / 74;
    pts.push({
      x: x0 + t * 440 + Math.cos(t * 160) * 1.1,
      y: y0 + Math.sin(t * Math.PI * 2) * 110 + Math.sin(t * 180) * 1.6 + Math.sin(t * 6.1) * 3.5,
    });
  }
  return pts;
}
const arclen = p => p.reduce((s, q, i) => i ? s + Math.hypot(q.x - p[i - 1].x, q.y - p[i - 1].y) : 0, 0);
const dHead = h => {
  const d = [];
  for (let i = 1; i < h.length; i++) { const x = h[i] - h[i - 1]; d.push(Math.atan2(Math.sin(x), Math.cos(x))); }
  return d;
};

/** Sign changes of the raw per-frame heading rate — the spec's literal test. */
function rawFlips(head) {
  let prev = 0, c = 0;
  for (const v of dHead(head)) {
    if (Math.abs(v) < 1e-9) continue;
    const s = Math.sign(v);
    if (prev !== 0 && s !== prev) c++;
    prev = s;
  }
  return c;
}
/** The same count, low-passed over ±8 frames so per-frame quantisation cannot
 *  register as a turn. A weave has a period of tens of frames and survives it. */
function smoothFlips(head, win = 8, floor = 2e-4) {
  const d = dHead(head), sm = [];
  for (let i = 0; i < d.length; i++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - win); j <= Math.min(d.length - 1, i + win); j++) { s += d[j]; n++; }
    sm.push(s / n);
  }
  let prev = 0, c = 0;
  for (const v of sm) {
    if (Math.abs(v) < floor) continue;
    const s = Math.sign(v);
    if (prev !== 0 && s !== prev) c++;
    prev = s;
  }
  return c;
}

async function drag(page, pts) {
  const b = await page.evaluate(() => {
    const r = document.getElementById('cv').getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height, W: window.__HL.W, H: window.__HL.H };
  });
  const S = p => ({ x: b.left + p.x * b.w / b.W, y: b.top + p.y * b.h / b.H });
  const a = S(pts[0]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (const p of pts.slice(1)) { const s = S(p); await page.mouse.move(s.x, s.y); }
  await page.mouse.up();
}
async function flyAndSample(page, id, frames = 1600) {
  return page.evaluate(([id, frames]) => {
    const H = window.__HL, dt = 1 / 60, head = [], off = [];
    for (let i = 0; i < frames; i++) {
      const p = H.get(id);
      if (!p) break;
      H.step(dt);
      head.push(p.hdg); off.push(p.offPath);
      if (!p.path) break;
    }
    return { head, off };
  }, [id, frames]);
}

test('the weave metric actually detects a weave', () => {
  // what waypoint-chasing looks like: the desired heading thrashes every frame
  const chaser = []; let h = 0;
  for (let i = 0; i < 900; i++) { h += (i % 14 < 7 ? 1 : -1) * 0.02; chaser.push(h); }
  expect(smoothFlips(chaser)).toBeGreaterThan(50);
  // what a single smooth arc looks like
  const arc = []; h = 0;
  for (let i = 0; i < 900; i++) { h += i < 300 ? 0.01 : (i < 600 ? -0.008 : 0); arc.push(h); }
  expect(smoothFlips(arc)).toBeLessThanOrEqual(3);
});

test('a hand-drawn 600px route becomes one smooth arc, not a weave (12.4)', async ({ page }) => {
  const errs = [];
  await load(page, errs);
  await startClean(page);
  const id = await page.evaluate(() => window.__HL.add('a', 300, 210, 0, false));

  const pts = handDrawnS(300, 210);
  expect(arclen(pts), 'route should be roughly 600px').toBeGreaterThan(540);
  expect(arclen(pts), 'route should be roughly 600px').toBeLessThan(700);
  await drag(page, pts);
  expect(await page.evaluate(i => !!window.__HL.get(i).path, id), 'drag committed').toBe(true);

  const { head } = await flyAndSample(page, id);
  expect(head.length).toBeGreaterThan(200);

  const raw = rawFlips(head), sm = smoothFlips(head);
  expect(raw, `raw heading-rate sign changes: ${raw}`).toBeLessThanOrEqual(3);
  expect(sm, `low-passed heading-rate sign changes: ${sm}`).toBeLessThanOrEqual(3);
  expect(errs).toEqual([]);
});

test('the plane settles onto the drawn line and stays on it (12.5)', async ({ page }) => {
  await load(page);
  await startClean(page);
  const id = await page.evaluate(() => window.__HL.add('a', 300, 210, 0, false));
  await drag(page, handDrawnS(300, 210));
  const { off } = await flyAndSample(page, id);
  const worst = Math.max(...off.slice(45));
  const mean = off.slice(45).reduce((a, b) => a + b, 0) / (off.length - 45);
  // §12.5 allows 25px; the tracker holds ~7px, so guard the real figure
  expect(worst, `worst off-path distance after settling was ${worst.toFixed(1)}px`).toBeLessThan(12);
  expect(mean, `mean off-path distance was ${mean.toFixed(1)}px`).toBeLessThan(3);
});

/* A fast mouse flick fires pointermove far apart, so the raw polyline has long
   straight runs and hard corners — the case that used to leave a plane 24px
   wide of its own line at end-game speed. */
function flick(x0, y0) {
  const way = [[x0, y0], [x0 + 120, y0 - 16], [x0 + 250, y0 + 24], [x0 + 300, y0 + 140],
               [x0 + 215, y0 + 235], [x0 + 80, y0 + 232], [x0 + 34, y0 + 140],
               [x0 + 130, y0 + 96], [x0 + 240, y0 + 120]];
  const pts = [];
  for (let i = 0; i < way.length - 1; i++) {
    const [ax, ay] = way[i], [bx, by] = way[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 38));
    for (let k = 0; k < n; k++) pts.push({ x: ax + (bx - ax) * k / n, y: ay + (by - ay) * k / n });
  }
  pts.push({ x: way[way.length - 1][0], y: way[way.length - 1][1] });
  return pts;
}

for (const minute of [0, 14]) {
  test(`a fast flick is tracked at minute ${minute}: the plane stays on its line`, async ({ page }) => {
    await load(page);
    await startClean(page);
    const speed = await page.evaluate(m => {
      window.__HL.S.t = m * 60; window.__HL.step(0); return window.__HL.S.speed;
    }, minute);
    expect(speed).toBeCloseTo(minute === 0 ? 38 : 68, 0);   // 68 is the top speed

    const id = await page.evaluate(() => window.__HL.add('a', 330, 240, 0, false));
    await drag(page, flick(330, 240));
    const { off, head } = await page.evaluate(([id, m]) => {
      const H = window.__HL, dt = 1 / 60, off = [], head = [];
      for (let i = 0; i < 3000; i++) {
        const p = H.get(id);
        if (!p) break;
        H.S.t = m * 60;                     // hold the difficulty point steady
        H.step(dt);
        off.push(p.offPath); head.push(p.hdg);
        if (!p.path) break;
      }
      return { off, head };
    }, [id, minute]);

    const settled = off.slice(40);
    const worst = Math.max(...settled);
    const mean = settled.reduce((a, b) => a + b, 0) / settled.length;
    expect(worst, `worst off-path was ${worst.toFixed(1)}px at ${speed.toFixed(0)}px/s`).toBeLessThan(12);
    expect(mean, `mean off-path was ${mean.toFixed(1)}px at ${speed.toFixed(0)}px/s`).toBeLessThan(3.5);
    expect(smoothFlips(head), 'a flick still has to fly as clean arcs').toBeLessThanOrEqual(6);
  });
}

test('tracking does not degrade as the game speeds up', async ({ page }) => {
  await load(page);
  const worst = {};
  for (const minute of [0, 14]) {
    await startClean(page);
    await page.evaluate(m => { window.__HL.S.t = m * 60; window.__HL.step(0); }, minute);
    const id = await page.evaluate(() => window.__HL.add('a', 330, 240, 0, false));
    await drag(page, flick(330, 240));
    worst[minute] = await page.evaluate(([id, m]) => {
      const H = window.__HL, dt = 1 / 60; let w = 0;
      for (let i = 0; i < 3000; i++) {
        const p = H.get(id);
        if (!p) break;
        H.S.t = m * 60; H.step(dt);
        if (i > 40) w = Math.max(w, p.offPath);
        if (!p.path) break;
      }
      return w;
    }, [id, minute]);
  }
  // turning is defined by a fixed radius, so 58px/s must track like 38px/s
  expect(Math.abs(worst[14] - worst[0]),
    `off-path was ${worst[0].toFixed(1)}px at 38px/s and ${worst[14].toFixed(1)}px at 58px/s`)
    .toBeLessThan(2);
});

test('a plane with no route left flies straight and does not spin (12.6)', async ({ page }) => {
  await load(page);
  await startClean(page);
  const id = await page.evaluate(() => window.__HL.add('a', 300, 210, 0, false));
  await drag(page, handDrawnS(300, 210));
  await flyAndSample(page, id);
  const after = await page.evaluate(id => {
    const H = window.__HL, p = H.get(id), out = [];
    for (let i = 0; i < 180; i++) { H.step(1 / 60); out.push(p.hdg); }
    return { out, path: !!p.path };
  }, id);
  expect(after.path).toBe(false);
  const spread = Math.max(...after.out) - Math.min(...after.out);
  expect(spread, `heading drifted ${spread.toFixed(4)} rad with no route`).toBeLessThan(0.02);
});

test('a short drag is a tap: it does not replace the existing route (5.2)', async ({ page }) => {
  await load(page);
  await startClean(page);
  const id = await page.evaluate(() => window.__HL.add('a', 300, 210, 0, false));
  await drag(page, handDrawnS(300, 210));
  const before = await page.evaluate(i => window.__HL.get(i).path.total, id);
  const p = await page.evaluate(i => { const q = window.__HL.get(i); return { x: q.x, y: q.y }; }, id);
  await drag(page, [p, { x: p.x + 6, y: p.y + 5 }, { x: p.x + 11, y: p.y + 8 }]);
  const after = await page.evaluate(i => window.__HL.get(i).path.total, id);
  expect(after).toBe(before);
});

/* The plane has to fly the line while it is being drawn, not sit on its old
   heading until the mouse comes up. Time is stepped BETWEEN pointer moves here,
   which is what makes this different from every other drag test in this file. */
test('the plane follows the line while it is still being drawn', async ({ page }) => {
  await load(page);
  await startClean(page);
  const id = await page.evaluate(() => window.__HL.add('a', 260, 240, 0, false));

  const b = await page.evaluate(() => {
    const r = document.getElementById('cv').getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height, W: window.__HL.W, H: window.__HL.H };
  });
  const S = p => ({ x: b.left + p.x * b.w / b.W, y: b.top + p.y * b.h / b.H });

  // a slow, deliberate arc — the way someone draws when they are being careful
  const way = [[260, 240], [360, 250], [455, 300], [520, 390], [530, 500], [470, 590]];
  const pts = [];
  for (let i = 0; i < way.length - 1; i++) {
    const [ax, ay] = way[i], [bx, by] = way[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 10));
    for (let k = 0; k < n; k++) pts.push({ x: ax + (bx - ax) * k / n, y: ay + (by - ay) * k / n });
  }
  pts.push({ x: way[way.length - 1][0], y: way[way.length - 1][1] });

  const start = S(pts[0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  const samples = [];
  for (const p of pts.slice(1)) {
    const s = S(p);
    await page.mouse.move(s.x, s.y);
    // three frames of flight per pointer move, as in a real drag
    samples.push(await page.evaluate(id => {
      const H = window.__HL, pl = H.get(id);
      for (let i = 0; i < 3; i++) H.step(1 / 60);
      return { hasPath: !!pl.path, off: pl.offPath, x: pl.x, y: pl.y, routed: pl.routed };
    }, id));
  }

  const mid = samples.slice(4);          // let the first few moves establish the line
  expect(mid.every(s => s.hasPath), 'the plane should be on a route throughout the drag').toBe(true);
  expect(mid.every(s => s.routed), 'a real drag marks the plane routed immediately').toBe(true);

  const worst = Math.max(...mid.map(s => s.off));
  expect(worst, `worst off-line distance DURING the drag was ${worst.toFixed(1)}px`).toBeLessThan(14);

  // and it must actually have been flying, not frozen waiting for pointerup
  const moved = Math.hypot(samples[samples.length - 1].x - 260, samples[samples.length - 1].y - 240);
  expect(moved, `plane only moved ${moved.toFixed(0)}px during the drag`).toBeGreaterThan(40);

  await page.mouse.up();
  const after = await page.evaluate(id => !!window.__HL.get(id).path, id);
  expect(after, 'releasing keeps the route').toBe(true);
});

test('a tap on a plane mid-flight restores the route it already had', async ({ page }) => {
  await load(page);
  await startClean(page);
  const id = await page.evaluate(() => window.__HL.add('a', 300, 210, 0, false));
  await drag(page, handDrawnS(300, 210));
  const before = await page.evaluate(i => {
    const p = window.__HL.get(i);
    for (let k = 0; k < 60; k++) window.__HL.step(1 / 60);
    return { total: p.path.total, routed: p.routed };
  }, id);
  const at = await page.evaluate(i => { const p = window.__HL.get(i); return { x: p.x, y: p.y }; }, id);
  await drag(page, [at, { x: at.x + 5, y: at.y + 4 }, { x: at.x + 9, y: at.y + 7 }]);
  const after = await page.evaluate(i => {
    const p = window.__HL.get(i);
    return { total: p.path ? p.path.total : null, routed: p.routed };
  }, id);
  expect(after.total).toBe(before.total);
  expect(after.routed).toBe(before.routed);
});
