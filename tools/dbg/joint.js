const { chromium } = require('@playwright/test');
const handS = (x0,y0)=>{const p=[];for(let i=0;i<=74;i++){const t=i/74;
  p.push({x:x0+t*440+Math.cos(t*160)*1.1,
          y:y0+Math.sin(t*Math.PI*2)*110+Math.sin(t*180)*1.6+Math.sin(t*6.1)*3.5});}return p;};
function flick(x0,y0){
  const way=[[x0,y0],[x0+120,y0-16],[x0+250,y0+24],[x0+300,y0+140],
             [x0+215,y0+235],[x0+80,y0+232],[x0+34,y0+140],[x0+130,y0+96],[x0+240,y0+120]];
  const pts=[];
  for(let i=0;i<way.length-1;i++){const [ax,ay]=way[i],[bx,by]=way[i+1];
    const n=Math.max(1,Math.round(Math.hypot(bx-ax,by-ay)/38));
    for(let k=0;k<n;k++) pts.push({x:ax+(bx-ax)*k/n,y:ay+(by-ay)*k/n});}
  pts.push({x:way.at(-1)[0],y:way.at(-1)[1]});return pts;
}
const dH=h=>{const d=[];for(let i=1;i<h.length;i++){const x=h[i]-h[i-1];d.push(Math.atan2(Math.sin(x),Math.cos(x)));}return d;};
const rawF=h=>{let p=0,c=0;for(const v of dH(h)){if(Math.abs(v)<1e-9)continue;const g=Math.sign(v);if(p!==0&&g!==p)c++;p=g;}return c;};
const smF=(h,w=8,f=2e-4)=>{const d=dH(h),sm=[];
  for(let i=0;i<d.length;i++){let s=0,n=0;for(let j=Math.max(0,i-w);j<=Math.min(d.length-1,i+w);j++){s+=d[j];n++;}sm.push(s/n);}
  let p=0,c=0;for(const v of sm){if(Math.abs(v)<f)continue;const g=Math.sign(v);if(p!==0&&g!==p)c++;p=g;}return c;};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  await pg.goto('file:///home/user/vacation-landing/dist/holiday-landing.html');
  await pg.waitForFunction(()=>window.__HL&&!document.getElementById('veil').hidden);
  const bx=await pg.evaluate(()=>{const r=document.getElementById('cv').getBoundingClientRect();
    return{left:r.left,top:r.top,w:r.width,h:r.height,W:window.__HL.W,H:window.__HL.H};});
  const S=p=>({x:bx.left+p.x*bx.w/bx.W,y:bx.top+p.y*bx.h/bx.H});
  async function run(cfg,pts,minute,x,y){
    await pg.evaluate(([c,m])=>{const H=window.__HL;H.seed(9);H.start();H.freeze(true);
      H.hold(true);H.clear();H.tune(c);H.S.t=m*60;H.step(0);},[cfg,minute]);
    const id=await pg.evaluate(([x,y])=>window.__HL.add('a',x,y,0,false),[x,y]);
    const a=S(pts[0]);await pg.mouse.move(a.x,a.y);await pg.mouse.down();
    for(const q of pts.slice(1)){const s=S(q);await pg.mouse.move(s.x,s.y);}
    await pg.mouse.up();
    return pg.evaluate(id=>{const H=window.__HL,dt=1/60,o=[];
      for(let i=0;i<3000;i++){const p=H.get(id);if(!p)break;H.step(dt);
        o.push({off:p.offPath,h:p.hdg});if(!p.path)break;}return o;},id);
  }
  console.log('ma ch |  gentle-S: raw  smooth  maxOff |  sharp flick @58: maxOff  p95   mean');
  for(const ma of [0,1,2])
  for(const ch of [1,2]){
    const cfg={R:20,k:1.2,ma,ch};
    const g=await run(cfg,handS(300,210),0,300,210);
    const f=await run(cfg,flick(330,240),14,330,240);
    const go=g.slice(45).map(z=>z.off), fo=f.slice(40).map(z=>z.off);
    const fs=[...fo].sort((a,b)=>a-b);
    console.log(String(ma).padEnd(3),String(ch).padEnd(3),'|',
      String(rawF(g.map(z=>z.h))).padEnd(13),
      String(smF(g.map(z=>z.h))).padEnd(7),
      Math.max(...go).toFixed(1).padEnd(7),'|',
      Math.max(...fo).toFixed(1).padEnd(21),
      fs[Math.floor(fs.length*0.95)].toFixed(1).padEnd(6),
      (fo.reduce((s,x)=>s+x,0)/fo.length).toFixed(1));
  }
  await b.close();
})();
