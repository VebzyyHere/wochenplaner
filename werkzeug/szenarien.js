/* ============================================================
   Multi-Persona-Pruefskript (iPhone 13 & iPhone SE, Hell & Dunkel):
   1) Alltagswoche: Header-Datum (KW 48 „23.–29.11.") ungekuerzt, ruhige
      „Heute"-Ansicht ohne Zweig/Welle, Toast oben unter dem Header, buendiges
      „+" in der Tabbar, gestraffte Texte in „Ziele".
   2) 3-Tage-Festival Fr–So: automatische Verteiler-Sperre (#bSperrt) bei
      mehrtaegig ganztägig (Eintages-Gegenprobe bleibt entsperrt), manuelle
      Termine bleiben moeglich, #looseBand steht OBEN ueber dem Raster und
      zeigt Fr–So im 3-Tage-Modus als einen Balken.
   3) Clubnacht Sa 22:00–06:00: Verteiler haelt am Sonntag ab 06:00 die
      eingestellte Schlafdauer (8 h → bis 14:00) frei, manuelle Eintraege
      (Brunch 12:00) bleiben frei, 3-Tage-Ansicht zeigt Sa & So nebeneinander.
   4) Chaotischer Tag auf 320px iPhone SE: Tagesform, Freihalten, Aufgaben,
      kein Quer-Ueberlauf in allen Ansichten inkl. 1-Tag, 3-Tage & Neu-Blatt.

   Feste Uhr: 2026-08-05T10:00:00+02:00 (Mittwoch), Europe/Berlin.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

async function boot(br, devName) {
  const ctx = await br.newContext({ ...devices[devName], timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.goto(F);
  await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(500);
  return { ctx, p, errs };
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const alleErrs = [];

  /* ---- 1. Persona: Alltagswoche auf iPhone 13 (390x844) ---- */
  console.log('\n=== Persona 1: Alltagswoche (iPhone 13, 390x844) ===');
  {
    const { ctx, p, errs } = await boot(br, 'iPhone 13');
    await p.evaluate(() => {
      state = freshState(); migrate(state);
      state.profile.name = 'Alex';
      state.areas.find(a => a.id === 'a2').plan.goal = 10;
      state.areas.find(a => a.id === 'a3').plan.goal = 3;
      const mon = mondayOf(new Date());
      const mi = iso(addDays(mon, 2));
      state.blocks = [
        { id: 'b-arbeit', title: 'Projektarbeit', areaId: 'a1', day: 2, date: mi, repeat: 'none', start: 9 * 60, end: 12 * 60, frog: true },
        { id: 'b-sport', title: 'Laufen im Park', areaId: 'a3', day: 2, date: mi, repeat: 'none', start: 18 * 60, end: 19 * 60, frog: false },
        { id: 'b-les', title: 'Fachbuch lesen', areaId: 'a2', day: 2, date: mi, repeat: 'none', start: 14 * 60, end: 15 * 60, frog: false, sug: true, grund: 'Nachmittags noch Luft' }
      ];
      state.tasks = [
        { id: 't1', title: 'Präsentation finalisieren', areaId: 'a1', done: false, frog: true, dauer: 60 },
        { id: 't2', title: 'Einkaufen', areaId: 'a5', done: false, frog: false }
      ];
      anchor = new Date(); selectedDayIdx = 2;
      save(); renderAll(); setView('heute');
    });
    await p.waitForTimeout(200);

    // Header-Datum KW 48 (23.–29.11.) darf nicht abgeschnitten werden (wenn akt. Woche)
    const hdr = await p.evaluate(() => {
      anchor = new Date('2026-11-23T12:00:00');
      renderHeader();
      const tb = document.getElementById('todayBtn'); if (tb) tb.hidden = true;
      const el = document.getElementById('weekLabel');
      const txt = el.textContent.replace(/\s+/g, ' ').trim();
      const sw = el.scrollWidth, cw = el.clientWidth;
      anchor = new Date(); renderHeader();
      return { txt, sw, cw };
    });
    ok(hdr.txt.includes('23.–29.11.'), 'P1a) KW 48 zeigt kompaktes Datum „23.–29.11." (' + hdr.txt + ')');
    ok(hdr.sw <= hdr.cw + 1, 'P1b) Header-Datum wird nicht abgeschnitten (' + hdr.sw + ' <= ' + hdr.cw + ')');

    // Ruhige „Heute"-Ansicht ohne Zweig/Welle, Toast oben, „+" buendig
    await p.evaluate(() => {
      document.querySelectorAll('.toasts .toast').forEach(t => t.remove());
      toast('Eintrag gespeichert');
    });
    await p.waitForTimeout(150);
    const heuteCheck = await p.evaluate(() => {
      const ft = document.querySelector('.agenda__frogtext');
      const frogAfter = getComputedStyle(document.querySelector('.agenda__frog'), '::after').content;
      const ds = document.getElementById('daySwitch').getBoundingClientRect();
      const tst = document.querySelector('.toasts .toast').getBoundingClientRect();
      const tab = document.getElementById('tabbar').getBoundingClientRect();
      const plus = document.getElementById('tabAdd').getBoundingClientRect();
      const sug = document.getElementById('sugBar').getBoundingClientRect();
      return {
        welle: ft ? getComputedStyle(ft).backgroundImage : 'none',
        zweig: frogAfter,
        toastTop: Math.round(tst.top), dsBottom: Math.round(ds.bottom),
        toastBottom: Math.round(tst.bottom), sugTop: Math.round(sug.top),
        plusTop: Math.round(plus.top), tabTop: Math.round(tab.top)
      };
    });
    ok(heuteCheck.welle === 'none', 'P1c) Schwerpunkt ohne dekorative Welle');
    ok(heuteCheck.zweig === 'none', 'P1d) Schwerpunkt ohne dekorativen Zweig');
    ok(heuteCheck.toastTop >= heuteCheck.dsBottom - 1 && heuteCheck.toastBottom < heuteCheck.sugTop,
      'P1e) Toast erscheint oben unter Tagesstreifen (' + JSON.stringify(heuteCheck) + ')');
    ok(heuteCheck.plusTop >= heuteCheck.tabTop - 1,
      'P1f) „+" sitzt buendig in der Tabbar (' + heuteCheck.plusTop + ' >= ' + heuteCheck.tabTop + ')');

    await p.evaluate(() => document.querySelectorAll('.toasts .toast').forEach(t => t.remove()));
    await p.screenshot({ path: path.join(__dirname, 'sz-heute-hell.png') });
    await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(__dirname, 'sz-heute-dunkel.png') });
    await p.evaluate(() => document.documentElement.removeAttribute('data-theme'));

    // Ziele-Ansicht: gestraffte Texte, kein alter AI-Slop-Satz
    await p.evaluate(() => setView('ziele'));
    await p.waitForTimeout(350);
    const zieleTxt = await p.evaluate(() => document.querySelector('.panel').innerText);
    ok(/Passt das noch\?/.test(zieleTxt) && !/Pläne reißen/.test(zieleTxt) && !/Zehn Minuten/.test(zieleTxt),
      'P1g) Ziele zeigt gestraffte Texte ohne alte Fuellsaetze');
    await p.screenshot({ path: path.join(__dirname, 'sz-ziele.png') });

    await p.evaluate(() => setView('aufgaben'));
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(__dirname, 'sz-aufgaben.png') });

    ok(errs.length === 0, 'P1h) Keine Konsolenfehler (' + errs.join(' | ') + ')');
    alleErrs.push(...errs);
    await ctx.close();
  }

  /* ---- 2. Persona: 3-Tage-Festival Fr–So ---- */
  console.log('\n=== Persona 2: 3-Tage-Festival Fr–So (iPhone 13) ===');
  {
    const { ctx, p, errs } = await boot(br, 'iPhone 13');
    await p.evaluate(() => {
      state = freshState(); migrate(state);
      state.areas.find(a => a.id === 'a2').plan.goal = 4;
      state.areas.find(a => a.id === 'a3').plan.goal = 2;
      state.blocks = []; state.tasks = [];
      anchor = new Date(); selectedDayIdx = 2;
      save(); renderAll(); setView('plan');
    });
    await p.waitForTimeout(150);

    // Gestrafftes Neu-Blatt ablichten
    await p.click('#tabAdd');
    await p.waitForSelector('#bTitle');
    await p.waitForTimeout(250);
    const blattM = await p.evaluate(() => ({
      wasVorWann: !!(document.getElementById('bTitle').compareDocumentPosition(document.getElementById('bDays')) & Node.DOCUMENT_POSITION_FOLLOWING),
      mehrZu: !document.getElementById('bMehr').open,
      daysTops: [...document.querySelectorAll('#bDays .chip')].map(c => Math.round(c.getBoundingClientRect().top)),
      sheetQuer: document.querySelector('.sheet').scrollWidth <= document.querySelector('.sheet').clientWidth + 1
    }));
    ok(blattM.wasVorWann, 'P2a) „Was?" steht im gestrafften Blatt vor „Wann?"');
    ok(blattM.mehrZu, 'P2b) „Mehr Details" startet beim neuen Eintrag zugeklappt');
    ok(new Set(blattM.daysTops).size === 1, 'P2c) Wochentage Mo–So stehen in einer einzigen Zeile (' + JSON.stringify(blattM.daysTops) + ')');
    ok(blattM.sheetQuer, 'P2d) Neu-Blatt hat keinen horizontalen Ueberlauf');
    await p.screenshot({ path: path.join(__dirname, 'sz-neu-eintrag.png') });

    // 3-Tage-Festival Fr–So anlegen
    await p.fill('#bTitle', 'Sommerfestival');
    await p.click('.sheet #bGenau button.chip:text-is("Ganztägig")');
    await p.fill('#bDatum', '2026-08-07');
    await p.dispatchEvent('#bDatum', 'change');
    await p.fill('#bBis', '2026-08-09');
    await p.dispatchEvent('#bBis', 'change');
    const sperrAuto = await p.evaluate(() => ({
      sichtbar: !document.getElementById('bSperrtRow').hidden,
      an: document.getElementById('bSperrt').checked
    }));
    ok(sperrAuto.sichtbar && sperrAuto.an, 'P2e) Mehrtägig ganztägig setzt „Keine Vorschläge an diesen Tagen" automatisch (' + JSON.stringify(sperrAuto) + ')');
    await p.click('.sheet__foot .btn--primary');
    await p.waitForTimeout(200);

    // Verteiler laedt Vorschlaege, laesst Fr/Sa/So leer und baut Mi/Do
    const vFest = await p.evaluate(() => {
      buildSuggestions(); save();
      const frSo = state.blocks.filter(b => b.sug && ['2026-08-07', '2026-08-08', '2026-08-09'].includes(b.date));
      const miDo = state.blocks.filter(b => b.sug && ['2026-08-05', '2026-08-06'].includes(b.date));
      // Manueller Termin am Festival-Samstag bleibt erlaubt
      state.blocks.push({ id: 'fest-act', title: 'Mainstage Headliner', areaId: 'a5', day: 5, date: '2026-08-08', repeat: 'none', start: 20 * 60, end: 22 * 60, frog: false, grob: false });
      selectedDayIdx = 4; // Fr -> 3 Tage zeigt Fr, Sa, So
      save(); renderAll(); setView('plan');
      return { frSo: frSo.length, miDo: miDo.length };
    });
    ok(vFest.frSo === 0 && vFest.miDo > 0, 'P2f) Verteiler sperrt Fr–So wegen Festival und nutzt Mi–Do (' + JSON.stringify(vFest) + ')');

    // Auf 3-Tage-Ansicht umschalten
    await p.click('#tagModus button[data-tage="3"]');
    await p.waitForTimeout(250);
    const ansicht3 = await p.evaluate(() => {
      const lb = document.getElementById('looseBand').getBoundingClientRect();
      const gw = document.getElementById('gridWrap').getBoundingClientRect();
      const chip = document.querySelector('#looseBand .loosechip.is-lang');
      const heads = [...document.querySelectorAll('#grid .dayhead:not(.dayhead--gutter)')].map(h => h.querySelector('.dayhead__name').textContent);
      const act = [...document.querySelectorAll('#grid .block')].some(b => /Mainstage Headliner/.test(b.textContent));
      return {
        tage: document.body.dataset.tage,
        heads,
        bandOben: lb.bottom <= gw.top + 1,
        bandTop: Math.round(lb.top), gridTop: Math.round(gw.top),
        chipText: chip ? chip.textContent : '',
        chipWidth: chip ? Math.round(chip.getBoundingClientRect().width) : 0,
        act
      };
    });
    ok(ansicht3.tage === '3' && ansicht3.heads.join(',') === 'Fr,Sa,So', 'P2g) 3-Tage-Ansicht zeigt Fr, Sa, So nebeneinander (' + ansicht3.heads.join(',') + ')');
    ok(ansicht3.bandOben, 'P2h) #looseBand steht OBEN ueber dem Raster (' + ansicht3.bandTop + ' <= ' + ansicht3.gridTop + ')');
    ok(/Sommerfestival/.test(ansicht3.chipText) && /3 Tage/.test(ansicht3.chipText) && ansicht3.chipWidth > 220,
      'P2i) Festival erscheint als ein Balken ueber 3 Tage (' + ansicht3.chipText + ', ' + ansicht3.chipWidth + 'px)');
    ok(ansicht3.act, 'P2j) Manueller Festival-Termin Mainstage Headliner ist sichtbar');

    await p.evaluate(() => document.querySelectorAll('.toasts .toast').forEach(t => t.remove()));
    await p.screenshot({ path: path.join(__dirname, 'sz-woche-3tage-festival.png') });

    // Gegenprobe: eintaegig ganztägig (Geburtstag) sperrt NICHT standardmaessig
    await p.waitForTimeout(250);
    await p.click('#tabAdd');
    await p.fill('#bTitle', 'Mamas Geburtstag');
    await p.click('.sheet #bGenau button.chip:text-is("Ganztägig")');
    await p.fill('#bDatum', '2026-08-06');
    await p.dispatchEvent('#bDatum', 'change');
    const gebDefault = await p.evaluate(() => document.getElementById('bSperrt').checked);
    ok(gebDefault === false, 'P2k) Eintaegiger ganztägiger Eintrag (Geburtstag) laesst Sperre standardmaessig aus');
    await p.click('.sheet__foot .btn--primary');
    await p.waitForTimeout(150);
    const nachGeb = await p.evaluate(() => {
      clearSuggestions(); buildSuggestions(); save();
      return state.blocks.filter(b => b.sug && b.date === '2026-08-06').length;
    });
    ok(nachGeb > 0, 'P2l) Verteiler schlaegt am Geburtstag (Do) weiter normal vor (' + nachGeb + ')');

    ok(errs.length === 0, 'P2m) Keine Konsolenfehler');
    alleErrs.push(...errs);
    await ctx.close();
  }

  /* ---- 3. Persona: Abend-Event / Clubnacht Sa 22:00–06:00 ---- */
  console.log('\n=== Persona 3: Clubnacht Sa 22:00–06:00 & Schlafpuffer (iPhone 13) ===');
  {
    const { ctx, p, errs } = await boot(br, 'iPhone 13');
    await p.evaluate(() => {
      state = freshState(); migrate(state);
      state.settings.dayStart = 7; state.settings.dayEnd = 22;
      state.settings.sleep = { on: true, from: 23 * 60, to: 7 * 60, wind: 30 };
      state.areas.find(a => a.id === 'a2').plan.goal = 6;
      state.blocks = []; state.tasks = [];
      anchor = new Date(); selectedDayIdx = 4; // Fr -> 3 Tage zeigt Fr, Sa, So
      save(); renderAll(); setView('plan');
    });

    await p.click('#tabAdd');
    await p.fill('#bTitle', 'Clubnacht');
    await p.click('.sheet #bDays button.chip:text-is("Sa")');
    await p.click('.sheet #bDays button.chip:text-is("Fr")');
    await p.fill('#bFrom', '22:00');
    await p.fill('#bTo', '06:00');
    await p.click('.sheet__foot .btn--primary');
    await p.waitForTimeout(200);

    const nachtRes = await p.evaluate(() => {
      buildSuggestions();
      const soSug = state.blocks.filter(b => b.sug && b.date === '2026-08-09').map(b => ({ t: b.title, s: b.start, e: b.end }));
      // Manueller Brunch am Sonntag um 12:00 bleibt trotz Schlafpuffer erlaubt
      state.blocks.push({ id: 'brunch', title: 'Brunch mit Freunden', areaId: 'a6', day: 6, date: '2026-08-09', repeat: 'none', start: 12 * 60, end: 13 * 60 + 30, frog: false, grob: false });
      save(); renderAll();
      return {
        teile: state.blocks.filter(b => b.title === 'Clubnacht').length,
        soSug
      };
    });
    ok(nachtRes.teile === 2, 'P3a) Clubnacht 22:00–06:00 als zwei verbundene Teile angelegt');
    ok(nachtRes.soSug.every(s => s.s >= 14 * 60),
      'P3b) Verteiler laesst am Sonntag nach 06:00 mind. 8 h Schlafpuffer bis 14:00 (' + JSON.stringify(nachtRes.soSug) + ')');

    await p.click('#tagModus button[data-tage="3"]');
    await p.waitForTimeout(250);
    const ansichtNacht = await p.evaluate(() => {
      const texte = [...document.querySelectorAll('#grid .block')].map(b => b.textContent);
      return {
        clubTeile: texte.filter(t => /Clubnacht/.test(t)).length,
        brunch: texte.some(t => /Brunch mit Freunden/.test(t))
      };
    });
    ok(ansichtNacht.clubTeile === 2 && ansichtNacht.brunch,
      'P3c) 3-Tage-Ansicht zeigt beide Clubnacht-Teile (Sa & So) plus manuellen Brunch');

    await p.evaluate(() => document.querySelectorAll('.toasts .toast').forEach(t => t.remove()));
    await p.screenshot({ path: path.join(__dirname, 'sz-woche-nacht.png') });

    ok(errs.length === 0, 'P3d) Keine Konsolenfehler');
    alleErrs.push(...errs);
    await ctx.close();
  }

  /* ---- 4. Persona: Chaotischer Tag auf iPhone SE (320x568) ---- */
  console.log('\n=== Persona 4: Chaotischer Tag & 320px iPhone SE ===');
  {
    const { ctx, p, errs } = await boot(br, 'iPhone SE');
    await p.evaluate(() => {
      state = freshState(); migrate(state);
      const mon = mondayOf(new Date());
      const mi = iso(addDays(mon, 2));
      state.blocks = [
        { id: 'f1', title: 'Festival-Pass', areaId: 'a5', day: 2, date: mi, bis: iso(addDays(mon, 4)), repeat: 'none', start: 0, end: 0, grob: true, ganztag: true, teil: 'mo', dauer: 0, sperrt: true },
        { id: 'c1', title: 'Steuererklaerung vorbereiten', areaId: 'a1', day: 2, date: mi, repeat: 'none', start: 10 * 60, end: 11 * 60, frog: true },
        { id: 'c2', title: 'Yoga im Studio', areaId: 'a3', day: 2, date: mi, repeat: 'none', start: 17 * 60, end: 18 * 60, frog: false, sug: true }
      ];
      anchor = new Date(); selectedDayIdx = 2;
      save(); renderAll();
    });

    await p.evaluate(() => setView('aufgaben'));
    await p.fill('#taskInput', 'Bahnticket buchen 30min #Alltag');
    await p.click('#taskForm button[type="submit"]');
    await p.waitForTimeout(150);

    await p.evaluate(() => setView('heute'));
    await p.click('.energy__opt[data-lvl="low"]');
    await p.click('.switch.freischalter');
    await p.waitForTimeout(150);

    const overflow = {};
    for (const v of ['heute', 'aufgaben', 'ziele', 'plan']) {
      await p.evaluate(x => setView(x), v);
      await p.waitForTimeout(180);
      overflow[v] = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    }
    await p.click('#tagModus button[data-tage="3"]');
    await p.waitForTimeout(200);
    overflow.plan3 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    ok(Object.values(overflow).every(d => d <= 1),
      'P4a) Kein waagerechtes Ueberlaufen auf 320px iPhone SE in allen Ansichten (' + JSON.stringify(overflow) + ')');
    ok(errs.length === 0, 'P4b) Keine Konsolenfehler');
    alleErrs.push(...errs);
    await ctx.close();
  }

  /* ---- 5. Persona: Desktop 1440x900 (Hell & Dunkel) + Ideen-Blatt ---- */
  console.log('\n=== Persona 5: Desktop Header, Radien & Ideen-Blatt (1440x900) ===');
  {
    const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date('2026-11-25T10:20:00+01:00'));
    await p.goto(F + '?beispiel');
    await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
    await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
    await p.waitForTimeout(400);

    const desk = await p.evaluate(() => {
      const tb = document.querySelector('.topbar');
      const tr = tb.getBoundingClientRect();
      const wb = document.querySelector('#wuerfelBtn');
      const wcs = getComputedStyle(wb);
      const wn = document.querySelector('.weeknav').getBoundingClientRect();
      return {
        taglineWeg: !document.querySelector('.brand__tagline'),
        topbarH: Math.round(tr.height),
        topbarQuer: tb.scrollWidth > tb.clientWidth + 1,
        weeknavH: Math.round(wn.height),
        wuerfelBg: wcs.backgroundColor,
        btnRadius: getComputedStyle(document.querySelector('#desktopAdd')).borderRadius
      };
    });
    ok(desk.taglineWeg && !desk.topbarQuer && desk.topbarH <= 76,
      'P5a) Desktop-Kopf aufgeraeumt, ohne Slogan, einzeilig (' + desk.topbarH + ' px, Weeknav ' + desk.weeknavH + ' px)');
    ok(desk.wuerfelBg !== 'rgba(0, 0, 0, 0)' && parseFloat(desk.btnRadius) <= 14,
      'P5b) Wuerfel-Knopf getoent (' + desk.wuerfelBg + '), moderne Button-Radien (' + desk.btnRadius + ')');

    await p.screenshot({ path: path.join(__dirname, 'sz-desktop-hell.png') });
    await p.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(__dirname, 'sz-desktop-dunkel.png') });
    await p.evaluate(() => { state.settings.theme = 'light'; applyTheme(); });

    await p.click('#wuerfelBtn');
    await p.waitForSelector('.idee__meta');
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(__dirname, 'sz-idee-blatt.png') });

    ok(errs.length === 0, 'P5c) Keine Konsolenfehler');
    alleErrs.push(...errs);
    await ctx.close();
  }

  /* ---- 6. Persona: iPhone 16 Pro (Dynamic Island, Footer-Spalt, Bereichs-Loeschung) ---- */
  console.log('\n=== Persona 6: iPhone 16 Pro Safe-Area, Sticky-Footer & Bereich-Loesch-Fix ===');
  {
    const ctx = await br.newContext({
      viewport: { width: 393, height: 852 },
      hasTouch: true, isMobile: true, deviceScaleFactor: 3,
      timezoneId: 'Europe/Berlin', locale: 'de-DE'
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date('2026-11-25T10:20:00+01:00'));
    await p.goto(F + '?beispiel');
    await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
    await p.evaluate(() => {
      if (typeof closeModal === 'function') closeModal();
      document.documentElement.style.setProperty('--safe-top', '59px');
      document.documentElement.style.setProperty('--safe-bottom', '34px');
      setView('plan');
    });
    await p.waitForTimeout(250);

    const ios = await p.evaluate(() => {
      const htmlCs = getComputedStyle(document.documentElement);
      const kopfCs = getComputedStyle(document.getElementById('kopf'));
      const topbar = document.querySelector('.topbar').getBoundingClientRect();
      state.settings.theme = 'dark'; applyTheme();
      const darkCs = getComputedStyle(document.documentElement).colorScheme;
      state.settings.theme = 'light'; applyTheme();
      const lightCs = getComputedStyle(document.documentElement).colorScheme;
      return {
        gleich: htmlCs.backgroundColor === kopfCs.backgroundColor,
        blur: kopfCs.backdropFilter,
        topbarTop: Math.round(topbar.top),
        darkCs, lightCs
      };
    });
    ok(ios.gleich && ios.blur === 'none', 'P6a) Browser-Modus hat deckenden --kopf-flach auf html und #kopf');
    ok(ios.darkCs.includes('dark') && ios.lightCs.includes('light'), 'P6b) color-scheme folgt Hell/Dunkel (' + ios.lightCs + ' / ' + ios.darkCs + ')');
    await p.screenshot({ path: path.join(__dirname, 'sz-iphone16-plan.png') });

    await p.click('#tabAdd');
    await p.waitForSelector('#bTitle');
    await p.waitForTimeout(250);
    await p.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await p.waitForTimeout(50);
    const modalCheck = await p.evaluate(() => {
      const s = document.querySelector('.sheet');
      const f = document.querySelector('.sheet__foot');
      const sr0 = s.getBoundingClientRect();
      const fr0 = f.getBoundingClientRect();
      s.scrollTop = 64;
      const sr = s.getBoundingClientRect();
      const fr = f.getBoundingClientRect();
      const hitLeft = document.elementFromPoint(sr.left + 28, fr.bottom - 8);
      const hitRight = document.elementFromPoint(sr.right - 28, fr.bottom - 8);
      const keinDurchblitzer = hitLeft && hitLeft.closest('.sheet__foot') && hitRight && hitRight.closest('.sheet__foot');
      s.scrollTop = 0;
      const fromR = document.getElementById('bFrom').getBoundingClientRect();
      const toR = document.getElementById('bTo').getBoundingClientRect();
      const datR = document.getElementById('bDatum').getBoundingClientRect();
      return {
        footBuendig: Math.abs(fr0.bottom - sr0.bottom) <= 1.5 && Math.abs(fr.bottom - sr.bottom) <= 1.5,
        keinDurchblitzer: Boolean(keinDurchblitzer),
        zeitOk: fromR.right <= toR.left + 1 && toR.right <= sr.right + 1 && datR.right <= sr.right + 1,
        quer: s.scrollWidth > s.clientWidth + 1,
        hasSwitch: getComputedStyle(document.getElementById('bSperrt')).appearance
      };
    });
    ok(modalCheck.footBuendig && modalCheck.keinDurchblitzer, 'P6c) Sticky-Footer buendig ohne 34px-Spalt / durchblitzende Chips');
    ok(modalCheck.zeitOk && !modalCheck.quer, 'P6d) iOS Date/Time-Felder sauber innerhalb der Box');
    await p.screenshot({ path: path.join(__dirname, 'sz-iphone16-neu.png') });

    // Klick auf „Oft geplant“ darf kein zweites Fenster (.blatt-abgang) erzeugen
    await p.click('#bLieblinge .chip >> nth=0');
    await p.waitForTimeout(80);
    const keinGhost = await p.evaluate(() => document.querySelectorAll('.blatt-abgang').length === 0 && !!document.querySelector('#bTitle').value);
    ok(keinGhost, 'P6e) Tippen auf „Oft geplant" uebernimmt ohne doppeltes Ueberlapp-Fenster');
    await p.evaluate(() => closeModal());
    await p.waitForTimeout(100);

    // Bereich-Loesch-Bug-Probe im zweiten Plan
    const hauptBefore = await p.evaluate(() => state.areas.filter(a => !a.kalender).map(a => a.id).join());
    await p.click('#planBtn');
    await p.waitForSelector('.planzeile__wahl >> nth=1');
    await p.click('.planzeile__wahl >> nth=1');
    await p.waitForTimeout(200);
    await p.click('#settingsBtn');
    await p.waitForSelector('.setmenu__item');
    await p.click('.setmenu__item:has-text("Bereiche")');
    await p.waitForSelector('#sAreas .arearow button.btn--danger');
    await p.click('#sAreas .arearow button.btn--danger >> nth=0');
    await p.waitForTimeout(150);
    const hauptAfter = await p.evaluate(() => state.areas.filter(a => !a.kalender).map(a => a.id).join());
    ok(hauptBefore === hauptAfter, 'P6f) Bereich-Loeschen im zweiten Plan laesst „Meine Woche"-Bereiche unberuehrt');

    ok(errs.length === 0, 'P6g) Keine Konsolenfehler');
    alleErrs.push(...errs);
    await ctx.close();
  }

  /* ---- 7. Persona: Gimmicks, Geheimpunkt, Checklisten-Zaehler, Fokus-Klang, Drag, Teilen & Multi-Undo ---- */
  console.log('\n=== Persona 7: Persoenliche Gimmicks, Fokus-Klang, Tag-Drag, Teilen & Multi-Undo ===');
  {
    const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date('2026-11-25T10:20:00+01:00'));
    await p.goto(F + '?beispiel');
    await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
    await p.evaluate(() => {
      if (typeof closeModal === 'function') closeModal();
      const mon = mondayOf(new Date());
      const di = iso(addDays(mon, 1));
      state.blocks.push({
        id: 'p7-steps', title: 'Atelier Skizze', areaId: 'a5', day: 2, date: iso(addDays(mon, 2)),
        repeat: 'none', start: 18 * 60, end: 19 * 60, frog: false,
        schritte: [{ t: 'Stifte', ok: true }, { t: 'Kaffee', ok: false }]
      });
      state.blocks.push({
        id: 'p7-drag', title: 'Verschiebe-Test', areaId: 'a2', day: 1, date: di,
        repeat: 'none', start: 11 * 60, end: 12 * 60, frog: false
      });
      selectedDayIdx = 2;
      save(); renderAll();
    });
    await p.waitForTimeout(200);

    const ideenCheck = await p.evaluate(() => {
      const texte = ideenGeneriert().map(i => i.t).join(' | ');
      return /Wintersonne/.test(texte) && /Katzenpfote/.test(texte) && /Hardstyle/.test(texte)
        && /Evoli/.test(texte) && /graue Katze/.test(texte);
    });
    ok(ideenCheck, 'P7a) Neue Mikroideen (Wintersonne, Katzenpfote, Hardstyle, Evoli, graue Katze) im Ideenpool');

    // Checklisten-Fortschritt ✓ 1/2 im Raster und in Heute
    const schrittCheck = await p.evaluate(() => {
      const blk = document.querySelector('.block[data-id="p7-steps"] .block__time');
      const agRow = document.querySelector('#agenda .agenda__check[data-id="p7-steps"]').closest('.agenda__row');
      const agSub = agRow && agRow.querySelector('.agenda__sub');
      return {
        raster: blk ? blk.textContent : '',
        heute: agSub ? agSub.textContent : ''
      };
    });
    ok(schrittCheck.raster.includes('✓ 1/2') && schrittCheck.heute.includes('✓ 1/2'), 'P7b) Checklisten-Fortschritt ✓ 1/2 in Raster und Heute sichtbar');

    // 3x Tippen auf .brand oeffnet „Kleiner Geheimpunkt" (Zwischenhinweis bei Tipp 2 + Name im Titel)
    await p.route('https://open.spotify.com/**', r => r.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>Spotify Embed Mock</body></html>'
    }));
    const preStateJson = await p.evaluate(() => JSON.stringify(state));
    await p.click('.brand');
    await p.click('.brand');
    const hinweis2 = await p.evaluate(() =>
      Array.from(document.querySelectorAll('#toasts .toast')).map(t => t.textContent).join(' ')
    );
    await p.click('.brand');
    await p.waitForSelector('.sheet.geheim');
    const geheimTitel = await p.textContent('.sheet.geheim .sheet__title');
    const keinAutoIframe = await p.evaluate(() => document.querySelectorAll('#geheimPlayer iframe').length === 0);
    const spruch1 = await p.textContent('#geheimSpruch');
    await p.click('#geheimKarte');
    const spruch2 = await p.textContent('#geheimSpruch');
    await p.click('#geheimRave');
    await p.waitForTimeout(150);
    const raveAn = await p.evaluate(() => document.querySelector('.sheet.geheim').classList.contains('is-rave'));
    await p.evaluate(() => { const t = document.querySelector('#toasts'); if (t) t.innerHTML = ''; });
    await p.screenshot({ path: path.join(__dirname, 'sz-geheim.png') });
    await p.click('#geheimPlayerBtn');
    await p.waitForSelector('#geheimPlayer iframe');
    const playerOffen = await p.evaluate(() => {
      const ifr = document.querySelector('#geheimPlayer iframe');
      const lnk = document.querySelector('#geheimPlayer .geheim__link');
      return {
        src: ifr ? ifr.getAttribute('src') || '' : '',
        allow: ifr ? ifr.getAttribute('allow') || '' : '',
        href: lnk ? lnk.getAttribute('href') || '' : ''
      };
    });
    await p.click('#geheimPlayerBtn');
    const playerZu = await p.evaluate(() =>
      document.querySelector('#geheimPlayer').hidden && document.querySelectorAll('#geheimPlayer iframe').length === 0
    );
    await p.evaluate(() => closeModal());
    const stateUnberuehrt = await p.evaluate(v => JSON.stringify(state) === v, preStateJson);
    ok(
      hinweis2.includes('noch einmal tippen') && geheimTitel.includes('Sunny')
      && keinAutoIframe && spruch1 !== spruch2 && raveAn
      && playerOffen.src.includes('77s5XxTYzzIx4piW1nVIbb')
      && !/autoplay/i.test(playerOffen.src) && !/autoplay/i.test(playerOffen.allow)
      && playerOffen.href.includes('https://open.spotify.com/playlist/77s5XxTYzzIx4piW1nVIbb')
      && playerZu && stateUnberuehrt,
      'P7c) Geheimpunkt (graue Katze + Name + 150 BPM Rave + On-Demand Spotify) via 3x-Tipp, speichert nichts in state'
    );

    // #bFokus im Eintrags-Blatt + Offline-Klang im Fokus-Blatt
    await p.evaluate(() => { const b = state.blocks.find(x => x.id === 'p7-steps'); blockSheet({ ...b }, b.date); });
    await p.waitForSelector('#bFokus');
    await p.click('#bFokus');
    await p.waitForSelector('#fokusKlang');
    await p.click('#fokusKlang button[data-klang="regen"]');
    await p.waitForTimeout(150);
    const klangPressed = await p.getAttribute('#fokusKlang button[data-klang="regen"]', 'aria-pressed');
    await p.screenshot({ path: path.join(__dirname, 'sz-fokus.png') });
    await p.evaluate(() => closeModal());
    ok(klangPressed === 'true', 'P7d) #bFokus oeffnet Fokus-Blatt mit Offline-Klang „Regen"');

    // Horizontaler Block-Drag am Desktop (Di -> Do)
    const dragRes = await p.evaluate(() => {
      const bEl = document.querySelector('.block[data-id="p7-drag"]');
      const ziel = document.querySelector('.daycol[data-day="3"]');
      const rB = bEl.getBoundingClientRect();
      const rZ = ziel.getBoundingClientRect();
      const sx = rB.left + rB.width / 2, sy = rB.top + 14;
      const ex = rZ.left + rZ.width / 2, ey = sy + 30;
      bEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', pointerId: 1, clientX: sx, clientY: sy }));
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', pointerId: 1, clientX: sx + 12, clientY: sy + 8 }));
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', pointerId: 1, clientX: ex, clientY: ey }));
      const zeitText = (bEl.querySelector('.dragzeit') || {}).textContent || '';
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse', pointerId: 1, clientX: ex, clientY: ey }));
      const verschoben = state.blocks.find(x => x.id === 'p7-drag');
      return { day: verschoben.day, date: verschoben.date, zeitText };
    });
    ok(dragRes.day === 3 && dragRes.zeitText.includes('Do'), 'P7e) Horizontaler Desktop-Drag verschiebt Block auf Do (' + JSON.stringify(dragRes) + ')');

    // Plan als Link teilen (#teilen=) & Import als neuer Plan
    const teilenRes = await p.evaluate(() => {
      const beforeBlocks = state.blocks.length;
      const beforeAreas = state.areas.filter(a => !a.kalender).length;
      const url = planLinkBauen(null);
      const hash = '#' + url.split('#')[1];
      const parsed = planLinkLesen(hash);
      planLinkImportSheet(parsed);
      document.querySelector('.sheet .btn--primary').click();
      const afterMainAreas = state.areas.filter(a => !a.kalender).length;
      const extraPlans = plaene().filter(x => x.id);
      const okImport = parsed && extraPlans.length > 0 && afterMainAreas === beforeAreas && state.blocks.length > beforeBlocks;
      planMerken(null); renderAll();
      return { okImport, urlLen: url.length };
    });
    ok(teilenRes.okImport && teilenRes.urlLen > 40, 'P7f) #teilen=-Link exportiert & importiert sauber als eigener neuer Plan');

    // Mehrstufiges Strg+Z Undo (2 Schritte hintereinander)
    const undoRes = await p.evaluate(() => {
      const n0 = state.tasks.length;
      state.tasks.push({ id: 'p7-u1', title: 'Undo Eins', areaId: 'a1', done: false, frog: false, dauer: 30 });
      save();
      state.tasks.push({ id: 'p7-u2', title: 'Undo Zwei', areaId: 'a1', done: false, frog: false, dauer: 30 });
      save();
      renderAll();
      return { n0, n2: state.tasks.length };
    });
    await p.keyboard.press('Control+z');
    const nach1 = await p.evaluate(() => state.tasks.length);
    await p.keyboard.press('Control+z');
    const nach2 = await p.evaluate(() => state.tasks.length);
    ok(undoRes.n2 === undoRes.n0 + 2 && nach1 === undoRes.n0 + 1 && nach2 === undoRes.n0, 'P7g) Mehrstufiges Strg+Z macht 2 Aenderungen der Reihe nach rueckgaengig');

    // Schwere-Tage-Begleitsatz bei Tagesform „Wenig"
    await p.click('.energy__opt[data-lvl="low"]');
    const lowRes = await p.evaluate(() => {
      const hint = document.getElementById('energyHint');
      const txt = hint ? hint.textContent : '';
      const nm = nutzerName();
      return {
        sichtbar: hint && !hint.hidden,
        txt,
        inPool: ENERGY_LOW_TEXTE.some(html =>
          txt.includes(html.replace('{n}', nm ? ', ' + nm : '').replace(/<[^>]+>/g, '').slice(0, 28))
        ),
        keinDuplikat: !/Das Wichtigste:/.test(txt)
      };
    });
    ok(lowRes.sichtbar && lowRes.inPool && lowRes.keinDuplikat, 'P7h) Tagesform „Wenig" zeigt warmherzigen Begleitsatz aus ENERGY_LOW_TEXTE');

    ok(errs.length === 0, 'P7i) Keine Konsolenfehler');
    alleErrs.push(...errs);
    await ctx.close();
  }

  await br.close();
  console.log('\n' + (fehler.length || alleErrs.length ? 'FEHLER: ' + fehler.length : 'ALLES GRUEN'));
  process.exit(fehler.length || alleErrs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
