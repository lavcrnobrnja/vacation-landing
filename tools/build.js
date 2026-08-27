#!/usr/bin/env node
/* Inlines the prepared art as base64 data URIs and emits two files:
     dist/holiday-landing.html  - standalone, opens from file://
     dist/artifact.html         - same page, minus the document skeleton that
                                  the Claude artifact host supplies itself
*/
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const A=p=>fs.readFileSync(path.join(root,'assets',p));
const uri=(p,m)=>'data:'+m+';base64,'+A(p).toString('base64');

let src=fs.readFileSync(path.join(root,'src','game.html'),'utf8');
const subs={
  __MAP__:     uri('map.webp','image/webp'),
  __PLANE_A__: uri('plane-a.webp','image/webp'),
  __PLANE_B__: uri('plane-b.webp','image/webp'),
  __PLANE_C__: uri('plane-c.webp','image/webp')
};
for(const [k,v] of Object.entries(subs)){
  if(!src.includes(k)) throw new Error('missing placeholder '+k);
  src=src.split(k).join(v);
}

fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist','artifact.html'),src);

/* Link-preview tags. claude.ai serves static Open Graph metadata on its artifact
   routes - a made-up id returns the same "Claude Artifact" preview as a real one -
   so an artifact link can never unfurl with this game's own title. Hosted
   anywhere else, these tags and dist/holiday-landing-og.jpg do the job.
   og:image is relative so the file stays free of absolute URLs; every common
   unfurler resolves it against the page URL. Make it absolute if yours does not. */
const DESC='Play Holiday Landing, an air-traffic-control game for Vacation Tracker. '+
  'Drag each plane a route and land it on the runway painted its colour.';
const head=[
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
  '<meta name="theme-color" content="#F3F0F8">',
  '<meta name="description" content="'+DESC+'">',
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="Vacation Tracker">',
  '<meta property="og:title" content="Holiday Landing">',
  '<meta property="og:description" content="'+DESC+'">',
  '<meta property="og:image" content="holiday-landing-og.jpg">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="Holiday Landing - three island runways seen from above">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="Holiday Landing">',
  '<meta name="twitter:description" content="'+DESC+'">',
  '<meta name="twitter:image" content="holiday-landing-og.jpg">'
].join('\n');
const standalone='<!doctype html>\n<html lang="en">\n<head>\n'+head+'\n'+src+'\n</html>\n';
fs.writeFileSync(path.join(root,'dist','holiday-landing.html'),standalone);

/* docs/ is what GitHub Pages serves. A link preview can only read Open Graph
   tags from a URL it can fetch, so the game has to live on a real host before
   any of those tags do anything. */
const docs=path.join(root,'docs');
fs.mkdirSync(docs,{recursive:true});
fs.writeFileSync(path.join(docs,'index.html'),standalone);
const og=path.join(root,'dist','holiday-landing-og.jpg');
if(fs.existsSync(og)) fs.copyFileSync(og,path.join(docs,'holiday-landing-og.jpg'));
else console.warn('  ! no dist/holiday-landing-og.jpg - run node tools/make-og.js');

for(const f of ['artifact.html','holiday-landing.html']){
  const kb=fs.statSync(path.join(root,'dist',f)).size/1024;
  console.log(f.padEnd(24), kb.toFixed(1)+' KB', kb<=260?'✓ under 260 KB':'✗ OVER BUDGET');
}
