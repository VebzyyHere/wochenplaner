const { chromium, devices } = require('playwright');
const path = require('path');
const LIST = ['iPhone SE','iPhone 12','iPhone 13','iPhone 14 Pro Max','Pixel 7','Galaxy S9+'];
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  for (const name of LIST) {
    const d = devices[name]; if (!d) { console.log('?', name); continue; }
    const ctx = await br.newContext({ ...d });
    const p = await ctx.newPage();
    await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(400);
    await p.evaluate(() => closeModal());
    await p.evaluate(() => { const mon=mondayOf(anchor);
      for(let x=0;x<5;x++) state.blocks.push({id:uid(),title:"Arbeit",areaId:"a1",day:x,
        date:iso(addDays(mon,x)),repeat:"weekly",since:iso(addDays(mon,x)),start:9*60,end:17*60,frog:false,grob:false});
      state.areas.find(a=>a.id==="a5").plan.goal=6; save(); buildSuggestions(); save(); renderAll(); });
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const R = s => Math.round(document.querySelector(s).getBoundingClientRect().height);
      const gw = document.querySelector('.gridwrap');
      return { w: window.innerWidth, h: window.innerHeight,
        topbar: R('.topbar'), tage: R('.dayswitch'), raster: R('.gridwrap'), band: R('.loose'), leiste: R('.tabbar'),
        stunden: Math.round(R('.gridwrap')/56*10)/10,
        dsQuer: document.querySelector('.dayswitch').scrollWidth > document.querySelector('.dayswitch').clientWidth + 1,
        scrollTop: gw.scrollTop };
    });
    console.log(name.padEnd(20), JSON.stringify(m));
    await ctx.close();
  }
  await br.close();
})();
