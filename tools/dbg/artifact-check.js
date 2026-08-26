const { chromium } = require('@playwright/test');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const errs=[];
  for(const theme of ['light','dark']){
    const pg=await b.newPage({viewport:{width:1280,height:900},colorScheme:theme});
    pg.on('pageerror',e=>errs.push(theme+': '+e.message));
    pg.on('console',m=>{if(m.type()==='error')errs.push(theme+' console: '+m.text());});
    await pg.goto('file:///tmp/claude-0/-home-user-vacation-landing/85f31906-d6b8-5aa8-957e-d121ddba3956/scratchpad/wrapped.html');
    await pg.waitForFunction(()=>window.__HL&&!document.getElementById('veil').hidden,{timeout:10000});
    const m=await pg.evaluate(()=>{
      const cv=document.getElementById('cv').getBoundingClientRect();
      return {title:document.title, ratio:cv.width/cv.height, w:cv.width,
              bodyBg:getComputedStyle(document.body).backgroundColor};
    });
    console.log(theme.padEnd(6),'title="'+m.title+'"','canvas',m.w.toFixed(0),'ratio',m.ratio.toFixed(4),'bodyBg',m.bodyBg);
    await pg.screenshot({path:'shots/artifact-'+theme+'.png'});
    await pg.close();
  }
  console.log('errors:',errs.length?errs:'none');
  await b.close();
})();
