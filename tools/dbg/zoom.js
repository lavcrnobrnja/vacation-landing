const { chromium } = require('@playwright/test');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:2});
  await pg.goto('file:///home/user/vacation-landing/dist/holiday-landing.html');
  await pg.waitForFunction(()=>window.__HL&&!document.getElementById('veil').hidden);
  await pg.evaluate(()=>{const H=window.__HL;H.seed(4);H.start();H.freeze(true);H.hold(true);H.clear();
    for(let i=0;i<10;i++)H.step(1/60);});
  const cv=await pg.$('#cv');
  const box=await cv.boundingBox();
  // crop each runway + its corridor at high zoom
  const rw=await pg.evaluate(()=>window.__HL.RUNWAYS.map(r=>({k:r.k,cx:r.cx,cy:r.cy,tx:r.tx,ty:r.ty,g:r.guide,ux:r.ux,uy:r.uy,len:Math.max(r.len,r.hwNear*2.4)})));
  for(const r of rw){
    const mx=(r.cx+(r.tx-r.ux*r.g))/2, my=(r.cy+(r.ty-r.uy*r.g))/2;
    const s=170;
    await pg.screenshot({path:'shots/zoom-'+r.k+'.png', clip:{
      x:box.x+(mx-s)*box.width/1280, y:box.y+(my-s)*box.height/853,
      width:2*s*box.width/1280, height:2*s*box.height/853}});
  }
  await b.close(); console.log('zooms written');
})();
