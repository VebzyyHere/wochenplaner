/* ============================================================
   Prüfskript Rückblick (Stufe 14) — geplant gegen tatsächlich

   Prüft, was der Bericht zu Stufe 14 über schrittRueckblick() und
   rueckblickMuster() behauptet:
     a) Je Bereich mit Wochenziel erscheint die Drei-Zahlen-Zeile, und die
        Zahlen stimmen mit einem von Hand gebauten Zustand überein — hier
        unabhängig von fmtDur() im eigenen fmtDurJS() nachgerechnet, damit
        die Prüfung nicht denselben Code testet, der auch die Anzeige baut.
     b) Bereiche ohne Wochenziel erscheinen nicht in der Zeile — und hat
        KEIN Bereich ein Ziel, bleibt der ganze Abschnitt (.rueckblick) weg.
     c) Das Mehrwochen-Angebot erscheint bei drei von vier Wochen unter
        zwei Dritteln (Bereich "Sport") und NICHT bei zwei von vier
        (Bereich "Hobby") — beide im selben Aufruf, mit denselben vier
        Wochen vor der aktuellen.
     d) Der Knopf "Auf X h setzen" setzt a.plan.goal tatsächlich auf den
        vorgeschlagenen Wert und lässt den Hinweis danach verschwinden.
     e) Ton-Wache: keines der verbotenen Wörter im Text des Abschnitts,
        und kein Element darin trägt die berechnete --danger-Farbe (über
        getComputedStyle geprüft, nicht über den Quelltext).
     f) "Später" in Schritt 1 schließt das Blatt, ohne den Wochenstart als
        erledigt zu markieren — UND ritualFaellig() bleibt danach wahr, wenn
        der Zeitpunkt selbst dafür spricht. Deshalb prüft f) nicht nur den
        Klick, sondern die Zeitregel aus ritualFaellig() an vier Zeitpunkten
        einer Woche (eigene Kontexte mit eigener fester Uhr, wie schon
        agenda.js es für seinen Abend-Abschnitt vormacht): Sonntag 15 Uhr
        (noch nicht fällig), Sonntag 17 Uhr (ab 16 Uhr zählt zur neuen
        Woche), Montag 10 Uhr (fällig) und Mittwoch 10 Uhr (die Karte
        schweigt bewusst, s. Kommentar vor ritualFaellig() in index.html).

   Stil wie haken.js/tk.js: eine Chromium-Seite, deutsche Ausgabe, Exit 1
   bei Fehlern. Nimmt nebenbei zwei Bilder auf (hell/dunkel) für die
   Ton-Prüfung von Auge.

   Uhrzeit UND Datum sind über page.clock.setFixedTime() auf Montag,
   2026-08-03, 10 Uhr genagelt (Europe/Berlin, wie in agenda.js/scroll.js/
   stufe5.js) — das Skript lief zuvor mit der jeweils echten Systemzeit,
   und ritualFaellig() ist Mi-Sa wahrheitsgemäß falsch (s. Kommentar vor
   der Funktion in index.html), wodurch die Zusicherung in f) an genau
   diesen Tagen zwangsläufig scheiterte. Montag 10 Uhr passt auch zu den
   übrigen Zusicherungen: a)-e) bauen ihren Zustand relativ zu `anchor`
   (= Ladezeitpunkt) selbst auf und sind vom Wochentag unabhängig.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// fmtDur() aus index.html unabhängig nachgebaut — Minuten -> "1,5 h" usw.
function fmtDurJS(min) {
  if (min <= 0) return '0 h';
  if (min < 60) return min + ' min';
  const h = min / 60;
  return (Math.round(h * 10) / 10).toString().replace('.', ',') + ' h';
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 950 }, timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  // Montag, 10 Uhr — s. Kopfkommentar.
  await p.clock.setFixedTime(new Date('2026-08-03T10:00:00+02:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  /* ---- Zustand aufbauen ------------------------------------------------
     a1 Arbeit: kein Ziel (bleibt bei 0) — soll trotz Eintrag nicht erscheinen.
     a2 Uni & Lernen: Ziel 3h, in der Vorwoche 3h eingeplant, davon 1,5h abgehakt
                      — "mittlere" Woche für Teil A.
     a3 Sport: Ziel 3h, vier Wochen mit 60/60/60/180 min geschafft — drei von
               vier unter der Zwei-Drittel-Schwelle (120 min), Angebot erwartet.
     a4 Hobby: Ziel 3h, vier Wochen mit 180/60/180/60 min geschafft — nur zwei
               von vier unter der Schwelle, KEIN Angebot erwartet.          */
  const setup = await p.evaluate(() => {
    const mon = mondayOf(anchor), vor = addDays(mon, -7);
    const mk = (id, t, a, datum, dauer) => ({
      id, title: t, areaId: a, day: 0, date: datum, repeat: 'none',
      start: 10 * 60, end: 10 * 60 + dauer, frog: false
    });
    const abhaken = (b) => setzeErledigt(b, b.date, true);

    state.areas.find(a => a.id === 'a2').plan.goal = 3;
    state.areas.find(a => a.id === 'a3').plan.goal = 3;
    state.areas.find(a => a.id === 'a4').plan.goal = 3;

    // a1: Eintrag ohne Ziel — muss trotzdem verschwinden.
    state.blocks.push(mk('rb-a1', 'Meeting', 'a1', iso(vor), 60));

    // a2: zwei Blöcke in der Vorwoche, nur einer abgehakt — reines Teil-A-
    // Beispiel, ohne Mehrwochen-Angebot. Weil rueckblickMuster() "gewertet"
    // über ALLE Einträge der Woche zählt (nicht nur die des Bereichs, siehe
    // Kommentar vor rueckblickMuster in index.html), würden die Wochen 2-4
    // sonst wegen der a3/a4-Testdaten fälschlich als "gewertet, 0 geschafft"
    // durchgehen und selbst ein Angebot auslösen. Deshalb hier zusätzlich in
    // den Wochen 2-4 klar über der Zwei-Drittel-Schwelle (120 min) abgehakt.
    const a2a = mk('rb-a2a', 'Vorlesung', 'a2', iso(vor), 90);
    const a2b = mk('rb-a2b', 'Übung', 'a2', iso(addDays(vor, 2)), 90);
    state.blocks.push(a2a, a2b);
    abhaken(a2a);
    [1, 2, 3].forEach(idx => {
      const wocheMon = addDays(mon, -7 * (idx + 1));
      const b = mk('rb-a2-' + idx, 'Vorlesung', 'a2', iso(wocheMon), 150);
      state.blocks.push(b); abhaken(b);
    });

    // a3: eine Woche pro Zeile, alle abgehakt, Dauer macht den Unterschied.
    const wochenA3 = [60, 60, 60, 180];
    wochenA3.forEach((dauer, idx) => {
      const wocheMon = addDays(mon, -7 * (idx + 1));
      const b = mk('rb-a3-' + idx, 'Training', 'a3', iso(wocheMon), dauer);
      state.blocks.push(b); abhaken(b);
    });

    // a4: gleiches Muster, andere Reihenfolge -> nur zwei von vier unter der Schwelle.
    const wochenA4 = [180, 60, 180, 60];
    wochenA4.forEach((dauer, idx) => {
      const wocheMon = addDays(mon, -7 * (idx + 1));
      const b = mk('rb-a4-' + idx, 'Zeichnen', 'a4', iso(wocheMon), dauer);
      state.blocks.push(b); abhaken(b);
    });

    save(); renderAll();
    return { vorwocheEintraege: wocheEintraege(vor).length };
  });
  console.log('1) Aufbau:', JSON.stringify(setup));

  /* ---- Ritual öffnen, Schritt 1 lesen ----------------------------------- */
  const stand1 = await p.evaluate(() => {
    ritualSheet();
    const rb = document.querySelector('.rueckblick');
    return {
      vorhanden: !!rb,
      zeilen: [...document.querySelectorAll('.rueckblick__row')].map(r => r.textContent),
      hinweise: [...document.querySelectorAll('.rueckblick__hinweis')].map(h => ({
        text: h.querySelector('.rueckblick__hinweis-txt').textContent,
        knopf: h.querySelector('button:not(.btn--ghost)').textContent
      }))
    };
  });
  console.log('2) Schritt 1 / Rückblick:', JSON.stringify(stand1, null, 2));

  /* ---- a) Drei-Zahlen-Zeile: unabhängig nachgerechnet -------------------- */
  const erwartetA2 = 'Uni & Lernen: ' + fmtDurJS(3 * 60) + ' vorgenommen · ' + fmtDurJS(180) + ' eingeplant · ' + fmtDurJS(90) + ' geschafft';
  const erwartetA3 = 'Sport: ' + fmtDurJS(3 * 60) + ' vorgenommen · ' + fmtDurJS(60) + ' eingeplant · ' + fmtDurJS(60) + ' geschafft';
  const erwartetA4 = 'Hobby: ' + fmtDurJS(3 * 60) + ' vorgenommen · ' + fmtDurJS(180) + ' eingeplant · ' + fmtDurJS(180) + ' geschafft';
  ok(stand1.zeilen.includes(erwartetA2), 'a2-Zeile stimmt: "' + erwartetA2 + '"');
  ok(stand1.zeilen.includes(erwartetA3), 'a3-Zeile stimmt: "' + erwartetA3 + '"');
  ok(stand1.zeilen.includes(erwartetA4), 'a4-Zeile stimmt: "' + erwartetA4 + '"');

  /* ---- b) Bereich ohne Ziel erscheint nicht ------------------------------ */
  ok(!stand1.zeilen.some(z => z.startsWith('Arbeit:')), 'a1 (kein Ziel) hat keine Zeile');
  ok(stand1.zeilen.length === 3, 'genau drei Zeilen (a2, a3, a4) — (' + stand1.zeilen.length + ')');

  /* ---- c) Mehrwochen-Angebot: Sport ja, Hobby nein ----------------------- */
  const hinweisSport = stand1.hinweise.find(h => h.text.indexOf('Sport') === 0);
  const hinweisHobby = stand1.hinweise.find(h => h.text.indexOf('Hobby') === 0);
  ok(!!hinweisSport, 'Angebot erscheint für Sport (3 von 4 Wochen unter der Schwelle)');
  ok(!hinweisHobby, 'KEIN Angebot für Hobby (nur 2 von 4 Wochen unter der Schwelle)');
  ok(!!hinweisSport && hinweisSport.knopf === 'Auf 2 h setzen', 'Sport-Vorschlag ist 2 h: "' + (hinweisSport && hinweisSport.knopf) + '"');
  ok(stand1.hinweise.length === 1, 'genau ein Angebot insgesamt — (' + stand1.hinweise.length + ')');

  /* ---- e) Ton-Wache ------------------------------------------------------
     Läuft VOR dem Klick auf "Auf 2 h setzen", solange der Mehrwochen-Hinweis
     noch im DOM steht — dessen Satz ("in drei von vier Wochen unter dem
     Ziel") ist die Stelle, an der wertende Sprache am ehesten hineinrutscht. */
  const ton = await p.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'btn btn--danger';
    probe.style.position = 'fixed'; probe.style.left = '-9999px';
    document.body.appendChild(probe);
    const dangerColor = getComputedStyle(probe).color;
    probe.remove();

    const root = document.querySelector('.rueckblick');
    const verboten = ['nur', 'leider', 'verfehlt', 'serie', 'in folge', '%'];
    const text = (root ? root.textContent : '').toLowerCase();
    const woerterTreffer = verboten.filter(w => text.indexOf(w) >= 0);

    const rotTreffer = [];
    if (root) {
      [root, ...root.querySelectorAll('*')].forEach(el => {
        const cs = getComputedStyle(el);
        ['color', 'backgroundColor', 'borderColor', 'borderLeftColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor']
          .forEach(prop => { if (cs[prop] === dangerColor) rotTreffer.push((el.className || el.tagName) + ':' + prop); });
      });
    }
    return { dangerColor, woerterTreffer, rotTreffer };
  });
  console.log('3) Ton-Wache:', JSON.stringify(ton));
  ok(ton.woerterTreffer.length === 0, 'keines der verbotenen Wörter im Rückblick-Text (Treffer: ' + ton.woerterTreffer.join(', ') + ')');
  ok(ton.rotTreffer.length === 0, 'kein Element im Rückblick trägt die --danger-Farbe (Treffer: ' + ton.rotTreffer.join(', ') + ')');

  // Bilder zur Ton-Prüfung von Auge, hell und dunkel, MIT dem Mehrwochen-
  // Angebot sichtbar (a2 = mittlere Woche, a3 = knappe Woche + Angebot,
  // a4 = erreichte Woche — alle drei in einem Bild). Die Wartezeit vor dem
  // ersten Bild ist kein Zufallspolster: ritualSheet() hängt den Dialog
  // synchron ins DOM, ein Screenshot im selben Tick zeigt noch den alten,
  // ungemalten Frame — document.querySelector('.sheet') meldet dann schon
  // "da", das Bild aber nicht (per Vergleichsbild geprüft).
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(__dirname, 'rueckblick-hell.png') });
  await p.evaluate(() => { state.settings.theme = 'dark'; save(); applyTheme(); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(__dirname, 'rueckblick-dunkel.png') });
  await p.evaluate(() => { state.settings.theme = 'auto'; save(); applyTheme(); });
  await p.waitForTimeout(150);

  /* ---- d) Knopf setzt das Ziel tatsächlich ------------------------------- */
  await p.click('.rueckblick__hinweis button:not(.btn--ghost)');
  await p.waitForTimeout(150);
  const stand2 = await p.evaluate(() => ({
    zielA3: state.areas.find(a => a.id === 'a3').plan.goal,
    hinweiseUebrig: document.querySelectorAll('.rueckblick__hinweis').length,
    zeilenA3: [...document.querySelectorAll('.rueckblick__row')].map(r => r.textContent).filter(t => t.startsWith('Sport:'))
  }));
  console.log('4) Nach "Auf 2 h setzen":', JSON.stringify(stand2));
  ok(stand2.zielA3 === 2, 'a3.plan.goal ist jetzt 2 (' + stand2.zielA3 + ')');
  ok(stand2.hinweiseUebrig === 0, 'kein Angebot mehr sichtbar, nachdem das Ziel gesenkt wurde');
  ok(stand2.zeilenA3.length === 1 && stand2.zeilenA3[0].startsWith('Sport: 2 h vorgenommen'),
     'die Drei-Zahlen-Zeile von Sport zeigt jetzt "2 h vorgenommen": "' + (stand2.zeilenA3[0] || '') + '"');

  /* ---- b, Fortsetzung: gar kein Bereich mit Ziel -> Abschnitt ganz weg --- */
  await p.evaluate(() => { closeModal(); });
  await p.waitForTimeout(150);
  const ohneZiele = await p.evaluate(() => {
    state.areas.forEach(a => { a.plan.goal = 0; });
    save(); renderAll();
    ritualSheet();
    return { rueckblickVorhanden: !!document.querySelector('.rueckblick') };
  });
  console.log('5) Kein Bereich mit Ziel:', JSON.stringify(ohneZiele));
  ok(!ohneZiele.rueckblickVorhanden, 'ohne jedes Wochenziel bleibt .rueckblick ganz weg (keine leere Trennlinie)');

  /* ---- f) "Später" schließt, ohne den Wochenstart als erledigt zu markieren */
  const vorSpaeter = await p.evaluate(() => ({ ritualKey: ritualKey(), gesetzt: !!state.rituale[ritualKey()] }));
  await p.click(".sheet__foot button:has-text('Später')");
  await p.waitForTimeout(200);
  const nachSpaeter = await p.evaluate(() => ({
    blattWeg: !document.querySelector('.sheet'),
    gesetzt: !!state.rituale[ritualKey()],
    faellig: ritualFaellig()
  }));
  console.log('6) "Später":', JSON.stringify({ vorher: vorSpaeter, nachher: nachSpaeter }));
  ok(nachSpaeter.blattWeg, 'das Blatt schließt sich über "Später"');
  ok(!vorSpaeter.gesetzt && !nachSpaeter.gesetzt, 'state.rituale bleibt für diese Woche ungesetzt');
  ok(nachSpaeter.faellig, 'ritualFaellig() bleibt wahr — die Ritual-Karte bietet den Start beim nächsten Mal wieder an');

  /* ---- f, Fortsetzung: die Zeitregel selbst, an vier Zeitpunkten --------
     Eigene Kontexte mit eigener fester Uhr statt eines Zeitsprungs auf der
     laufenden Seite (wie agenda.js es für seinen Abend-Abschnitt macht),
     damit jeder Zeitpunkt an einem frischen Zustand hängt statt an
     Nebenwirkungen der Szenarien oben. */
  console.log('\n7) Zeitregel ritualFaellig() an vier Zeitpunkten:');
  async function faelligUm(iso) {
    const ctxZ = await br.newContext({ timezoneId: 'Europe/Berlin' });
    const pZ = await ctxZ.newPage();
    await pZ.clock.setFixedTime(new Date(iso));
    await pZ.goto(F);
    await pZ.waitForTimeout(300);
    const f = await pZ.evaluate(() => ritualFaellig());
    await ctxZ.close();
    return f;
  }
  const zeitpunkte = [
    { zeit: '2026-08-02T15:00:00+02:00', erwartet: false, label: 'Sonntag 15 Uhr — noch nicht fällig' },
    { zeit: '2026-08-02T17:00:00+02:00', erwartet: true, label: 'Sonntag 17 Uhr — zählt schon zur neuen Woche' },
    { zeit: '2026-08-03T10:00:00+02:00', erwartet: true, label: 'Montag 10 Uhr — fällig' },
    { zeit: '2026-08-05T10:00:00+02:00', erwartet: false, label: 'Mittwoch 10 Uhr — Karte schweigt bewusst' }
  ];
  for (const z of zeitpunkte) {
    const f = await faelligUm(z.zeit);
    ok(f === z.erwartet, 'ritualFaellig() ' + z.label + ' (' + f + ')');
  }

  console.log('\n=== Konsolenfehler: ' + (errs.length ? errs.join(' | ') : 'keine'));
  if (errs.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  if (fehler.length) { console.log('\n=== FEHLER (' + fehler.length + '):'); fehler.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('\nAlle Prüfungen bestanden.');
})();
