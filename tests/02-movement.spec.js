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
  expect(worst, `worst off-path distance after settling was ${worst.toFixed(1)}px`).toBeLessThan(25);
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
