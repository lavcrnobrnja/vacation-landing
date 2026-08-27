const { test, expect } = require('@playwright/test');
const { load } = require('./helpers');

test('loads with no page or console errors, and all four images decode', async ({ page }) => {
  const errs = [];
  await load(page, errs);
  // the start card only appears once all four images have decoded, and load()
  // waited for it; confirm the canvas is really backed by pixels too
  const ok = await page.evaluate(() => {
    const c = document.getElementById('cv');
    const d = c.getContext('2d').getImageData(640, 400, 1, 1).data;
    return c.width > 0 && c.height > 0 && (d[0] + d[1] + d[2]) > 0;
  });
  expect(ok).toBe(true);
  expect(errs).toEqual([]);
});

test('canvas keeps a 1.501 ratio at every viewport (10.1)', async ({ page }) => {
  await load(page);
  for (const [w, h] of [[1280, 900], [1440, 760], [820, 1180], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => {
      const b = document.getElementById('cv').getBoundingClientRect();
      return { w: b.width, h: b.height, ratio: b.width / b.height };
    });
    expect(r.w, `${w}x${h} width`).toBeGreaterThan(0);
    expect(Math.abs(r.ratio - 1.501), `${w}x${h} ratio was ${r.ratio.toFixed(4)}`).toBeLessThan(0.005);
  }
});

test('every approach guide stays inside the canvas (10.2)', async ({ page }) => {
  await load(page);
  const { guides, W, H } = await page.evaluate(() => ({
    guides: window.__HL.guides(), W: window.__HL.W, H: window.__HL.H,
  }));
  expect(guides.length).toBe(3);
  for (const g of guides) {
    expect(g.g, `${g.k} corridor length`).toBeLessThanOrEqual(100);
    expect(g.g, `${g.k} corridor length`).toBeGreaterThan(20);
    // both rails, at both ends
    for (const s of [-1, 1]) {
      const px = -g.uy * g.hw * s, py = g.ux * g.hw * s;
      for (const [x, y] of [[g.tx + px, g.ty + py], [g.ex + px, g.ey + py]]) {
        // §7 asks for a 20px margin, and it must hold on the rails, not just
        // the centreline — C's rails leave the canvas long before its centre
        expect(x, `${g.k} guide rail x=${x.toFixed(1)}`).toBeGreaterThanOrEqual(20);
        expect(x, `${g.k} guide rail x=${x.toFixed(1)}`).toBeLessThanOrEqual(W - 20);
        expect(y, `${g.k} guide rail y=${y.toFixed(1)}`).toBeGreaterThanOrEqual(20);
        expect(y, `${g.k} guide rail y=${y.toFixed(1)}`).toBeLessThanOrEqual(H - 20);
      }
    }
  }
});

/* The portrait gate is for a phone held upright and nothing else. A narrow
   browser window or an embedded side panel is also portrait and under 640px,
   but it still gets a usable playfield, so gating it would be a regression —
   and the artifact preview pane is exactly that shape. */
const GATE_CASES = [
  { w: 610,  h: 660,  touch: false, gated: false, what: 'artifact side panel' },
  { w: 430,  h: 860,  touch: true,  gated: true,  what: 'phone held upright' },
  { w: 430,  h: 860,  touch: false, gated: false, what: 'narrow desktop window' },
  { w: 844,  h: 390,  touch: true,  gated: false, what: 'phone on its side' },
  { w: 820,  h: 1180, touch: true,  gated: false, what: 'tablet upright' },
  { w: 1280, h: 900,  touch: false, gated: false, what: 'desktop' },
];

for (const c of GATE_CASES) {
  test(`the rotate gate ${c.gated ? 'covers' : 'stays out of'} a ${c.what}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: c.w, height: c.h }, hasTouch: c.touch, isMobile: c.touch,
    });
    const page = await ctx.newPage();
    await load(page);
    const r = await page.evaluate(() => {
      const g = document.querySelector('.rotate');
      const cv = document.getElementById('cv').getBoundingClientRect();
      return {
        gated: getComputedStyle(g).display !== 'none',
        w: cv.width, h: cv.height, ratio: cv.width / cv.height,
      };
    });
    expect(r.gated, `${c.w}x${c.h} touch=${c.touch}`).toBe(c.gated);
    if (!c.gated) {
      // whatever is not gated has to be actually playable
      expect(r.w, `playfield was only ${Math.round(r.w)}px wide`).toBeGreaterThan(320);
      expect(Math.abs(r.ratio - 1.501)).toBeLessThan(0.005);
    }
    await ctx.close();
  });
}

/* Whatever the window, both cards have to fit inside it — an unreachable Start
   button is a hard failure, and the artifact preview pane is one of these
   shapes. */
const FIT_SIZES = [
  [610, 660], [560, 600], [500, 900], [430, 860], [380, 700], [700, 760],
  [844, 390], [740, 360], [667, 375], [1024, 768], [1280, 900], [1440, 760],
  [1920, 1080], [1280, 620], [900, 420],
];

test('the start and game-over cards fit every window size', async ({ page }) => {
  await load(page);
  const bad = [];
  for (const [w, h] of FIT_SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(60);

    await page.evaluate(() => { window.__HL.S.phase = 'start'; });
    await page.evaluate(() => {
      const c = document.getElementById('card');
      window.__probe = () => {
        const btn = document.getElementById('go').getBoundingClientRect();
        return {
          overflow: c.scrollHeight - c.clientHeight,
          reachable: btn.bottom <= innerHeight + 0.5 && btn.top >= -0.5,
        };
      };
    });
    const start = await page.evaluate(() => window.__probe());

    // now the game-over card, which is the taller of the two
    await page.evaluate(() => {
      const H = window.__HL;
      H.start(); H.hold(true); H.freeze(true); H.clear();
      const r = H.RW.B;
      H.add('a', r.tx - r.ux * 10, r.ty - r.uy * 10, r.deg, true);
      for (let i = 0; i < 140; i++) H.step(1 / 60);
    });
    const over = await page.evaluate(() => {
      const c = document.getElementById('card');
      const btn = document.getElementById('go').getBoundingClientRect();
      return {
        overflow: c.scrollHeight - c.clientHeight,
        reachable: btn.bottom <= innerHeight + 0.5 && btn.top >= -0.5,
      };
    });

    for (const [name, r] of [['start', start], ['game-over', over]]) {
      if (r.overflow > 0 || !r.reachable) {
        bad.push(`${w}x${h} ${name}: overflow ${r.overflow}px, button ${r.reachable ? 'reachable' : 'OUT OF REACH'}`);
      }
    }
    await page.reload();
    await page.waitForFunction(() => window.__HL && !document.getElementById('veil').hidden);
  }
  expect(bad, `cards did not fit:\n  ${bad.join('\n  ')}`).toEqual([]);
});
