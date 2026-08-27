const { chromium } = require('@playwright/test');
const FILE='file:///home/user/vacation-landing/dist/holiday-landing.html';
const boot=async(pg)=>{await pg.goto(FILE);await pg.waitForFunction(()=>window.__HL&&!document.getElementById('veil').hidden);};
const shot=(pg,n)=>pg.screenshot({path:'shots/'+n+'.png'});

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});

  // 1. start screen
  let pg=await b.newPage({viewport:{width:1280,height:900}});
  await boot(pg); await pg.waitForTimeout(400); await shot(pg,'1-start');

  // 2. mid-play: a busy sky, one route being drawn onto C
  await pg.evaluate(()=>{
    const H=window.__HL; H.seed(4); H.start(); H.freeze(true); H.hold(true); H.clear();
    H.add('a',250,150,55,false); H.add('b',980,120,140,false);
    H.add('c',300,760,-20,false); H.add('a',1120,330,200,false);
    const id=H.add('b',560,620,300,false);
    H.route(id,[{x:560,y:620},{x:660,y:520},{x:740,y:400},{x:762,y:300}]);
    for(let i=0;i<40;i++) H.step(1/60);
  });
  // start a drag on the purple plane so its runway lights up
  const bx=await pg.evaluate(()=>{const r=document.getElementById('cv').getBoundingClientRect();
    return{left:r.left,top:r.top,w:r.width,h:r.height,W:window.__HL.W,H:window.__HL.H};});
  const P=p=>({x:bx.left+p.x*bx.w/bx.W,y:bx.top+p.y*bx.h/bx.H});
  const pc=await pg.evaluate(()=>{const p=window.__HL.S.planes.find(q=>q.type.k==='c');return{x:p.x,y:p.y};});
  let a=P(pc); await pg.mouse.move(a.x,a.y); await pg.mouse.down();
  for(const q of [{x:pc.x+90,y:pc.y-40},{x:pc.x+240,y:pc.y-80},{x:pc.x+430,y:pc.y-110},{x:1010,y:780}]){
    const s=P(q); await pg.mouse.move(s.x,s.y);
  }
  await pg.waitForTimeout(200); await shot(pg,'2-play');
  await pg.mouse.up();

  // 3. a landing, caught mid-celebration
  await pg.evaluate(()=>{
    const H=window.__HL; H.start(); H.freeze(true); H.hold(true); H.clear();
    H.add('a',300,150,60,false); H.add('c',1000,200,150,false);
    const r=H.RW.A; H.add('a',r.tx-r.ux*40,r.ty-r.uy*40,r.deg,true);
    // 40px at 38px/s is ~63 frames to the threshold; stop just after touchdown
    for(let i=0;i<78;i++) H.step(1/60);
  });
  await pg.waitForTimeout(150); await shot(pg,'3-landing');

  // 4. wrong island
  await pg.evaluate(()=>{
    const H=window.__HL; H.start(); H.freeze(true); H.hold(true); H.clear();
    const r=H.RW.B; H.add('a',r.tx-r.ux*30,r.ty-r.uy*30,r.deg,true);
    for(let i=0;i<140;i++) H.step(1/60);   // past the 0.6s card reveal
  });
  await pg.waitForTimeout(400); await shot(pg,'4-wrong-island');

  // 5. mid-air
  await pg.evaluate(()=>{
    const H=window.__HL; H.start(); H.freeze(true); H.hold(true); H.clear();
    H.add('a',560,420,0,false); H.add('c',600,420,180,false);
    for(let i=0;i<140;i++) H.step(1/60);
  });
  await pg.waitForTimeout(400); await shot(pg,'5-midair');

  // 6. proximity warning state
  await pg.evaluate(()=>{
    const H=window.__HL; H.start(); H.freeze(true); H.hold(true); H.clear();
    H.add('a',520,400,0,false); H.add('c',585,415,180,false);
    H.add('b',900,600,250,false);
    for(let i=0;i<2;i++) H.step(1/60);
  });
  await pg.waitForTimeout(150); await shot(pg,'6-warning');
  await pg.close();

  // 9. caught MID-DRAG: mouse still down, plane already flying the line
  pg=await b.newPage({viewport:{width:1280,height:900}});
  await boot(pg);
  await pg.evaluate(()=>{const H=window.__HL;H.seed(4);H.start();H.freeze(true);H.hold(true);H.clear();});
  {
    const bb=await pg.evaluate(()=>{const r=document.getElementById('cv').getBoundingClientRect();
      return{left:r.left,top:r.top,w:r.width,h:r.height,W:window.__HL.W,H:window.__HL.H};});
    const Q=p=>({x:bb.left+p.x*bb.w/bb.W,y:bb.top+p.y*bb.h/bb.H});
    const id=await pg.evaluate(()=>window.__HL.add('c',250,180,20,false));
    const way=[[250,180],[380,170],[500,215],[580,330],[560,470],[640,600],[820,650],[1000,700]];
    const pts=[];
    for(let i=0;i<way.length-1;i++){
      const [ax,ay]=way[i],[bx,by]=way[i+1];
      const n=Math.max(1,Math.round(Math.hypot(bx-ax,by-ay)/10));
      for(let k=0;k<n;k++) pts.push({x:ax+(bx-ax)*k/n,y:ay+(by-ay)*k/n});
    }
    const a2=Q(pts[0]); await pg.mouse.move(a2.x,a2.y); await pg.mouse.down();
    // drag most of the way, flying the plane as we go - mouse stays DOWN
    for(const q of pts.slice(1,Math.floor(pts.length*0.72))){
      await pg.mouse.move(Q(q).x,Q(q).y);
      await pg.evaluate(()=>{for(let i=0;i<5;i++) window.__HL.step(1/60);});
    }
    await pg.waitForTimeout(150);
    await shot(pg,'9-mid-drag');
    const st=await pg.evaluate(i=>{const p=window.__HL.get(i);
      return {off:p.offPath, moved:Math.hypot(p.x-250,p.y-180)};},id);
    console.log('mid-drag: plane '+st.off.toFixed(2)+'px off its line, '+st.moved.toFixed(0)+'px flown');
    await pg.mouse.up();
  }
  await pg.close();

  // 10. the aircraft cap stepping up
  pg=await b.newPage({viewport:{width:1280,height:900}});
  await boot(pg);
  // with a scripted controller keeping the sky clear, so the run survives to 0:45
  await pg.evaluate(()=>{const H=window.__HL,S=H.S;H.seed(6);H.start();H.hold(true);
    let next=2.5;
    for(let i=0;i<60*45;i++){
      H.step(1/60);
      const air=S.planes.filter(p=>!p.landing);
      for(let a=0;a<air.length;a++)for(let b=a+1;b<air.length;b++)
        if(Math.hypot(air[a].x-air[b].x,air[a].y-air[b].y)<H.WARN_D+6){
          const k=S.planes.indexOf(air[b]); if(k>=0) S.planes.splice(k,1);}
      if(S.t>=next){next+=2.5;const l=S.planes.filter(p=>!p.landing);
        if(l.length) S.planes.splice(S.planes.indexOf(l[0]),1);}
    }});
  await pg.waitForTimeout(150); await shot(pg,'10-traffic-up');
  await pg.close();

  // 7. landscape phone (10.5)
  pg=await b.newPage({viewport:{width:844,height:390},deviceScaleFactor:2});
  await boot(pg); await pg.waitForTimeout(300); await shot(pg,'7-phone-start');
  await pg.evaluate(()=>{const H=window.__HL;H.seed(2);H.start();H.freeze(true);H.hold(true);H.clear();
    H.add('a',300,200,50,false);H.add('b',900,300,170,false);H.add('c',600,650,-40,false);
    for(let i=0;i<30;i++)H.step(1/60);});
  await pg.waitForTimeout(200); await shot(pg,'7b-phone-play');
  await pg.close();

  // 8. portrait gate
  pg=await b.newPage({viewport:{width:420,height:820}});
  await boot(pg); await pg.waitForTimeout(300); await shot(pg,'8-portrait');
  await pg.close();
  await b.close();
  console.log('shots written');
})();
