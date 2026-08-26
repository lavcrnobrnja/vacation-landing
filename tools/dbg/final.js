const { chromium } = require('@playwright/test');
const prof = t=>({wx:Math.cos(t*160)*1.1, wy:Math.sin(t*180)*1.6+Math.sin(t*6.1)*3.5});
/* sign changes of the heading rate, low-passed over `win` frames so per-frame
   quantisation cannot register as a turn. A real weave has a period of tens of
   frames and survives this untouched. */
function weaveCount(head, win=8, floor=2e-4){
  const d=[];
  for(let i=1;i<head.length;i++){let x=head[i]-head[i-1];d.push(Math.atan2(Math.sin(x),Math.cos(x)));}
  const sm=[];
  for(let i=0;i<d.length;i++){
    let s=0,n=0;
    for(let j=Math.max(0,i-win);j<=Math.min(d.length-1,i+win);j++){s+=d[j];n++;}
    sm.push(s/n);
  }
  let prev=0,c=0;
  for(const v of sm){ if(Math.abs(v)<floor) continue; const s=Math.sign(v);
    if(prev!==0&&s!==prev)c++; prev=s; }
  return c;
}
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  await pg.goto('file:///home/user/vacation-landing/dist/holiday-landing.html');
  await pg.waitForFunction(()=>window.__HL && !document.getElementById('veil').hidden);
  const bx=await pg.evaluate(()=>{const r=document.getElementById('cv').getBoundingClientRect();
    return{left:r.left,top:r.top,w:r.width,h:r.height,W:window.__HL.W,H:window.__HL.H};});
  const S=p=>({x:bx.left+p.x*bx.w/bx.W,y:bx.top+p.y*bx.h/bx.H});
  const pts=[];for(let i=0;i<=74;i++){const t=i/74;const w=prof(t);
    pts.push({x:300+t*440+w.wx, y:210+Math.sin(t*Math.PI*2)*110+w.wy});}
  console.log('look dead    raw  smoothed  maxOff settled');
  for(const look of [30,34,38,40,42])
  for(const dead of [0.0005,0.004]){
    await pg.evaluate(([l,d])=>{window.__HL.seed(7);window.__HL.start();window.__HL.freeze(true);
      window.__HL.hold(true);window.__HL.clear();window.__HL.tune({look:l,dead:d});},[look,dead]);
    const id=await pg.evaluate(()=>window.__HL.add('a',300,210,0,false));
    const a=S(pts[0]); await pg.mouse.move(a.x,a.y); await pg.mouse.down();
    for(const p of pts.slice(1)){const s=S(p);await pg.mouse.move(s.x,s.y);}
    await pg.mouse.up();
    const d2=await pg.evaluate(id=>{const H=window.__HL,dt=1/60,o=[];
      for(let i=0;i<1600;i++){const p=H.get(id);if(!p)break;H.step(dt);
        o.push({h:p.hdg,off:p.offPath});if(!p.path)break;}return o;},id);
    const head=d2.map(z=>z.h);
    let prev=0,raw=0;
    for(let i=1;i<head.length;i++){let x=head[i]-head[i-1];x=Math.atan2(Math.sin(x),Math.cos(x));
      if(Math.abs(x)<1e-9)continue;const s=Math.sign(x);if(prev!==0&&s!==prev)raw++;prev=s;}
    console.log(String(look).padEnd(5),String(dead).padEnd(8),String(raw).padEnd(5),
      String(weaveCount(head)).padEnd(10),
      Math.max(...d2.map(z=>z.off)).toFixed(1).padEnd(7),
      Math.max(...d2.slice(60).map(z=>z.off)).toFixed(1));
  }
  // does the metric have teeth? feed it a waypoint-chaser's heading trace
  const weave=[]; let h=0;
  for(let i=0;i<900;i++){ h += (i%14<7?1:-1)*0.02; weave.push(h); }
  console.log('\nsynthetic waypoint-chaser weave -> smoothed count =', weaveCount(weave));
  const clean=[]; h=0;
  for(let i=0;i<900;i++){ h += i<300?0.01:(i<600?-0.008:0); clean.push(h); }
  console.log('synthetic clean S              -> smoothed count =', weaveCount(clean));
  await b.close();
})();
