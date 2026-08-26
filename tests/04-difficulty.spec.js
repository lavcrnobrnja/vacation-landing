const { test, expect } = require('@playwright/test');
const { load, startClean } = require('./helpers');

/* §6's table. A competent player clears a plane every ~2.5s and breaks up any
   conflict before it becomes a crash, so the run survives the full 15 minutes. */
const TABLE = [
  { min: 0,  maxAir: 3, gap: 7.0, speed: 38 },
  { min: 2,  maxAir: 4, gap: 6.4, speed: 41 },
  { min: 4,  maxAir: 5, gap: 5.7, speed: 44 },
  { min: 8,  maxAir: 7, gap: 4.5, speed: 49 },
  { min: 12, maxAir: 8, gap: 3.2, speed: 55 },
  { min: 14, maxAir: 8, gap: 3.2, speed: 58 },
];

test('the difficulty curves follow the table over 15 minutes (12.12)', async ({ page }) => {
  await load(page);
  await page.evaluate(() => {
    window.__HL.seed(11);
    window.__HL.start();
    window.__HL.hold(true);          // we drive time; spawning stays ON
  });
  const out = await page.evaluate(marks => {
    const H = window.__HL, S = H.S, dt = 1 / 60;
    const samples = {}, perMinute = [];
    let nextClear = 2.5, minute = 0, maxThisMinute = 0, mi = 0;
    for (let i = 0; i < 60 * 60 * 15; i++) {
      H.step(dt);
      const air = S.planes.filter(p => !p.landing);
      maxThisMinute = Math.max(maxThisMinute, air.length);

      // scripted player: break up any conflict, then clear one every ~2.5s
      for (let a = 0; a < air.length && S.phase === 'play'; a++)
        for (let b = a + 1; b < air.length; b++)
          if (Math.hypot(air[a].x - air[b].x, air[a].y - air[b].y) < H.WARN_D + 6) {
            const k = S.planes.indexOf(air[b]);
            if (k >= 0) S.planes.splice(k, 1);
          }
      if (S.t >= nextClear) {
        nextClear += 2.5;
        const live = S.planes.filter(p => !p.landing);
        if (live.length) S.planes.splice(S.planes.indexOf(live[0]), 1);
      }
      if (mi < marks.length && S.t >= marks[mi] * 60) {
        samples[marks[mi]] = { maxAir: S.maxAir, gap: S.gap, speed: S.speed };
        mi++;
      }
      if (S.t >= (minute + 1) * 60) { perMinute.push(maxThisMinute); maxThisMinute = 0; minute++; }
    }
    return { samples, perMinute, phase: S.phase, elapsed: S.t };
  }, TABLE.map(r => r.min));

  expect(out.phase, 'the scripted player should survive 15 minutes').toBe('play');
  expect(out.elapsed).toBeGreaterThan(890);
  for (const row of TABLE) {
    const s = out.samples[row.min];
    expect(s, `no sample at minute ${row.min}`).toBeTruthy();
    expect(s.maxAir, `minute ${row.min} concurrency cap`).toBe(row.maxAir);
    expect(Math.abs(s.gap - row.gap), `minute ${row.min} gap was ${s.gap.toFixed(2)}s`).toBeLessThan(0.06);
    expect(Math.abs(s.speed - row.speed), `minute ${row.min} speed was ${s.speed.toFixed(1)}`).toBeLessThan(0.6);
  }
  // the cap is the primary lever, so it must actually bind
  expect(Math.max(...out.perMinute)).toBeLessThanOrEqual(8);
});

test('at most three planes are airborne in the first two minutes (12.13)', async ({ page }) => {
  await load(page);
  await page.evaluate(() => { window.__HL.seed(3); window.__HL.start(); window.__HL.hold(true); });
  const r = await page.evaluate(() => {
    const H = window.__HL, S = H.S, dt = 1 / 60;
    let peak = 0, arrivals = 0, lastSeq = 0, nextClear = 2.5;
    for (let i = 0; i < 60 * 120; i++) {
      H.step(dt);
      peak = Math.max(peak, S.planes.filter(p => !p.landing).length);
      if (S.seq > lastSeq) { arrivals += S.seq - lastSeq; lastSeq = S.seq; }
      // a competent player clears one every ~2.5s, so the cap - not a jammed
      // sky - is what limits concurrency
      if (S.t >= nextClear) {
        nextClear += 2.5;
        const live = S.planes.filter(p => !p.landing);
        if (live.length) S.planes.splice(S.planes.indexOf(live[0]), 1);
      }
      const air = S.planes.filter(p => !p.landing);
      for (let a = 0; a < air.length; a++)
        for (let b = a + 1; b < air.length; b++)
          if (Math.hypot(air[a].x - air[b].x, air[a].y - air[b].y) < H.WARN_D + 6) {
            const k = S.planes.indexOf(air[b]); if (k >= 0) S.planes.splice(k, 1);
          }
    }
    return { peak, arrivals, phase: S.phase, maxAir: S.maxAir };
  });
  expect(r.phase).toBe('play');
  expect(r.peak, `peak concurrent planes in the first 2 minutes was ${r.peak}`).toBeLessThanOrEqual(3);
  expect(r.arrivals, 'arrivals should be roughly 120s / 7s').toBeGreaterThan(8);
  expect(r.arrivals).toBeLessThan(26);
});

test('the first arrival is gentle and the sky starts empty', async ({ page }) => {
  await load(page);
  await startClean(page);
  const s = await page.evaluate(() => ({ air: window.__HL.S.planes.length, gap: window.__HL.S.gap }));
  expect(s.gap).toBeCloseTo(7.0, 1);
  expect(s.air).toBe(0);
});
