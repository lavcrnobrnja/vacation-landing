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
