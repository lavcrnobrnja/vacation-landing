const { chromium } = require('@playwright/test');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  for(const [w,h] of [[1280,900],[1440,760],[1920,1080],[1100,720],[844,390],[820,1180]]){
    const pg=await b.newPage({viewport:{width:w,height:h}});
    await pg.goto('file:///home/user/vacation-landing/dist/holiday-landing.html');
    await pg.waitForFunction(()=>window.__HL&&!document.getElementById('veil').hidden);
    const m=await pg.evaluate(()=>{
      const hd=document.querySelector('.hdr').getBoundingClientRect();
      const ft=document.querySelector('.ftr').getBoundingClientRect();
      const cv=document.getElementById('cv').getBoundingClientRect();
      const sh=document.querySelector('.shell').getBoundingClientRect();
      const cs=getComputedStyle(document.body);
      return {hdr:hd.height, ftr:ft.height||0, pad:parseFloat(cs.paddingTop)*2,
              cvW:cv.width, cvH:cv.height, shW:sh.width, shH:sh.height,
              ratio:cv.width/cv.height, bars:(sh.width-cv.width)/2};
    });
    console.log(`${w}x${h}`.padEnd(10),
      'hdr',m.hdr.toFixed(0),'ftr',m.ftr.toFixed(0),'pad',m.pad.toFixed(0),
      '| chrome',(m.hdr+m.ftr+m.pad).toFixed(0),
      '| canvas',m.cvW.toFixed(0)+'x'+m.cvH.toFixed(0),
      'ratio',m.ratio.toFixed(4),'sideBars',m.bars.toFixed(0));
    await pg.close();
  }
  await b.close();
})();
