const { chromium } = require('@playwright/test');
/* A FAST mouse flick: pointermove fires far apart, so the raw polyline has long
   straight runs and hard corners. This is the case that puts a plane off the
   line, and it is what a player actually draws mid-rush. */
function flick(x0,y0){
  const way=[[x0,y0],[x0+120,y0-16],[x0+250,y0+24],[x0+300,y0+140],
             [x0+215,y0+235],[x0+80,y0+232],[x0+34,y0+140],[x0+130,y0+96],[x0+240,y0+120]];
  const pts=[];
  for(let i=0;i<way.length-1;i++){
    const [ax,ay]=way[i],[bx,by]=way[i+1];
    const n=Math.max(1,Math.round(Math.hypot(bx-ax,by-ay)/38));   // ~38px between samples
    for(let k=0;k<n;k++) pts.push({x:ax+(bx-ax)*k/n,y:ay+(by-ay)*k/n});
  }
  pts.push({x:way.at(-1)[0],y:way.at(-1)[1]});
  return pts;
}
function weave(head,win=8,floor=2e-4){
  const d=[];for(let i=1;i<head.length;i++){const x=head[i]-head[i-1];d.push(Math.atan2(Math.sin(x),Math.cos(x)));}
  const sm=[];for(let i=0;i<d.length;i++){let s=0,n=0;
    for(let j=Math.max(0,i-win);j<=Math.min(d.length-1,i+win);j++){s+=d[j];n++;}sm.push(s/n);}
  let p=0,c=0;for(const v of sm){if(Math.abs(v)<floor)continue;const g=Math.sign(v);if(p!==0&&g!==p)c++;p=g;}
  return c;
}
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  await pg.goto('file:///home/user/vacation-landing/dist/holiday-landing.html');
  await pg.waitForFunction(()=>window.__HL&&!document.getElementById('veil').hidden);
  const bx=await pg.evaluate(()=>{const r=document.getElementById('cv').getBoundingClientRect();
    return{left:r.left,top:r.top,w:r.width,h:r.height,W:window.__HL.W,H:window.__HL.H};});
  const S=p=>({x:bx.left+p.x*bx.w/bx.W,y:bx.top+p.y*bx.h/bx.H});
  const pts=flick(330,240);
  console.log('R     k     minute  spd   maxOff   p95    mean   weave');
  for(const R of [16,20,24,28,34])
  for(const kk of [1.1,1.25,1.5])
  for(const minute of [0,14]){
    const r=await pg.evaluate(([RR,k,m])=>{const H=window.__HL;H.seed(9);H.start();H.freeze(true);
      H.hold(true);H.clear();H.tune({R:RR,k:k,ch:2});
      H.S.t=m*60; H.step(0); return H.S.speed;},[R,kk,minute]);
    const id=await pg.evaluate(()=>window.__HL.add('a',330,240,0,false));
    const a=S(pts[0]);await pg.mouse.move(a.x,a.y);await pg.mouse.down();
    for(const q of pts.slice(1)){const s=S(q);await pg.mouse.move(s.x,s.y);}
    await pg.mouse.up();
    const d=await pg.evaluate(id=>{const H=window.__HL,dt=1/60,o=[];
      for(let i=0;i<3000;i++){const p=H.get(id);if(!p)break;H.step(dt);
        o.push({off:p.offPath,h:p.hdg});if(!p.path)break;}return o;},id);
    const raw=d.slice(40).map(z=>z.off);
    const srt=[...raw].sort((x,y)=>x-y);
    console.log(String(R).padEnd(6),String(kk).padEnd(6),String(minute).padEnd(8),
      r.toFixed(0).padEnd(6),
      Math.max(...raw).toFixed(1).padEnd(9),
      srt[Math.floor(srt.length*0.95)].toFixed(1).padEnd(7),
      (raw.reduce((s,x)=>s+x,0)/raw.length).toFixed(1).padEnd(7),
      weave(d.map(z=>z.h)));
  }
  await b.close();
})();
