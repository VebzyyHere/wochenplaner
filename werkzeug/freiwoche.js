/* ============================================================
   Pruefskript "Frei diese Woche" (Auftrag A) — #weekLabel oeffnet ein
   Blatt, das freeGaps() (3024) endlich zeigt: sieben Zeilen in Worten
   statt eines Rasters, aus dem man Luecken heraussuchen muss.

   Feste Uhr, Datum, Zeitzone (Hausvertrag): Donnerstag 13.08.2026 09:15
   Europe/Berlin, zoniertes Literal. Die Testwoche ist Montag 10.08. bis
   Sonntag 16.08.2026 — "heute" faellt auf Donnerstag, Montag bis
   Mittwoch sind "vorbei".
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const UHR = '2026-08-13T09:15:00+02:00';

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// Baut die im Auftrag verlangte Beispielwoche auf und rendert sie.
// idx: welcher Tag als "heute" gilt (selectedDayIdx) -- hier immer
// Donnerstag (3), die feste Uhr steht sowieso auf Donnerstag.
async function basiswocheAufbauen(p) {
  await p.evaluate(() => {
    state = freshState();
    migrate(state);
    anchor = new Date(2026, 7, 10); // Montag 10.08.2026
    const mon = mondayOf(anchor);
    const datum = i => iso(addDays(mon, i));

    // Arbeit Mo-Do 9-17, Freitag bewusst frei von Arbeit, damit dort eine
    // echte, klar nachrechenbare Terminluecke entsteht (Test b).
    [0, 1, 2, 3].forEach(i => {
      state.blocks.push({
        id: 'arbeit-' + i, title: 'Arbeit', areaId: 'a1', day: i, date: datum(i),
        repeat: 'weekly', since: datum(0), ortId: null,
        grob: false, start: 9 * 60, end: 17 * 60, frog: false
      });
    });
    // Vereinsabend am heutigen Donnerstag -- damit "heute" nicht einfach
    // "ab jetzt bis Feierabend" ist, sondern eine echte zweite Luecke danach.
    state.blocks.push({
      id: 'verein', title: 'Vereinsabend', areaId: 'a6', date: datum(3),
      ortId: null, grob: false, start: 19 * 60, end: 21 * 60, frog: false
    });
    // Freitag: ein einzelner fester Termin mitten am Vormittag -- zwei
    // klar getrennte, nachrechenbare Fenster drumherum (Test b).
    state.blocks.push({
      id: 'zahnarzt', title: 'Zahnarzt', areaId: 'a7', date: datum(4),
      ortId: null, grob: false, start: 10 * 60, end: 11 * 60, frog: false
    });
    // Samstag: nur ein grober Eintrag, keine Uhrzeit -- fuer freeGaps()
    // unsichtbar, fuer tagesAuslastung() reale Zeit (Test e).
    state.blocks.push({
      id: 'einkaufen', title: 'Einkaufen abends', areaId: 'a7', date: datum(5),
      ortId: null, grob: true, teil: 'ab', dauer: 60, frog: false
    });
    // Sonntag: bewusst freigehalten (Test d).
    dayMeta(datum(6)).frei = true;

    selectedDayIdx = 3; // Donnerstag
    save();
    renderAll();
  });
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.clock.setFixedTime(new Date(UHR));
  await p.goto(F);
  await p.waitForTimeout(500);
  // Erststart-Assistent wegklicken, bevor der eigene Zustand ueberschrieben
  // wird (wie frei.js/dialog.js).
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(150);

  await basiswocheAufbauen(p);
  await p.waitForTimeout(200);

  /* ---- a) Antippen oeffnet, ohne Antippen erscheint nichts ------------ */
  console.log('\n--- a) #weekLabel oeffnet "Frei diese Woche" ---');
  const vorAntippen = await p.evaluate(() => !!document.querySelector('.sheet'));
  ok(!vorAntippen, 'vor dem Antippen ist kein Blatt offen');

  const label = await p.evaluate(() => {
    const el = document.getElementById('weekLabel');
    return { tag: el.tagName, ariaLabel: el.getAttribute('aria-label'), hoehe: el.getBoundingClientRect().height };
  });
  ok(label.tag === 'BUTTON', '#weekLabel ist ein echter <button> (' + label.tag + ')');
  ok(!!label.ariaLabel, '#weekLabel hat ein aria-label (' + JSON.stringify(label.ariaLabel) + ')');
  ok(label.hoehe >= 44, '#weekLabel erreicht die 44px-Trefferflaeche (' + Math.round(label.hoehe) + 'px)');

  await p.click('#weekLabel');
  await p.waitForTimeout(300);
  const titel = await p.evaluate(() => (document.querySelector('.sheet__title') || {}).textContent);
  ok(titel === 'Frei diese Woche', 'Blatt "Frei diese Woche" ist nach dem Antippen offen (Titel: ' + JSON.stringify(titel) + ')');

  // Tastatur: Escape schliesst, Fokus kehrt zum Knopf zurueck (modal()
  // erledigt das generisch, hier nur die eigene Anbindung geprueft).
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  const nachEscape = await p.evaluate(() => ({
    offen: !!document.querySelector('.sheet'),
    fokus: document.activeElement && document.activeElement.id
  }));
  ok(!nachEscape.offen, 'Escape schliesst das Blatt wieder');
  ok(nachEscape.fokus === 'weekLabel', 'Fokus kehrt auf #weekLabel zurueck (' + nachEscape.fokus + ')');

  // Tastatur-Oeffnen: Fokus + Enter muss dasselbe tun wie ein Klick.
  await p.evaluate(() => document.getElementById('weekLabel').focus());
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const perTastatur = await p.evaluate(() => !!document.querySelector('.sheet'));
  ok(perTastatur, 'Enter auf dem fokussierten Knopf oeffnet das Blatt ebenso');

  /* ---- Zeilen aus dem offenen Blatt lesen ------------------------------ */
  const zeilen = await p.evaluate(() => {
    return [...document.querySelectorAll('.freizeitrow')].map(el => ({
      klasse: el.className,
      tag: el.querySelector('.freizeitrow__tag').textContent,
      text: el.querySelector('.freizeitrow__zeit').innerHTML
    }));
  });
  console.log('   Zeilen: ' + JSON.stringify(zeilen, null, 1));
  ok(zeilen.length === 7, 'genau sieben Zeilen, Montag bis Sonntag (' + zeilen.length + ')');

  /* ---- b) Termin-Tag: Zahlen gegen freeGaps() gegengerechnet ---------- */
  console.log('\n--- b) Freitag (fester Termin) -- Fenster gegen freeGaps() gegengerechnet ---');
  const freitag = await p.evaluate(() => {
    const day = weekDays()[4];
    const gaps = freeGaps(day, {}, null, {}).filter(g => g.end - g.start >= FREIZEIT_MIN);
    const z = freizeitZeile(day, iso(new Date()));
    return {
      gaps: gaps.map(g => ({ start: fmtTime(g.start), end: fmtTime(g.end) })),
      text: z.text, art: z.art
    };
  });
  console.log('   freeGaps (>=30min): ' + JSON.stringify(freitag.gaps) + '  -> Zeile: ' + freitag.text);
  ok(freitag.gaps.length === 2, 'Freitag hat genau zwei echte Fenster vor/nach dem Zahnarzt (' + freitag.gaps.length + ')');
  freitag.gaps.forEach(g => {
    const stueck = g.end === '22:00' ? 'ab <b>' + g.start + '</b>' : '<b>' + g.start + '–' + g.end + '</b>';
    ok(freitag.text.includes(stueck), 'Fenster ' + JSON.stringify(g) + ' steht wortgleich in der Zeile');
  });

  /* ---- c) Tag ganz ohne Eintrag zeigt "ganzer Tag frei" ---------------- */
  console.log('\n--- c) Tag ohne jeden Eintrag ---');
  const leer = await p.evaluate(() => {
    // Eigener, isoliert zurueckgesetzter Zustand -- sonst wuerde die
    // woechentliche Arbeit aus der Basiswoche (Tag 0, seit 10.08.) auch
    // hier auf Montag zuschlagen, egal wie weit die Woche in der Zukunft
    // liegt. state/anchor werden danach sofort wiederhergestellt.
    const savedState = state, savedAnchor = anchor;
    state = freshState(); migrate(state);
    anchor = new Date(2026, 8, 7); // Montag 07.09.2026, komplett zukuenftig
    const day = weekDays()[0];
    const z = freizeitZeile(day, iso(new Date()));
    state = savedState; anchor = savedAnchor;
    return z;
  });
  ok(leer.text === '<b>ganzer Tag frei</b>', 'leerer zukuenftiger Tag: "ganzer Tag frei" (' + JSON.stringify(leer.text) + ')');
  ok(leer.art === 'ganz', 'art ist "ganz"');

  /* ---- d) Freigehaltener Tag erscheint als frei, nicht als "nichts frei" */
  console.log('\n--- d) Sonntag (freigehalten) ---');
  const sonntagZeile = zeilen[6];
  ok(sonntagZeile.text.includes('freigehalten'), 'Sonntag nennt sich "freigehalten" (' + sonntagZeile.text + ')');
  ok(!sonntagZeile.text.includes('nichts frei'), 'Sonntag steht NICHT als "nichts frei" da');
  ok(sonntagZeile.text.includes('<b>'), 'Sonntag ist fett hervorgehoben, genau wie "ganzer Tag frei" (' + sonntagZeile.text + ')');

  /* ---- e) Grober Eintrag wird genannt, Fenster bleiben korrekt -------- */
  console.log('\n--- e) Samstag (grober Eintrag "Einkaufen abends") ---');
  const samstag = await p.evaluate(() => {
    const day = weekDays()[5];
    const z = freizeitZeile(day, iso(new Date()));
    const last = tagesAuslastung(day);
    return { text: z.text, art: z.art, verplantMin: last.min };
  });
  console.log('   Zeile: ' + samstag.text + '  ·  tagesAuslastung().min=' + samstag.verplantMin);
  ok(samstag.text.includes('Einkaufen abends offen'), 'grober Eintrag wird genannt (' + samstag.text + ')');
  ok(samstag.text.includes('1 h'), 'Dauer des groben Eintrags steht dabei (' + samstag.text + ')');
  ok(samstag.text.startsWith('<b>ganzer Tag frei</b>'), 'die Fenster selbst bleiben korrekt -- Samstag hat sonst keinen Block, also ganzer Tag frei (' + samstag.text + ')');
  ok(samstag.verplantMin === 60, 'tagesAuslastung() zaehlt die 60 Minuten des groben Eintrags trotzdem als verplant -- der dokumentierte Widerspruch (' + samstag.verplantMin + ')');

  /* ---- f) Fenster unter der Mindestdauer erscheinen NICHT ------------- */
  console.log('\n--- f) Fenster unter 30 Minuten bleiben verborgen ---');
  const knapp = await p.evaluate(() => {
    // Wieder isoliert zurueckgesetzt -- aus demselben Grund wie bei c).
    // Areabereich a7 ("Alltag", Art "orga", pause=10) und Bloecke unter
    // 45 Minuten halten das Pufferpolster von freeGaps() (pauseNach()) auf
    // 5 Minuten -- ein Block ab 150 Minuten Laenge wuerde die Pause auf
    // 20 anheben und das absichtliche 20-Minuten-Fenster gleich mitfressen.
    const savedState = state, savedAnchor = anchor;
    state = freshState(); migrate(state);
    anchor = new Date(2026, 8, 14); // eigene, komplett zukuenftige Woche
    const day = weekDays()[0];
    const datum = day.key;
    // 9:00-9:30 und 10:00-10:30, je 5 Minuten Puffer -> Luecke dazwischen
    // real 9:35-9:55 = 20 Minuten: ueber freeGaps() eigener 15-Minuten-
    // Grenze, aber unter unserer FREIZEIT_MIN von 30.
    state.blocks.push({ id: 'k1', title: 'Block A', areaId: 'a7', date: datum,
      ortId: null, grob: false, start: 9 * 60, end: 9 * 60 + 30, frog: false });
    state.blocks.push({ id: 'k2', title: 'Block B', areaId: 'a7', date: datum,
      ortId: null, grob: false, start: 10 * 60, end: 10 * 60 + 30, frog: false });
    const rohGaps = freeGaps(day, {}, null, {});
    const z = freizeitZeile(day, iso(new Date()));
    state = savedState; anchor = savedAnchor;
    return { rohGaps: rohGaps.map(g => ({ start: fmtTime(g.start), end: fmtTime(g.end), min: g.end - g.start })), text: z.text };
  });
  console.log('   rohe freeGaps(): ' + JSON.stringify(knapp.rohGaps) + '  -> Zeile: ' + knapp.text);
  const versteckt = knapp.rohGaps.find(g => g.min >= 15 && g.min < 30);
  ok(!!versteckt, 'freeGaps() liefert roh ein Fenster zwischen 15 und 30 Minuten (Beweis, dass es existiert): ' + JSON.stringify(versteckt));
  ok(!!versteckt && !knapp.text.includes(versteckt.start) && !knapp.text.includes(versteckt.end),
    'genau dieses Fenster (' + (versteckt && versteckt.start) + '–' + (versteckt && versteckt.end) + ') steht NICHT in der Zeile (' + knapp.text + ')');
  const grosse = knapp.rohGaps.filter(g => g.min >= 30);
  ok(grosse.length === 2, 'die beiden groesseren Fenster drumherum bleiben sichtbar (' + grosse.length + ')');
  grosse.forEach(g => ok(knapp.text.includes(g.start) || knapp.text.includes(g.end), 'Fenster ' + JSON.stringify(g) + ' steht in der Zeile'));

  /* ---- h) Vergangene Tage stuerzen nicht ab ---------------------------- */
  console.log('\n--- h) Vergangene Tage (der .gruende-Fall) ---');
  const vergangen = await p.evaluate(() => {
    const day = weekDays()[0]; // Montag, vor der festen Uhr (Donnerstag)
    const todayKey = iso(new Date());
    const roh = freeGaps(day, {}, null, {});
    let z, warf = false;
    try { z = freizeitZeile(day, todayKey); } catch (e) { warf = true; }
    return {
      istVorHeute: day.key < todayKey,
      rohIstArray: Array.isArray(roh) && roh.length === 0,
      gruendeFehlt: roh.gruende === undefined,
      warf, text: z && z.text
    };
  });
  ok(vergangen.istVorHeute, 'Montag liegt vor der festen Uhr (Donnerstag)');
  ok(vergangen.rohIstArray, 'freeGaps() liefert fuer vergangene Tage ein leeres Array');
  ok(vergangen.gruendeFehlt, 'roh.gruende fehlt tatsaechlich (undefined) -- die dokumentierte Falle ist real');
  ok(!vergangen.warf, 'freizeitZeile() stuerzt an dieser Falle NICHT ab');
  ok(vergangen.text === 'vorbei', 'vergangener Tag zeigt "vorbei" (' + vergangen.text + ')');
  ok(zeilen[0].klasse.includes('is-vorbei') && zeilen[1].klasse.includes('is-vorbei') && zeilen[2].klasse.includes('is-vorbei'),
    'Montag bis Mittwoch tragen im offenen Blatt die Klasse is-vorbei');

  await p.screenshot({ path: path.join(__dirname, 'freiwoche-se-hell.png') });

  /* ---- g) iPhone SE: alle sieben Tage ohne Scrollen sichtbar ---------- */
  console.log('\n--- g) iPhone SE 320x568: alle sieben Zeilen ohne Scrollen sichtbar ---');
  const sichtbarkeit = await p.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const foot = document.querySelector('.sheet__foot');
    const rows = [...document.querySelectorAll('.freizeitrow')].map(el => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
    });
    return {
      fensterHoehe: window.innerHeight,
      sheetScrollt: sheet.scrollHeight > sheet.clientHeight + 1,
      footUnten: foot.getBoundingClientRect().bottom,
      rows
    };
  });
  console.log('   ' + JSON.stringify(sichtbarkeit));
  ok(!sichtbarkeit.sheetScrollt, 'das Blatt selbst braucht keinen internen Scrollbalken');
  ok(sichtbarkeit.rows.length === 7, 'sieben Zeilen im DOM (' + sichtbarkeit.rows.length + ')');
  sichtbarkeit.rows.forEach((r, i) => {
    ok(r.top >= 0 && r.bottom <= sichtbarkeit.fensterHoehe,
      'Zeile ' + (i + 1) + ' (' + DAY_KURZ(i) + ') liegt ohne Scrollen im Bild (top=' + r.top + ' bottom=' + r.bottom + ' Fenster=' + sichtbarkeit.fensterHoehe + ')');
  });
  ok(sichtbarkeit.footUnten <= sichtbarkeit.fensterHoehe, '"Fertig" liegt ohne Scrollen im Bild (' + sichtbarkeit.footUnten + ')');

  function DAY_KURZ(i) { return ['Mo','Di','Mi','Do','Fr','Sa','So'][i]; }

  /* ---- Screenshots: SE hell/dunkel, iPhone 13 hell/dunkel, drei Faelle - */
  console.log('\n--- Screenshots ---');
  await p.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(__dirname, 'freiwoche-se-dunkel.png') });
  await p.evaluate(() => { state.settings.theme = 'light'; applyTheme(); closeModal(); });
  await p.waitForTimeout(150);

  const ctx13 = await br.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Berlin' });
  const p13 = await ctx13.newPage();
  await p13.clock.setFixedTime(new Date(UHR));
  await p13.goto(F);
  await p13.waitForTimeout(500);
  await p13.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p13.waitForTimeout(150);
  await basiswocheAufbauen(p13);
  await p13.click('#weekLabel');
  await p13.waitForTimeout(300);
  await p13.screenshot({ path: path.join(__dirname, 'freiwoche-13-hell.png') });
  await p13.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
  await p13.waitForTimeout(150);
  await p13.screenshot({ path: path.join(__dirname, 'freiwoche-13-dunkel.png') });
  await ctx13.close();

  // Volle Woche: kaum Fenster ab 30 Minuten frei.
  const ctxVoll = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const pVoll = await ctxVoll.newPage();
  await pVoll.clock.setFixedTime(new Date(UHR));
  await pVoll.goto(F);
  await pVoll.waitForTimeout(500);
  await pVoll.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await pVoll.waitForTimeout(150);
  await pVoll.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = new Date(2026, 8, 21); // eigene, komplett zukuenftige Woche
    const mon = mondayOf(anchor);
    const datum = i => iso(addDays(mon, i));
    [0, 1, 2, 3, 4, 5, 6].forEach(i => {
      state.blocks.push({ id: 'v-tag-' + i, title: 'Arbeit', areaId: 'a1', date: datum(i),
        ortId: null, grob: false, start: 7 * 60, end: 21 * 60 + 45, frog: false });
    });
    selectedDayIdx = 0; save(); renderAll();
  });
  await pVoll.click('#weekLabel');
  await pVoll.waitForTimeout(300);
  await pVoll.screenshot({ path: path.join(__dirname, 'freiwoche-se-voll.png') });
  await ctxVoll.close();

  // Samstagabend-Fall: laufende Woche fast vorbei -- wenig zu zeigen.
  const ctxSams = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const pSams = await ctxSams.newPage();
  await pSams.clock.setFixedTime(new Date('2026-08-15T21:30:00+02:00')); // Samstag 15.08. 21:30
  await pSams.goto(F);
  await pSams.waitForTimeout(500);
  await pSams.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await pSams.waitForTimeout(150);
  await basiswocheAufbauen(pSams);
  await pSams.evaluate(() => { selectedDayIdx = 5; renderAll(); });
  const samsInfo = await pSams.evaluate(() => {
    const day = weekDays()[5];
    return { auslastung: tagesAuslastung(day).quote, zeile: freizeitZeile(day, iso(new Date())).text };
  });
  console.log('\n--- Samstagabend-Fall (heute = Samstag 21:30) ---');
  console.log('   tagesAuslastung().quote=' + samsInfo.auslastung + '  Zeile=' + samsInfo.zeile);
  await pSams.click('#weekLabel');
  await pSams.waitForTimeout(300);
  await pSams.screenshot({ path: path.join(__dirname, 'freiwoche-se-samstagabend.png') });
  await ctxSams.close();

  console.log('\nKonsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  console.log('\n' + (fehler.length ? fehler.length + ' FEHLER:' : 'Alle Pruefungen bestanden.'));
  fehler.forEach(f => console.log(' - ' + f));
  process.exit(fehler.length ? 1 : 0);
})();
