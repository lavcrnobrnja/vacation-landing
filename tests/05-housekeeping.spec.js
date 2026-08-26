const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { load } = require('./helpers');

const FILE = path.join(__dirname, '..', 'dist', 'holiday-landing.html');
const read = () => fs.readFileSync(FILE, 'utf8');
/* everything that is not an embedded asset */
const code = () => read().replace(/data:[a-z0-9/+.-]+;base64,[A-Za-z0-9+/=]+/gi, 'data:URI');

test('no browser storage, no forms, no network URLs (12.14)', () => {
  const c = code();
  for (const banned of ['localStorage', 'sessionStorage', 'indexedDB', '<form', 'http://', 'https://']) {
    const i = c.indexOf(banned);
    expect(i, `found "${banned}" at offset ${i}: ${c.slice(Math.max(0, i - 60), i + 60)}`).toBe(-1);
  }
});

test('the built file is a single self-contained document under 260 KB (12.15)', () => {
  const kb = fs.statSync(FILE).size / 1024;
  expect(kb, `built file is ${kb.toFixed(1)} KB`).toBeLessThanOrEqual(260);
  const c = read();
  expect(c).toMatch(/^<!doctype html>/i);
  expect((c.match(/<script/g) || []).length, 'exactly one inline script').toBe(1);
  expect(c).not.toMatch(/<script[^>]+src=/i);
  expect(c).not.toMatch(/<link[^>]+href=/i);
  expect((c.match(/data:image\/webp;base64,/g) || []).length, 'four embedded images').toBe(4);
});

test('it makes no network requests at runtime (13.1)', async ({ page }) => {
  const external = [];
  page.on('request', r => { if (!r.url().startsWith('file://')) external.push(r.url()); });
  await load(page);
  await page.evaluate(() => { window.__HL.seed(5); window.__HL.start(); });
  await page.waitForTimeout(1200);
  expect(external, 'the page must work with no network at all').toEqual([]);
});

test('accessibility: labels, focus, reduced motion and auto-pause (11)', async ({ page }) => {
  await load(page);
  const a = await page.evaluate(() => {
    const s = document.getElementById('btnSound');
    const p = document.getElementById('btnPause');
    return {
      canvasLabel: document.getElementById('cv').getAttribute('aria-label'),
      soundPressed: s.getAttribute('aria-pressed'),
      soundLabel: s.getAttribute('aria-label'),
      pauseLabel: p.getAttribute('aria-label'),
      buttons: [...document.querySelectorAll('button')].length,
    };
  });
  expect(a.canvasLabel).toBeTruthy();
  expect(a.soundPressed, 'sound is muted by default (8.5)').toBe('false');
  expect(a.soundLabel).toMatch(/off/i);
  expect(a.pauseLabel).toMatch(/pause/i);
  expect(a.buttons).toBeGreaterThanOrEqual(3);

  // no AudioContext may exist before the user asks for sound
  expect(await page.evaluate(() => window.__audioMade === true)).toBeFalsy();

  // keyboard: space starts, p pauses, m unmutes
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__HL.S.phase)).toBe('play');
  await page.keyboard.press('p');
  expect(await page.evaluate(() => window.__HL.S.phase)).toBe('paused');
  await page.keyboard.press('p');
  expect(await page.evaluate(() => window.__HL.S.phase)).toBe('play');
  await page.keyboard.press('m');
  expect(await page.evaluate(() => document.getElementById('btnSound').getAttribute('aria-pressed'))).toBe('true');
});

test('reduced motion is honoured', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await load(page);
  expect(await page.evaluate(() => window.__HL.S.reduced)).toBe(true);
  await page.evaluate(() => { window.__HL.seed(5); window.__HL.start(); window.__HL.hold(true);
    window.__HL.clear(); window.__HL.add('a', 400, 400, 0, false); });
  await page.evaluate(() => { for (let i = 0; i < 120; i++) window.__HL.step(1 / 60); });
  const s = await page.evaluate(() => ({ trail: window.__HL.S.planes[0].trail.length, shake: window.__HL.S.shake }));
  expect(s.trail, 'no wake trail under reduced motion').toBe(0);
  await ctx.close();
});

test('the game auto-pauses when the tab is hidden', async ({ page }) => {
  await load(page);
  await page.evaluate(() => { window.__HL.start(); });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  });
  expect(await page.evaluate(() => window.__HL.S.phase)).toBe('paused');
});
