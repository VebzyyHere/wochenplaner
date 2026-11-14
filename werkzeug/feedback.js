/* ============================================================
   Pruefskript Feedback (Nutzer-Feedback 2026-11) — fuenf Wuensche im
   Eintrags-Editor (blockSheet) und im Aufgabenblatt (taskSheet):

   a) Ganztaegig: dritter Chip unter „Wie genau?". Ergibt einen groben Block
      mit ganztag:true und dauer 0 — zaehlt nicht als verplante Zeit
      (tagesAuslastung), steht im Band als Zeile „Ganzt." und in der Agenda
      als „ganztaegig", im Kalender-Export als VALUE=DATE.
   b) Notizen: Textfeld in Termin und Aufgabe, gespeichert als notiz,
      leer = Feld entfernt; Agenda zeigt die erste Zeile, wenn sonst keine
      Unterzeile da ist; Export als DESCRIPTION.
   c) Orte ohne Anlegen: freier Text landet in b.ort (state.orte bleibt
      unberuehrt); ein gemerkter Ortsname wird zur ortId; „Als Ort merken"
      legt ihn auf Wunsch doch an.
   d) „Morgens" als ungefaehre Zeit: der Abschnitt vm heisst jetzt morgens.
   e) Ueber Mitternacht: Bis vor Von ergibt zwei verbundene Bloecke (bis 24:00
      und ab 0:00 am Folgetag), der Editor zeigt sie als einen Termin,
      Aendern/Kuerzen/Loeschen ziehen den zweiten Teil mit; Serien am Sonntag
      laufen in den Montag; Export als ein Termin.
   f) migrate() laesst alles stehen und ist idempotent; keine Konsolenfehler.

   Feste Uhr: Mittwoch 2026-08-05, 10:00 Europe/Berlin.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Berlin', locale: 'de-DE', hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });

  const basis = () => p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 23;
    state.orte = [{ id: 'o-uni', name: 'Uni' }];
    state.blocks = []; state.tasks = [];
    anchor = new Date(); selectedDayIdx = 2;
    save(); setView('heute'); renderAll();
  });
  const neu = (tag, von, bis) => p.evaluate(([t, v, b]) => { newBlock(t, iso(addDays(mondayOf(anchor), t)), v, b); }, [tag, von, bis]);
  const chip = name => p.click(`.sheet button.chip:text-is("${name}")`);
  const eintragen = () => p.click('.sheet .btn--primary');
  // Bild fuer die Sichtpruefung: Toasts weg, das genannte Feld in die Mitte.
  const bild = async (name, sel) => {
    await p.evaluate(s => { document.querySelectorAll('.toast').forEach(t => t.remove());
      const el = document.querySelector(s); if (el) el.scrollIntoView({ block: 'center' }); }, sel);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(__dirname, name) });
  };
  const zu = async () => { await p.evaluate(() => closeModal()); await p.waitForTimeout(150); };

  // ============================================================== a)
  console.log('=== a) ganztaegig ===');
  await basis();
  await neu(2, 600, 660);
  await p.fill('#bTitle', 'Geburtstag Oma');
  await chip('Ganztägig');
  ok(await p.isHidden('#bZeitRow') && await p.isHidden('#bGrobRow'), 'a1) Ganztaegig blendet Uhrzeit und Abschnitt aus');
  await bild('feedback-ganztag.png', '#bGenau');
  await eintragen();
  await p.waitForTimeout(200);
  const a = await p.evaluate(() => {
    const b = state.blocks[0];
    const tag = { key: b.date, i: b.day };
    return { b, last: tagesAuslastung(tag).min, agenda: document.querySelector('#agenda') ? document.querySelector('#agenda').textContent : document.body.textContent,
      ics: kalenderIcs() };
  });
  ok(a.b.ganztag === true && a.b.grob === true && a.b.dauer === 0, 'a2) Block ist ganztag+grob mit Dauer 0 (' + JSON.stringify({ g: a.b.ganztag, d: a.b.dauer }) + ')');
  ok(a.last === 0, 'a3) zaehlt nicht als verplante Zeit (tagesAuslastung ' + a.last + ')');
  ok(/Geburtstag Oma\s*ganztägig/.test(a.agenda), 'a4) Agenda zeigt „ganztaegig"');
  ok(/DTSTART;VALUE=DATE:20260805/.test(a.ics) && /DTEND;VALUE=DATE:20260806/.test(a.ics), 'a5) Export als ganztaegiger Termin');
  await p.evaluate(() => { setView('plan'); renderAll(); });
  await p.waitForTimeout(200);
  const band = await p.evaluate(() => [...document.querySelectorAll('#looseBand .loose__lab')].map(x => x.textContent));
  ok(band[0] === 'Ganztags', 'a6) Band zeigt die Zeile „Ganztags" oben (' + band.join(',') + ')');
  await bild('feedback-band.png', '#looseBand');
  await p.evaluate(() => { const b = state.blocks[0]; blockSheet({ ...b }, b.date); });
  ok(await p.getAttribute('.sheet button.chip:text-is("Ganztägig")', 'aria-pressed') === 'true', 'a7) Wieder geoeffnet: Ganztaegig ist gewaehlt');
  await zu();

  // ============================================================== b)
  console.log('=== b) Notizen ===');
  await basis();
  await neu(2, 14 * 60, 15 * 60);
  await p.fill('#bTitle', 'Seminar');
  await p.fill('#bNotiz', 'Raum 2.14\nSkript mitnehmen');
  await eintragen();
  await p.waitForTimeout(200);
  const b1 = await p.evaluate(() => ({ n: state.blocks[0].notiz, txt: document.body.textContent, ics: kalenderIcs() }));
  ok(b1.n === 'Raum 2.14\nSkript mitnehmen', 'b1) Notiz am Termin gespeichert');
  ok(b1.txt.includes('Raum 2.14') && !b1.txt.includes('Skript mitnehmen'), 'b2) Agenda zeigt nur die erste Zeile');
  ok(/DESCRIPTION:Raum 2\.14\\nSkript mitnehmen/.test(b1.ics), 'b3) Export als DESCRIPTION');
  await p.evaluate(() => { const b = state.blocks[0]; blockSheet({ ...b }, b.date); });
  ok(await p.inputValue('#bNotiz') === 'Raum 2.14\nSkript mitnehmen', 'b4) Wieder geoeffnet: Notiz steht im Feld');
  await bild('feedback-notiz.png', '#bNotiz');
  await p.fill('#bNotiz', '   ');
  await eintragen();
  ok(await p.evaluate(() => !('notiz' in state.blocks[0])), 'b5) Leere Notiz entfernt das Feld');
  await p.evaluate(() => { state.tasks = [{ id: 't1', title: 'Hausarbeit', areaId: state.areas[0].id, done: false, frog: false }]; taskSheet(state.tasks[0]); });
  await p.fill('#tkNotiz', 'Quellen: Bib-Katalog');
  await p.click('.sheet .btn--primary');
  ok(await p.evaluate(() => state.tasks[0].notiz === 'Quellen: Bib-Katalog'), 'b6) Notiz an der Aufgabe gespeichert');
  await p.evaluate(() => taskSheet(state.tasks[0]));
  ok(await p.inputValue('#tkNotiz') === 'Quellen: Bib-Katalog', 'b7) Aufgabe wieder geoeffnet: Notiz steht im Feld');
  await zu();

  // ============================================================== c)
  console.log('=== c) Orte ohne Anlegen ===');
  await basis();
  await neu(2, 16 * 60, 17 * 60);
  await p.fill('#bTitle', 'Kaffee mit Lena');
  await p.fill('#bOrt', 'Café Lotte');
  ok(await p.isVisible('#bOrtMerken'), 'c1) Freier Ort bietet „Als Ort merken" an');
  await bild('feedback-ort.png', '#bOrt');
  await eintragen();
  await p.waitForTimeout(200);
  const c1 = await p.evaluate(() => ({ b: state.blocks[0], orte: state.orte.length, txt: document.body.textContent }));
  ok(c1.b.ort === 'Café Lotte' && !c1.b.ortId && c1.orte === 1, 'c2) Freier Ort als Text, nichts angelegt (' + JSON.stringify({ ort: c1.b.ort, ortId: c1.b.ortId, orte: c1.orte }) + ')');
  ok(c1.txt.includes('Café Lotte'), 'c3) Agenda zeigt den freien Ort');
  await neu(2, 12 * 60, 13 * 60);
  await p.fill('#bTitle', 'Vorlesung');
  await p.fill('#bOrt', 'uni');
  ok(await p.getAttribute('.sheet #bOrte button.chip:text-is("Uni")', 'aria-pressed') === 'true', 'c4) Getippter Name markiert den gemerkten Ort');
  await eintragen();
  const c2 = await p.evaluate(() => state.blocks.find(b => b.title === 'Vorlesung'));
  ok(c2.ortId === 'o-uni' && !c2.ort, 'c5) Gemerkter Ort wird zur ortId');
  await neu(2, 18 * 60, 19 * 60);
  await p.fill('#bTitle', 'Training');
  await p.fill('#bOrt', 'Halle Nord');
  await p.click('#bOrtMerken');
  await eintragen();
  const c3 = await p.evaluate(() => ({ b: state.blocks.find(b => b.title === 'Training'), orte: state.orte.map(o => o.name) }));
  ok(c3.orte.includes('Halle Nord') && c3.b.ortId && !c3.b.ort, 'c6) „Als Ort merken" legt den Ort an und verknuepft ihn');

  // ============================================================== d)
  console.log('=== d) Morgens ===');
  await basis();
  await neu(2, 8 * 60, 9 * 60);
  await p.fill('#bTitle', 'Laufen');
  await chip('Ungefähr');
  ok(await p.isVisible('.sheet button.chip:text-is("Morgens")'), 'd1) Chip „Morgens" unter „Wann ungefaehr?"');
  ok(await p.getAttribute('.sheet button.chip:text-is("Morgens")', 'aria-pressed') === 'true', 'd2) 8 Uhr ergibt vorgewaehlt „Morgens"');
  await bild('feedback-morgens.png', '#bTeil');
  await eintragen();
  await p.waitForTimeout(200);
  const d = await p.evaluate(() => ({ b: state.blocks[0], txt: document.body.textContent }));
  ok(d.b.grob && d.b.teil === 'vm' && /morgens ~1 h/.test(d.txt), 'd3) Agenda zeigt „morgens ~1 h"');

  // ============================================================== e)
  console.log('=== e) ueber Mitternacht ===');
  await basis();
  await neu(2, 20 * 60, 21 * 60);
  await p.fill('#bTitle', 'Nachtschicht');
  await p.fill('#bFrom', '22:00');
  await p.fill('#bTo', '02:00');
  ok(await p.isVisible('#bNachtHint') && /nächsten Tag \(Do\) um 02:00/.test(await p.textContent('#bNachtHint')), 'e1) Hinweis „endet am naechsten Tag (Do) um 02:00"');
  ok(await p.isHidden('#bZeitError'), 'e2) Kein Fehler bei Bis vor Von');
  await bild('feedback-nacht.png', '#bNachtHint');
  await eintragen();
  await p.waitForTimeout(200);
  const e1 = await p.evaluate(() => state.blocks.map(b => ({ id: b.id, day: b.day, date: b.date, start: b.start, end: b.end, nacht: b.nacht })));
  ok(e1.length === 2 && e1[0].start === 1320 && e1[0].end === 1440 && e1[1].day === 3 && e1[1].date === '2026-08-06'
     && e1[1].start === 0 && e1[1].end === 120 && e1[0].nacht === e1[1].id && e1[1].nacht === e1[0].id,
     'e3) Zwei verbundene Bloecke Mi 22–24 und Do 0–2 (' + JSON.stringify(e1) + ')');
  const zeitTexte = await p.evaluate(() => { anchor = new Date(); selectedDayIdx = 3; setView('plan'); renderAll();
    return [...document.querySelectorAll('.block .block__time')].map(x => x.textContent); });
  ok(zeitTexte.includes('22:00–02:00'), 'e4) Block im Raster zeigt die ganze Spanne (' + zeitTexte.join(',') + ')');
  // Den zweiten Teil oeffnen: Editor zeigt den ganzen Termin.
  await p.evaluate(id => { const b = state.blocks.find(x => x.id === id); blockSheet({ ...b }, b.date); }, e1[1].id);
  ok(await p.inputValue('#bFrom') === '22:00' && await p.inputValue('#bTo') === '02:00', 'e5) Zweiter Teil geoeffnet: Editor zeigt 22:00–02:00');
  await p.fill('#bTo', '03:30');
  await eintragen();
  const e2 = await p.evaluate(() => state.blocks.map(b => ({ start: b.start, end: b.end })));
  ok(e2.length === 2 && e2[1].end === 210, 'e6) Ende geaendert: zweiter Teil zieht mit (' + JSON.stringify(e2) + ')');
  await p.evaluate(() => { const b = state.blocks[0]; blockSheet({ ...b }, b.date); });
  await p.fill('#bTo', '23:30');
  await eintragen();
  const e3 = await p.evaluate(() => state.blocks.map(b => ({ start: b.start, end: b.end, nacht: b.nacht })));
  ok(e3.length === 1 && e3[0].end === 1410 && !e3[0].nacht, 'e7) Auf 23:30 gekuerzt: zweiter Teil verschwindet (' + JSON.stringify(e3) + ')');
  await p.evaluate(() => { const b = state.blocks[0]; blockSheet({ ...b }, b.date); });
  await p.fill('#bTo', '01:00');
  await eintragen();
  ok(await p.evaluate(() => state.blocks.length === 2), 'e8) Wieder ueber Mitternacht: zweiter Teil neu angelegt');
  const ics = await p.evaluate(() => kalenderIcs());
  ok((ics.match(/BEGIN:VEVENT/g) || []).length === 1 && /DTSTART:20260805T220000/.test(ics) && /DTEND:20260806T010000/.test(ics), 'e9) Export als ein Termin 22:00 bis 01:00 am Folgetag');
  await p.evaluate(() => { const b = state.blocks[1]; blockSheet({ ...b }, b.date); });
  await p.click('.sheet .btn--danger');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => state.blocks.length === 0), 'e10) Loeschen entfernt beide Teile');
  // Woechentlich am Sonntag: zweiter Teil am Montag.
  await neu(6, 20 * 60, 21 * 60);
  await p.fill('#bTitle', 'Spaetdienst');
  await chip('Wöchentlich');
  await p.fill('#bFrom', '23:00');
  await p.fill('#bTo', '01:00');
  await eintragen();
  const e4 = await p.evaluate(() => {
    const [a, b] = state.blocks;
    const mo = addDays(mondayOf(anchor), 7);
    return { a: { day: a.day, since: a.since }, b: { day: b.day, since: b.since, repeat: b.repeat },
      naechsterMontag: onDay(b, iso(mo), 0), dieserMontag: onDay(b, iso(mondayOf(anchor)), 0) };
  });
  ok(e4.b.day === 0 && e4.b.repeat === 'weekly' && e4.naechsterMontag && !e4.dieserMontag,
     'e11) Sonntag-Serie: zweiter Teil montags ab der Folgewoche (' + JSON.stringify(e4) + ')');

  // ============================================================== f)
  console.log('=== f) migrate ===');
  const f = await p.evaluate(() => {
    state.blocks.push({ id: 'g1', title: 'Urlaub', areaId: state.areas[0].id, day: 1, date: '2026-08-04', repeat: 'none', grob: true, ganztag: true, teil: 'ab', dauer: 99, start: 0, end: 0, notiz: 'x', ort: 'Ostsee' });
    state.blocks.push({ id: 'w1', title: 'Waise', areaId: state.areas[0].id, day: 1, date: '2026-08-04', repeat: 'none', start: 0, end: 60, nacht: 'gibtsnicht', notiz: '  ', ort: 5 });
    const vorher = JSON.stringify(state.blocks);
    migrate(state);
    const einmal = JSON.stringify(state.blocks);
    migrate(state); migrate(state);
    const g = state.blocks.find(b => b.id === 'g1'), w = state.blocks.find(b => b.id === 'w1');
    return { stabil: einmal === JSON.stringify(state.blocks), g, w, paar: state.blocks.filter(b => b.nacht).length };
  });
  ok(f.stabil, 'f1) migrate() idempotent');
  ok(f.g.ganztag && f.g.dauer === 0 && f.g.teil === 'vm' && f.g.notiz === 'x' && f.g.ort === 'Ostsee', 'f2) ganztaegig, Notiz und Ort bleiben stehen');
  ok(!f.w.nacht && !('notiz' in f.w) && !('ort' in f.w), 'f3) verwaiste/ungueltige Felder werden entfernt');
  ok(f.paar === 2, 'f4) gueltiges Mitternachts-Paar bleibt verbunden');

  ok(!konsolenfehler.length, 'Keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));
  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nAlles gruen.');
  process.exit(fehler.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
