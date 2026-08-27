const { chromium } = require('@playwright/test');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:610,height:660},deviceScaleFactor:2});
  await pg.goto('file:///home/user/vacation-landing/dist/holiday-landing.html');
  await pg.waitForFunction(()=>window.__HL&&!document.getElementById('veil').hidden);
  await pg.waitForTimeout(400);
  await pg.screenshot({path:'shots/11-side-panel.png'});
  await b.close(); console.log('ok');
})();
