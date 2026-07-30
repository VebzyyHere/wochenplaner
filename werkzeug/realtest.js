const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const c = await b.newContext({ viewport:{width:1400,height:950} });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(600);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // Exakt die Eingabe aus der Analyse
  const r = await p.evaluate(() => {
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on:true, from:22*60+30, to:6*60+30, wind:30 };
    const set = (id, h, must, pad) => { const a = state.areas.find(x=>x.id===id);
      a.plan.goal = h; a.plan.must = must; if (pad !== undefined) a.plan.pad = pad; };
    set("a1", 20, true, 60);   // Arbeit, Wegzeit 60
    set("a2", 12, true);       // Uni
    set("a3", 4, true);        // Sport
    set("a6", 4, true);        // Menschen
    set("a5", 8, false);       // Freizeit als Kür
    // Woche komplett in der Zukunft, damit alle 7 Tage zaehlen
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    save(); renderAll();
    clearSuggestions();
    const res = buildSuggestions();

    // Grobe Bloecke haben keine echte Uhrzeit — sie liegen im Band unter dem
    // Raster. Fuer Luecken und Strecken zaehlen nur die exakten.
    const alle = state.blocks.filter(x=>x.sug);
    const grobe = alle.filter(x=>x.grob);
    const sug = alle.filter(x=>!x.grob);
    const proTag = {};
    weekDays().forEach(d => proTag[DAY_SHORT[d.i]] = 0);
    sug.forEach(x => proTag[DAY_SHORT[x.day]] += (x.end - x.start));

    // Übergänge ohne Lücke + längste Strecke ohne Pause
    let ohneLuecke = 0, uebergaenge = 0, laengsteStrecke = 0;
    weekDays().forEach(d => {
      const tag = state.blocks.filter(x => !x.grob && onDay(x, d.key, d.i)).sort((a,b)=>a.start-b.start);
      let strecke = 0;
      for (let i=0;i<tag.length;i++) {
        if (i>0) {
          uebergaenge++;
          const luecke = tag[i].start - tag[i-1].end;
          if (luecke <= 0) { ohneLuecke++; strecke += tag[i].end - tag[i].start; }
          else { laengsteStrecke = Math.max(laengsteStrecke, strecke); strecke = tag[i].end - tag[i].start; }
        } else strecke = tag[i].end - tag[i].start;
      }
      laengsteStrecke = Math.max(laengsteStrecke, strecke);
    });

    const werte = Object.values(proTag);
    const nachmittags = sug.filter(x => x.start >= 15*60).length;
    return {
      verteilt: Math.round(res.placed/60*10)/10,
      offen: Math.round(res.missing/60*10)/10,
      bloecke: sug.length,
      grobeBloecke: grobe.length,
      grobeStunden: Math.round(grobe.reduce((n,x)=>n+(x.dauer||0),0)/60*10)/10,
      proTagStunden: Object.fromEntries(Object.entries(proTag).map(([k,v])=>[k, Math.round(v/60*10)/10])),
      spanne: Math.round((Math.max(...werte)-Math.min(...werte))/60*10)/10,
      uebergaengeOhneLuecke: uebergaenge ? Math.round(ohneLuecke/uebergaenge*100) : 0,
      laengsteStreckeOhnePause: Math.round(laengsteStrecke/60*10)/10,
      anteilNach15Uhr: Math.round(nachmittags/sug.length*100),
      klebt: (() => { const bad=[]; weekDays().forEach(day => {
        const tag = sug.filter(x=>onDay(x,day.key,day.i)).sort((x,y)=>x.start-y.start);
        for (let i=1;i<tag.length;i++) if (tag[i].start - tag[i-1].end <= 0)
          bad.push(DAY_SHORT[day.i]+" "+tag[i-1].title+" "+fmtTime(tag[i-1].start)+"-"+fmtTime(tag[i-1].end)
            +" || "+tag[i].title+" "+fmtTime(tag[i].start)+"-"+fmtTime(tag[i].end)); }); return bad; })()
    };
  });
  console.log('=== Realitaetstest mit der Eingabe aus der Analyse ===');
  console.log(JSON.stringify(r, null, 1));
  console.log('\nZielwerte der Analyse (Gegenentwurf): 0% ohne Luecke, 4.0h laengste Strecke, 3.0h Spanne, 21 Bloecke');
  console.log('v1.6 war:                              42% ohne Luecke, 8.5h,               6.5h Spanne, 33 Bloecke');
  console.log('\nFehler:', errs.length ? errs : 'keine');
  await b.close();
})();
