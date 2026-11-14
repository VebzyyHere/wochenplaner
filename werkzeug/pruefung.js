/* ============================================================
   Pruefskript Nutzerpruefung 2026-11 — kleine Korrekturen und zwei
   neue Handgriffe aus der Pruefung aus sechs Blickwinkeln:

   a) Tagesband: heute UND gewaehlt in einer Woche ohne freien Tag — das
      Kuerzel liegt unter dem inneren Ring, der Auslastungsstrich ueber der
      Lippe, und das Band wird dadurch nicht hoeher.
   b) Lange Woerter: der Titel der Laufend-Karte bricht um statt abgeschnitten.
   c) #weekLabel nennt die Woche im zugaenglichen Namen (WCAG 2.5.3).
   d) Kopieren im Eintrags-Editor: oeffnet einen NEUEN Eintrag, vorausgefuellt;
      Aufgaben-Verknuepfung, Schwerpunkt und Abhaken wandern nicht mit;
      erst „Eintragen" speichert.
   e) Schnelleingabe Aufgaben: „30 min", „1,5 h", „#Bereich" setzen Dauer und
      Bereich; Unklares bleibt im Titel; reiner Code ohne Treffer bleibt Titel.
   f) keine Konsolenfehler.

   Feste Uhr: Mittwoch 2026-11-18, 09:30 Europe/Berlin.
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

  await p.clock.setFixedTime(new Date('2026-11-18T09:30:00+01:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });

  const basis = (bloecke = []) => p.evaluate(bl => {
    state = freshState(); migrate(state);
    state.profile.name = 'Test';
    state.blocks = bl; state.tasks = [];
    anchor = new Date(); selectedDayIdx = 2;
    save(); setView('heute'); renderAll();
  }, bloecke);
  const zu = async () => { await p.evaluate(() => closeModal()); await p.waitForTimeout(150); };

  // ============================================================== a)
  console.log('=== a) Tagesband: heute und gewaehlt ===');
  await basis();
  await p.waitForTimeout(300);
  const a = await p.evaluate(() => {
    const b = document.querySelector('.dayswitch__band .is-today');
    const r = s => b.querySelector(s).getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const nachbar = document.querySelector('.dayswitch__band .is-woche:not(.is-today)').getBoundingClientRect();
    return { gedrueckt: b.getAttribute('aria-pressed'), top: rb.top, bottom: rb.bottom, h: rb.height,
      span: r('span').top, bar: r('i').bottom, nachbarH: nachbar.height,
      band: document.querySelector('.dayswitch').getBoundingClientRect().height };
  });
  ok(a.gedrueckt === 'true', 'a1) heutiger Tag ist gewaehlt');
  ok(a.span - a.top >= 4.5, 'a2) Kuerzel beginnt unter dem 4-px-Ring (Abstand ' + (a.span - a.top).toFixed(1) + ' px)');
  ok(a.bottom - a.bar >= 6, 'a3) Auslastungsstrich endet ueber der 6-px-Lippe (Abstand ' + (a.bottom - a.bar).toFixed(1) + ' px)');
  ok(Math.abs(a.h - a.nachbarH) < 0.5 && a.h <= 46.5, 'a4) Pille nicht hoeher als die Nachbarn (' + a.h + ' / ' + a.nachbarH + ' px)');
  await p.screenshot({ path: path.join(__dirname, 'pruefung-band.png'), clip: { x: 0, y: 40, width: 390, height: 80 } });

  // ============================================================== b)
  console.log('=== b) Lange Woerter ===');
  await basis([{ id: 'lang', title: 'Bachelorarbeitsbetreuungsgespräch', areaId: 'a1', day: 2, date: '2026-11-18', repeat: 'none', start: 540, end: 660 }]);
  await p.setViewportSize({ width: 320, height: 640 });
  await p.waitForTimeout(300);
  const b = await p.evaluate(() => {
    const t = document.querySelector('.agenda__hero-title');
    return t ? { sw: t.scrollWidth, cw: t.clientWidth, rechts: t.getBoundingClientRect().right, text: t.textContent } : null;
  });
  ok(!!b, 'b1) Laufend-Karte zeigt den Termin (' + (b && b.text) + ')');
  ok(b && b.sw <= b.cw + 1 && b.rechts <= 320, 'b2) Titel passt in die Karte (scrollWidth ' + (b && b.sw) + ' / ' + (b && b.cw) + ')');
  await p.screenshot({ path: path.join(__dirname, 'pruefung-lang.png') });
  await p.setViewportSize({ width: 390, height: 844 });

  // ============================================================== c)
  console.log('=== c) Wochen-Knopf nennt die Woche ===');
  const c = await p.evaluate(() => ({ name: document.querySelector('#weekLabel').getAttribute('aria-label'), text: document.querySelector('#weekLabel').textContent }));
  ok(/^KW 47 · 16\.11\.–22\.11\. — Wochenübersicht anzeigen$/.test(c.name), 'c1) aria-label = sichtbarer Text + Zweck (' + c.name + ')');
  ok(c.name.includes(c.text.replace(/\s+/g, ' ').trim().slice(0, 5)), 'c2) sichtbarer Text steckt im Namen (' + c.text + ')');

  // ============================================================== d)
  console.log('=== d) Kopieren im Editor ===');
  await basis([{ id: 'v1', title: 'Vorlesung Statistik', areaId: 'a2', day: 0, date: '2026-11-16', repeat: 'weekly', since: '2026-11-16', start: 600, end: 720, ort: 'Hörsaal 3', notiz: 'Skript mitnehmen', frog: true, taskId: 't1', erledigt: { '2026-11-16': true } }]);
  await p.evaluate(() => { state.tasks = [{ id: 't1', title: 'Vorlesung Statistik', areaId: 'a2', done: false, geplant: 'v1' }]; save(); editBlock('v1', '2026-11-16'); });
  await p.waitForTimeout(250);
  const knoepfe = await p.$$eval('.sheet button', bs => bs.map(x => x.textContent));
  ok(knoepfe.includes('Kopieren'), 'd1) Editor zeigt „Kopieren" (' + knoepfe.join(' | ') + ')');
  await p.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); });
  await p.screenshot({ path: path.join(__dirname, 'pruefung-kopieren.png') });
  const fussPasst = await p.evaluate(() => { const bs = [...document.querySelectorAll('.sheet__foot button, #bKopie')]; const zeilen = new Set([...document.querySelectorAll('.sheet__foot button')].map(x => Math.round(x.getBoundingClientRect().top))); return zeilen.size <= 2 && bs.every(x => { const r = x.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && x.scrollWidth <= x.clientWidth + 1; }); });
  ok(fussPasst, 'd2) alle Fussknoepfe passen auf 390 px, Fuss hat hoechstens zwei Zeilen');
  await p.click('#bKopie');
  await p.waitForTimeout(300);
  const d = await p.evaluate(() => ({
    titel: (document.querySelector('.sheet__title') || {}).textContent,
    was: document.querySelector('#bTitle').value,
    von: document.querySelector('#bFrom').value, bis: document.querySelector('#bTo').value,
    anzahl: state.blocks.length
  }));
  ok(d.titel === 'Neuer Eintrag', 'd3) Kopie oeffnet als neuer Eintrag (' + d.titel + ')');
  ok(d.was === 'Vorlesung Statistik' && d.von === '10:00' && d.bis === '12:00', 'd4) Titel und Zeit vorausgefuellt (' + [d.was, d.von, d.bis].join(' ') + ')');
  ok(d.anzahl === 1, 'd5) noch nichts gespeichert (' + d.anzahl + ' Block)');
  // Anderen Tag waehlen: Donnerstag statt Montag.
  await p.click('#bDays button:text-is("Do")');
  await p.click('#bDays button:text-is("Mo")');
  await p.click('.sheet .btn--primary');
  await p.waitForTimeout(250);
  const d2 = await p.evaluate(() => {
    const neu = state.blocks.find(b => b.id !== 'v1');
    const alt = state.blocks.find(b => b.id === 'v1');
    return { neu, alt, task: state.tasks[0], anzahl: state.blocks.length };
  });
  ok(!!d2.neu && d2.anzahl === 2 && d2.neu.day === 3 && d2.neu.start === 600 && d2.neu.end === 720, 'd6) Kopie liegt Do 10–12 (' + JSON.stringify(d2.neu && { day: d2.neu.day, s: d2.neu.start, e: d2.neu.end }) + ')');
  ok(d2.neu && d2.neu.repeat === 'weekly' && d2.neu.ort === 'Hörsaal 3' && d2.neu.notiz === 'Skript mitnehmen', 'd7) Rhythmus, Ort und Notiz kopiert');
  ok(d2.neu && !d2.neu.taskId && !d2.neu.frog && !d2.neu.erledigt, 'd8) Aufgabe, Schwerpunkt und Haken NICHT kopiert');
  ok(d2.alt && d2.alt.taskId === 't1' && d2.task.geplant === 'v1', 'd9) Original und seine Aufgabe unveraendert');

  // ============================================================== e)
  console.log('=== e) Schnelleingabe Aufgaben ===');
  await basis();
  const faelle = await p.evaluate(() => [
    'Einkaufen 30 min #Alltag', 'Hausarbeit gliedern 1,5 h #uni', 'Laufen 45min', 'Steuer 2 Std.',
    'Kapitel 3 lesen', '#sport', 'Treffen #gibtsnicht', 'Raum 101 putzen', 'Sport 3h #Sport'
  ].map(t => ({ t, e: aufgabeAusEingabe(t), areas: state.areas.map(a => [a.id, a.name]) })));
  const name = id => (faelle[0].areas.find(a => a[0] === id) || [])[1];
  const f = i => faelle[i].e;
  ok(f(0).title === 'Einkaufen' && f(0).dauer === 30 && /Alltag/.test(name(f(0).areaId) || ''), 'e1) „Einkaufen 30 min #Alltag" (' + JSON.stringify(f(0)) + ')');
  ok(f(1).title === 'Hausarbeit gliedern' && f(1).dauer === 90 && /^Uni/.test(name(f(1).areaId) || ''), 'e2) „1,5 h #uni" = 90 min, Uni-Bereich (' + JSON.stringify(f(1)) + ')');
  ok(f(2).title === 'Laufen' && f(2).dauer === 45, 'e3) „45min" ohne Leerzeichen');
  ok(f(3).title === 'Steuer' && f(3).dauer === 120, 'e4) „2 Std." = 120 min');
  ok(f(4).title === 'Kapitel 3 lesen' && !f(4).dauer && !f(4).areaId, 'e5) Zahl ohne Einheit bleibt Titel');
  ok(f(5).title === '#sport' && !f(5).areaId, 'e6) nur ein Bereich ohne Titel bleibt als Titel stehen');
  ok(f(6).title === 'Treffen #gibtsnicht' && !f(6).areaId, 'e7) unbekannter Bereich bleibt im Titel');
  ok(f(7).title === 'Raum 101 putzen' && !f(7).dauer, 'e8) „Raum 101" ist keine Dauer');
  ok(f(8).title === 'Sport' && f(8).dauer === 180, 'e9) „3h #Sport" (' + JSON.stringify(f(8)) + ')');
  // Echter Weg ueber das Formular.
  await p.evaluate(() => setView('aufgaben'));
  await p.fill('#taskInput', 'Einkaufen 30 min #Alltag');
  await p.press('#taskInput', 'Enter');
  await p.waitForTimeout(250);
  const e = await p.evaluate(() => ({ t: state.tasks[0], toast: [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' / '), liste: document.querySelector('#taskList').textContent }));
  ok(e.t.title === 'Einkaufen' && e.t.dauer === 30, 'e10) Formular legt „Einkaufen" mit 30 min an');
  ok(/Alltag/.test(e.toast) && /30 min/.test(e.toast), 'e11) Hinweis nennt, was erkannt wurde (' + e.toast + ')');
  ok(/30 min/.test(e.liste), 'e12) Liste zeigt die Dauer');
  await p.fill('#taskInput', 'Wäsche');
  await p.press('#taskInput', 'Enter');
  await p.waitForTimeout(250);
  const e2 = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' / '));
  ok(/Tipp/.test(e2), 'e13) beim ersten Eintrag ohne Treffer ein Tipp (' + e2 + ')');

  // ============================================================== f)
  console.log('=== f) Konsole ===');
  ok(konsolenfehler.length === 0, 'f1) keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));

  await br.close();
  console.log(fehler.length ? '\nROT: ' + fehler.length + ' Zusicherung(en) verletzt' : '\nGRUEN: alles erfuellt');
  process.exit(fehler.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
