/* ============================================================
   Pruefskript Beispielwoche und Eintrags-Karte (v1.55)

   a) index.html?beispiel: eigener Speicherplatz „wochenplaner.beispiel",
      kein Abgleich (Sync.configured() false), der echte Plan unter
      „wochenplaner.local" bleibt Byte fuer Byte gleich.
   b) Inhalt: Serien, Einzeltermine mit Ort/Notiz, grobe Eintraege, ein
      mehrtaegiges Festival, Aufgaben mit Frist, Checklisten, Wochenziele,
      Abgehaktes an vergangenen Tagen, Vorschlaege. Banner mit Rueckweg.
   c) Ohne ?beispiel: kein Banner, der echte Plan wird geladen.
   d) Eintrags-Karte am Telefon: Bereiche als Raster (eine Zeile je Chip),
      „Dazu" bricht nicht um, „Erledigt" ist eine runde Mulde, im Fuss stehen
      Loeschen/Verschieben leise ueber Abbrechen/Speichern, nichts ueberlappt.
   e) keine Konsolenfehler.

   Feste Uhr: Mittwoch 2026-11-25, 10:20 Europe/Berlin.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const konsolenfehler = [];
  const kontext = async (opt) => {
    const ctx = await br.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE', ...opt });
    return ctx;
  };
  const seite = async (ctx, url) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date('2026-11-25T10:20:00+01:00'));
    await p.goto(url);
    await p.waitForTimeout(600);
    return p;
  };

  console.log('=== a) Eigener Speicherplatz ===');
  const ctx = await kontext({ viewport: { width: 1440, height: 900 } });
  const echt = await seite(ctx, F);
  await echt.evaluate(() => { closeModal(); state.profile.name = 'Echt'; state.blocks = [{ id: 'echt1', title: 'Mein Termin', areaId: 'a1', day: 2, date: '2026-11-25', repeat: 'none', start: 600, end: 660, grob: false, frog: false }]; save(); });
  const vorher = await echt.evaluate(() => localStorage.getItem('wochenplaner.local'));
  const p = await seite(ctx, F + '?beispiel');
  const a = await p.evaluate(() => ({ scope: Store.scope, sync: Sync.configured(), status: Sync.status,
    eigen: !!localStorage.getItem('wochenplaner.beispiel'), echt: localStorage.getItem('wochenplaner.local') }));
  ok(a.scope === 'beispiel' && a.eigen, 'a) Beispielwoche liegt unter wochenplaner.beispiel');
  ok(a.sync === false && a.status === 'off', 'a) kein Abgleich (' + a.status + ')');
  ok(a.echt === vorher && vorher.includes('Mein Termin'), 'a) der echte Plan bleibt unveraendert');

  console.log('=== b) Inhalt ===');
  const b = await p.evaluate(() => {
    const echte = state.blocks.filter(x => !x.sug);
    const heute = iso(new Date());
    return {
      serien: echte.filter(istSerie).length, einzeln: echte.filter(x => x.repeat === 'none' && !x.grob).length,
      grob: echte.filter(x => x.grob && !x.ganztag).length, mehrtaegig: echte.filter(x => x.ganztag && x.bis).length,
      ortNotiz: echte.some(x => x.ort) && echte.some(x => x.notiz), schritte: echte.filter(x => (x.schritte || []).length).length,
      aufgaben: state.tasks.length, frist: state.tasks.filter(t => t.frist).length, erledigt: state.tasks.filter(t => t.done).length,
      ziele: state.areas.filter(x => x.plan.goal > 0).length, sug: state.blocks.filter(x => x.sug).length,
      abgehakt: Object.keys(state.erledigt).filter(k => k.split('|')[1] < heute).length,
      heuteAbgehakt: Object.keys(state.erledigt).filter(k => k.split('|')[1] >= heute).length,
      banner: document.querySelector('#banner').textContent, rueck: document.querySelector('#banner a').getAttribute('href'),
      agenda: document.querySelectorAll('#agenda .agenda__row, #agenda li').length, name: state.profile.name
    };
  });
  ok(b.serien >= 4 && b.einzeln >= 5 && b.grob >= 3 && b.mehrtaegig === 1, 'b) Serien, Einzeltermine, grobe und ein mehrtaegiger Eintrag: ' + JSON.stringify([b.serien, b.einzeln, b.grob, b.mehrtaegig]));
  ok(b.ortNotiz && b.schritte >= 2, 'b) Orte, Notizen und Checklisten');
  ok(b.aufgaben === 6 && b.frist >= 2 && b.erledigt === 1 && b.ziele >= 4, 'b) Aufgaben mit Frist, eine erledigt, Wochenziele');
  ok(b.sug > 0 && b.abgehakt >= 5 && b.heuteAbgehakt === 0, 'b) Vorschlaege und Abgehaktes nur an vergangenen Tagen (' + b.abgehakt + ')');
  ok(b.banner.startsWith('Beispielwoche') && b.rueck && !b.rueck.includes('beispiel'), 'b) Banner mit Weg zurueck zum eigenen Plan');

  console.log('=== c) Ohne ?beispiel ===');
  const c = await seite(ctx, F);
  const cc = await c.evaluate(() => ({ scope: Store.scope, banner: document.querySelector('#banner').textContent, titel: state.blocks.map(x => x.title).join() }));
  ok(cc.scope !== 'beispiel' && !cc.banner.includes('Beispielwoche') && cc.titel === 'Mein Termin', 'c) eigener Plan, kein Banner');
  await ctx.close();

  console.log('=== d) Eintrags-Karte am Telefon ===');
  const tctx = await kontext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const t = await seite(tctx, F + '?beispiel');
  await t.evaluate(() => { setView('plan'); const x = state.blocks.find(b => b.id === 'bsp-projektsprint'); blockSheet(x, x.date); });
  await t.waitForSelector('#bAreas .chip');
  const d = await t.evaluate(() => {
    const r = e => e.getBoundingClientRect();
    const chips = [...document.querySelectorAll('#bAreas .chip')];
    const dazu = document.querySelector('#bSchrittDazu');
    const done = document.querySelector('#bDone');
    const fuss = [...document.querySelectorAll('.sheet__foot--eintrag > .btn')];
    const zeile = e => Math.round(r(e).top);
    const leise = fuss.filter(x => x.classList.contains('btn--leise')), haupt = fuss.filter(x => !x.classList.contains('btn--leise'));
    const ueber = (x, y) => { const a = r(x), b = r(y); return a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1; };
    let overlap = false;
    fuss.forEach((x, i) => fuss.slice(i + 1).forEach(y => { if (ueber(x, y)) overlap = true; }));
    return {
      chipH: Math.max(...chips.map(x => r(x).height)), spalten: new Set(chips.map(x => Math.round(r(x).left))).size,
      dazuH: r(dazu).height, dazuText: dazu.textContent, rund: getComputedStyle(done).borderRadius, doneKlasse: done.className,
      leise: leise.map(x => x.textContent).join(), haupt: haupt.map(x => x.textContent).join(),
      reihen: leise.length && haupt.length ? Math.max(...leise.map(zeile)) < Math.min(...haupt.map(zeile)) : false,
      gleich: haupt.length === 2 && Math.abs(r(haupt[0]).width - r(haupt[1]).width) < 2,
      rechts: Math.max(...fuss.map(x => r(x).right)), overlap, scroll: document.documentElement.scrollWidth
    };
  });
  ok(d.chipH <= 52 && d.spalten === 2, 'd) Bereiche als Raster in 2 Spalten, je eine Zeile (' + d.chipH + ' px)');
  ok(d.dazuText === 'Dazu' && d.dazuH <= 52, 'd) „Dazu" bricht nicht um (' + d.dazuH + ' px)');
  ok(d.doneKlasse.includes('task__check') && parseFloat(d.rund) >= 10, 'd) „Erledigt" ist eine runde Mulde (' + d.rund + ')');
  ok(d.leise === 'Löschen,Verschieben' && d.haupt === 'Abbrechen,Speichern' && d.reihen && d.gleich, 'd) Fuss: leise Nebenaktionen ueber zwei gleich breiten Hauptknoepfen');
  ok(!d.overlap && d.rechts <= 390 && d.scroll <= 390, 'd) nichts ueberlappt, nichts ragt aus dem Bild');
  if (process.env.WP_BILD) await t.screenshot({ path: path.join(process.env.WP_BILD, 'eintrag-handy.png') });
  await tctx.close();

  console.log('=== e) Konsole ===');
  ok(konsolenfehler.length === 0, 'e) keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));
  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nALLES GRUEN');
  process.exit(fehler.length ? 1 : 0);
})();
