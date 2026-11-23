/* ============================================================
   Pruefskript Nachtraster, Tagesband-Loose, Energie-Balken & Aufgaben-Umbruch

   Prueft die vier behobenen Live-Probleme aus v1.58:
     a) Ueber-Mitternacht (22:00-06:00) bei Standard-Einstellung dayStart=7,
        dayEnd=22: rasterGrenzen() weitet das sichtbare Raster pro Ansicht
        ohne state.settings zu veraendern; Sa 22-24 und So 0-6 bleiben
        vollstaendig sichtbar, beschriftet (00:00..24:00) und anklickbar.
        Normale Wochen ohne Nachttermine bleiben exakt 07:00-22:00.
     b) Tageswechsel am Telefon (renderDaySwitch): aktualisiert auch #looseBand
        sofort beim Antippen eines anderen Tages derselben Woche.
     c) Desktop-Tageskopf (.dayhead__energy): die drei Energie-Balken bleiben
        <= 4 px schmal statt durch .dayhead__last > i gestreckt zu werden.
     d) Aufgabenliste am Telefon (390x844): kein innerer horizontaler Scrollbalken
        (#taskList.scrollWidth <= clientWidth) und kein verwaister Strich | an
        .task__dur bei Umbruch.

   Feste Uhr und Zone: Mittwoch, 2026-08-05T10:00:00+02:00, Europe/Berlin.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const UHR = new Date('2026-08-05T10:00:00+02:00');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const konsolenfehler = [];
  const anhaengen = p => {
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });
  };

  /* ==============================================================
     Teil 1: iPhone (390x844, Touch)
     ============================================================== */
  {
    console.log('\n=== Teil 1: iPhone 390x844 ===');
    const ctx = await br.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: 'Europe/Berlin',
      locale: 'de-DE',
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2
    });
    const p = await ctx.newPage();
    anhaengen(p);

    await p.clock.setFixedTime(UHR);
    await p.goto(F);
    await p.waitForTimeout(500);

    const reset = () => p.evaluate(() => {
      if (typeof closeModal === 'function') closeModal();
      state = freshState(); migrate(state);
      state.settings.dayStart = 7; state.settings.dayEnd = 22;
      state.blocks = []; state.tasks = []; state.days = {};
      anchor = new Date(); selectedDayIdx = 5;
      save(); setView('plan'); renderAll();
    });

    // ---- a1) Kontrollprobe: normale Woche bleibt 07:00-22:00
    await reset();
    await p.evaluate(() => {
      const mon = mondayOf(anchor);
      state.blocks.push({ id: 'tag1', title: 'Büro', areaId: 'a1', day: 5, date: iso(addDays(mon, 5)),
        repeat: 'none', start: 9 * 60, end: 12 * 60, grob: false });
      save(); renderAll();
    });
    await p.waitForTimeout(150);
    const norm = await p.evaluate(() => ({
      ds: document.getElementById('grid').dataset.dayStart,
      de: document.getElementById('grid').dataset.dayEnd,
      marks: [...document.querySelectorAll('.timecol__mark')].map(x => x.textContent)
    }));
    ok(norm.ds === '7' && norm.de === '22' && norm.marks[0] === '07:00' && norm.marks[norm.marks.length - 1] === '22:00',
      'a1) Normale Woche bleibt exakt 07:00-22:00 (' + norm.ds + '..' + norm.de + ')');

    // ---- a2) Clubnacht Sa 22:00-06:00 ueber den echten Editor
    await reset();
    await p.evaluate(() => { newBlock(5, iso(addDays(mondayOf(anchor), 5)), 20 * 60, 21 * 60); });
    await p.waitForTimeout(150);
    await p.fill('#bTitle', 'Clubnacht');
    await p.fill('#bFrom', '22:00');
    await p.fill('#bTo', '06:00');
    await p.click('.sheet .btn--primary');
    await p.waitForTimeout(250);

    const sa = await p.evaluate(() => {
      const wrap = document.getElementById('gridWrap');
      wrap.scrollTop = wrap.scrollHeight;
      const grid = document.getElementById('grid');
      const gr = grid.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const blk = grid.querySelector('.block');
      const br = blk ? blk.getBoundingClientRect() : null;
      return {
        settings: { s: state.settings.dayStart, e: state.settings.dayEnd },
        ds: grid.dataset.dayStart, de: grid.dataset.dayEnd,
        marks: [...document.querySelectorAll('.timecol__mark')].map(x => x.textContent),
        gr, wr, br, text: blk ? blk.textContent : ''
      };
    });
    ok(sa.settings.s === 7 && sa.settings.e === 22, 'a2) state.settings.dayStart/dayEnd bleibt unveraendert (7..22)');
    ok(sa.ds === '7' && sa.de === '24' && sa.marks.includes('23:00') && sa.marks.includes('24:00'),
      'a3) Sa erweitert das Raster auf 07:00-24:00 inkl. Achsenbeschriftung');
    ok(!!sa.br && sa.br.top >= sa.gr.top - 1 && sa.br.bottom <= sa.gr.bottom + 2 && sa.br.bottom > sa.wr.top && sa.br.top < sa.wr.bottom,
      'a4) Sa 22:00-24:00 liegt vollstaendig im sichtbaren Raster (' + JSON.stringify({ top: Math.round(sa.br.top), bottom: Math.round(sa.br.bottom), gridBottom: Math.round(sa.gr.bottom) }) + ')');
    await p.screenshot({ path: path.join(__dirname, 'nr-iphone-sa.png') });

    // Sonntag im Tagesstreifen antippen (zweiter Teil 00:00-06:00)
    await p.tap('.dayswitch__btn[data-tag="2026-08-09"]');
    await p.waitForTimeout(250);
    const so = await p.evaluate(() => {
      const wrap = document.getElementById('gridWrap');
      const grid = document.getElementById('grid');
      const gr = grid.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const blk = grid.querySelector('.block');
      const br = blk ? blk.getBoundingClientRect() : null;
      const mark0 = document.querySelector('.timecol__mark');
      return {
        ds: grid.dataset.dayStart, de: grid.dataset.dayEnd,
        marks: [...document.querySelectorAll('.timecol__mark')].map(x => x.textContent),
        mark0Top: mark0 ? Math.round(mark0.getBoundingClientRect().top) : null,
        wrapTop: Math.round(wr.top),
        gr, wr, br, scrollTop: wrap.scrollTop
      };
    });
    ok(so.ds === '0' && so.de === '22' && so.marks[0] === '00:00' && so.marks.includes('06:00'),
      'a5) So erweitert das Raster nach oben auf 00:00-22:00 (' + so.marks.slice(0, 4).join(',') + ')');
    ok(so.mark0Top >= so.wrapTop - 1, 'a6) 00:00-Markierung oben nicht abgeschnitten (' + so.mark0Top + ' >= ' + so.wrapTop + ')');
    ok(!!so.br && so.br.top >= so.gr.top - 1 && so.br.top >= so.wr.top - 1 && so.br.bottom <= so.wr.bottom + 2,
      'a7) So 00:00-06:00 ist sofort sichtbar statt ueber 07:00 abgeschnitten (' + JSON.stringify({ top: Math.round(so.br.top), bottom: Math.round(so.br.bottom), wrapTop: Math.round(so.wr.top) }) + ')');
    await p.screenshot({ path: path.join(__dirname, 'nr-iphone-so.png') });

    await p.tap('#grid .block');
    await p.waitForTimeout(200);
    const editor = await p.evaluate(() => ({
      offen: !!document.querySelector('.sheet'),
      von: (document.getElementById('bFrom') || {}).value,
      bis: (document.getElementById('bTo') || {}).value
    }));
    ok(editor.offen && editor.von === '22:00' && editor.bis === '06:00',
      'a8) Tipp auf Sonntags-Haelfte oeffnet Editor mit 22:00-06:00 (' + JSON.stringify(editor) + ')');

    // ---- b) Tageswechsel im Tagesstreifen aktualisiert #looseBand sofort
    await reset();
    await p.evaluate(() => {
      const mon = mondayOf(anchor);
      state.blocks = [
        { id: 'l-mo', title: 'Wäsche', areaId: 'a7', day: 0, date: iso(mon), repeat: 'none', grob: true, teil: 'ab', dauer: 45, start: 0, end: 0 },
        { id: 'l-sa', title: 'Festival-Check', areaId: 'a4', day: 5, date: iso(addDays(mon, 5)), repeat: 'none', grob: true, teil: 'nm', dauer: 60, start: 0, end: 0 }
      ];
      selectedDayIdx = 0; save(); setView('plan'); renderAll();
    });
    await p.waitForTimeout(150);
    const lbMo = await p.evaluate(() => ({ hidden: document.getElementById('looseBand').hidden, text: document.getElementById('looseBand').textContent }));
    ok(!lbMo.hidden && lbMo.text.includes('Wäsche') && !lbMo.text.includes('Festival-Check'), 'b1) Mo zeigt Mo-Loose-Eintrag');

    await p.tap('.dayswitch__btn[data-tag="2026-08-08"]');
    await p.waitForTimeout(150);
    const lbSa = await p.evaluate(() => ({ hidden: document.getElementById('looseBand').hidden, text: document.getElementById('looseBand').textContent }));
    ok(!lbSa.hidden && lbSa.text.includes('Festival-Check') && !lbSa.text.includes('Wäsche'),
      'b2) Tipp auf Sa aktualisiert #looseBand sofort auf Sa (' + lbSa.text.slice(0, 40) + ')');

    await p.tap('.dayswitch__btn[data-tag="2026-08-04"]');
    await p.waitForTimeout(150);
    const lbDi = await p.evaluate(() => document.getElementById('looseBand').hidden);
    ok(lbDi === true, 'b3) Tipp auf Di ohne grobe Eintraege blendet #looseBand sofort aus');

    // ---- d) Aufgabenliste am Telefon: 0px Quer-Overflow & kein | an .task__dur
    await reset();
    await p.evaluate(() => {
      const mon = mondayOf(anchor);
      state.blocks = [{ id: 'sug-t2', title: 'Neues Kaffeerezept ausprobieren', areaId: 'a5', taskId: 't2',
        day: 4, date: iso(addDays(mon, 4)), repeat: 'none', start: 20 * 60 + 40, end: 21 * 60 + 10, sug: true, frog: false }];
      state.tasks = [
        { id: 't1', title: 'Präsentation vorbereiten', areaId: 'a1', done: false, frog: true, dauer: 90, frist: iso(addDays(mon, 3)) },
        { id: 't2', title: 'Neues Kaffeerezept ausprobieren', areaId: 'a5', done: false, frog: false, dauer: 30, geplant: 'sug-t2' },
        { id: 't3', title: 'Fahrrad reparieren', areaId: 'a7', done: false, frog: false }
      ];
      save(); setView('aufgaben'); renderAll();
    });
    await p.waitForTimeout(200);
    const auf = await p.evaluate(() => {
      const list = document.getElementById('taskList');
      const dur = list.querySelector('.task__dur');
      const docOver = document.documentElement.scrollWidth > window.innerWidth + 1;
      const offenTxt = [...list.querySelectorAll('.task__meta span')].map(s => s.textContent).find(t => t.includes('Dauer offen')) || '';
      return {
        scrollW: list.scrollWidth, clientW: list.clientWidth, docOver,
        borderLeft: dur ? getComputedStyle(dur).borderLeftWidth : null,
        offenTxt
      };
    });
    ok(auf.scrollW <= auf.clientW && !auf.docOver,
      'd1) Aufgabenliste hat 0px horizontalen Ueberlauf (' + auf.scrollW + ' <= ' + auf.clientW + ')');
    ok(auf.borderLeft === '0px', 'd2) .task__dur hat keinen linken Trennstrich mehr (' + auf.borderLeft + ')');
    ok(auf.offenTxt === 'Dauer offen', 'd3) Dauer offen ohne fuehrenden Punkt (' + JSON.stringify(auf.offenTxt) + ')');
    await p.screenshot({ path: path.join(__dirname, 'nr-iphone-aufgaben.png') });

    await ctx.close();
  }

  /* ==============================================================
     Teil 2: Desktop 1440x900 (Ueber-Mitternacht & Energie-Balken)
     ============================================================== */
  {
    console.log('\n=== Teil 2: Desktop 1440x900 ===');
    const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
    const p = await ctx.newPage();
    anhaengen(p);

    await p.clock.setFixedTime(UHR);
    await p.goto(F);
    await p.waitForTimeout(500);

    await p.evaluate(() => {
      if (typeof closeModal === 'function') closeModal();
      state = freshState(); migrate(state);
      state.settings.dayStart = 7; state.settings.dayEnd = 22;
      const mon = mondayOf(anchor);
      const todayKey = iso(new Date());
      state.days[todayKey] = { energy: 'mid' };
      // Auslastung > 100% am Mittwoch (today) -> .is-voll + data-energy="mid"
      state.blocks = [
        { id: 'd-mi1', title: 'Arbeit', areaId: 'a1', day: 2, date: todayKey, repeat: 'none', start: 8 * 60, end: 18 * 60 + 30 },
        { id: 'd-sa', title: 'Clubnacht', areaId: 'a5', day: 5, date: iso(addDays(mon, 5)), repeat: 'none', start: 22 * 60, end: 24 * 60, nacht: 'd-so' },
        { id: 'd-so', title: 'Clubnacht', areaId: 'a5', day: 6, date: iso(addDays(mon, 6)), repeat: 'none', start: 0, end: 6 * 60, nacht: 'd-sa' }
      ];
      state.tasks = [];
      save(); setView('plan'); renderAll();
      document.getElementById('gridWrap').scrollTop = 0;
    });
    await p.waitForTimeout(250);

    const desk = await p.evaluate(() => {
      const grid = document.getElementById('grid');
      const gr = grid.getBoundingClientRect();
      const marks = [...document.querySelectorAll('.timecol__mark')].map(x => x.textContent);
      const saBlk = grid.querySelector('[data-id="d-sa"]');
      const soBlk = grid.querySelector('[data-id="d-so"]');
      const energyWidths = [...document.querySelectorAll('.dayhead.is-today .dayhead__energy i')].map(el => Math.round(el.getBoundingClientRect().width * 10) / 10);
      const lastWidths = [...document.querySelectorAll('.dayhead__last > i')].map(el => Math.round(el.getBoundingClientRect().width * 10) / 10);
      const heuteHead = document.querySelector('.dayhead.is-today');
      return {
        ds: grid.dataset.dayStart, de: grid.dataset.dayEnd,
        firstMark: marks[0], lastMark: marks[marks.length - 1],
        gr,
        saRect: saBlk ? saBlk.getBoundingClientRect() : null,
        soRect: soBlk ? soBlk.getBoundingClientRect() : null,
        energyWidths, lastWidths,
        heuteVoll: !!(heuteHead && heuteHead.classList.contains('is-voll')),
        heuteEnergy: heuteHead ? heuteHead.dataset.energy : null
      };
    });

    ok(desk.ds === '0' && desk.de === '24' && desk.firstMark === '00:00' && desk.lastMark === '24:00',
      'c1) Desktop-Wochenraster weitet sich auf 00:00-24:00 (' + desk.firstMark + '..' + desk.lastMark + ')');
    ok(!!desk.saRect && desk.saRect.top >= desk.gr.top - 1 && desk.saRect.bottom <= desk.gr.bottom + 2,
      'c2) Desktop Sa 22:00-24:00 im Raster (' + Math.round(desk.saRect.top) + '..' + Math.round(desk.saRect.bottom) + ')');
    ok(!!desk.soRect && desk.soRect.top >= desk.gr.top - 1 && desk.soRect.bottom <= desk.gr.bottom + 2,
      'c3) Desktop So 00:00-06:00 im Raster (' + Math.round(desk.soRect.top) + '..' + Math.round(desk.soRect.bottom) + ')');
    ok(desk.heuteVoll && desk.heuteEnergy === 'mid', 'c4) Heute-Kopf traegt is-voll und data-energy="mid"');
    ok(desk.energyWidths.length === 3 && desk.energyWidths.every(w => w >= 2 && w <= 4),
      'c5) Energie-Balken im Tageskopf bleiben sichtbar und <= 4 px schmal (' + JSON.stringify(desk.energyWidths) + ')');
    ok(desk.lastWidths.length >= 1 && desk.lastWidths.every(w => w >= 20),
      'c6) Auslastungsbalken .dayhead__last > i bleibt >= 20 px breit (' + JSON.stringify(desk.lastWidths.slice(0, 6)) + ')');

    await p.screenshot({ path: path.join(__dirname, 'nr-desktop.png') });

    await p.click('[data-id="d-so"]');
    await p.waitForTimeout(200);
    const deskEd = await p.evaluate(() => ({
      offen: !!document.querySelector('.sheet'),
      von: (document.getElementById('bFrom') || {}).value,
      bis: (document.getElementById('bTo') || {}).value
    }));
    ok(deskEd.offen && deskEd.von === '22:00' && deskEd.bis === '06:00',
      'c7) Klick auf So 00:00-06:00 oeffnet Editor mit 22:00-06:00');

    await ctx.close();
  }

  ok(!konsolenfehler.length, 'Keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));
  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nAlles gruen.');
  process.exit(fehler.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
