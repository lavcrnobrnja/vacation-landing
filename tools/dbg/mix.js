const { chromium } = require('@playwright/test');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage();
  await pg.goto('file://'+(process.argv[2]||'/home/user/vacation-landing/dist/holiday-landing.html'));
  await pg.waitForFunction(()=>window.__HL&&!document.getElementById('veil').hidden);
  const res=await pg.evaluate(()=>{
    const H=window.__HL,S=H.S,dt=1/60;
    const all=[];
    for(let seed=1;seed<=12;seed++){
      H.seed(seed); H.start(); H.hold(true);
      const seen=new Map(); const seq=[];
      let next=2.0;
      for(let i=0;i<60*60*10;i++){
        H.step(dt);
        for(const p of S.planes) if(!seen.has(p.id)){ seen.set(p.id,1); seq.push(p.type.k); }
        // a scripted controller so the run survives and keeps consuming arrivals
        const air=S.planes.filter(p=>!p.landing);
        for(let a=0;a<air.length;a++)for(let c=a+1;c<air.length;c++)
          if(Math.hypot(air[a].x-air[c].x,air[a].y-air[c].y)<H.WARN_D+6){
            const k=S.planes.indexOf(air[c]); if(k>=0) S.planes.splice(k,1);}
        if(S.t>=next){next+=2.0;const l=S.planes.filter(p=>!p.landing);
          if(l.length) S.planes.splice(S.planes.indexOf(l[0]),1);}
      }
      all.push(seq);
    }
    return all;
  });
  let maxRun=0, over3=0, totals={a:0,b:0,c:0}, n=0, runHist={};
  for(const seq of res){
    let last=null,cur=0,mx=0;
    for(const k of seq){ totals[k]++; n++; cur=(k===last)?cur+1:1; last=k; mx=Math.max(mx,cur);
      runHist[cur]=(runHist[cur]||0)+1; }
    maxRun=Math.max(maxRun,mx); if(mx>3) over3++;
  }
  console.log('sessions:',res.length,' arrivals per session ~',Math.round(n/res.length),' total',n);
  console.log('longest run anywhere :',maxRun);
  console.log('sessions with run >3 :',over3+'/'+res.length);
  console.log('colour split         : a '+(100*totals.a/n).toFixed(1)+'%  b '+
    (100*totals.b/n).toFixed(1)+'%  c '+(100*totals.c/n).toFixed(1)+'%');
  // how often does a run of length L start
  const starts={};
  for(const seq of res){ let last=null,cur=0;
    for(const k of seq){ cur=(k===last)?cur+1:1; last=k; starts[cur]=(starts[cur]||0)+1; } }
  console.log('positions at run-depth: 1:'+(starts[1]||0)+'  2:'+(starts[2]||0)+
    '  3:'+(starts[3]||0)+'  4+:'+Object.keys(starts).filter(k=>+k>3).reduce((s,k)=>s+starts[k],0));
  await b.close();
})();
