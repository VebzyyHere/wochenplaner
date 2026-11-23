/* ============================================================
   Pruefskript Schnelleingabe Termine (Studio-Entwurf 2026-11)

   a) terminAusEingabe(): Tag, Uhrzeit, Spanne, Dauer, Bereich, Wiederholung;
      Unklares bleibt Titel (Datum „3.10", Kuerzel als erstes Wort).
   b) Editor: Tippen zeigt „Erkannt: …" mit Knopf; nichts wird gespeichert.
   c) „Uebernehmen" fuellt Titel, Tage, Zeit, Bereich; erst „Eintragen" speichert
      (zwei Tage = zwei Eintraege).
   d) Enter im Titel uebernimmt statt zu speichern; ohne Erkanntes speichert Enter.
   e) Bestehender Eintrag: keine Schnelleingabe-Zeile.
   f) keine Konsolenfehler.

   Feste Uhr: Mittwoch 2026-11-18, 09:30 Europe/Berlin.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const BILD = process.env.WP_BILD;

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
  const basis = () => p.evaluate(() => {
    closeModal();
    state = freshState(); migrate(state);
    state.profile.name = 'Test'; state.blocks = []; state.tasks = [];
    anchor = new Date(); selectedDayIdx = 2;
    save(); setView('heute'); renderAll();
  });
  const neu = async () => { await p.evaluate(() => document.querySelector('#fabAdd').onclick()); await p.waitForTimeout(350); };

  console.log('=== a) Leser ===');
  await basis();
  const lies = t => p.evaluate(x => terminAusEingabe(x, { start: 600, end: 660 }), t);
  let r = await lies('Gym Do 18:30-20 #sport');
  ok(r.title === 'Gym' && r.tage.join() === '3' && r.start === 1110 && r.end === 1200 && r.areaId === 'a3', 'Tag, Spanne, Bereich: ' + JSON.stringify(r));
  r = await lies('Gym Mo Do 18:30 alle 2 Wochen');
  ok(r.tage.join() === '0,3' && r.repeat === '2wochen' && r.end - r.start === 60, 'zwei Tage, alle 2 Wochen, Laenge des Entwurfs');
  r = await lies('Vorlesung Mo–Fr 8 Uhr 90 min');
  ok(r.tage.length === 5 && r.start === 480 && r.end === 570, 'Mo–Fr, „8 Uhr", Dauer 90 min');
  r = await lies('Kaffee mit Lea morgen 15 Uhr');
  ok(r.date === '2026-11-19' && r.title === 'Kaffee mit Lea' && r.start === 900, 'morgen');
  r = await lies('Festival Sa 22:00–06:00');
  ok(r.start === 1320 && r.end === 360, 'ueber Mitternacht bleibt Bis vor Von');
  r = await lies('Zahnarzt Dienstag um 9:15');
  ok(r.tage.join() === '1' && r.start === 555 && r.title === 'Zahnarzt', 'ausgeschriebener Tag, „um"');
  r = await lies('Abgabe 3.10');
  ok(!r.erkannt.length && r.title === 'Abgabe 3.10', 'Datum mit Punkt bleibt Titel');
  r = await lies('So ein Tag');
  ok(!r.erkannt.length, 'Kuerzel als erstes Wort bleibt Titel');
  r = await lies('Einkaufen');
  ok(!r.erkannt.length, 'nichts erkannt');
  r = await lies('18:30');
  ok(!r.erkannt.length && r.title === '18:30', 'nur Uhrzeit ohne Titel bleibt Titel');

  console.log('=== b) Editor zeigt Erkanntes, speichert nichts ===');
  await neu();
  ok(await p.locator('#bSchnell').isHidden(), 'leer: Zeile verborgen');
  await p.fill('#bTitle', 'Gym Mo Do 18:30-20 #sport');
  await p.waitForTimeout(100);
  const zeile = await p.locator('#bSchnell').innerText();
  ok(/Erkannt: Mo, Do · 18:30–20:00 · Sport/.test(zeile), 'Zeile: ' + zeile.replace(/\n/g, ' | '));
  ok(await p.evaluate(() => state.blocks.length) === 0, 'noch nichts gespeichert');
  const kn = await p.locator('#bSchnellOk').boundingBox();
  ok(kn && kn.height >= 40, 'Knopf mind. 40 px hoch: ' + (kn && kn.height));
  if (BILD) await p.screenshot({ path: path.join(BILD, 'schnell-erkannt.png') });

  console.log('=== c) Uebernehmen ===');
  await p.locator('#bSchnellOk').tap();
  await p.waitForTimeout(400);
  const c = await p.evaluate(() => ({
    titel: document.querySelector('#bTitle').value,
    tage: [...document.querySelectorAll('#bDays .chip[aria-pressed="true"]')].map(x => x.textContent).join(),
    von: document.querySelector('#bFrom').value, bis: document.querySelector('#bTo').value,
    bereich: document.querySelector('#bAreas .chip[aria-pressed="true"]').textContent,
    zeile: document.querySelector('#bSchnell').hidden, n: state.blocks.length
  }));
  ok(c.titel === 'Gym' && c.tage === 'Mo,Do' && c.von === '18:30' && c.bis === '20:00' && c.bereich === 'Sport', 'Felder gefuellt: ' + JSON.stringify(c));
  ok(c.zeile && c.n === 0, 'Zeile wieder weg, weiter nichts gespeichert');
  if (BILD) await p.screenshot({ path: path.join(BILD, 'schnell-uebernommen.png') });
  await p.locator('.sheet__foot .btn--primary').tap();
  await p.waitForTimeout(300);
  const bl = await p.evaluate(() => state.blocks.map(b => b.title + ' ' + b.day + ' ' + b.start + '-' + b.end + ' ' + b.areaId));
  ok(bl.length === 2 && bl.includes('Gym 0 1110-1200 a3') && bl.includes('Gym 3 1110-1200 a3'), '„Eintragen" speichert zwei Eintraege: ' + bl.join(' | '));

  console.log('=== d) Enter ===');
  await basis(); await neu();
  await p.fill('#bTitle', 'Kino morgen 20:15 2 h');
  await p.press('#bTitle', 'Enter');
  await p.waitForTimeout(400);
  const d = await p.evaluate(() => ({ titel: document.querySelector('#bTitle') && document.querySelector('#bTitle').value,
    datum: document.querySelector('#bDatum') && document.querySelector('#bDatum').value,
    von: document.querySelector('#bFrom').value, bis: document.querySelector('#bTo').value, n: state.blocks.length }));
  ok(d.titel === 'Kino' && d.datum === '2026-11-19' && d.von === '20:15' && d.bis === '22:15' && d.n === 0, 'Enter uebernimmt, speichert nicht: ' + JSON.stringify(d));
  await p.press('#bTitle', 'Enter');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => state.blocks.length === 1 && state.blocks[0].date === '2026-11-19'), 'zweites Enter speichert wie bisher');

  console.log('=== e) Bestehender Eintrag ===');
  await p.evaluate(() => blockSheet({ ...state.blocks[0] }));
  await p.waitForTimeout(300);
  ok(await p.locator('#bSchnell').count() === 0, 'keine Schnelleingabe beim Bearbeiten');
  await p.evaluate(() => closeModal());

  console.log('=== f) Konsole ===');
  ok(konsolenfehler.length === 0, 'keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));

  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nALLES GRUEN');
  process.exit(fehler.length ? 1 : 0);
})();
