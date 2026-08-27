#!/usr/bin/env node
/* Renders dist/holiday-landing-og.png, the 1200x630 link-preview image.
   claude.ai serves static Open Graph tags for artifact URLs, so a link to the
   artifact can never unfurl with the game's own title. Hosted anywhere else,
   the standalone file carries the tags below and this image, and unfurls
   properly. */
const { chromium } = require('@playwright/test');
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const uri = (p, m) => 'data:' + m + ';base64,' +
  fs.readFileSync(path.join(root, 'assets', p)).toString('base64');

const html = `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;position:relative;
       font-family:ui-sans-serif,-apple-system,"Segoe UI",Inter,Roboto,sans-serif;
       background:#0A1834}
  .map{position:absolute;inset:0;background:url('${uri('map.webp', 'image/webp')}') center/cover;
       transform:scale(1.06)}
  .wash{position:absolute;inset:0;
        background:linear-gradient(90deg,rgba(6,14,36,.94) 0%,rgba(6,14,36,.86) 46%,rgba(6,14,36,.24) 100%)}
  .body{position:absolute;inset:0;padding:64px 70px;display:flex;flex-direction:column;
        justify-content:center;gap:0}
  .brand{display:flex;align-items:center;font-weight:800;font-size:29px;letter-spacing:-.03em;
         color:#fff;margin-bottom:26px}
  .mark{width:34px;height:34px;border-radius:50%;background:#7F00FF;color:#fff;display:grid;
        place-items:center;font-size:21px;font-weight:800;margin-right:2px}
  .eyebrow{font-size:16px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;
           color:#ED6E44;margin-bottom:12px}
  h1{font-size:82px;font-weight:800;letter-spacing:-.04em;color:#fff;line-height:1;margin-bottom:22px}
  h1 em{font-style:normal;background:#E8DEF2;color:#281853;border-radius:16px;padding:.02em .16em}
  p{font-size:25px;line-height:1.42;color:#C7D2EA;max-width:19em}
  .fleet{position:absolute;right:58px;bottom:52px;display:flex;align-items:flex-end;gap:26px}
  .fleet img{height:104px;filter:drop-shadow(0 12px 22px rgba(0,0,0,.55))}
</style>
<div class="map"></div><div class="wash"></div>
<div class="body">
  <div class="brand"><span class="mark">V</span>acation Tracker</div>
  <div class="eyebrow">Departures</div>
  <h1>Holiday <em>Landing</em></h1>
  <p>Drag each plane a route and land it on the runway painted its colour.</p>
</div>
<div class="fleet">
  <img src="${uri('plane-a.webp', 'image/webp')}">
  <img src="${uri('plane-b.webp', 'image/webp')}">
  <img src="${uri('plane-c.webp', 'image/webp')}">
</div>`;

(async () => {
  const tmp = path.join(root, 'dist', '_og.html');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await pg.goto('file://' + tmp);
  await pg.waitForTimeout(300);
  const raw = path.join(root, 'dist', '_og_raw.png');
  await pg.screenshot({ path: raw });
  await b.close();
  fs.unlinkSync(tmp);
  // JPEG keeps the preview well under the size every unfurler is happy with
  require('child_process').execSync(
    `python3 -c "from PIL import Image; im=Image.open('${raw}').convert('RGB'); ` +
    `im.save('${path.join(root, 'dist', 'holiday-landing-og.jpg')}', quality=86, optimize=True, progressive=True)"`);
  fs.unlinkSync(raw);
  const out = path.join(root, 'dist', 'holiday-landing-og.jpg');
  console.log('holiday-landing-og.jpg  ' + (fs.statSync(out).size / 1024).toFixed(1) + ' KB  1200x630');
})();
