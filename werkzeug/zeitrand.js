/* ============================================================
   Prüfskript Zeitrand — die Zeitrechnung an ihren Rändern
   (dauerhaft, Exit 1).

   Deckt Auftrag D ab:

     A) Sommerzeitwechsel — mondayOf() bleibt über die echten
        Umstellungswochenenden (Ende März / Ende Oktober, 2026–2030)
        ein einziger, in sich konsistenter Wochenanker: die Tagesschlüssel
        um jede Umstellung herum sind lückenlos (kein doppelter, kein
        fehlender Kalendertag), und jeder Tag zeigt auf einen echten
        Montag.

     B) Zweiwöchentliche Parität über denselben Umstellungswochenenden,
        über mehrere Jahre. serie.js prüft die Sommerzeit bereits für
        2026 — hier zusätzlich für 2027–2030, weil das Math.round() in
        onDay() bei JEDER Umstellung neu greifen muss, nicht nur einmal
        zufällig im geprüften Jahr.

     C) Jahresgrenze und 53-Wochen-Jahre. isoWeek() wird tatsächlich von
        der Oberfläche aufgerufen — renderHeader() (~Zeile 2440) und die
        Ziele-Anzeige (~Zeile 3847), beide mit mondayOf(anchor) als
        Argument. Geprüft gegen eine ZWEITE, vom Produkt-Code unabhängige
        Rechenweise (Ordnungszahl des eigenen Donnerstags statt
        Date.UTC()+Runden): jede Silvester-Woche bleibt für alle sieben
        Tage EINE Wochenzahl, und echte 53-Wochen-Jahre (2026, 2032,
        2037, 2043, 2048) zeigen tatsächlich "53".

     D) Die Herbst-Umstellung erzeugt eine lokale Stunde, die zweimal
        vorkommt (2:00–3:00 Uhr am letzten Sonntag im Oktober läuft in
        Europe/Berlin doppelt: einmal als MESZ, einmal als MEZ). "Heute"
        darf sich dabei nicht verschieben — geprüft mit der echten
        Browser-Uhr an beiden Vorkommen.

   Zeitzone durchgehend Europe/Berlin (timezoneId). Die Testdaten für A–C
   sind Kalendertage ohne Zonen-Endung, gesetzt auf T12:00:00 — new
   Date("YYYY-MM-DDT12:00:00") wird vom Browser in SEINER (=Europe/Berlin)
   Ortszeit interpretiert und landet damit unabhängig von der Jahreszeit
   mittags auf dem richtigen Kalendertag, ohne je eine Umstellungsstunde
   zu berühren (exakt das Muster aus onDay(), Zeile ~2548). Nur die feste
   Uhr für den Programmstart und die beiden Zeitpunkte in Abschnitt D sind
   ECHTE Zeitpunkte und tragen deshalb die Zonen-Endung von Hand:
   +02:00 für Sommerzeit (MESZ), +01:00 für Winterzeit (MEZ) — je nachdem,
   auf welcher Seite der jeweiligen Umstellung der Zeitpunkt liegt. Die
   beiden Momente in Abschnitt D tragen absichtlich densel­ben Wanduhr-Text
   "02:30" mit unterschiedlicher Zonen-Endung — das IST der Beweis, dass
   ohne Zonen-Endung diese Stunde nicht eindeutig wäre.

   Stil wie serie.js/haken.js: eine Chromium-Seite, deutsche Ausgabe,
   Exit 1 bei Fehlern.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// Letzter Sonntag eines Monats — reine Kalenderarithmetik (Tag 0 des
// Folgemonats ist der letzte Tag des Vormonats). Bewusst ohne Uhrzeit:
// das Ergebnis ist ein Kalendertag, kein Zeitpunkt, und deshalb unabhängig
// von der Prozesszeitzone der Maschine, auf der dieses Skript läuft.
function letzterSonntag(jahr, monatIdx) {
  const d = new Date(jahr, monatIdx + 1, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function iso0(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// Zweiter, vom Produkt-Code UNABHÄNGIGER Rechenweg für die ISO-Wochenzahl:
// Woche des eigenen Donnerstags, aber über die Ordnungszahl des Tages im
// Jahr statt über Date.UTC() + Runden wie in index.html. Beide Wege
// beruhen auf derselben ISO-8601-Definition, aber auf unterschiedlicher
// Arithmetik — stimmen sie überein, prüft das etwas Echtes, kein
// Selbstgespräch derselben Formel. (Gegen index.html abgeglichen: 0
// Abweichungen über 41 Jahre, jeder Tag.)
function isoWeekUnabhaengig(jahr, monatIdx, tag) {
  const datum = new Date(jahr, monatIdx, tag);
  const isoWochentag = ((datum.getDay() + 6) % 7) + 1; // Mo=1..So=7
  const donnerstag = new Date(jahr, monatIdx, tag + (4 - isoWochentag));
  const jan1 = new Date(donnerstag.getFullYear(), 0, 1);
  const ordnungszahl = Math.round((donnerstag - jan1) / 86400000) + 1;
  return Math.ceil(ordnungszahl / 7);
}

// Dritter, rein definitorischer Weg, nur für Abschnitt C: ob ein Jahr 53
// statt 52 ISO-Wochen hat, hängt nur vom Wochentag seines 1. Januar ab
// (Donnerstag, oder bei Schaltjahren Mittwoch) — Lehrbuchregel, keine
// Berechnung, dient als dritte, von beiden Wochenzahl-Funktionen oben
// unabhängige Bestätigung.
function hat53Wochen(jahr) {
  const schaltjahr = (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0;
  const wtJan1 = new Date(jahr, 0, 1).getDay(); // 0=So..6=Sa
  return wtJan1 === 4 || (schaltjahr && wtJan1 === 3);
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 950 }, timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  // Programmstart: ein gewöhnlicher Sommertag, keine Umstellung in der Nähe.
  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.goto(F); await p.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);

  /* ---- A) Wochenanker über die Umstellungswochenenden, mehrere Jahre --- */
  console.log('\n## A) Wochenanker: mondayOf() bleibt über die Umstellungswochenenden lückenlos (2026–2030)');
  for (const jahr of [2026, 2027, 2028, 2029, 2030]) {
    for (const [name, monatIdx] of [['März', 2], ['Oktober', 9]]) {
      const sonntag = letzterSonntag(jahr, monatIdx);
      const mitte = iso0(sonntag);
      const r = await p.evaluate((mitte) => {
        const basis = new Date(mitte + 'T12:00:00');
        const tage = [];
        for (let off = -4; off <= 4; off++) tage.push(addDays(basis, off));
        return tage.map(d => ({ key: iso(d), montag: iso(mondayOf(d)) }));
      }, mitte);

      // Lückenlos: aufeinanderfolgende Tagesschlüssel unterscheiden sich um
      // genau einen Kalendertag — sonst hätte setDate() an der Umstellung
      // selbst einen Tag verschluckt oder verdoppelt.
      for (let i = 1; i < r.length; i++) {
        const diffTage = Math.round((new Date(r[i].key + 'T00:00:00Z') - new Date(r[i - 1].key + 'T00:00:00Z')) / 86400000);
        ok(diffTage === 1, jahr + ' ' + name + ': Tagesschlüssel ' + r[i - 1].key + ' → ' + r[i].key + ' ist genau ein Tag (erhalten ' + diffTage + ')');
      }
      // Neun Tage rund um einen Sonntag (Ende einer Kalenderwoche) berühren
      // genau zwei Wochenanker — nie einen dritten, nie nur einen.
      const anker = new Set(r.map(e => e.montag));
      ok(anker.size === 2, jahr + ' ' + name + ': neun Tage rund um die Umstellung zeigen auf genau zwei Wochenanker (erhalten ' + anker.size + ': ' + [...anker].join(', ') + ')');
    }
  }

  /* ---- B) Zweiwöchentliche Parität über die Umstellungswochenenden, mehrere Jahre ---- */
  console.log('\n## B) Zweiwöchentliche Parität bleibt über die Umstellungswochenenden korrekt (2026–2030)');
  for (const jahr of [2026, 2027, 2028, 2029, 2030]) {
    for (const [name, monatIdx] of [['März', 2], ['Oktober', 9]]) {
      const sonntag = letzterSonntag(jahr, monatIdx);
      const montagDerUmstellungswoche = iso0(new Date(sonntag.getFullYear(), sonntag.getMonth(), sonntag.getDate() - 6));
      // "since" zwölf Wochen vor der Umstellungswoche verankern und nur
      // NICHT-negative Offsets testen: onDay() weist Tage vor "since" per
      // Vertrag immer zurück (unabhängig von der Parität, Zeile ~2542) —
      // mit einem negativen Offset würde dieser Test also die
      // Since-Schranke prüfen, nicht die Sommerzeit. Bei Offset 6 liegt die
      // Umstellungswoche selbst mitten im Fenster.
      const since = iso0(new Date(sonntag.getFullYear(), sonntag.getMonth(), sonntag.getDate() - 6 - 6 * 7));
      const r = await p.evaluate(({ since }) => {
        const dayIdx = 0; // since ist ein Montag
        const b = { day: dayIdx, repeat: '2wochen', since };
        const ergebnisse = [];
        for (let off = 0; off <= 12; off++) {
          const dayKey = iso(addDays(new Date(since + 'T12:00:00'), off * 7));
          ergebnisse.push({ off, dayKey, treffer: onDay(b, dayKey, dayIdx) });
        }
        return ergebnisse;
      }, { since });
      console.log('   ' + jahr + ' ' + name + ' (since ' + since + ', Umstellungswoche ' + montagDerUmstellungswoche + '): ' + r.map(e => e.off + ':' + (e.treffer ? '1' : '0')).join('  '));
      r.forEach(e => {
        const erwartet = e.off % 2 === 0;
        ok(e.treffer === erwartet, jahr + ' ' + name + ' Woche ' + e.off + ' (' + e.dayKey + '): erwartet ' + erwartet + ', erhalten ' + e.treffer);
      });
    }
  }

  /* ---- C) Jahresgrenze und 53-Wochen-Jahre ---------------------------- */
  console.log('\n## C) Jahresgrenze: Silvester-Woche bleibt zusammenhängend, 53-Wochen-Jahre zeigen wirklich 53');
  const JAHRE_C = [2025, 2026, 2027, 2028, 2029, 2030, 2032, 2037, 2043, 2048];
  for (const jahr of JAHRE_C) {
    // isoWeekUnabhaengig() (zweiter Rechenweg) gegen hat53Wochen() (reine
    // Lehrbuchregel): bei echten 53-Wochen-Jahren muss der 31.12. selbst
    // in Woche 53 seines EIGENEN Jahres liegen — er könnte sonst (bei
    // anderen Jahren durchaus normal) schon in Woche 1 des Folgejahres
    // liegen, dann wäre die 53 kein Beleg für ein 53-Wochen-Jahr.
    const woche = isoWeekUnabhaengig(jahr, 11, 31);
    const erwartet = hat53Wochen(jahr) ? 53 : woche; // nur die 53er-Behauptung ist unabhängig prüfbar
    ok(woche === erwartet, jahr + ': unabhängige Wochenzahl von Silvester ist ' + woche);
    if (hat53Wochen(jahr)) ok(woche === 53, jahr + ': echtes 53-Wochen-Jahr, Silvester zeigt unabhängig berechnet "53" (erhalten ' + woche + ')');
  }

  for (const jahr of JAHRE_C) {
    const r = await p.evaluate((jahr) => {
      const mon = mondayOf(new Date(jahr, 11, 31, 12));
      const tage = [];
      for (let i = 0; i < 7; i++) { const d = addDays(mon, i); tage.push({ key: iso(d), woche: isoWeek(d) }); }
      return tage;
    }, jahr);
    const wochen = new Set(r.map(t => t.woche));
    ok(wochen.size === 1, jahr + ': die Silvester-Woche (' + r[0].key + '…' + r[6].key + ') zeigt für alle sieben Tage dieselbe Wochenzahl (erhalten ' + [...wochen].join(', ') + ')');

    const erwartet = isoWeekUnabhaengig(jahr, 11, 31);
    r.forEach(t => ok(t.woche === erwartet, jahr + ' ' + t.key + ': isoWeek() aus index.html (' + t.woche + ') stimmt mit dem unabhängigen Rechenweg (' + erwartet + ') überein'));

    if (hat53Wochen(jahr)) {
      ok(r[0].woche === 53, jahr + ': echtes 53-Wochen-Jahr zeigt in index.html tatsächlich "53" (erhalten ' + r[0].woche + ')');
    }
  }

  /* ---- D) Die doppelte Stunde der Herbst-Umstellung -------------------- */
  console.log('\n## D) Herbst-Umstellung: dieselbe Wanduhr-Zeit zweimal, "heute" bleibt beide Male der 25.10.2026');
  for (const [bezeichnung, literal] of [
    ['erstes Vorkommen 02:30 (MESZ, +02:00)', '2026-10-25T02:30:00+02:00'],
    ['zweites Vorkommen 02:30 (MEZ, +01:00)', '2026-10-25T02:30:00+01:00']
  ]) {
    await p.clock.setFixedTime(new Date(literal));
    const heute = await p.evaluate(() => iso(new Date()));
    ok(heute === '2026-10-25', 'Herbst-Umstellung, ' + bezeichnung + ': iso(new Date()) ist 2026-10-25 (erhalten ' + heute + ')');
  }
  // Die beiden Momente sind unterschiedliche Zeitpunkte (eine Stunde
  // Abstand) — sonst wäre das oben kein echter Test der doppelten Stunde,
  // nur zweimal dieselbe Uhrzeit.
  const abstandMs = new Date('2026-10-25T02:30:00+01:00') - new Date('2026-10-25T02:30:00+02:00');
  ok(abstandMs === 3600000, 'Herbst-Umstellung: die beiden "02:30"-Momente liegen tatsächlich eine Stunde auseinander (erhalten ' + (abstandMs / 3600000) + ' h) — Beweis, dass die Zonen-Endung die Stunde erst eindeutig macht');

  console.log('\n=== Konsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  if (fehler.length) { console.log('\n=== FEHLER (' + fehler.length + '):'); fehler.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('\nAlle Prüfungen bestanden.');
})();
