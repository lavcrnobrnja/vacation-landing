const { test, expect } = require('@playwright/test');
const { load, startClean } = require('./helpers');

/* The shipped curve. §6's original tops out between 10 and 14 minutes and moves
   so little early that the opening minutes feel identical; this one reaches
   full pressure at ~7 minutes and steps the aircraft cap every ~54s. */
const TABLE = [
  { min: 0,  maxAir: 3,  gap: 6.60, speed: 38.0 },
  { min: 1,  maxAir: 4,  gap: 5.93, speed: 41.7 },
  { min: 2,  maxAir: 5,  gap: 5.27, speed: 45.4 },
  { min: 3,  maxAir: 6,  gap: 4.60, speed: 49.1 },
  { min: 4,  maxAir: 7,  gap: 3.93, speed: 52.9 },
  { min: 5,  maxAir: 8,  gap: 3.27, speed: 56.6 },
  { min: 6,  maxAir: 9,  gap: 2.60, speed: 60.3 },
  { min: 7,  maxAir: 10, gap: 2.60, speed: 64.0 },
  { min: 12, maxAir: 10, gap: 2.60, speed: 64.0 },
];

/** Run the real game loop with a scripted player who clears a plane every ~2.5s
 *  and breaks up any conflict before it lands them in a crash. */
async function play(page, minutes, seed = 11) {
  return page.evaluate(([minutes, seed]) => {
    const H = window.__HL, S = H.S, dt = 1 / 60;
    H.seed(seed); H.start(); H.hold(true);
    const perMinute = [], arrivalsPerMinute = [];
    let nextClear = 2.5, minute = 0, peak = 0, peakEarly = 0, lastSeq = 0, arrivals = 0;
    const frames = 60 * 60 * minutes + 90;   // a little past the last boundary,
    for (let i = 0; i < frames; i++) {       // dt accumulation runs slightly short
      H.step(dt);
      const air = S.planes.filter(p => !p.landing);
      peak = Math.max(peak, air.length);
      if (S.t < 50) peakEarly = Math.max(peakEarly, air.length);
      if (S.seq > lastSeq) { arrivals += S.seq - lastSeq; lastSeq = S.seq; }

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
      if (S.t >= (minute + 1) * 60) {
        perMinute.push(S.maxAir);
        arrivalsPerMinute.push(arrivals);
        arrivals = 0; minute++;
      }
    }
    return { perMinute, arrivalsPerMinute, peak, peakEarly, phase: S.phase, elapsed: S.t };
  }, [minutes, seed]);
}

test('the difficulty curves follow the table (12.12)', async ({ page }) => {
  await load(page);
  const out = await page.evaluate(marks => {
    const H = window.__HL;
    H.start(); H.hold(true); H.freeze(true);
    const got = {};
    for (const m of marks) {
      H.S.t = m * 60; H.S.lastMax = 99; H.step(0);
      got[m] = { maxAir: H.S.maxAir, gap: H.S.gap, speed: H.S.speed };
    }
    return got;
  }, TABLE.map(r => r.min));

  for (const row of TABLE) {
    const s = out[row.min];
    expect(s.maxAir, `minute ${row.min} aircraft cap`).toBe(row.maxAir);
    expect(Math.abs(s.gap - row.gap), `minute ${row.min} gap was ${s.gap.toFixed(2)}s`).toBeLessThan(0.06);
    expect(Math.abs(s.speed - row.speed), `minute ${row.min} speed was ${s.speed.toFixed(1)}`).toBeLessThan(0.6);
  }
});

test('the sky starts calm: three aircraft for the opening minute (12.13)', async ({ page }) => {
  await load(page);
  const r = await play(page, 1, 3);
  expect(r.phase).toBe('play');
  expect(r.peakEarly, `peak concurrent planes in the first 50s was ${r.peakEarly}`).toBeLessThanOrEqual(3);
});

test('it actually gets harder: the cap climbs and arrivals speed up', async ({ page }) => {
  await load(page);
  const r = await play(page, 7);
  expect(r.phase, 'the scripted player should survive seven minutes').toBe('play');

  // the aircraft cap must rise every single minute until it tops out
  const caps = r.perMinute;
  expect(caps.length).toBeGreaterThanOrEqual(7);
  for (let i = 1; i < 6; i++)
    expect(caps[i], `cap at minute ${i + 1} (${caps[i]}) should exceed minute ${i} (${caps[i - 1]})`)
      .toBeGreaterThan(caps[i - 1]);
  expect(caps[0]).toBe(4);
  expect(caps[6]).toBe(10);

  // and arrivals must visibly speed up: the sixth minute should bring
  // substantially more traffic than the first
  const first = r.arrivalsPerMinute[0], sixth = r.arrivalsPerMinute[5];
  expect(sixth / first, `arrivals went ${first}/min -> ${sixth}/min`).toBeGreaterThan(1.5);
});

test('the ramp is steeper than the one it replaced', async ({ page }) => {
  await load(page);
  const now = await page.evaluate(() => {
    const H = window.__HL; H.start(); H.hold(true); H.freeze(true);
    H.S.t = 4 * 60; H.S.lastMax = 99; H.step(0);
    return { maxAir: H.S.maxAir, gap: H.S.gap, speed: H.S.speed };
  });
  // §6's original at four minutes: 5 aircraft, 5.7s gap, 44px/s
  expect(now.maxAir).toBeGreaterThan(5);
  expect(now.gap).toBeLessThan(5.7);
  expect(now.speed).toBeGreaterThan(44);
});

test('the first arrival is gentle and the sky starts empty', async ({ page }) => {
  await load(page);
  await startClean(page);
  const s = await page.evaluate(() => ({ air: window.__HL.S.planes.length, gap: window.__HL.S.gap }));
  expect(s.gap).toBeCloseTo(6.6, 1);
  expect(s.air).toBe(0);
});

test('a rising aircraft cap is announced on the playfield', async ({ page }) => {
  await load(page);
  const shown = await page.evaluate(() => {
    const H = window.__HL;
    H.seed(5); H.start(); H.hold(true); H.freeze(true);
    for (let i = 0; i < 60 * 56; i++) H.step(1 / 60);    // ~2s after the first step,
                                                        // inside the note's 2.6s life
    return { notes: H.S.notes.map(n => n.txt), cap: H.S.maxAir };
  });
  expect(shown.cap).toBe(4);
  expect(shown.notes.join(' '), 'the step up should be announced').toMatch(/4 aircraft inbound/);
});

test('the header shows the shift clock ticking', async ({ page }) => {
  await load(page);
  await page.evaluate(() => {
    const H = window.__HL; H.start(); H.hold(true); H.freeze(true);
    for (let i = 0; i < 60 * 75; i++) H.step(1 / 60);
  });
  expect(await page.textContent('#clock')).toMatch(/^1:1[45]$/);
});
