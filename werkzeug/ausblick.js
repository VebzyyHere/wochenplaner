/* ============================================================
   Pruefskript Ausblick (v1.47) — Feiertage Baden-Wuerttemberg,
   Brueckentag-Tipps, Vorfreude-Zaehler, Monat wischen.

   a) Osterformel: bekannte Ostersonntage 2024–2038.
   b) Feiertage BW: genau zwoelf je Jahr (Feiertagsgesetz BW § 1), die
      beweglichen haengen am Ostersonntag; Heiligabend, Silvester, Oster-
      und Pfingstsonntag sind KEINE Feiertage.
   c) Brueckentage: Himmelfahrt 2027 (Do 6.5.) — 1 Urlaubstag ergibt
      4 freie Tage (Do–So); Kette ueber Ostern 2027: 8 Urlaubstage, 16 Tage.
      Kein Tipp beginnt vor morgen; jeder Urlaubstag ist ein Werktag ohne
      Feiertag.
   d) Monatsblatt: Feiertag traegt .is-feiertag, der Name steht im
      aria-label und in der Zeile darunter; die Zelle selbst behaelt nur
      die Tagesnummer als Text.
   e) Wischen im Monat (echte Touch-Events) blaettert, bewegt anchor nicht
      und oeffnet keinen Tag.
   f) Ausblick: ganztaegiger Eintrag mit Zaehler, Feiertage, Tipps; ein
      Tipp oeffnet nur den vorausgefuellten Eintrag und speichert nichts.
   g) Tagestitel nennt den Feiertag.
   i) Tab-Wechsel am Telefon: die neue Ansicht kommt von der Seite ihres
      Reiters, ohne seitliches Scrollen.
   h) keine Konsolenfehler.

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
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.profile.name = 'Test';
    state.blocks = [{ id: 'fest1', title: 'Festival <b>', areaId: state.areas[0].id, day: 4, date: '2026-12-04',
      repeat: 'none', start: 0, end: 0, grob: true, ganztag: true, teil: 'mo', dauer: 0, bis: '2026-12-06' }];
    state.tasks = [];
    anchor = new Date(); selectedDayIdx = 2;
    save(); setView('plan'); renderAll();
  });

  console.log('=== a) Osterformel ===');
  const ostern = await p.evaluate(() => [2024, 2025, 2026, 2027, 2028, 2030, 2038].map(j => iso(osterSonntag(j))));
  const soll = ['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16', '2030-04-21', '2038-04-25'];
  ok(JSON.stringify(ostern) === JSON.stringify(soll), 'a) Ostersonntage stimmen: ' + ostern.join(', '));

  console.log('=== b) Feiertage BW ===');
  const f = await p.evaluate(() => ({
    j26: [...feiertageBW(2026)].sort().map(x => x.join(' ')),
    j27: [...feiertageBW(2027)].sort().map(x => x.join(' ')),
    nicht: ['2026-12-24', '2026-12-31', '2026-04-05', '2026-05-24', '2026-10-31', '2026-04-02'].map(feiertagAm)
  }));
  ok(f.j26.length === 12 && f.j27.length === 12, 'b) zwoelf Feiertage je Jahr (' + f.j26.length + ', ' + f.j27.length + ')');
  const soll26 = ['2026-01-01 Neujahr', '2026-01-06 Heilige Drei Könige', '2026-04-03 Karfreitag', '2026-04-06 Ostermontag',
    '2026-05-01 Tag der Arbeit', '2026-05-14 Christi Himmelfahrt', '2026-05-25 Pfingstmontag', '2026-06-04 Fronleichnam',
    '2026-10-03 Tag der Deutschen Einheit', '2026-11-01 Allerheiligen', '2026-12-25 1. Weihnachtstag', '2026-12-26 2. Weihnachtstag'];
  ok(JSON.stringify(f.j26) === JSON.stringify(soll26), 'b) 2026 vollstaendig und an den richtigen Tagen');
  ok(f.j27.includes('2027-05-06 Christi Himmelfahrt') && f.j27.includes('2027-05-27 Fronleichnam') && f.j27.includes('2027-03-26 Karfreitag'),
    'b) 2027: Karfreitag 26.3., Himmelfahrt 6.5., Fronleichnam 27.5.');
  ok(f.nicht.every(x => x === null), 'b) Heiligabend, Silvester, Oster-/Pfingstsonntag, Reformationstag, Gruendonnerstag sind keine Feiertage');

  console.log('=== c) Brueckentage ===');
  const t = await p.evaluate(() => {
    const tipps = brueckenTipps(new Date(), 370);
    const flach = tipps.map(x => ({ namen: x.namen, opt: x.optionen.map(o => ({ u: o.urlaub, f: o.frei, von: iso(o.von), bis: iso(o.bis),
      tage: o.nehmen.flatMap(l => { const r = []; for (let d = l.von; d <= l.bis; d = addDays(d, 1)) r.push(iso(d)); return r; }) })) }));
    return flach;
  });
  const alle = t.flatMap(x => x.opt);
  const himmel = t.find(x => x.namen.join() === 'Christi Himmelfahrt');
  ok(!!himmel && himmel.opt.some(o => o.u === 1 && o.f === 4 && o.von === '2027-05-06' && o.bis === '2027-05-09' && o.tage.join() === '2027-05-07'),
    'c) Himmelfahrt 2027: 1 Urlaubstag (Fr 7.5.) ergibt 4 Tage frei (6.–9.5.)');
  const os = t.find(x => x.namen.join() === 'Karfreitag,Ostermontag');
  ok(!!os && os.opt.some(o => o.u === 8 && o.f === 16 && o.von === '2027-03-20' && o.bis === '2027-04-04'),
    'c) Ostern 2027 als Kette: 8 Urlaubstage ergeben 16 Tage frei (20.3.–4.4.)');
  ok(alle.every(o => o.tage.length === o.u), 'c) Zahl der Urlaubstage = Zahl der genannten Tage');
  ok(alle.every(o => o.tage.every(k => { const w = new Date(k + 'T12:00').getDay(); return w !== 0 && w !== 6; })),
    'c) kein Urlaubstag liegt auf einem Wochenende');
  const feiertageAlle = new Set([...f.j26, ...f.j27].map(x => x.slice(0, 10)));
  ok(alle.every(o => o.tage.every(k => !feiertageAlle.has(k))), 'c) kein Urlaubstag liegt auf einem Feiertag');
  ok(alle.every(o => o.f / o.u >= 1.9), 'c) jeder Tipp bringt mindestens das 1,9-Fache an freien Tagen');
  ok(alle.every(o => o.von > '2026-11-18' || o.tage[0] > '2026-11-18'), 'c) kein Tipp verlangt einen Urlaubstag heute oder frueher');

  console.log('=== d) Monatsblatt ===');
  await p.evaluate(() => monatSheet(new Date('2026-12-07T12:00:00')));
  await p.waitForTimeout(300);
  const d = await p.evaluate(() => {
    const z = k => document.querySelector('.monatcell[data-date="' + k + '"]');
    return { klasse25: z('2026-12-25').className, label25: z('2026-12-25').getAttribute('aria-label'), text25: z('2026-12-25').textContent,
      klasse24: z('2026-12-24').className, zeile: document.getElementById('monatFeiertage').textContent,
      zeileHidden: document.getElementById('monatFeiertage').hidden };
  });
  ok(d.klasse25.includes('is-feiertag') && !d.klasse24.includes('is-feiertag'), 'd) 25.12. ist markiert, 24.12. nicht');
  ok(d.label25.includes('Feiertag: 1. Weihnachtstag'), 'd) aria-label nennt den Feiertag: ' + JSON.stringify(d.label25));
  ok(d.text25 === '25', 'd) die Zelle traegt weiter nur die Tagesnummer');
  ok(!d.zeileHidden && d.zeile.includes('Fr 25.12. 1. Weihnachtstag') && d.zeile.includes('Sa 26.12. 2. Weihnachtstag'), 'd) Zeile unter dem Raster: ' + JSON.stringify(d.zeile));

  console.log('=== e) Monat wischen ===');
  const ankerVor = await p.evaluate(() => iso(anchor));
  const wisch = async (vonX, bisX) => {
    const box = await p.locator('#monatGrid').boundingBox();
    const y = box.y + box.height / 2;
    const cdp = await ctx.newCDPSession(p);
    const pt = x => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(vonX) });
    const schritte = 8;
    for (let i = 1; i <= schritte; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(vonX + (bisX - vonX) * i / schritte) });
      await p.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await p.waitForTimeout(400);
  };
  await wisch(300, 110);
  const e1 = await p.evaluate(() => ({ titel: document.getElementById('monatTitel').textContent, offen: !!document.querySelector('.monatgrid'), anker: iso(anchor) }));
  ok(e1.titel === 'Januar 2027', 'e) nach links wischen zeigt den naechsten Monat (' + e1.titel + ')');
  await wisch(110, 300); await wisch(110, 300);
  const e2 = await p.evaluate(() => ({ titel: document.getElementById('monatTitel').textContent, offen: !!document.querySelector('.monatgrid'), anker: iso(anchor),
    transform: document.getElementById('monatGrid').style.transform }));
  ok(e2.titel === 'November 2026', 'e) zweimal nach rechts wischen geht zwei Monate zurueck (' + e2.titel + ')');
  ok(e2.offen && e2.anker === ankerVor, 'e) das Blatt bleibt offen, anchor ist unveraendert');
  ok(e2.transform === '', 'e) das Raster steht nach dem Wisch wieder gerade');
  await wisch(200, 230);
  const e3 = await p.evaluate(() => document.getElementById('monatTitel').textContent);
  ok(e3 === 'November 2026', 'e) ein kurzer Wisch unter der Schwelle blaettert nicht');

  console.log('=== f) Ausblick ===');
  const vorher = await p.evaluate(() => JSON.stringify(state.blocks));
  await p.click('#monatAusblick');
  await p.waitForTimeout(900);
  const a1 = await p.evaluate(() => ({
    titel: (document.querySelector('.sheet .sheet__title') || {}).textContent,
    zeilen: [...document.querySelectorAll('.kommt__row')].map(r => r.textContent),
    roh: [...document.querySelectorAll('.kommt__row b')].some(b => b.querySelector('b')),
    tipps: document.querySelectorAll('.tipp').length, opts: document.querySelectorAll('.tipp__opt').length,
    leer: !!document.querySelector('.ausblick__leer'),
    breit: document.querySelector('.sheet').scrollWidth <= document.querySelector('.sheet').clientWidth + 1
  }));
  ok(a1.titel === 'Ausblick', 'f) Blatt „Ausblick" ist offen');
  ok(a1.zeilen.some(z => z.includes('in 16 Tagen') && z.includes('Festival <b>') && z.includes('3 Tage')), 'f) Festival mit Zaehler „in 16 Tagen" und „3 Tage": ' + JSON.stringify(a1.zeilen[0]));
  ok(!a1.roh, 'f) Nutzertext ist maskiert (kein eingeschleustes <b>)');
  ok(a1.zeilen.some(z => z.includes('1. Weihnachtstag') && z.includes('in 37 Tagen')), 'f) naechster Feiertag mit Zaehler');
  ok(a1.tipps >= 3 && a1.opts > a1.tipps, 'f) Tipps vorhanden (' + a1.tipps + ' Karten, ' + a1.opts + ' Moeglichkeiten)');
  ok(!a1.leer, 'f) kein Leer-Hinweis, wenn ein eigener Eintrag ansteht');
  ok(a1.breit, 'f) nichts laeuft seitlich aus dem Blatt');
  await p.locator('.tipp__opt').first().click();
  await p.waitForTimeout(500);
  const a2 = await p.evaluate(() => ({
    titel: (document.querySelector('.sheet .sheet__title') || {}).textContent,
    was: (document.getElementById('bTitle') || {}).value,
    daten: [...document.querySelectorAll('.sheet input[type=date]')].map(i => i.value),
    bloecke: JSON.stringify(state.blocks)
  }));
  ok(a2.titel === 'Neuer Eintrag' && a2.was === 'Urlaub', 'f) Tipp oeffnet „Neuer Eintrag" mit Titel „Urlaub"');
  ok(a2.daten[0] === '2026-12-19' && a2.daten[1] === '2026-12-27', 'f) Zeitraum vorausgefuellt: ' + a2.daten.join(' bis '));
  ok(a2.bloecke === vorher, 'f) nichts wurde gespeichert');
  await p.evaluate(() => closeModal()); await p.waitForTimeout(150);

  await p.evaluate(() => { state.blocks = []; save(); ausblickSheet(); });
  await p.waitForTimeout(600);
  const a3 = await p.evaluate(() => ({ leer: !!document.querySelector('.ausblick__leer'), zeilen: document.querySelectorAll('.kommt__row').length }));
  ok(a3.leer && a3.zeilen === 3, 'f) ohne eigene Eintraege: Hinweis und die drei naechsten Feiertage');
  await p.locator('.kommt__row').first().click();
  await p.waitForTimeout(400);

  console.log('=== g) Tagestitel ===');
  const g = await p.evaluate(() => ({ offen: !!document.querySelector('.sheet'), titel: document.querySelector('.planhead h1').textContent, sicht: document.body.dataset.mview }));
  ok(!g.offen && g.sicht === 'plan', 'g) Zeile springt in den Tag, alle Blaetter sind zu');
  ok(g.titel.includes('25. Dezember') && g.titel.includes('1. Weihnachtstag'), 'g) Tagestitel nennt den Feiertag: ' + JSON.stringify(g.titel));

  console.log('=== i) Tab-Wechsel mit Richtung ===');
  await p.evaluate(() => setView('heute'));
  // Der Klick nach einem Touch-Tipp kommt vom Browser nachgereicht — erst
  // lesen, wenn die Ansicht wirklich gewechselt hat (sonst liest man den
  // Stand des vorigen Tipps). Beim selben Reiter gibt es nichts abzuwarten
  // ausser einer kurzen Frist, in der ein faelschlicher Uebergang begaenne.
  const tab = async v => {
    const gleich = await p.evaluate(v => mview === v, v);
    await p.locator('#tabbar button[data-view="' + v + '"]').tap();
    if (gleich) await p.waitForTimeout(150);
    else await p.waitForFunction(v => mview === v, v, { timeout: 3000 });
    const r = await p.evaluate(() => ({ x: $('#main').style.getPropertyValue('--wechsel-x'), an: $('#main').classList.contains('is-wechsel'),
      quer: document.documentElement.scrollWidth <= window.innerWidth }));
    await p.waitForTimeout(450);
    return r;
  };
  const i1 = await tab('aufgaben'), i2 = await tab('plan'), i3 = await tab('plan');
  ok(i1.an && i1.x === '18px', 'i) nach rechts getippt: die Ansicht kommt von rechts (' + i1.x + ')');
  ok(i2.an && i2.x === '-18px', 'i) nach links getippt: die Ansicht kommt von links (' + i2.x + ')');
  ok(i1.quer && i2.quer, 'i) kein seitliches Scrollen waehrend des Uebergangs');
  ok(!i3.an, 'i) derselbe Reiter noch einmal: kein Uebergang');

  console.log('=== h) Konsole ===');
  ok(konsolenfehler.length === 0, 'h) keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));

  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nAlles gruen.');
  process.exit(fehler.length ? 1 : 0);
})();
