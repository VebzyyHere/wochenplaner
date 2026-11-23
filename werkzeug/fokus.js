/* ============================================================
   Pruefskript Checkliste und Fokus (Studio-Entwurf 2026-11)

   a) Checkliste im Editor: Schritte dazulegen (Knopf, Enter, getippter Rest
      beim Speichern), entfernen, Obergrenze; gespeichert erst mit „Eintragen".
   b) migrate(): saeubert b.schritte wertbasiert und ist idempotent.
   c) Laufend-Karte ist die Tuer zum Fokus-Blatt und wird dadurch nicht hoeher.
   d) Fokus-Blatt: Restzeit, Ring-Anteil, Ort, Notiz; der Ring folgt der Uhr.
   e) Schritt im Fokus abhaken speichert sofort; bei einer Serie gilt der
      Haken nur fuer diesen Tag.
   f) „Erledigt" hakt ueber abhaken() ab und schliesst.
   g) Kopieren nimmt die Schritte ohne Haken mit.
   h) Desktop: Tuer per Tastatur; keine Konsolenfehler.

   Feste Uhr: Mittwoch 2026-11-18, 10:20 Europe/Berlin.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const BILD = process.env.WP_BILD;

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const konsolenfehler = [];
  const seite = async (opt) => {
    const ctx = await br.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE', ...opt });
    const p = await ctx.newPage();
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date('2026-11-18T10:20:00+01:00'));
    await p.goto(F);
    await p.waitForTimeout(500);
    return p;
  };
  const basis = (p, bloecke = []) => p.evaluate(bl => {
    closeModal();
    state = freshState(); migrate(state);
    state.profile.name = 'Test';
    state.blocks = bl; state.tasks = [];
    anchor = new Date(); selectedDayIdx = 2;
    save(); setView('heute'); renderAll();
  }, bloecke);
  const HEUTE = '2026-11-18';
  const lauf = (extra = {}) => ({ id: 'b1', title: 'Sport im Park', areaId: 'a3', day: 2, date: HEUTE, repeat: 'none', start: 600, end: 660, ...extra });

  const p = await seite({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

  console.log('=== a) Checkliste im Editor ===');
  await basis(p);
  await p.evaluate(() => document.querySelector('#fabAdd').onclick());
  await p.waitForTimeout(350);
  await p.fill('#bTitle', 'Sport');
  ok(await p.locator('#bSchritte').isHidden(), 'leere Liste verborgen');
  await p.fill('#bSchritt', 'Sportschuhe');
  await p.locator('#bSchrittDazu').tap();
  await p.fill('#bSchritt', 'Wasserflasche');
  await p.press('#bSchritt', 'Enter');
  await p.waitForTimeout(100);
  ok(await p.locator('#bSchritte .schritt').count() === 2, 'Knopf und Enter legen je einen Schritt dazu');
  ok(await p.locator('#bSchritte input[type=checkbox]').count() === 0, 'neuer Eintrag: noch keine Haken');
  ok(await p.evaluate(() => state.blocks.length) === 0, 'Enter im Schritt-Feld speichert den Eintrag nicht');
  await p.fill('#bSchritt', 'Handtuch');
  await p.locator('#bSchritte .schritt__weg').first().tap();
  await p.waitForTimeout(100);
  ok(await p.locator('#bSchritte .schritt').count() === 1, '× entfernt einen Schritt');
  const weg = await p.locator('#bSchritte .schritt__weg').first().boundingBox();
  ok(weg.width >= 44 && weg.height >= 44, 'Entfernen-Knopf 44 px: ' + weg.width + 'x' + weg.height);
  if (BILD) { await p.locator('#bSchritt').scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(BILD, 'checkliste-editor.png') }); }
  await p.locator('.sheet__foot .btn--primary').tap();
  await p.waitForTimeout(300);
  const a = await p.evaluate(() => state.blocks[0].schritte);
  ok(JSON.stringify(a) === JSON.stringify([{ t: 'Wasserflasche' }, { t: 'Handtuch' }]), 'gespeichert, getippter Rest zaehlt mit: ' + JSON.stringify(a));
  const max = await p.evaluate(() => {
    blockSheet({ ...state.blocks[0], schritte: Array.from({ length: SCHRITTE_MAX }, (_, i) => ({ t: 'S' + i })) });
    return document.querySelector('#bSchritt').disabled && document.querySelector('#bSchrittDazu').disabled;
  });
  ok(max, 'Obergrenze sperrt das Feld');

  console.log('=== b) migrate ===');
  const m = await p.evaluate(() => {
    closeModal();
    const s = JSON.parse(JSON.stringify(state));
    s.blocks = [
      { ...s.blocks[0], id: 'x1', schritte: [{ t: '  ok  ', ok: true }, { t: '' }, null, { t: 'Serie', ok: '2026-11-18' }, { t: 'kaputt', ok: 'ja' }, { t: 5 }] },
      { ...s.blocks[0], id: 'x2', schritte: 'quatsch' },
      { ...s.blocks[0], id: 'x3', schritte: Array.from({ length: 40 }, () => ({ t: 'a'.repeat(200) })) }
    ];
    migrate(s);
    const eins = JSON.stringify(s.blocks.map(b => b.schritte));
    migrate(s);
    return { eins, zwei: JSON.stringify(s.blocks.map(b => b.schritte)), x1: s.blocks[0].schritte, x2: 'schritte' in s.blocks[1], x3: s.blocks[2].schritte };
  });
  ok(JSON.stringify(m.x1) === JSON.stringify([{ t: 'ok', ok: true }, { t: 'Serie', ok: '2026-11-18' }, { t: 'kaputt' }]), 'gesaeubert: ' + JSON.stringify(m.x1));
  ok(!m.x2, 'kein Array: Feld entfernt');
  ok(m.x3.length === 12 && m.x3[0].t.length === 80, 'hoechstens 12 Schritte, je 80 Zeichen');
  ok(m.eins === m.zwei, 'idempotent');

  console.log('=== c) Laufend-Karte als Tuer ===');
  await basis(p, [lauf()]);
  await p.waitForTimeout(200);
  const hOhne = await p.evaluate(() => {
    const h = document.querySelector('.agenda__hero'); const t = h.querySelector('.agenda__hero-tuer');
    t.hidden = true; t.style.display = 'none'; const ohne = h.offsetHeight; t.style.display = ''; t.hidden = false;
    return { ohne, mit: h.offsetHeight, text: h.querySelector('.agenda__hero-sub').textContent, rolle: h.getAttribute('role'), name: h.getAttribute('aria-label') };
  });
  ok(hOhne.ohne === hOhne.mit, 'Karte nicht hoeher durch „Fokus ›": ' + hOhne.mit + ' px');
  ok(/noch 40 min/.test(hOhne.text) && /Fokus/.test(hOhne.text), 'Zeile: ' + hOhne.text);
  ok(hOhne.rolle === 'button' && /Fokus öffnen: Sport im Park, noch 40 min/.test(hOhne.name), 'zugaenglicher Name: ' + hOhne.name);
  if (BILD) { await p.evaluate(() => { document.querySelector('#toasts').innerHTML = ''; }); await p.waitForTimeout(400); await p.screenshot({ path: path.join(BILD, 'fokus-tuer.png') }); }

  console.log('=== d) Fokus-Blatt ===');
  await basis(p, [lauf({ ort: 'Schlossgarten', notiz: 'Matte mitnehmen', schritte: [{ t: 'Sportschuhe' }, { t: 'Wasserflasche' }] })]);
  await p.locator('#agendaHero').tap();
  await p.waitForTimeout(450);
  const d = await p.evaluate(() => ({
    titel: document.querySelector('.sheet.fokus .sheet__title').textContent,
    wo: document.querySelector('.fokus__wo').textContent,
    rest: document.querySelector('#fokusRest').textContent, bis: document.querySelector('#fokusBis').textContent,
    bogen: document.querySelector('#fokusBogen').getAttribute('stroke-dasharray').split(' ').map(Number),
    notiz: document.querySelector('.fokus__notiz').textContent,
    lab: document.querySelector('#fokusSchritteLab').textContent,
    name: document.querySelector('#fokusRing').getAttribute('aria-label')
  }));
  ok(d.titel === 'Sport im Park' && d.wo === 'Sport · Schlossgarten', 'Titel und Ort: ' + d.titel + ' / ' + d.wo);
  ok(d.rest === 'noch 40 min' && d.bis === 'bis 11:00', 'Restzeit: ' + d.rest + ', ' + d.bis);
  ok(Math.abs(d.bogen[0] / d.bogen[1] - 40 / 60) < 0.01, 'Ring zeigt 40 von 60 min: ' + (d.bogen[0] / d.bogen[1]).toFixed(3));
  ok(d.notiz === 'Matte mitnehmen' && d.lab === 'Checkliste · 0 von 2', 'Notiz und Checkliste: ' + d.lab);
  ok(d.name === 'noch 40 min, bis 11:00', 'Ring hat einen Namen');
  // Die Uhr laeuft weiter: 10:50, der Takt (20 s) zieht nach.
  await p.clock.setFixedTime(new Date('2026-11-18T10:50:00+01:00'));
  await p.clock.runFor(21000);
  ok(await p.locator('#fokusRest').innerText() === 'noch 10 min', 'Ring folgt der Uhr: ' + await p.locator('#fokusRest').innerText());
  await p.clock.setFixedTime(new Date('2026-11-18T11:05:00+01:00'));
  await p.clock.runFor(21000);
  ok(await p.locator('#fokusRest').innerText() === 'Zeit ist um' && await p.locator('#fokusBis').innerText() === 'geplant bis 11:00', 'nach dem Ende: „Zeit ist um"');
  await p.clock.setFixedTime(new Date('2026-11-18T10:20:00+01:00'));

  console.log('=== e) Schritt abhaken ===');
  await p.locator('#fokusSchritte input').first().tap();
  await p.waitForTimeout(150);
  if (BILD) await p.screenshot({ path: path.join(BILD, 'fokus-blatt.png') });
  ok(await p.evaluate(() => state.blocks[0].schritte[0].ok === true && !state.blocks[0].schritte[1].ok), 'einmaliger Eintrag: ok = true, sofort im Zustand');
  ok(await p.locator('#fokusSchritteLab').innerText() === 'Checkliste · 1 von 2', 'Zaehler zieht nach');
  ok(await p.locator('.sheet.fokus').count() === 1, 'Blatt bleibt offen');
  const serie = await p.evaluate(() => {
    closeModal();
    const b = state.blocks[0]; b.repeat = 'weekly'; b.since = b.date; b.schritte = [{ t: 'Sportschuhe' }];
    schrittSetzen(b, b.schritte[0], '2026-11-18', true);
    return { wert: b.schritte[0].ok, heute: schrittOk(b, b.schritte[0], '2026-11-18'), naechste: schrittOk(b, b.schritte[0], '2026-11-25') };
  });
  ok(serie.wert === '2026-11-18' && serie.heute && !serie.naechste, 'Serie: Haken gilt nur fuer diesen Tag: ' + JSON.stringify(serie));

  console.log('=== f) Erledigt ===');
  await basis(p, [lauf()]);
  await p.locator('#agendaHero').tap();
  await p.waitForTimeout(450);
  await p.locator('#fokusOk').tap();
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => istErledigt(state.blocks[0], '2026-11-18')), 'abgehakt');
  ok(await p.locator('.sheet.fokus').count() === 0, 'Blatt geschlossen');
  await p.evaluate(() => fokusSheet('b1', '2026-11-18'));
  await p.waitForTimeout(300);
  ok(await p.locator('#fokusOk').count() === 0, 'schon erledigt: kein „Erledigt"-Knopf');

  console.log('=== g) Kopieren ===');
  await basis(p, [lauf({ schritte: [{ t: 'Sportschuhe', ok: true }] })]);
  await p.evaluate(() => blockSheet({ ...state.blocks[0] }, '2026-11-18'));
  await p.waitForTimeout(300);
  ok(await p.locator('#bSchritte input[type=checkbox]').isChecked(), 'bestehender Eintrag zeigt den Haken');
  await p.locator('#bKopie').tap();
  await p.waitForTimeout(400);
  const g = await p.evaluate(() => ({ n: document.querySelectorAll('#bSchritte .schritt').length, haken: document.querySelectorAll('#bSchritte input[type=checkbox]').length }));
  ok(g.n === 1 && g.haken === 0, 'Kopie: Schritt da, ohne Haken');
  await p.evaluate(() => closeModal());
  await p.context().close();

  console.log('=== h) Desktop, Tastatur ===');
  const dsk = await seite({ viewport: { width: 1440, height: 900 } });
  await basis(dsk, [lauf({ schritte: [{ t: 'Sportschuhe' }] })]);
  await dsk.waitForTimeout(200);
  await dsk.locator('#agendaHero').focus();
  await dsk.keyboard.press('Enter');
  await dsk.waitForTimeout(450);
  ok(await dsk.locator('.sheet.fokus #fokusRest').innerText() === 'noch 40 min', 'Enter auf der Karte oeffnet das Fokus-Blatt');
  if (BILD) await dsk.screenshot({ path: path.join(BILD, 'fokus-desktop.png') });
  await dsk.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await dsk.waitForTimeout(150);
  if (BILD) await dsk.screenshot({ path: path.join(BILD, 'fokus-desktop-dunkel.png') });

  ok(konsolenfehler.length === 0, 'keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));
  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nALLES GRUEN');
  process.exit(fehler.length ? 1 : 0);
})();
