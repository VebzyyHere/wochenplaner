/* ============================================================
   Pruefskript Schleife (Stufe 13) — "die Schleife schliesst sich".

   a) Ein angenommener Vorschlag zeigt seinen grund in der Agenda (oder,
      falls er einen Ort hat, den Ort — dann bleibt der Grund im Blatt
      abrufbar). Kein Eintrag zeigt zwei Unterzeilen.
   b) Der Wochenstart hat in Schritt 2 die vier Anker-Chips, und eine
      Auswahl landet tatsaechlich in area.regeln.anker.
   c) Schritt 1 des Wochenstarts hat einen sichtbaren "Spaeter"-Ausgang,
      der das Blatt schliesst, ohne etwas zu speichern.
   d) Die Ritual-Kennzahl nennt "X von Y hat einen Platz", nicht mehr "offen".
   e) Der Tagesabschluss erscheint ab Feierabendzeit, bietet drei Wege je
      Eintrag und verschiebt NICHTS von selbst. Vor der Feierabendzeit
      erscheint er nicht.
   f) Ein per "×" abgeschalteter Vorschlagstyp taucht beim naechsten
      Verteilen nicht wieder auf — auch nach einem migrate()-Durchlauf
      nicht (das Feld muss die Migration ueberleben).

   Stil wie erklaer.js/rt.js: eine Chromium-Seite, deutsche Ausgabe,
   Exit 1 bei Fehlern. Die Uhrzeit wird ueber page.clock.setFixedTime()
   festgenagelt (Playwright 1.62), NICHT ueber die echte Systemuhr —
   sonst haengt e) davon ab, wann das Skript zufaellig laeuft.
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

  // Feste Uhrzeit: Mittwoch, 18:00 — ein normaler Werktag mit reichlich
  // Abstand zur Nachtruhe. Ab hier steht new Date() im Browser immer hier.
  await p.clock.setFixedTime(new Date('2026-08-05T18:00:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // ==============================================================
  // a) Grund vs. Ort in der Agenda
  // ==============================================================
  console.log('=== a) Grund in der Agenda ===');
  const a = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    const mon = mondayOf(anchor);
    const heuteI = (anchor.getDay() + 6) % 7;
    const heuteKey = iso(anchor);
    state.orte = [{ id: 'ort1', name: 'Sportstudio' }];

    // Uhrzeit ist per clock.setFixedTime auf 18:00 genagelt (s. oben) — alle
    // Testeintraege liegen bewusst DANACH, sonst zaehlt renderAgenda() sie
    // gar nicht erst zu "danach" und die Zeile bliebe ganz aus (das war der
    // erste Anlauf dieses Skripts: leere Agenda, statt eines echten Befunds).

    // a3 (Sport) bekommt einen Ort -> Agenda soll den Ort zeigen, den Grund
    // NICHT in der Unterzeile, aber im Blatt lesbar halten.
    const sport = state.areas.find(x => x.id === 'a3');
    sport.plan.ortId = 'ort1';
    const bMitOrt = { id: uid(), title: 'Sport', areaId: 'a3', day: heuteI, date: heuteKey,
      repeat: 'none', start: 19 * 60, end: 20 * 60, frog: false, grund: 'Testgrund mit Ort' };
    state.blocks.push(bMitOrt);

    // a4 (Hobby) ohne Ort -> Agenda soll den Grund zeigen.
    const bOhneOrt = { id: uid(), title: 'Hobby', areaId: 'a4', day: heuteI, date: heuteKey,
      repeat: 'none', start: 20 * 60, end: 21 * 60, frog: false, grund: 'Testgrund ohne Ort' };
    state.blocks.push(bOhneOrt);

    // a7 (Alltag), grob, mit Grund -> Agenda soll den Grund zeigen. Abschnitt
    // "ab" (17:00-24:00), damit er trotz 18:00 Uhr noch als "danach" gilt.
    const bGrob = { id: uid(), title: 'Aufräumen', areaId: 'a7', day: heuteI, date: heuteKey,
      repeat: 'none', grob: true, teil: 'ab', dauer: 45, frog: false, grund: 'Testgrund grob' };
    state.blocks.push(bGrob);

    save(); setView('heute'); renderAgenda();

    const rows = [...document.querySelectorAll('.agenda__row')];
    const gelesen = rows.map(r => ({
      titel: (r.querySelector('.agenda__title') || {}).textContent,
      subAnzahl: r.querySelectorAll('.agenda__sub').length,
      sub: (r.querySelector('.agenda__sub') || {}).textContent || null
    }));
    return { ids: { mitOrt: bMitOrt.id, ohneOrt: bOhneOrt.id, grob: bGrob.id }, gelesen };
  });
  console.log(JSON.stringify(a.gelesen, null, 1));

  const zMitOrt = a.gelesen.find(r => r.titel === 'Sport');
  const zOhneOrt = a.gelesen.find(r => r.titel === 'Hobby');
  const zGrob = a.gelesen.find(r => r.titel === 'Aufräumen');
  ok(!!zMitOrt && zMitOrt.sub === 'Sportstudio', 'a) Eintrag mit Ort zeigt den Ort, nicht den Grund (' + JSON.stringify(zMitOrt) + ')');
  ok(!!zOhneOrt && zOhneOrt.sub === 'Testgrund ohne Ort', 'a) Eintrag ohne Ort zeigt den Grund (' + JSON.stringify(zOhneOrt) + ')');
  ok(!!zGrob && zGrob.sub === 'Testgrund grob', 'a) grober Eintrag zeigt den Grund (' + JSON.stringify(zGrob) + ')');
  ok(a.gelesen.every(r => r.subAnzahl <= 1), 'a) kein Eintrag zeigt zwei Unterzeilen (' + JSON.stringify(a.gelesen.map(r => r.subAnzahl)) + ')');

  // Der Grund des Eintrags mit Ort bleibt im Block-Blatt lesbar.
  const blattTxt = await p.evaluate((id) => {
    const b = state.blocks.find(x => x.id === id);
    blockSheet({ ...b }, b.date);
    const s = document.querySelector('.sheet');
    const txt = s ? s.textContent : null;
    closeModal();
    return txt;
  }, a.ids.mitOrt);
  ok(!!blattTxt && blattTxt.includes('Testgrund mit Ort'), 'a) der Grund eines Eintrags mit Ort ist im Block-Blatt abrufbar');

  // ==============================================================
  // b) + c) + d) Wochenstart: Anker-Chips, "Spaeter" in Schritt 1, Kennzahl
  // ==============================================================
  console.log('\n=== b)+c)+d) Wochenstart ===');
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    state.blocks = [];
    const mon = mondayOf(anchor);

    // d) Kennzahl: drei Ziele, zwei mit Platz (einer echt, einer per
    // Vorschlag), eines ohne — erwartet "2 von 3".
    const sport = state.areas.find(x => x.id === 'a3'); sport.plan.goal = 2;   // 120 min
    const hobby = state.areas.find(x => x.id === 'a4'); hobby.plan.goal = 2;   // 120 min
    const freizeit = state.areas.find(x => x.id === 'a5'); freizeit.plan.goal = 2; // 120 min, bleibt offen

    state.blocks.push({ id: uid(), title: 'Sport', areaId: 'a3', day: 0, date: iso(mon),
      repeat: 'none', start: 9 * 60, end: 11 * 60, frog: false });
    state.blocks.push({ id: uid(), title: 'Hobby', areaId: 'a4', day: 1, date: iso(addDays(mon, 1)),
      repeat: 'none', start: 9 * 60, end: 11 * 60, frog: false, sug: true, grund: 'Testvorschlag' });

    save(); renderAll();
  });

  // Schritt 1: "Spaeter" schliesst, ohne state.rituale zu setzen.
  const c1 = await p.evaluate(() => {
    ritualSheet();
    const s = document.querySelector('.sheet');
    const foot = s.querySelector('.sheet__foot');
    const btns = [...foot.querySelectorAll('button')].map(b => b.textContent);
    return { titel: s.querySelector('.sheet__title').textContent, btns, ritualeVorher: Object.keys(state.rituale).length };
  });
  console.log('Schritt 1 Fuss:', JSON.stringify(c1));
  ok(c1.btns.includes('Später'), 'c) Schritt 1 hat einen "Später"-Knopf (' + JSON.stringify(c1.btns) + ')');
  ok(!c1.btns.includes('Zurück'), 'c) Schritt 1 hat kein "Zurück" (bestaetigt Auftragsannahme)');

  await p.click('.sheet__foot button:has-text("Später")');
  await p.waitForTimeout(200);
  const c2 = await p.evaluate(() => ({
    offen: !!document.querySelector('.sheet'),
    rituale: Object.keys(state.rituale).length
  }));
  console.log('Nach "Später":', JSON.stringify(c2));
  ok(!c2.offen, 'c) "Später" schliesst das Blatt');
  ok(c2.rituale === c1.ritualeVorher, 'c) "Später" setzt state.rituale nicht (' + c1.ritualeVorher + ' -> ' + c2.rituale + ')');

  // Frisch oeffnen und zu Schritt 2 (Ziele/Anker) weiterklicken.
  await p.evaluate(() => ritualSheet());
  await p.click('.sheet__foot button:has-text("Weiter")');
  await p.waitForTimeout(200);

  const b1 = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.zielrow')];
    const sportRow = rows.find(r => r.textContent.includes('Sport'));
    const anker = sportRow ? sportRow.nextElementSibling : null;
    const chips = anker && anker.classList.contains('zielanker')
      ? [...anker.querySelectorAll('.chip')].map(c => c.textContent) : null;
    return { titel: document.querySelector('.sheet__title').textContent, chips };
  });
  console.log('Schritt 2 Anker-Chips (Sport):', JSON.stringify(b1));
  ok(b1.titel === 'Was nimmst du dir vor?', 'b) Schritt 2 zeigt den erwarteten Titel');
  ok(Array.isArray(b1.chips) && b1.chips.length === 4, 'b) Sport hat genau vier Anker-Chips (' + JSON.stringify(b1.chips) + ')');
  ok(!!b1.chips && b1.chips.includes('Nach der Arbeit') && b1.chips.includes('Morgens') &&
     b1.chips.includes('Abends') && b1.chips.includes('Egal'),
     'b) die vier Chips heissen wie erwartet (' + JSON.stringify(b1.chips) + ')');

  // Klick auf "Morgens" -> area.regeln.anker.tageszeit === "morgen".
  await p.click('.zielrow:has-text("Sport") + .zielanker button:has-text("Morgens")');
  await p.waitForTimeout(150);
  const b2 = await p.evaluate(() => {
    const a = state.areas.find(x => x.id === 'a3');
    return a.regeln && a.regeln.anker;
  });
  console.log('Nach "Morgens":', JSON.stringify(b2));
  ok(!!b2 && b2.tageszeit === 'morgen', 'b) "Morgens" landet in area.regeln.anker (' + JSON.stringify(b2) + ')');

  // Klick auf "Nach der Arbeit" -> ref-basierter Anker auf a1.
  await p.click('.zielrow:has-text("Sport") + .zielanker button:has-text("Nach der Arbeit")');
  await p.waitForTimeout(150);
  const b3 = await p.evaluate(() => {
    const a = state.areas.find(x => x.id === 'a3');
    return a.regeln && a.regeln.anker;
  });
  console.log('Nach "Nach der Arbeit":', JSON.stringify(b3));
  ok(!!b3 && b3.ref === 'a1', 'b) "Nach der Arbeit" landet als ref-Anker auf Arbeit (' + JSON.stringify(b3) + ')');

  // d) Kennzahl in Schritt 3.
  await p.click('.sheet__foot button:has-text("Weiter")');
  await p.waitForTimeout(200);
  const d1 = await p.evaluate(() => ({
    titel: document.querySelector('.sheet__title').textContent,
    lead: document.querySelector('.ritual__lead').textContent
  }));
  console.log('Schritt 3 Kennzahl:', JSON.stringify(d1));
  ok(/^2 von 3\b/.test(d1.lead), 'd) Kennzahl nennt "2 von 3" (' + JSON.stringify(d1.lead) + ')');
  ok(!/offen/.test(d1.lead), 'd) "offen" kommt in der Kennzahl nicht mehr vor (' + JSON.stringify(d1.lead) + ')');
  ok(/hat einen Platz/.test(d1.lead), 'd) Formulierung "hat einen Platz" (' + JSON.stringify(d1.lead) + ')');
  await p.evaluate(() => closeModal());

  // ==============================================================
  // e) Tagesabschluss
  // ==============================================================
  console.log('\n=== e) Tagesabschluss ===');
  // Vor Feierabend: dayEnd 20:00, Uhrzeit 18:00 -> darf NICHT erscheinen.
  const eVorher = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 20;
    state.settings.sleep = { on: false };
    anchor = new Date();
    state.days = {};
    const heuteKey = iso(anchor);
    const heuteI = (anchor.getDay() + 6) % 7;
    state.blocks = [{ id: uid(), title: 'Nicht erledigt', areaId: 'a3', day: heuteI, date: heuteKey,
      repeat: 'none', start: 9 * 60, end: 10 * 60, frog: false }];
    save(); setView('heute'); renderAgenda();
    return {
      abschnitt: !!document.querySelector('.abschlussliste'),
      label: [...document.querySelectorAll('.agenda__label')].some(x => x.textContent === 'Tagesabschluss')
    };
  });
  console.log('Vor Feierabend (dayEnd 20, jetzt 18:00):', JSON.stringify(eVorher));
  ok(!eVorher.abschnitt && !eVorher.label, 'e) vor der Feierabendzeit erscheint kein Tagesabschluss');

  // Nach Feierabend: dayEnd 17:00, Uhrzeit weiterhin 18:00 -> MUSS erscheinen.
  const eSetup = await p.evaluate(() => {
    state.settings.dayEnd = 17;
    const vorher = JSON.parse(JSON.stringify(state.blocks.map(b => ({ id: b.id, date: b.date, start: b.start }))));
    save(); renderAgenda();
    const rows = [...document.querySelectorAll('.abschlussrow')];
    return {
      abschnitt: !!document.querySelector('.abschlussliste'),
      zeilen: rows.length,
      aktionen: rows.map(r => [...r.querySelectorAll('[data-abschluss]')].map(b => b.dataset.abschluss)),
      ausblendKnopf: !!document.getElementById('abschlussWeg'),
      vorher
    };
  });
  console.log('Nach Feierabend (dayEnd 17, jetzt 18:00):', JSON.stringify(eSetup));
  ok(eSetup.abschnitt, 'e) ab der Feierabendzeit erscheint der Tagesabschluss');
  ok(eSetup.zeilen === 1, 'e) genau der eine offene Eintrag erscheint (' + eSetup.zeilen + ')');
  ok(eSetup.aktionen.every(a => a.length === 3 && a.includes('ab') && a.includes('schieben') && a.includes('aufgabe')),
    'e) jede Zeile hat genau drei Aktionen — Abhaken/Schieben/Zu Aufgaben (' + JSON.stringify(eSetup.aktionen) + ')');
  ok(eSetup.ausblendKnopf, 'e) es gibt einen Knopf zum Ausblenden');

  // Nichts wurde durch das blosse Erscheinen von selbst verschoben.
  const eUnveraendert = await p.evaluate((vorher) => {
    return vorher.every(v => {
      const b = state.blocks.find(x => x.id === v.id);
      return b && b.date === v.date && b.start === v.start;
    });
  }, eSetup.vorher);
  ok(eUnveraendert, 'e) der Tagesabschluss verschiebt beim Erscheinen nichts von selbst');

  // "Für heute ausblenden" — bleibt auch nach einem erneuten renderAgenda() weg.
  await p.click('#abschlussWeg');
  await p.waitForTimeout(150);
  const eWeg1 = await p.evaluate(() => !!document.querySelector('.abschlussliste'));
  await p.evaluate(() => renderAgenda());
  const eWeg2 = await p.evaluate(() => !!document.querySelector('.abschlussliste'));
  console.log('Nach "Für heute ausblenden":', JSON.stringify({ eWeg1, eWeg2 }));
  ok(!eWeg1, 'e) "Für heute ausblenden" blendet den Abschnitt sofort aus');
  ok(!eWeg2, 'e) bleibt auch nach einem erneuten renderAgenda() weg');

  // ==============================================================
  // f) "×" schaltet Vorschlaege dauerhaft ab — auch nach migrate()
  // ==============================================================
  console.log('\n=== f) Kein-Vorschlag ueberlebt migrate() ===');
  const f1 = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: true, from: 22 * 60 + 30, to: 6 * 60 + 30, wind: 30 };
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    const sport = state.areas.find(x => x.id === 'a3');
    sport.plan.goal = 4; sport.plan.must = true;
    save(); renderAll();
    clearSuggestions();
    buildSuggestions();
    const vor = state.blocks.filter(b => b.sug && b.areaId === 'a3').length;

    // "×" im Vorschlags-Blatt klicken (echter UI-Weg, kein direktes Setzen).
    const b = state.blocks.find(x => x.sug && x.areaId === 'a3');
    sugSheet(b);
    return { vor, hatSugSheet: !!document.getElementById('sugAusBereich') };
  });
  console.log('Vor "×":', JSON.stringify(f1));
  ok(f1.vor > 0, 'f) Voraussetzung: es gibt zunaechst Sport-Vorschlaege (' + f1.vor + ')');
  ok(f1.hatSugSheet, 'f) das Vorschlags-Blatt hat den "×"-Knopf');

  await p.click('#sugAusBereich');
  await p.waitForTimeout(200);
  const f2 = await p.evaluate(() => {
    const sport = state.areas.find(x => x.id === 'a3');
    return { keinVorschlag: sport.plan.keinVorschlag, sugDanach: state.blocks.filter(b => b.sug && b.areaId === 'a3').length };
  });
  console.log('Nach "×":', JSON.stringify(f2));
  ok(f2.keinVorschlag === true, 'f) "×" setzt area.plan.keinVorschlag');
  ok(f2.sugDanach === 0, 'f) "×" entfernt bestehende Sport-Vorschlaege sofort (' + f2.sugDanach + ')');

  // migrate() ueberlebt: Feld bleibt gesetzt.
  const f3 = await p.evaluate(() => {
    migrate(state);
    const sport = state.areas.find(x => x.id === 'a3');
    return sport.plan.keinVorschlag;
  });
  ok(f3 === true, 'f) plan.keinVorschlag ueberlebt migrate() (' + f3 + ')');

  // Naechstes Verteilen: kein Sport-Vorschlag taucht wieder auf.
  const f4 = await p.evaluate(() => {
    clearSuggestions();
    buildSuggestions();
    return state.blocks.filter(b => b.sug && b.areaId === 'a3').length;
  });
  console.log('Nach erneutem Verteilen:', f4);
  ok(f4 === 0, 'f) beim naechsten Verteilen entsteht kein neuer Sport-Vorschlag (' + f4 + ')');

  // Auch ein per Migration frisch geladener alter Stand haelt das Feld,
  // wenn es vorher schon gesetzt war (Migrationspfad statt Live-Zustand).
  const f5 = await p.evaluate(() => {
    const roh = JSON.parse(JSON.stringify(state));
    roh.areas.find(x => x.id === 'a3').plan.keinVorschlag = true;
    migrate(roh);
    return roh.areas.find(x => x.id === 'a3').plan.keinVorschlag;
  });
  ok(f5 === true, 'f) plan.keinVorschlag ueberlebt migrate() auch bei einem frisch geladenen Stand (' + f5 + ')');

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
