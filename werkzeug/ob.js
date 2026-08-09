/* ============================================================
   Pruefskript Erststart (ob = Onboarding) — begleitet maybeWelcome()/
   anlegen() durch alle vier Schritte des Assistenten auf Desktop und
   iPhone SE, mit Screenshot je Schritt.

   Feste Uhr: Montag, 2026-08-03, 8 Uhr, Europe/Berlin (page.clock.
   setFixedTime(), Muster serie.js/kapazitaet.js). Seit Stufe D laeuft
   anlegen() ueber verteilenMitGate() — ob dabei "Das wird eng" erscheint,
   haengt von wochenKapazitaet() ab, also von Wochentag und Uhrzeit. Ohne
   genagelte Uhr waere dieses Skript je nach Startzeitpunkt mal gruen, mal
   rot (dieselbe Fehlerklasse, die in diesem Projekt laut CLAUDE.md-Vertrag
   schon mehrfach zugeschlagen hat). Montagmorgen mit den Assistenten-
   Standardwerten (Arbeit Mo-Fr 09-17, Wochenziele START_ZIELE = 16h) haelt
   wochenKapazitaet().ok bei true, das Gate bleibt hier also aus — das
   Skript sichert diese Annahme unten selbst per Zusicherung ab, statt sie
   stillschweigend vorauszusetzen.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
let kapaFehler = false;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  for (const dev of ['desktop', 'iPhone SE']) {
    const ctx = dev === 'desktop'
      ? await br.newContext({ viewport: { width: 1400, height: 950 }, timezoneId: 'Europe/Berlin' })
      : await br.newContext({ ...devices[dev], timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date('2026-08-03T08:00:00+02:00'));
    await p.goto(F);
    await p.waitForTimeout 
      ? await p.waitForTimeout(600) : null;

    console.log('\n===== ' + dev);
    const s0 = await p.evaluate(() => {
      const s = document.querySelector('.sheet');
      if (!s) return { kein: true };
      const f = s.querySelector('.sheet__foot').getBoundingClientRect();
      return { titel: s.querySelector('.sheet__title').textContent,
               knopf: s.querySelector('.sheet__foot .btn--primary').textContent,
               footSichtbar: f.bottom <= window.innerHeight + 1 };
    });
    console.log('0)', JSON.stringify(s0));
    await p.screenshot({ path: `ob-${dev.replace(/ /g,'')}-0.png` });

    for (const n of [1,2,3]) {
      await p.click('.sheet__foot .btn--primary');
      await p.waitForTimeout(300);
      const st = await p.evaluate(() => {
        const s = document.querySelector('.sheet');
        const f = s.querySelector('.sheet__foot').getBoundingClientRect();
        return { titel: s.querySelector('.sheet__title').textContent,
                 schritt: s.querySelector('.steps__lab') && s.querySelector('.steps__lab').textContent,
                 knopf: s.querySelector('.sheet__foot .btn--primary').textContent,
                 footSichtbar: f.bottom <= window.innerHeight + 1,
                 hint: (s.querySelector('#wSchlafHint')||{}).textContent,
                 summe: (s.querySelector('.ritual__summe')||{}).textContent,
                 querScroll: s.scrollWidth > s.clientWidth + 1 };
      });
      console.log(n + ')', JSON.stringify(st));
      await p.screenshot({ path: `ob-${dev.replace(/ /g,'')}-${n}.png` });
    }
    await p.click('.sheet__foot .btn--primary');
    await p.waitForTimeout(700);
    const fin = await p.evaluate(() => ({
      dialogWeg: !document.querySelector('.sheet'),
      bloecke: state.blocks.filter(b=>!b.sug).length,
      vorschlaege: state.blocks.filter(b=>b.sug).length,
      vorschlagStunden: Math.round(state.blocks.filter(b=>b.sug).reduce((n,b)=>n+dauerVon(b),0)/6)/10,
      ziele: state.areas.filter(a=>a.plan.goal>0).map(a=>a.name+' '+a.plan.goal+'h'),
      schlaf: state.settings.sleep, tagVon: state.settings.dayStart, tagBis: state.settings.dayEnd,
      inNachtruhe: state.blocks.filter(b=>b.sug&&!b.grob).filter(b=>restSpans().some(s=>b.start<s.end&&b.end>s.start)).length,
      toast: (document.querySelector('.toast')||{}).textContent,
      kapaOk: wochenKapazitaet().ok
    }));
    console.log('fertig:', JSON.stringify(fin));
    // Zusicherung (Stufe D): diese Fixture muss wochenKapazitaet().ok===true
    // halten — sug-Bloecke zaehlen dort nicht mit (weder bei "fest" noch bei
    // "offen"), die Zahl ist also unabhaengig davon, ob buildSuggestions()
    // hier schon gelaufen ist. Kippt sie doch einmal, sieht dieses Skript
    // stillschweigend nie das Gate "Das wird eng" — lieber hier laut werden.
    if (fin.kapaOk !== true) {
      console.log('   FEHLER wochenKapazitaet().ok ist ' + fin.kapaOk + ' statt true (' + dev + ') — die Montagmorgen-Fixture passt nicht mehr, das Skript wuerde ein moegliches Gate stillschweigend uebersehen');
      kapaFehler = true;
    } else {
      console.log('   OK    wochenKapazitaet().ok === true (' + dev + ', Montagmorgen — kein Gate erwartet)');
    }
    await p.screenshot({ path: `ob-${dev.replace(/ /g,'')}-plan.png`, fullPage: true });
    console.log('Fehler:', errs.length ? errs : 'keine');
    await ctx.close();
  }
  await br.close();
  if (kapaFehler) process.exit(1);
})();
