/* ============================================================
   Pruefskript Regeln (Stufe 9) — der kontextbewusste Verteiler.

   Prueft woertlich die drei Nutzerbeispiele aus dem Auftrag, als Tabelle:
     a) Fenster    — Bereich "Alltag" mit Mo-Sa 8:00-20:00: kein Vorschlag
                      faellt auf einen Sonntag oder beginnt nach 20:00,
                      geprueft ueber die ganze Woche.
     b) Anker      — Bereich "Sport" mit Anker auf "Arbeit", min 30, max 180:
                      jeder Vorschlag beginnt in diesem Fenster nach dem Ende
                      des letzten Arbeitsblocks desselben Tages.
     c) sonst:aus  — ein Tag ohne Arbeitsblock erzeugt keinen Sport-Vorschlag.
     d) Gegenprobe — ohne Regeln entstehen weiterhin Vorschlaege, und die
                      Gesamtzahl faellt mit Regeln nicht auf null.
     e) Reihenfolge — most-constrained-first: ein enges Fenster bekommt seinen
                      Platz auch dann, wenn ein flexibler Bereich dieselbe
                      Luecke haette fuellen koennen.
     f) Wachstum   — growSuggestions() (Restminuten an bestehende Vorschlaege
                      anhaengen) darf einen Vorschlag nicht ueber das Ende
                      seines Regeln-Fensters hinaus verlaengern.

   Stil wie realtest.js/rt.js: eine Chromium-Seite, deutsche Ausgabe,
   Exit 1 bei Fehlern.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const p = await br.newPage({ viewport: { width: 1400, height: 950 } });
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // -------------------------------------------------------------
  // a) + b) + c) + d): ein gemeinsamer, klar definierter Zustand.
  //   - "Alltag" (a7): Fenster Mo-Sa 8:00-20:00, Ziel 10 h/Woche.
  //   - "Sport" (a3): Anker auf "Arbeit", min 30, max 180, Ziel 6 h/Woche.
  //   - "Arbeit" (a1) hat feste Bloecke Mo-Do 9:00-17:00 — Fr/Sa/So bleiben
  //     ohne Arbeitsblock, das liefert Fall c) gleich mit.
  // -------------------------------------------------------------
  const a = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);   // volle Zukunftswoche, alle 7 Tage zaehlen
    state.blocks = [];

    const alltag = state.areas.find(x => x.name === "Alltag");
    alltag.plan.goal = 10; alltag.plan.must = true; alltag.plan.days = [0,1,2,3,4,5,6];
    alltag.regeln = { fenster: [{ tage: [0,1,2,3,4,5], von: 8*60, bis: 20*60 }], anker: null };

    const sport = state.areas.find(x => x.name === "Sport");
    sport.plan.goal = 6; sport.plan.must = true; sport.plan.days = [0,1,2,3,4,5,6];
    sport.regeln = { fenster: [], anker: { ref: "a1", min: 30, max: 180, sonst: "aus" } };

    const arbeit = state.areas.find(x => x.id === "a1");
    arbeit.plan.goal = 0;   // keine eigenen Vorschlaege, nur feste Bloecke
    weekDays().filter(d => d.i <= 3).forEach(d => {   // Mo-Do
      state.blocks.push({ id: uid(), title: "Arbeit", areaId: "a1",
        day: d.i, date: d.key, repeat: "none", start: 9*60, end: 17*60, frog: false });
    });

    save(); renderAll();
    clearSuggestions();
    const res = buildSuggestions();

    const sugAlltag = state.blocks.filter(b => b.sug && b.areaId === alltag.id);
    const sugSport = state.blocks.filter(b => b.sug && b.areaId === sport.id);

    return {
      placed: res.placed, missing: res.missing,
      alltag: {
        anzahl: sugAlltag.length,
        sonntag: sugAlltag.filter(b => b.day === 6).length,
        nach20Start: sugAlltag.filter(b => b.start >= 20*60).length,
        nach20Ende: sugAlltag.filter(b => b.end > 20*60).length,
        tage: [...new Set(sugAlltag.map(b => b.day))].sort()
      },
      sport: {
        anzahl: sugSport.length,
        tage: [...new Set(sugSport.map(b => b.day))].sort(),
        ausserhalbFenster: sugSport.filter(b => {
          const arbeitEnde = 17*60;
          return b.start < arbeitEnde + 30 || b.start > arbeitEnde + 180;
        }).map(b => "Tag " + b.day + " " + fmtTime(b.start) + "-" + fmtTime(b.end)),
        anFrSaSo: sugSport.filter(b => b.day >= 4).length   // Fr/Sa/So: kein Arbeitsblock
      }
    };
  });
  console.log('=== a)+b)+c)+d) Verteilung mit Fenster und Anker ===');
  console.log(JSON.stringify(a, null, 1));
  ok(a.alltag.sonntag === 0, 'a) Alltag: kein Vorschlag am Sonntag (' + a.alltag.sonntag + ')');
  ok(a.alltag.nach20Start === 0, 'a) Alltag: kein Vorschlag beginnt nach 20:00 (' + a.alltag.nach20Start + ')');
  ok(a.alltag.anzahl > 0, 'a) Alltag: es entstehen ueberhaupt Vorschlaege (' + a.alltag.anzahl + ')');
  ok(a.sport.ausserhalbFenster.length === 0,
    'b) Sport: jeder Vorschlag beginnt 30-180 Min nach Arbeitsende (Verstoesse: ' + a.sport.ausserhalbFenster.join(', ') + ')');
  ok(a.sport.anzahl > 0, 'b) Sport: es entstehen ueberhaupt Vorschlaege (' + a.sport.anzahl + ')');
  ok(a.sport.anFrSaSo === 0, 'c) Sport: kein Vorschlag an einem Tag ohne Arbeitsblock (' + a.sport.anFrSaSo + ')');
  ok(a.placed > 0, 'd) Gegenprobe (mit Regeln): Gesamtzahl faellt nicht auf null (' + a.placed + ' Min platziert)');

  // -------------------------------------------------------------
  // d) Gegenprobe ohne Regeln: derselbe Zustand, aber area.regeln = null.
  //    Muss weiterhin Vorschlaege erzeugen — Regeln duerfen nicht grundsaetzlich
  //    alles verhindern.
  // -------------------------------------------------------------
  const d = await p.evaluate(() => {
    const alltag = state.areas.find(x => x.name === "Alltag");
    const sport = state.areas.find(x => x.name === "Sport");
    alltag.regeln = null;
    sport.regeln = null;
    state.blocks = state.blocks.filter(b => !b.sug);   // nur die festen Arbeitsbloecke bleiben
    save(); renderAll();
    clearSuggestions();
    const res = buildSuggestions();
    return { placed: res.placed, missing: res.missing,
             anzahl: state.blocks.filter(b => b.sug).length };
  });
  console.log('\n=== d) Gegenprobe ohne Regeln ===');
  console.log(JSON.stringify(d, null, 1));
  ok(d.placed > 0 && d.anzahl > 0, 'd) Ohne Regeln entstehen weiterhin Vorschlaege (' + d.anzahl + ')');
  ok(d.placed >= a.placed, 'd) Ohne Regeln wird nicht weniger platziert als mit Regeln (' + d.placed + ' vs. ' + a.placed + ')');

  // -------------------------------------------------------------
  // e) Most-constrained-first: ein Bereich mit engem Fenster (nur Mittwoch,
  //    12:00-13:00) und ein flexibler Bereich (ganze Woche) konkurrieren um
  //    dieselbe einzige freie Stunde der Woche. Der enge Bereich muss sie
  //    bekommen, unabhaengig von der Reihenfolge in state.areas.
  // -------------------------------------------------------------
  const e = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];

    // Die ganze Woche mit festen Bloecken zumauern, ausser Mittwoch 11-14 Uhr —
    // der Rand ist bewusst breiter als 12-13, weil pauseNach() (Arbeit/"kopf",
    // Bloecke >= 150 Min) je 30 Minuten Puffer an beide Blockenden haengt.
    // Ohne den Rand friesst der Puffer selbst die 12-13-Luecke leer.
    weekDays().forEach(d => {
      if (d.i === 2) {
        state.blocks.push({ id: uid(), title: "Belegt", areaId: "a1", day: d.i, date: d.key,
          repeat: "none", start: 7*60, end: 11*60, frog: false });
        state.blocks.push({ id: uid(), title: "Belegt", areaId: "a1", day: d.i, date: d.key,
          repeat: "none", start: 14*60, end: 22*60, frog: false });
      } else {
        state.blocks.push({ id: uid(), title: "Belegt", areaId: "a1", day: d.i, date: d.key,
          repeat: "none", start: 7*60, end: 22*60, frog: false });
      }
    });
    state.areas.forEach(ar => { ar.plan.goal = 0; });

    // Absichtlich zuerst der flexible, dann der enge Bereich in state.areas —
    // ein Sortierschluessel, der die Reihenfolge nicht durchbricht, wuerde
    // den flexiblen zuerst verteilen und dem engen nichts uebrig lassen.
    const flex = { id: "tFlex", name: "Flex", hue: 10, plan: { ...defaultPlan(),
      goal: 1, must: true, days: [0,1,2,3,4,5,6] }, regeln: null };
    const eng = { id: "tEng", name: "Eng", hue: 20, plan: { ...defaultPlan(),
      goal: 1, must: true, days: [2] },
      regeln: { fenster: [{ tage: [2], von: 12*60, bis: 13*60 }], anker: null } };
    state.areas.push(flex, eng);

    save(); renderAll();
    clearSuggestions();
    const res = buildSuggestions();

    const sugFlex = state.blocks.filter(b => b.sug && b.areaId === "tFlex");
    const sugEng = state.blocks.filter(b => b.sug && b.areaId === "tEng");
    return {
      placed: res.placed,
      flexMinuten: sugFlex.reduce((n,b) => n + (b.end - b.start), 0),
      engMinuten: sugEng.reduce((n,b) => n + (b.end - b.start), 0),
      engBloecke: sugEng.map(b => "Tag " + b.day + " " + fmtTime(b.start) + "-" + fmtTime(b.end))
    };
  });
  console.log('\n=== e) Most-constrained-first ===');
  console.log(JSON.stringify(e, null, 1));
  ok(e.engMinuten >= 60, 'e) Der enge Bereich bekommt seine volle Stunde (' + e.engMinuten + ' Min, ' + e.engBloecke.join(', ') + ')');
  ok(e.flexMinuten === 0, 'e) Der flexible Bereich bekommt nichts mehr ab (' + e.flexMinuten + ' Min)');

  // -------------------------------------------------------------
  // f) growSuggestions() darf einen Vorschlag nicht ueber das Ende seines
  //    Regeln-Fensters (Anker: Ende + max) hinaus verlaengern.
  // -------------------------------------------------------------
  const fT = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];

    const sport = state.areas.find(x => x.id === "a3");
    sport.plan.goal = 0;
    // Anker: Arbeit + min 30, max 60 -> Fenster ist genau 30 Minuten breit.
    sport.regeln = { fenster: [], anker: { ref: "a1", min: 30, max: 60, sonst: "aus" } };

    const day = weekDays()[0];   // Montag
    state.blocks.push({ id: uid(), title: "Arbeit", areaId: "a1", day: day.i, date: day.key,
      repeat: "none", start: 9*60, end: 17*60, frog: false });
    // Vorschlag von Hand an den Anfang des erlaubten Fensters gesetzt (17:30-17:45)
    state.blocks.push({ id: "sport-sug", title: "Sport", areaId: "a3", day: day.i, date: day.key,
      repeat: "none", start: 17*60+30, end: 17*60+45, frog: false, sug: true });

    const used = growSuggestions(sport, 100);
    const b = state.blocks.find(x => x.id === "sport-sug");
    return { used, ende: b.end, fensterEnde: 17*60 + 60, verletzt: b.end > 17*60 + 60 };
  });
  console.log('\n=== f) growSuggestions() respektiert das Anker-Fenster ===');
  console.log(JSON.stringify(fT, null, 1));
  ok(!fT.verletzt, 'f) growSuggestions() verlaengert nicht ueber das Anker-Fenster hinaus (Ende ' +
    fT.ende + ' Min, erlaubt bis ' + fT.fensterEnde + ' Min)');

  // -------------------------------------------------------------
  // Migration: area.regeln und task.regeln ueberleben ZEHN migrate()-Durchlaeufe.
  // -------------------------------------------------------------
  const mig = await p.evaluate(() => {
    const s = { version: 9,
      profile: { id: "x", name: "" },
      settings: { dayStart: 7, dayEnd: 22, theme: "auto", sleep: defaultSleep() }, settingsAt: 0,
      areas: [
        { id: "a1", name: "Arbeit", hue: 248, plan: defaultPlan(), regeln: null },
        { id: "a3", name: "Sport", hue: 152, plan: defaultPlan(),
          regeln: { fenster: [{ tage: [0,1,2,3,4], von: 480, bis: 1200 }],
                    anker: { ref: "a1", min: 30, max: 180, sonst: "aus" } } }
      ],
      blocks: [], tasks: [{ id: "t1", title: "Test", areaId: "a3", regeln: { fenster: [{tage:[6],von:600,bis:660}], anker: null } }],
      days: {}, tombs: {}, backupAt: 0
    };
    const vorher = JSON.stringify(s.areas[1].regeln);
    const vorherTask = JSON.stringify(s.tasks[0].regeln);
    for (let i = 0; i < 10; i++) migrate(s);
    return {
      version: s.version,
      unveraendert: JSON.stringify(s.areas[1].regeln) === vorher,
      taskUnveraendert: JSON.stringify(s.tasks[0].regeln) === vorherTask,
      areaRegeln: s.areas[1].regeln, taskRegeln: s.tasks[0].regeln
    };
  });
  console.log('\n=== Migration: zehn Durchlaeufe ===');
  console.log(JSON.stringify(mig, null, 1));
  ok(mig.version === 9, 'migrate() endet bei version 9 (' + mig.version + ')');
  ok(mig.unveraendert, 'area.regeln bleibt ueber 10 migrate()-Durchlaeufe unveraendert');
  ok(mig.taskUnveraendert, 'task.regeln bleibt ueber 10 migrate()-Durchlaeufe unveraendert (migrate fasst es nicht an)');

  // Verwaister Anker: zeigt ref auf einen geloeschten Bereich -> Anker faellt weg.
  const verwaist = await p.evaluate(() => {
    const s = { version: 9,
      profile: { id: "x", name: "" },
      settings: { dayStart: 7, dayEnd: 22, theme: "auto", sleep: defaultSleep() }, settingsAt: 0,
      areas: [{ id: "a3", name: "Sport", hue: 152, plan: defaultPlan(),
        regeln: { fenster: [], anker: { ref: "geloescht", min: 30, max: 180, sonst: "aus" } } }],
      blocks: [], tasks: [], days: {}, tombs: {}, backupAt: 0
    };
    migrate(s);
    return { regeln: s.areas[0].regeln };
  });
  console.log('\n=== Verwaister Anker (ref zeigt ins Leere) ===');
  console.log(JSON.stringify(verwaist, null, 1));
  ok(verwaist.regeln === null, 'ein Anker auf einen nicht mehr vorhandenen Bereich wird verworfen');

  // -------------------------------------------------------------
  // Sync: ein v9-Stand mit Regeln, durch ein simuliertes v8-Geraet (regeln
  // entfernt) geschickt und per mergeStates() in beide Richtungen verrechnet
  // — die Regeln duerfen dabei nicht verloren gehen.
  // -------------------------------------------------------------
  const sync = await p.evaluate(() => {
    const mine = JSON.parse(JSON.stringify(state));
    const alltag = mine.areas.find(x => x.name === "Alltag") || mine.areas[0];
    alltag.regeln = { fenster: [{ tage: [0,1,2,3,4,5], von: 480, bis: 1200 }], anker: null };
    alltag.at = 6000;   // die Regeln sind die juengste Aenderung an diesem Bereich

    // v8-Geraet: kennt "regeln" nicht, sein Stand des Bereichs ist aelter.
    const v8Kopie = JSON.parse(JSON.stringify(mine));
    const altAlltag = v8Kopie.areas.find(x => x.id === alltag.id);
    delete altAlltag.regeln;
    altAlltag.at = 5000;

    // Beide Richtungen: einmal "mine" als Basis (eigenes Geraet empfaengt vom
    // v8-Geraet), einmal "v8Kopie" als Basis (v8-Geraet empfaengt von mir) —
    // der juengere Datensatz (mine, mit Regeln) muss in beiden Faellen gewinnen.
    const hierher = mergeStates(mine, v8Kopie);
    const dorthin = mergeStates(v8Kopie, mine);
    migrate(hierher); migrate(dorthin);

    return {
      hierher: hierher.areas.find(x => x.id === alltag.id).regeln,
      dorthin: dorthin.areas.find(x => x.id === alltag.id).regeln
    };
  });
  console.log('\n=== Sync: v9 durch simuliertes v8-Geraet und zurueck ===');
  console.log(JSON.stringify(sync, null, 1));
  ok(sync.hierher && typeof sync.hierher === "object" && sync.hierher.fenster && sync.hierher.fenster.length,
    'Zusammenfuehrung behaelt die Regeln, wenn die eigene (juengere) Fassung Basis ist');
  ok(sync.dorthin && typeof sync.dorthin === "object" && sync.dorthin.fenster && sync.dorthin.fenster.length,
    'Zusammenfuehrung behaelt die Regeln auch in der Gegenrichtung, weil "mine" trotzdem der juengere Datensatz ist');

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
