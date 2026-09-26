/* ============================================================
   Prüfskript Freude (v1.33) — „Frisch & verspielt"

     a) Begrüßung  — gruss() zu fünf Tageszeiten, mit und ohne Namen; sie
                     steht in derselben Zeile wie „Heute zählt" (kostet keine
                     Höhe) und nur am heutigen Tag. Das erste .agenda__label
                     bleibt wörtlich „Heute zählt".
     b) Etiketten  — keine gesperrten Großbuchstaben mehr (.label,
                     .agenda__label, .loose__lab); der Tagesschwerpunkt trägt
                     seine Welle im Farbton des Bereichs; „frei" ist ein
                     schräger Aufkleber.
     c) Abhaken    — ein Haken lässt Schnipsel aufsteigen, die wieder
                     verschwinden; Aufheben löst nichts aus; mit „Bewegung
                     reduzieren" keine Schnipsel.
     d) Momente    — ein erreichtes Wochenziel meldet sich genau einmal;
                     der ganz abgehakte Tag meldet sich; nichts davon landet
                     in state.

   Feste Uhr und Zone; jeder Fall stellt seine Uhr selbst.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

const aufbau = () => {
  closeModal(); state = freshState(); migrate(state);
  state.profile.name = 'Alex';
  state.settings.sleep = { on: true, from: 1380, to: 420, wind: 30 };
  const mon = mondayOf(new Date()); anchor = new Date(); selectedDayIdx = (new Date().getDay() + 6) % 7;
  state.rituale[iso(mon)] = Date.now();
  state.areas.forEach(a => { a.plan.goal = a.id === 'a3' ? 1 : 0; });
  const heute = iso(new Date()), i = selectedDayIdx;
  state.blocks = [
    { id: 'lauf', title: 'Laufen', areaId: 'a3', day: i, date: heute, start: 1020, end: 1080, repeat: 'none' },
    { id: 'lesen', title: 'Lesen', areaId: 'a2', day: i, date: heute, start: 1140, end: 1170, repeat: 'none' },
    { id: 'sonntag', title: 'Frühstück', areaId: 'a6', day: 6, date: iso(addDays(mon, 6)), start: 600, end: 660, repeat: 'none' }
  ];
  state.tasks = [{ id: 't1', title: 'Bewerbung abschicken', areaId: 'a7', done: false, frog: true, dauer: 30 }];
  dayMeta(iso(addDays(mon, 5))).frei = true;
  save(); renderAll(); setView('heute');
};

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const konsolenfehler = [];
  const seite = async (uhr, opts = {}) => {
    const ctx = await br.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Berlin', ...opts });
    const p = await ctx.newPage();
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) konsolenfehler.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date(uhr));
    await p.goto(F);
    await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
    await p.evaluate(aufbau);
    await p.waitForTimeout(200);
    return { ctx, p };
  };

  console.log('a) Begrüßung');
  const zeiten = [['2026-09-09T08:00:00+02:00', 'Moin, Alex'], ['2026-09-09T12:30:00+02:00', 'Mahlzeit, Alex'],
    ['2026-09-09T15:00:00+02:00', 'Hey, Alex'], ['2026-09-09T20:00:00+02:00', 'Guten Abend, Alex'],
    ['2026-09-09T23:30:00+02:00', 'Noch wach, Alex?']];
  for (const [uhr, erwartet] of zeiten) {
    const { ctx, p } = await seite(uhr);
    const r = await p.evaluate(() => {
      const lab = document.querySelector('#agenda .agenda__label');
      const g = document.querySelector('#agenda .agenda__gruss');
      state.profile.name = ''; const ohne = gruss();
      return { lab: lab.textContent, gruss: g && g.textContent, gleicheZeile: g && Math.abs(g.getBoundingClientRect().bottom - lab.getBoundingClientRect().bottom) < 4, ohne };
    });
    ok(r.gruss === erwartet, uhr.slice(11, 16) + ' Uhr: „' + r.gruss + '"');
    ok(r.lab === 'Heute zählt' && r.gleicheZeile, uhr.slice(11, 16) + ' Uhr: erstes Etikett bleibt „Heute zählt", Gruß in derselben Zeile');
    if (uhr.includes('23:30')) ok(r.ohne === 'Noch wach?', 'ohne Namen: „' + r.ohne + '"');
    if (uhr.includes('08:00')) {
      ok(r.ohne === 'Moin', 'ohne Namen: „' + r.ohne + '"');
      const anderer = await p.evaluate(() => { selectedDayIdx = (selectedDayIdx + 1) % 7; renderAgenda(); return !document.querySelector('#agenda .agenda__gruss'); });
      ok(anderer, 'an einem anderen Tag keine Begrüßung');
    }
    await ctx.close();
  }

  const { ctx, p } = await seite('2026-09-09T10:15:00+02:00');

  console.log('b) Etiketten und Akzente');
  const b = await p.evaluate(() => {
    goalsSheet(); const lab = document.querySelector('.sheet .label'); const t1 = getComputedStyle(lab).textTransform; closeModal();
    return { label: t1, agenda: getComputedStyle(document.querySelector('.agenda__label')).textTransform,
      frog: getComputedStyle(document.querySelector('.agenda__frogtext')).backgroundImage,
      frei: getComputedStyle(document.querySelector('.dayhead__frei')).transform };
  });
  ok(b.label === 'none' && b.agenda === 'none', 'Etiketten ohne Großbuchstaben (' + b.label + ' / ' + b.agenda + ')');
  ok(/data:image\/svg/.test(b.frog) && /oklch/.test(decodeURIComponent(b.frog)), 'der Schwerpunkt trägt eine Welle im Bereichston');
  ok(b.frei && b.frei !== 'none', '„frei" ist ein schräger Aufkleber (' + b.frei + ')');
  await p.evaluate(() => setView('plan'));
  const loose = await p.evaluate(() => { const l = document.querySelector('.loose__lab'); return l ? getComputedStyle(l).textTransform : 'none'; });
  ok(loose === 'none', 'Band-Etikett ohne Großbuchstaben');
  await p.evaluate(() => setView('heute'));

  console.log('c) Abhaken');
  const vorher = await p.evaluate(() => JSON.stringify({ b: state.blocks, t: state.tasks }));
  await p.click('#agenda .agenda__check[data-id="lesen"]');
  const schnipsel = await p.evaluate(() => document.querySelectorAll('.jubel').length);
  ok(schnipsel >= 10, 'ein Haken lässt Schnipsel aufsteigen (' + schnipsel + ')');
  ok(await p.evaluate(() => [...document.querySelectorAll('.jubel')].every(s => getComputedStyle(s).pointerEvents === 'none')), 'Schnipsel sind nie anklickbar');
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => document.querySelectorAll('.jubel').length === 0), 'und verschwinden wieder');
  await p.click('#agenda .agenda__check[data-id="lesen"]');
  ok(await p.evaluate(() => document.querySelectorAll('.jubel').length === 0), 'Aufheben eines Hakens löst nichts aus');
  ok(await p.evaluate(v => JSON.stringify({ b: state.blocks, t: state.tasks }) === v, vorher), 'Blöcke und Aufgaben unverändert (nur der Haken selbst wechselt)');

  console.log('d) Momente');
  await p.evaluate(() => document.querySelectorAll('.toasts .toast').forEach(t => t.remove()));
  await p.click('#agenda .agenda__check[data-id="lauf"]');
  const ziel = await p.evaluate(() => [...document.querySelectorAll('.toasts .toast')].map(t => t.textContent).join(' | '));
  ok(/Sport: Wochenziel geschafft/.test(ziel), 'erreichtes Wochenziel meldet sich (' + ziel + ')');
  ok(await p.evaluate(() => document.querySelectorAll('.jubel').length) >= 30, 'mit großem Konfetti');
  await p.click('#agenda .agenda__check[data-id="lauf"]');
  await p.evaluate(() => document.querySelectorAll('.toasts .toast').forEach(t => t.remove()));
  await p.click('#agenda .agenda__check[data-id="lauf"]');
  const zweit = await p.evaluate(() => [...document.querySelectorAll('.toasts .toast')].map(t => t.textContent).join(' | '));
  ok(!/Wochenziel geschafft/.test(zweit), 'dasselbe Ziel feiert nicht zweimal in einer Sitzung');
  await p.evaluate(() => document.querySelectorAll('.toasts .toast').forEach(t => t.remove()));
  await p.click('#agenda .agenda__check[data-id="lesen"]');
  const tag = await p.evaluate(() => [...document.querySelectorAll('.toasts .toast')].map(t => t.textContent).join(' | '));
  ok(/Alles abgehakt/.test(tag), 'der ganz abgehakte Tag meldet sich (' + tag + ')');
  ok(await p.evaluate(() => !JSON.stringify(state).includes('gefeiert') && !JSON.stringify(state).includes('jubel')), 'nichts davon landet in state');
  await ctx.close();

  console.log('e) Ring am Termin und runde Schrift (v1.34)');
  {
    const { ctx, p } = await seite('2026-09-09T10:15:00+02:00');
    await p.evaluate(() => setView('plan'));
    await p.waitForTimeout(150);
    const vor = await p.evaluate(() => getComputedStyle(document.querySelector('.block[data-id="lauf"] .block__done')).opacity);
    await p.hover('.block[data-id="lauf"]');
    await p.waitForTimeout(250);
    const nach = await p.evaluate(() => getComputedStyle(document.querySelector('.block[data-id="lauf"] .block__done')).opacity);
    ok(vor === '0' && nach === '1', 'Desktop: Ring erscheint erst beim Überfahren (' + vor + ' → ' + nach + ')');
    await p.click('.block[data-id="lauf"] .block__done');
    ok(await p.evaluate(() => istErledigt(state.blocks.find(b => b.id === 'lauf'), iso(new Date())) && document.querySelectorAll('.jubel').length > 0),
      'Klick auf den Ring hakt ab und feiert');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.block[data-id="lauf"] .block__done')).opacity === '1'), 'abgehakt bleibt der gefüllte Ring sichtbar');
    const schrift = await p.evaluate(async () => { await document.fonts.ready;
      return { da: document.fonts.check('750 17px "Wochenplaner Rund"'), stapel: getComputedStyle(document.querySelector('.planhead h1')).fontFamily }; });
    ok(schrift.da && /Wochenplaner Rund/.test(schrift.stapel), 'eingebettete runde Schrift ist geladen und im Display-Stapel');
    await ctx.close();
  }
  {
    const { ctx, p } = await seite('2026-09-09T10:15:00+02:00', { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    await p.evaluate(() => setView('plan'));
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.block[data-id="lauf"] .block__done')).opacity === '1'), 'Telefon: Ring ist immer sichtbar');
    await ctx.close();
  }

  console.log('c2) Bewegung reduziert');
  {
    const { ctx, p } = await seite('2026-09-09T10:15:00+02:00', { reducedMotion: 'reduce' });
    await p.click('#agenda .agenda__check[data-id="lesen"]');
    ok(await p.evaluate(() => document.querySelectorAll('.jubel').length === 0 && state.erledigt && Object.values(state.erledigt).some(e => e.on)),
      'mit „Bewegung reduzieren": Haken gesetzt, keine Schnipsel');
    await ctx.close();
  }

  await br.close();
  ok(konsolenfehler.length === 0, 'keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nalles grün');
  process.exit(fehler.length ? 1 : 0);
})();
