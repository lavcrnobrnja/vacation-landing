const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'dist', 'holiday-landing.html');

/** Load the page and wait for the art to decode and the start card to appear. */
async function load(page, errs) {
  if (errs) {
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  }
  await page.goto(FILE);
  await page.waitForFunction(() => window.__HL && !document.getElementById('veil').hidden);
  return page;
}

/** Start a run with auto-spawn frozen and a deterministic RNG. */
async function startClean(page, seed = 7) {
  await page.evaluate(s => {
    window.__HL.seed(s);
    window.__HL.start();
    window.__HL.freeze(true);
    window.__HL.hold(true);      // the rAF loop must not step time underneath us
    window.__HL.clear();
  }, seed);
}

/** Advance the simulation without waiting on real frames. */
async function sim(page, seconds, dt = 1 / 60) {
  return page.evaluate(([sec, d]) => {
    const n = Math.round(sec / d);
    for (let i = 0; i < n; i++) window.__HL.step(d);
  }, [seconds, dt]);
}

module.exports = { FILE, load, startClean, sim };
