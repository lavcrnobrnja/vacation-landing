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

const standalone='<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'+
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+
  '<meta name="description" content="Air-traffic control for people who need a holiday. '+
  'Land every plane on the runway painted its colour.">\n'+
  '<meta name="theme-color" content="#F3F0F8">\n'+
  src.replace(/^<title>/,'<title>')+'\n</html>\n';
fs.writeFileSync(path.join(root,'dist','holiday-landing.html'),standalone);

for(const f of ['artifact.html','holiday-landing.html']){
  const kb=fs.statSync(path.join(root,'dist',f)).size/1024;
  console.log(f.padEnd(24), kb.toFixed(1)+' KB', kb<=260?'✓ under 260 KB':'✗ OVER BUDGET');
}
