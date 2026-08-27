const { chromium } = require('@playwright/test');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:2});
  await pg.goto('file:///home/user/vacation-landing/dist/holiday-landing.html');
  await pg.waitForFunction(()=>window.__HL&&!document.getElementById('veil').hidden);
  await pg.evaluate(()=>{const H=window.__HL;H.seed(4);H.start();H.freeze(true);H.hold(true);H.clear();});
  const bb=await pg.evaluate(()=>{const r=document.getElementById('cv').getBoundingClientRect();
    return{left:r.left,top:r.top,w:r.width,h:r.height,W:window.__HL.W,H:window.__HL.H};});
  const Q=p=>({x:bb.left+p.x*bb.w/bb.W,y:bb.top+p.y*bb.h/bb.H});
  const id=await pg.evaluate(()=>window.__HL.add('a',300,600,-90,false));
  // a tight 180: maximum bank
  const way=[[300,600],[300,480],[330,400],[420,370],[510,400],[540,485],[520,590],[470,660]];
  const pts=[];
  for(let i=0;i<way.length-1;i++){const [ax,ay]=way[i],[bx,by]=way[i+1];
    const n=Math.max(1,Math.round(Math.hypot(bx-ax,by-ay)/16));
    for(let k=0;k<n;k++) pts.push({x:ax+(bx-ax)*k/n,y:ay+(by-ay)*k/n});}
  pts.push({x:way.at(-1)[0],y:way.at(-1)[1]});
  const a=Q(pts[0]); await pg.mouse.move(a.x,a.y); await pg.mouse.down();
  for(const q of pts.slice(1)){const s=Q(q);await pg.mouse.move(s.x,s.y);}
  await pg.mouse.up();
  const cv=await pg.$('#cv'); const box=await cv.boundingBox();
  const frames=[];
  for(let f=0;f<6;f++){
    await pg.evaluate(()=>{for(let i=0;i<52;i++) window.__HL.step(1/60);});
    const st=await pg.evaluate(i=>{const p=window.__HL.get(i);return p?{x:p.x,y:p.y,bank:p.bank,off:p.offPath}:null;},id);
    if(!st) break;
    const s=70;
    await pg.screenshot({path:`shots/bank-${f}.png`, clip:{
      x:box.x+(st.x-s)*box.width/1280, y:box.y+(st.y-s)*box.height/853,
      width:2*s*box.width/1280, height:2*s*box.height/853}});
    frames.push(`bank=${st.bank.toFixed(2)} off=${st.off.toFixed(1)}px`);
  }
  console.log(frames.join('\n'));
  await b.close();
})();
