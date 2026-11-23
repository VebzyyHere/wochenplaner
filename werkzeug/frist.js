/* ============================================================
   Pruefskript Fristen und Feiertage im Verteiler (v1.47)

   a) Feiertage freihalten: in der Weihnachtswoche 2026 (Fr 25.12. ist
      Feiertag) schlaegt der Verteiler am Freitag nichts vor; freeGaps()
      nennt den Grund „Feiertag". Mit ausgeschaltetem Schalter
      (settings.feiertageFrei === false) ist der Freitag wieder offen.
   b) Schalter in den Einstellungen: aus schreibt false, an entfernt das
      Feld wieder; migrate() laesst nur false stehen.
   c) Frist an der Aufgabe: Feld im Aufgabenblatt speichert task.frist,
      die Zeile zeigt „bis Mi 23.12. · in 2 Tagen"; eine verstrichene Frist
      wird nur sachlich genannt; migrate() entfernt Unsinn.
   d) Verteiler: eine Aufgabe mit Frist Dienstag bekommt ihren Vorschlag
      spaetestens am Dienstag; ist davor kein Platz, kommt sie trotzdem
      unter (lieber spaet als gar nicht).
   e) Reihenfolge „Ohne Platz": fruehere Frist zuerst, ohne Frist zuletzt.
   f) Ausblick nennt die Aufgabe mit Zaehler und „Frist".
   g) keine Konsolenfehler.

   Feste Uhr: Montag 2026-12-21, 08:00 Europe/Berlin.
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

  await p.clock.setFixedTime(new Date('2026-12-21T08:00:00+01:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  const basis = (aufgaben = [], bloecke = []) => p.evaluate(([tk, bl]) => {
    state = freshState(); migrate(state);
    state.profile.name = 'Test';
    state.areas.forEach(a => { a.plan.goal = 0; });
    state.blocks = bl; state.tasks = tk.map((t, i) => ({ id: 't' + i, done: false, frog: false, areaId: state.areas[0].id, ...t }));
    anchor = new Date(); selectedDayIdx = 0;
    save(); setView('aufgaben'); renderAll();
  }, [aufgaben, bloecke]);

  console.log('=== a) Feiertage freihalten ===');
  await basis();
  const a = await p.evaluate(() => {
    const a0 = state.areas[0];
    a0.plan.goal = 14; a0.plan.days = [0, 1, 2, 3, 4, 5, 6];
    const fr = weekDays()[4];
    const anGaps = freeGaps(fr, a0.plan, a0);
    buildSuggestions();
    const anFr = state.blocks.filter(b => b.sug && b.date === '2026-12-25').length;
    const anGesamt = state.blocks.filter(b => b.sug).length;
    clearSuggestions();
    state.settings.feiertageFrei = false;
    const ausGaps = freeGaps(fr, a0.plan, a0);
    const hand = freeGaps(fr, a0.plan, a0, { ignoreFrei: true }).length;
    delete state.settings.feiertageFrei;
    return { key: fr.key, anLen: anGaps.length, grund: anGaps.gruende, anFr, anGesamt, ausLen: ausGaps.length, hand,
      gesperrt: vorschlagGesperrt('2026-12-25'), normal: vorschlagGesperrt('2026-12-24') };
  });
  ok(a.key === '2026-12-25' && a.anLen === 0 && (a.grund || []).includes('Feiertag'), 'a) freeGaps am 25.12.: keine Luecke, Grund „Feiertag"');
  ok(a.anGesamt > 0 && a.anFr === 0, 'a) Verteiler: ' + a.anGesamt + ' Vorschlaege in der Woche, keiner am Feiertag');
  ok(a.ausLen > 0, 'a) Schalter aus: der Freitag ist wieder offen');
  ok(a.gesperrt && !a.normal, 'a) Heiligabend ist kein Feiertag und bleibt offen');

  console.log('=== b) Schalter ===');
  await p.evaluate(() => { clearSuggestions(); save(); });
  const schalten = async an => {
    await p.evaluate(() => document.getElementById('settingsBtn').click());
    await p.waitForTimeout(300);
    await p.evaluate(an => {
      const box = document.getElementById('sFeiertage');
      if (box.checked !== an) { box.checked = an; box.dispatchEvent(new Event('change', { bubbles: true })); }
    }, an);
    const da = await p.evaluate(() => !!document.getElementById('sFeiertage'));
    await p.evaluate(() => { const b = [...document.querySelectorAll('.sheet__foot .btn')].find(x => /Fertig|Speichern|Schließen/.test(x.textContent)); b.click(); });
    await p.waitForTimeout(300);
    return da;
  };
  const da = await schalten(false);
  const b1 = await p.evaluate(() => state.settings.feiertageFrei);
  ok(da && b1 === false, 'b) Schalter aus schreibt settings.feiertageFrei = false');
  await schalten(true);
  const b2 = await p.evaluate(() => ({ hat: 'feiertageFrei' in state.settings,
    mig: (() => { const s = JSON.parse(JSON.stringify(state)); s.settings.feiertageFrei = 'ja'; migrate(s); const x = 'feiertageFrei' in s.settings;
                  s.settings.feiertageFrei = false; migrate(s); return [x, s.settings.feiertageFrei]; })() }));
  ok(!b2.hat, 'b) Schalter an entfernt das Feld wieder');
  ok(b2.mig[0] === false && b2.mig[1] === false, 'b) migrate(): Unsinn faellt weg, false bleibt');

  console.log('=== c) Frist an der Aufgabe ===');
  await basis([{ title: 'Hausarbeit abgeben', dauer: 60 }, { title: 'Alte Sache', dauer: 30, frist: '2026-12-18' }]);
  await p.evaluate(() => taskSheet(state.tasks[0]));
  await p.waitForTimeout(300);
  await p.fill('#tkFrist', '2026-12-23');
  await p.evaluate(() => { const b = [...document.querySelectorAll('.sheet__foot .btn')].find(x => /Speichern|Fertig|Sichern/.test(x.textContent)); b.click(); });
  await p.waitForTimeout(300);
  const c = await p.evaluate(() => ({
    frist: state.tasks[0].frist, offen: !!document.querySelector('.sheet'),
    zeilen: [...document.querySelectorAll('.task')].map(z => ({ t: (z.querySelector('.task__title') || z).textContent, f: (z.querySelector('.task__frist') || {}).textContent || null,
      k: (z.querySelector('.task__frist') || {}).className || '' })),
    mig: (() => { const s = JSON.parse(JSON.stringify(state)); s.tasks[0].frist = '23.12.'; s.tasks[1].frist = 20261218; migrate(s); return s.tasks.map(t => t.frist); })()
  }));
  ok(c.frist === '2026-12-23' && !c.offen, 'c) Aufgabenblatt speichert task.frist');
  const z0 = c.zeilen.find(z => z.t.includes('Hausarbeit')), z1 = c.zeilen.find(z => z.t.includes('Alte Sache'));
  ok(!!z0 && z0.f === 'bis Mi 23.12. · in 2 Tagen' && z0.k.includes('is-nah'), 'c) Zeile zeigt ' + JSON.stringify(z0 && z0.f));
  ok(!!z1 && z1.f === 'Frist war Fr 18.12.' && !z1.k.includes('is-nah'), 'c) verstrichene Frist sachlich: ' + JSON.stringify(z1 && z1.f));
  ok(c.mig.every(x => x === undefined), 'c) migrate() entfernt ungueltige Fristen');

  console.log('=== d) Verteiler vor der Frist ===');
  await basis([{ title: 'Bis Dienstag', dauer: 60, frist: '2026-12-22' }, { title: 'Ohne Frist', dauer: 60 }]);
  const d1 = await p.evaluate(() => { buildSuggestions(); const b = state.blocks.find(x => x.taskId === 't0'); return b ? b.date : null; });
  ok(d1 === '2026-12-21' || d1 === '2026-12-22', 'd) Vorschlag liegt spaetestens am Fristtag: ' + d1);
  const voll = ['2026-12-21', '2026-12-22'].map((dt, i) => ({ id: 'v' + i, title: 'Voll', areaId: null, day: i, date: dt, repeat: 'none', start: 0, end: 1440, frog: false }));
  await basis([{ title: 'Bis Dienstag', dauer: 60, frist: '2026-12-22' }]);
  const d2 = await p.evaluate(bl => {
    bl.forEach(b => { b.areaId = state.areas[1].id; state.blocks.push(b); });
    buildSuggestions(); const b = state.blocks.find(x => x.taskId === 't0'); return b ? b.date : null;
  }, voll);
  ok(!!d2 && d2 > '2026-12-22', 'd) kein Platz vor der Frist: die Aufgabe kommt trotzdem unter (' + d2 + ')');

  console.log('=== e) Reihenfolge ===');
  await basis([{ title: 'Aaa ohne Frist', dauer: 30 }, { title: 'Zzz spaet', dauer: 30, frist: '2027-01-10' }, { title: 'Mmm frueh', dauer: 30, frist: '2026-12-28' }]);
  const e = await p.evaluate(() => [...document.querySelectorAll('.task .task__title')].map(x => x.textContent));
  ok(e.join('|').indexOf('Mmm') < e.join('|').indexOf('Zzz') && e.join('|').indexOf('Zzz') < e.join('|').indexOf('Aaa'), 'e) fruehere Frist zuerst, ohne Frist zuletzt: ' + e.join(' | '));

  console.log('=== f) Ausblick ===');
  await p.evaluate(() => ausblickSheet());
  await p.waitForTimeout(700);
  const f = await p.evaluate(() => [...document.querySelectorAll('.kommt__row')].map(r => r.textContent));
  ok(f.some(z => z.includes('Mmm frueh') && z.includes('in 7 Tagen') && z.includes('Frist')), 'f) Ausblick nennt die Aufgabe mit Zaehler und „Frist": ' + JSON.stringify(f.find(z => z.includes('Mmm'))));
  ok(!(await p.evaluate(() => !!document.querySelector('.ausblick__leer'))), 'f) kein Leer-Hinweis, wenn eine Frist ansteht');

  console.log('=== g) Konsole ===');
  ok(konsolenfehler.length === 0, 'g) keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));

  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nAlles gruen.');
  process.exit(fehler.length ? 1 : 0);
})();
