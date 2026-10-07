/* ============================================================
   Prüfskript Übersicht (v1.31)

   Prüft die Übersichts-Runde:
     a) Klebetitel — ein langer Block, dessen Anfang oben aus dem Bild
                     gescrollt ist, zeigt seinen Titel UNTER dem Tageskopf
                     (vorher klebte er bei festen 58px und verschwand hinter
                     dem ~89px hohen Kopf). Am Telefon (kein Tageskopf im
                     Raster) klebt er am oberen Rand statt 58px darunter.
     b) Wochenkopf — jeder Tag nennt am Desktop seine verplanten Stunden
                     (dieselbe tagesAuslastung() wie der Tagesstreifen am
                     Telefon), ein freigehaltener Tag sagt „frei". Der
                     gewählte Tag ist markiert (aria-pressed) und per
                     Tastatur wählbar.
     c) Tagesform  — die drei Knöpfe zeigen ihre Stufe auch unausgewählt
                     (1, 2, 3 Balken statt dreimal dasselbe Symbol).
     d) Kalender   — kalenderIcs(): gültiger Rahmen, CRLF, gefaltete Zeilen
                     ≤ 75 Oktette, Serien als RRULE (INTERVAL=2 für
                     zweiwöchentlich), Ausnahmen als EXDATE, ohne Vorschläge
                     und ohne grobe Blöcke, Sonderzeichen maskiert, 24:00 als
                     Folgetag. Der Knopf in den Einstellungen lädt eine
                     .ics-Datei herunter und verändert den Plan nicht.
     e) Tastatur   — „?" öffnet die Kürzel-Übersicht, „m" die Monats-,
                     „w" die Wochenübersicht; beides bewegt anchor nicht.
                     In einem Eingabefeld bleiben die Tasten Text.

   Feste Uhr (Mittwoch, 2026-09-09T10:15:00+02:00) und feste Zone — der
   Wochenkopf rechnet mit „heute".
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const UHR = new Date('2026-09-09T10:15:00+02:00');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// Dieselbe Beispielwoche wie release/ansichten.cjs, gekürzt.
const beispiel = () => {
  closeModal(); state = freshState(); migrate(state);
  state.settings.sleep = { on: true, from: 1380, to: 420, wind: 30 };
  const mon = mondayOf(new Date()); anchor = new Date(); selectedDayIdx = 2;
  state.rituale[iso(mon)] = Date.now();
  const block = (id, title, areaId, day, start, end, extra = {}) => ({
    id, title, areaId, day, date: iso(addDays(mon, day)), start, end, repeat: 'none', ...extra
  });
  state.blocks = [
    block('mo1', 'Arbeit', 'a1', 0, 540, 720), block('mo2', 'Projektzeit', 'a1', 0, 780, 960),
    block('di1', 'Arbeit', 'a1', 1, 540, 720),
    block('mi1', 'Projektbesprechung', 'a1', 2, 600, 660),
    block('mi2', 'Lange Schreibzeit', 'a2', 2, 480, 780),
    block('do2', 'Rezept abholen', 'a7', 3, 780, 795, { sug: true, grund: 'Platz vor dem Termin.' }),
    block('hobby', 'Zeit für Musik', 'a4', 1, 1080, 1200, { grob: true, teil: 'ab', dauer: 120 })
  ];
  state.tasks = [];
  dayMeta(iso(addDays(mon, 6))).frei = true;
  save(); renderAll();
};

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const konsolenfehler = [];
  const seite = async (dev) => {
    const ctx = await br.newContext({ ...dev, timezoneId: 'Europe/Berlin', acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) konsolenfehler.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(UHR);
    await p.goto(F);
    await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
    await p.evaluate(beispiel);
    await p.waitForTimeout(300);
    return { ctx, p };
  };

  /* ---------------- Desktop ---------------- */
  {
    // v1.42: 900 statt 1000 px Höhe. Seit Arbeitsfläche und Raster am Desktop
    // randlos stehen (kein 16-px-Rahmen mehr), passte der Tag bei 1000 px fast
    // ganz ins Bild — das Raster ließ sich nur noch 3 px scrollen und es gab
    // nichts, was oben angeschnitten werden konnte. Geprüft wird dasselbe.
    const { ctx, p } = await seite({ viewport: { width: 1440, height: 900 } });

    console.log('a) Klebetitel am Desktop');
    await p.evaluate(() => { const w = $('#gridWrap'); w.scrollTop = 3 * 52; w.dispatchEvent(new Event('scroll')); });
    await p.waitForTimeout(150);
    const a = await p.evaluate(() => {
      const kopf = document.querySelector('.dayhead:not(.dayhead--gutter)').getBoundingClientRect().bottom;
      return [...document.querySelectorAll('.block')].map(el => {
        const r = el.getBoundingClientRect(), t = el.querySelector('.block__title').getBoundingClientRect();
        return { titel: el.querySelector('.block__title').textContent, oben: r.top, unten: r.bottom, tOben: t.top, tUnten: t.bottom, kopf };
      });
    });
    const angeschnitten = a.filter(x => x.oben < x.kopf && x.unten > x.kopf + 60);
    ok(angeschnitten.length >= 2, 'es gibt oben angeschnittene lange Blöcke (' + angeschnitten.map(x => x.titel).join(', ') + ')');
    angeschnitten.forEach(x => ok(x.tOben >= x.kopf - 0.5 && x.tOben <= x.kopf + 8,
      '„' + x.titel + '": Titel klebt direkt unter dem Tageskopf (Titel ' + Math.round(x.tOben) + ' / Kopf ' + Math.round(x.kopf) + ')'));

    console.log('b) Wochenkopf mit Stunden');
    await p.evaluate(() => { $('#gridWrap').scrollTop = 0; });
    const kopf = await p.evaluate(() => [...document.querySelectorAll('.dayhead:not(.dayhead--gutter)')].map(h => ({
      std: (h.querySelector('.dayhead__std') || {}).textContent || '',
      label: h.getAttribute('aria-label') || '', gedrueckt: h.getAttribute('aria-pressed'),
      rolle: h.getAttribute('role'), tab: h.tabIndex, bar: getComputedStyle(h.querySelector('.dayhead__last') || h).getPropertyValue('--last').trim()
    })));
    ok(kopf.length === 7, 'sieben Tagesköpfe');
    ok(kopf[0].std === '6 h', 'Montag nennt 6 h (ist: „' + kopf[0].std + '")');
    ok(/6 h geplant/.test(kopf[0].label), 'Montag: Vorleseetikett nennt „6 h geplant" (' + kopf[0].label + ')');
    ok(kopf[1].std === '5 h', 'Dienstag zählt den groben Block mit: 5 h (ist: „' + kopf[1].std + '")');
    ok(kopf[3].std === '15 min', 'Donnerstag zählt den Vorschlag mit: 15 min (ist: „' + kopf[3].std + '")');
    ok(kopf[4].std === '–', 'leerer Freitag zeigt „–" (ist: „' + kopf[4].std + '")');
    ok(kopf[6].std === '' && /freigehalten/.test(kopf[6].label), 'freigehaltener Sonntag: keine Stundenzahl, Etikett „freigehalten"');
    ok(kopf.every(k => k.rolle === 'button' && k.tab === 0), 'alle Tagesköpfe sind Knöpfe in der Tab-Reihenfolge');
    ok(kopf[2].gedrueckt === 'true' && kopf.filter(k => k.gedrueckt === 'true').length === 1, 'genau der gewählte Mittwoch ist gedrückt');
    ok(parseFloat(kopf[0].bar) > 0, 'Montag hat einen gefüllten Balken (' + kopf[0].bar + ')');

    await p.click('.dayhead:not(.dayhead--gutter) >> nth=3');
    await p.waitForTimeout(100);
    ok(await p.evaluate(() => selectedDayIdx === 3 && document.querySelectorAll('.dayhead[aria-pressed="true"]').length === 1
      && document.querySelectorAll('.dayhead:not(.dayhead--gutter)')[3].getAttribute('aria-pressed') === 'true'),
      'Klick auf Donnerstag wählt ihn und markiert nur ihn');
    await p.focus('.dayhead:not(.dayhead--gutter) >> nth=4');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(100);
    ok(await p.evaluate(() => selectedDayIdx === 4 && document.activeElement && document.activeElement.classList.contains('dayhead')),
      'Enter auf Freitag wählt ihn, der Fokus bleibt auf dem Tageskopf');
    await p.keyboard.press(' ');
    await p.waitForTimeout(100);
    ok(await p.evaluate(() => selectedDayIdx === 4 && document.scrollingElement.scrollTop === 0), 'Leertaste scrollt die Seite nicht weg');

    console.log('c) Tagesform zeigt ihre Stufe');
    await p.evaluate(() => setView('heute'));
    const tf = await p.evaluate(() => {
      const farbe = (lvl, n) => getComputedStyle(document.querySelector('.energy__opt[data-lvl="' + lvl + '"] .energy__bars i:nth-child(' + n + ')')).backgroundColor;
      const gedrueckt = [...document.querySelectorAll('.energy__opt')].map(b => b.getAttribute('aria-pressed'));
      return { gedrueckt, low: [1, 2, 3].map(n => farbe('low', n)), mid: [1, 2, 3].map(n => farbe('mid', n)), high: [1, 2, 3].map(n => farbe('high', n)) };
    });
    ok(tf.gedrueckt.every(x => x === 'false'), 'keine Tagesform gewählt');
    ok(tf.low[0] !== tf.low[1] && tf.low[1] === tf.low[2], '„Wenig" hebt einen Balken hervor');
    ok(tf.mid[0] === tf.mid[1] && tf.mid[1] !== tf.mid[2], '„Normal" hebt zwei Balken hervor');
    ok(tf.high[0] === tf.high[1] && tf.high[1] === tf.high[2] && tf.high[0] === tf.low[0], '„Viel" hebt alle drei hervor');

    console.log('d) Kalender-Export');
    const ics = await p.evaluate(() => {
      const mon = mondayOf(new Date());
      state.blocks.push(
        { id: 'serie1', title: 'Chor; Probe, Saal \\ 2', areaId: 'a4', day: 0, date: iso(mon), since: iso(mon), start: 1140, end: 1260, repeat: 'weekly', ausnahmen: [iso(addDays(mon, 14))] },
        { id: 'serie2', title: 'Putzen', areaId: 'a7', day: 5, date: iso(addDays(mon, 5)), since: iso(mon), start: 600, end: 660, repeat: '2wochen' },
        { id: 'spaet', title: 'Nachtschicht mit sehr langem Titel, der ganz sicher über fünfundsiebzig Oktette hinausgeht und gefaltet werden muss', areaId: 'a1', day: 4, date: iso(addDays(mon, 4)), start: 1320, end: 1440, repeat: 'none' }
      );
      save();
      return kalenderIcs();
    });
    const zeilen = ics.split('\r\n');
    const logisch = ics.replace(/\r\n[ \t]/g, '').split('\r\n');
    const ev = (uid) => { const i = logisch.findIndex(z => z === 'UID:' + uid + '@wochenplaner'); if (i < 0) return null; const e = logisch.slice(0, i).lastIndexOf('BEGIN:VEVENT'); return logisch.slice(e, logisch.indexOf('END:VEVENT', i) + 1); };
    ok(logisch[0] === 'BEGIN:VCALENDAR' && logisch.includes('VERSION:2.0') && logisch.some(z => z.startsWith('PRODID:')), 'Rahmen: VCALENDAR, VERSION, PRODID');
    ok(ics.endsWith('END:VCALENDAR\r\n') && !/[^\r]\n/.test(ics), 'Zeilenenden sind durchgehend CRLF');
    ok(zeilen.every(z => Buffer.byteLength(z, 'utf8') <= 75), 'keine Zeile länger als 75 Oktette');
    ok(ics.replace(/\r\n[ \t]/g, '') !== ics, 'der lange Titel wurde gefaltet');
    ok(!ev('do2'), 'offener Vorschlag wird nicht exportiert');
    ok(!ev('hobby'), 'grober Block (ohne Uhrzeit) wird nicht exportiert');
    const mo1 = ev('mo1');
    ok(mo1 && mo1.includes('DTSTART:20260907T090000') && mo1.includes('DTEND:20260907T120000') && mo1.includes('SUMMARY:Arbeit') && !mo1.some(z => z.startsWith('RRULE')), 'einmaliger Termin mit lokaler Zeit, ohne RRULE');
    const s1 = ev('serie1');
    ok(s1 && s1.includes('RRULE:FREQ=WEEKLY') && s1.includes('DTSTART:20260907T190000'), 'wöchentliche Serie als RRULE ab dem ersten Termin');
    ok(s1 && s1.includes('EXDATE:20260921T190000'), 'ausgelassener Serientag als EXDATE');
    ok(s1 && s1.includes('SUMMARY:Chor\\; Probe\\, Saal \\\\ 2'), 'Semikolon, Komma und Backslash maskiert');
    const s2 = ev('serie2');
    ok(s2 && s2.includes('RRULE:FREQ=WEEKLY;INTERVAL=2') && s2.includes('DTSTART:20260912T100000'), 'zweiwöchentliche Serie mit INTERVAL=2 ab Samstag, 12.9.');
    const sp = ev('spaet');
    ok(sp && sp.includes('DTEND:20260912T000000'), 'Ende 24:00 wird zu 0:00 des Folgetags');
    ok(logisch.filter(z => z === 'BEGIN:VEVENT').length === 8, 'genau acht Termine: fünf einmalige, zwei Serien, der späte (ist: ' + logisch.filter(z => z === 'BEGIN:VEVENT').length + ')');

    const vorher = await p.evaluate(() => JSON.stringify(state.blocks));
    await p.click('#settingsBtn');
    await p.click('.setmenu__item:has-text("Kalender")');
    await p.waitForSelector('#sKalender', { state: 'visible' });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#sKalender')]);
    ok(/\.ics$/.test(dl.suggestedFilename()), 'Einstellungen laden eine .ics-Datei herunter (' + dl.suggestedFilename() + ')');
    const inhalt = require('fs').readFileSync(await dl.path(), 'utf8');
    ok(inhalt.startsWith('BEGIN:VCALENDAR') && inhalt.includes('UID:serie1@wochenplaner'), 'heruntergeladene Datei enthält den Kalender');
    ok(await p.evaluate(v => JSON.stringify(state.blocks) === v, vorher), 'Export verändert den Plan nicht');
    await p.keyboard.press('Escape');

    console.log('e) Tastenkürzel');
    const anchorVorher = await p.evaluate(() => iso(anchor));
    await p.keyboard.press('?');
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => !!openModal && /Tastenkürzel/.test(openModal.querySelector('.sheet__title').textContent)), '„?" öffnet die Kürzel-Übersicht');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(() => !openModal), 'Escape schließt sie');
    await p.keyboard.press('m');
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => !!openModal && !!openModal.querySelector('#monatGrid')), '„m" öffnet die Monatsübersicht');
    await p.keyboard.press('Escape');
    await p.keyboard.press('w');
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => !!openModal && /Woche|KW/.test(openModal.textContent)), '„w" öffnet die Wochenübersicht');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(() => iso(anchor)) === anchorVorher, 'anchor bleibt beim Öffnen per Taste unverändert');
    await p.evaluate(() => setView('aufgaben'));
    await p.focus('#taskInput');
    await p.keyboard.type('m?w');
    ok(await p.evaluate(() => !openModal && $('#taskInput').value === 'm?w'), 'im Eingabefeld bleiben m, ? und w Text');

    await ctx.close();
  }

  /* ---------------- Telefon ---------------- */
  {
    console.log('a) Klebetitel am Telefon');
    const { ctx, p } = await seite({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
    await p.evaluate(() => setView('plan'));
    await p.waitForTimeout(150);
    // Mittwoch: „Lange Schreibzeit" 8–13 Uhr. Zwei Stunden hineinscrollen.
    await p.evaluate(() => { const w = $('#gridWrap'); const b = document.querySelector('.block[data-id="mi2"]'); w.scrollTop = b.offsetTop + 2 * 52; });
    await p.waitForTimeout(150);
    const t = await p.evaluate(() => {
      const w = $('#gridWrap').getBoundingClientRect().top;
      const t = document.querySelector('.block[data-id="mi2"] .block__title').getBoundingClientRect().top;
      return { w, t };
    });
    ok(t.t >= t.w - 0.5 && t.t <= t.w + 8, 'Titel klebt am oberen Rasterrand (Titel ' + Math.round(t.t) + ' / Rand ' + Math.round(t.w) + ')');
    ok(await p.evaluate(() => !document.querySelector('.dayhead')), 'am Telefon gibt es keinen Tageskopf im Raster');
    await ctx.close();
  }

  /* ---------------- Tablet ----------------
     Unter 1100px galt bisher pauschal top:0 für die Titel — richtig für die
     Eintagesansicht, falsch fürs Tablet, das sieben Tage MIT Kopf zeigt. */
  {
    console.log('a) Klebetitel am Tablet');
    const { ctx, p } = await seite({ ...devices['iPad (gen 7)'], deviceScaleFactor: 1 });
    await p.evaluate(() => setView('plan'));
    await p.waitForTimeout(150);
    await p.evaluate(() => { const w = $('#gridWrap'); const b = document.querySelector('.block[data-id="mo1"]'); w.scrollTop = b.offsetTop + 52; });
    await p.waitForTimeout(150);
    const t = await p.evaluate(() => ({
      kopf: document.querySelector('.dayhead:not(.dayhead--gutter)').getBoundingClientRect().bottom,
      titel: document.querySelector('.block[data-id="mo1"] .block__title').getBoundingClientRect().top
    }));
    ok(t.titel >= t.kopf - 0.5 && t.titel <= t.kopf + 8, 'Titel klebt unter dem Tageskopf (Titel ' + Math.round(t.titel) + ' / Kopf ' + Math.round(t.kopf) + ')');
    await ctx.close();
  }

  await br.close();
  ok(konsolenfehler.length === 0, 'keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nalles grün');
  process.exit(fehler.length ? 1 : 0);
})();
