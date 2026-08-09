/* ============================================================
   Prüfskript Wochenübersicht: Frei/Belegt (Stufe M2) — freizeitSheet()
   (Auslöser #weekLabel) bekommt ein zweites Gesicht. "Frei" beantwortet
   weiter "wann hab ich Zeit" (freizeitZeile(), unverändert — freiwoche.js
   prüft das eigenständig hart). "Belegt" beantwortet die Gegenfrage "was
   liegt an": sieben Zeilen, rechts je Tag eine Segmentleiste über die
   Tagesachse (dayStart..dayEnd), darunter eine Klartextzeile.

   Feste Uhr, zoniert: Mittwoch 2026-08-05T10:00:00+02:00, Europe/Berlin
   (Hausvertrag — ungenagelte Zeit hat in diesem Projekt schon sechsmal
   falsches Vertrauen erzeugt).

   Fixture (Woche Mo 3.8.–So 9.8.2026, "heute" = Mi 5.8.):
     Mo-Fr  Arbeit, Serie 9-17 (a1)                    -- exakt, jeden Tag
     Di     zusätzlich grober Block "Sport" abends (a3) -- Abschnittsstart
     Mi     zusätzlich sug-Vorschlag "Lesen" 20-21 (a4) -- heute, gedämpft
     Do     zusätzlich exakter Termin "Zahnarzt" 10-11 (a7) -- genau 2 Einträge
     Fr     zusätzlich bösartiger Termin (a3, 10-11) + grober Block "Hobby"
            abends (a4) -- 3 Einträge, "+1"-Deckel, Maskierungsprobe
     Sa     freigehalten (dayMeta().frei)
     So     nichts

   a) Blatt öffnet im Frei-Gesicht (Voreinstellung), Umschalter vorhanden,
      beide Chips ≥44px.
   b) Umschalt auf "Belegt": 7 Zeilen; Mo (nur Serie) trägt ein exakt
      positioniertes Segment (gegen start/Dauer nachgerechnet, Toleranz
      wenige px); Di zusätzlich ein gestricheltes Segment exakt am Beginn
      seines Abschnitts (abends = 17:00); Mi (heute) zusätzlich ein
      gestricheltes, gegenüber "grob" nochmal gedämpfteres sug-Segment;
      Do zeigt genau zwei Titel ohne Kappung; Fr zeigt zwei Titel + "+1",
      der bösartige Titel steht escaped im Markup und unescaped im Text,
      kein onerror feuert.
   c) Sa: "bewusst frei" (fett); So: "nichts geplant" (gedämpft).
   d) Zeilen-Tipp in einer per ‹ vorgeblätterten Woche: anchor wandert
      exakt auf den Montag dieser Woche, selectedDayIdx auf den
      angetippten Tag, Ansicht "plan", Blatt zu.
   e) Das Gesicht übersteht ‹/›-Blättern innerhalb desselben offenen
      Blatts; nach Rückschalt auf "Frei" stimmen Titel-Wortlaut,
      "vorbei"-Dimmen und "· heute"-Marker weiterhin (Frei-Gesicht
      unversehrt).
   f) Schließen + Wiederöffnen im selben Sitzungslauf: das zuletzt
      gewählte Gesicht (Belegt) ist beim Öffnen sofort aktiv.
   g) Trefferflächen der Zeilen ≥44px (Messmuster wie haken.js: echte Box
      vermessen — hier ohne ::before-Kniff nötig, die Zeile ist ohnehin
      deutlich über 44px hoch).

   Ab hier Stufe M3 ("Der Zoom schließt sich"):
   h) Titel-Tipp (#freizeitTitel, jetzt ein echter <button>, 44px,
      aria-label "Monatsübersicht öffnen") zoomt raus: schließt das
      Wochen-Blatt, öffnet monatSheet() im Monat der ZULETZT HIER
      gezeigten Woche (per ‹ vorher eigens in den Nachbarmonat Juli
      geblättert — sonst wäre der Unterschied zum Monat von anchor, der
      die ganze Zeit auf August/3.8. stehen bleibt, gar nicht zu sehen).
   i) freizeitSheet(startMontag): öffnet direkt in der übergebenen Woche
      (nicht der von anchor), ‹/› blättern von dort aus weiter, anchor
      bleibt unbewegt.
   j) Das Gesicht übersteht den ganzen Zoom-Rundweg: Belegt wählen →
      Titel-Tipp (Monat) → KW-Tipp zurück (Woche) → weiterhin Belegt, kein
      stiller Rücksprung auf Frei.

   Rot-Beweis: `git stash push -- index.html` gegen HEAD (vor Stufe M2),
   Skript erneut laufen lassen — a) findet keinen Umschalter/keine
   Chips, b) findet weder Belegt-Chip noch .wochenzeile (Klick auf ein
   nicht vorhandenes Element wird darum übersprungen, nicht versucht),
   d) hat ohne Belegt-Gesicht keine Zeile zum Antippen. Defensiv gegen
   diesen Fall gebaut (Existenzprüfung vor jedem Klick/Zugriff), damit
   das Skript beim alten Stand FEHLER-Zeilen schreibt statt an einer
   nicht abgefangenen Exception zu zerschellen (Stil wie monat.js).
   `git stash pop` stellt den Stand danach wieder her.

   Stufe M3 (h–j): eigener Rot-Beweis gegen den NEUEN HEAD (68b0541 — M1/M2
   schon enthalten, nur M3 fehlt noch). `git stash push -- index.html`,
   Skript erneut laufen lassen: h) #freizeitTitel ist noch ein <h2>, kein
   <button> — der Klick darauf tut nichts, das Monatsblatt bleibt zu; i)
   freizeitSheet() kennt noch keinen Startparameter, öffnet immer bei
   anchor statt bei der übergebenen Woche; j) ist ohne h)/i) hinfällig —
   der KW-Tipp auf die aktuelle Woche springt im Monatsblatt noch in den
   Plan statt zurück ins Wochen-Blatt, das Gesicht hat also gar keinen
   Rundweg zu überstehen. `git stash pop` stellt den Stand danach wieder her.

   Stil wie freiwoche.js/monat.js: eine Chromium-Seite (iPhone SE),
   deutsche Ausgabe, Exit 1 bei Fehlern.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const UHR = '2026-08-05T10:00:00+02:00'; // Mittwoch
const BOESER_TITEL = '<img src=x onerror=alert(1)>Sport'; // Muster aus vorschlagzeilen.js

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

async function fixtureAufbauen(p) {
  return p.evaluate((boeserTitel) => {
    if (typeof closeModal === 'function') closeModal();
    state = freshState(); migrate(state);
    anchor = new Date(2026, 7, 3); // Montag 03.08.2026
    const mon = mondayOf(anchor);
    const datum = i => iso(addDays(mon, i));

    [0, 1, 2, 3, 4].forEach(i => {
      state.blocks.push({
        id: 'arbeit-' + i, title: 'Arbeit', areaId: 'a1', day: i, date: datum(i),
        repeat: 'weekly', since: datum(0), ortId: null,
        grob: false, start: 9 * 60, end: 17 * 60, frog: false
      });
    });
    state.blocks.push({
      id: 'grob-di', title: 'Sport', areaId: 'a3', date: datum(1),
      ortId: null, grob: true, teil: 'ab', dauer: 90, frog: false
    });
    state.blocks.push({
      id: 'sug-mi', title: 'Lesen', areaId: 'a4', day: 2, date: datum(2),
      repeat: 'none', ortId: null, grob: false, start: 20 * 60, end: 21 * 60, frog: false, sug: true
    });
    state.blocks.push({
      id: 'termin-do', title: 'Zahnarzt', areaId: 'a7', date: datum(3),
      ortId: null, grob: false, start: 10 * 60, end: 11 * 60, frog: false
    });
    // Fr: sortMin(Arbeit)=540 < sortMin(boesartig, exakt)=600 <
    // sortMin(Hobby, grob "ab")=1020 -- die ersten zwei erscheinen in der
    // Klartextzeile, "Hobby" faellt ins "+1".
    state.blocks.push({
      id: 'termin-fr', title: boeserTitel, areaId: 'a3', date: datum(4),
      ortId: null, grob: false, start: 10 * 60, end: 11 * 60, frog: false
    });
    state.blocks.push({
      id: 'grob-fr', title: 'Hobby', areaId: 'a4', date: datum(4),
      ortId: null, grob: true, teil: 'ab', dauer: 60, frog: false
    });
    dayMeta(datum(5)).frei = true; // Sa freigehalten
    // So: nichts.

    selectedDayIdx = 2; // Mittwoch
    save();
    setView('plan');
    renderAll();
  }, BOESER_TITEL);
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  const dialoge = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => { dialoge.push(d.message()); d.dismiss(); });

  await p.clock.setFixedTime(new Date(UHR));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(150);

  await fixtureAufbauen(p);
  await p.waitForTimeout(200);

  /* ---- a) Öffnen im Frei-Gesicht (Voreinstellung) ----------------------- */
  console.log('\n=== a) Öffnen: Frei-Gesicht ist Voreinstellung, Umschalter vorhanden ===');
  await p.click('#weekLabel');
  await p.waitForTimeout(300);

  const a1 = await p.evaluate(() => {
    const chips = [...document.querySelectorAll('#gesichtUmschalter .chip')];
    return {
      titel: (document.querySelector('.sheet__title') || {}).textContent || null,
      chipTexte: chips.map(c => c.textContent),
      chipPressed: chips.map(c => c.getAttribute('aria-pressed')),
      chipRects: chips.map(c => { const r = c.getBoundingClientRect(); return { w: r.width, h: r.height }; }),
      freizeitrows: document.querySelectorAll('.freizeitrow').length,
      wochenzeilenVersteckt: (document.getElementById('wochenzeilenListe') || {}).hidden
    };
  });
  console.log('   ' + JSON.stringify(a1));
  ok(a1.titel === 'Frei diese Woche', 'a) Titel "Frei diese Woche" beim Öffnen (war ' + JSON.stringify(a1.titel) + ')');
  ok(a1.chipTexte.length === 2 && a1.chipTexte[0] === 'Frei' && a1.chipTexte[1] === 'Belegt',
    'a) zwei Chips "Frei"/"Belegt" (' + JSON.stringify(a1.chipTexte) + ')');
  ok(a1.chipPressed[0] === 'true' && a1.chipPressed[1] === 'false',
    'a) "Frei" ist als aktiv markiert (aria-pressed) (' + JSON.stringify(a1.chipPressed) + ')');
  ok(a1.chipRects.every(r => r.w >= 44 && r.h >= 44), 'a) beide Chips erreichen 44×44 (' + JSON.stringify(a1.chipRects) + ')');
  ok(a1.freizeitrows === 7, 'a) sieben .freizeitrow-Zeilen stehen (Frei-Gesicht aktiv) (' + a1.freizeitrows + ')');
  ok(a1.wochenzeilenVersteckt === true, 'a) das Belegt-Gesicht (#wochenzeilenListe) ist versteckt (' + a1.wochenzeilenVersteckt + ')');

  /* ---- b) Umschalten auf "Belegt" ---------------------------------------- */
  console.log('\n=== b) Umschalten auf "Belegt": 7 Zeilen, Segmente, Klartext, Maskierung ===');
  const belegtChipDa = await p.locator('#gesichtUmschalter .chip', { hasText: 'Belegt' }).count() > 0;
  ok(belegtChipDa, 'b) "Belegt"-Chip existiert');
  if (belegtChipDa) {
    await p.locator('#gesichtUmschalter .chip', { hasText: 'Belegt' }).click();
    await p.waitForTimeout(250);
  }

  const zeilenDa = await p.locator('.wochenzeile').count();
  ok(zeilenDa === 7, 'b) sieben .wochenzeile-Zeilen stehen (' + zeilenDa + ')');

  if (zeilenDa === 7) {
    const b1 = await p.evaluate(() => ({
      titel: document.querySelector('.sheet__title').textContent,
      freizeitrowsVersteckt: document.getElementById('freizeitListe').hidden
    }));
    ok(b1.titel === 'Diese Woche', 'b) Titel "Diese Woche" (ohne "Frei") (war ' + JSON.stringify(b1.titel) + ')');
    ok(b1.freizeitrowsVersteckt === true, 'b) das Frei-Gesicht (#freizeitListe) ist jetzt versteckt');

    // ---- Montag: nur die Arbeit-Serie -- exakt positioniertes Segment.
    const mo = await p.evaluate(() => {
      const row = document.querySelectorAll('.wochenzeile')[0];
      const bar = row.querySelector('.wochenzeile__bar');
      const segs = [...row.querySelectorAll('.wochenzeile__seg')];
      const barRect = bar.getBoundingClientRect();
      return {
        tag: row.querySelector('.wochenzeile__tag').textContent,
        txt: row.querySelector('.wochenzeile__txt').textContent,
        segAnzahl: segs.length,
        segKlassen: segs.map(s => s.className),
        segPos: segs.map(s => { const r = s.getBoundingClientRect(); return { links: r.left - barRect.left, breite: r.width }; }),
        barBreite: barRect.width
      };
    });
    console.log('   Mo: ' + JSON.stringify(mo));
    ok(mo.tag.startsWith('Mo 3.'), 'b) Montag-Tag zeigt "Mo 3." (' + mo.tag + ')');
    ok(mo.txt === 'Arbeit 09:00', 'b) Montag-Klartext "Arbeit 09:00" (' + JSON.stringify(mo.txt) + ')');
    ok(mo.segAnzahl === 1 && mo.segKlassen[0] === 'wochenzeile__seg',
      'b) Montag trägt genau ein Segment ohne grob/sug-Zusatzklasse (' + JSON.stringify(mo.segKlassen) + ')');
    if (mo.segAnzahl === 1) {
      const vonMin = 7 * 60, bisMin = 22 * 60, span = bisMin - vonMin; // Standard dayStart/dayEnd
      const erwLinks = (9 * 60 - vonMin) / span * mo.barBreite;
      const erwBreite = (17 * 60 - 9 * 60) / span * mo.barBreite;
      const TOL = 3;
      ok(Math.abs(mo.segPos[0].links - erwLinks) <= TOL,
        'b) Montag-Segment: Position gegen start=9:00 nachgerechnet, Toleranz ' + TOL + 'px (ist ' + mo.segPos[0].links.toFixed(1) + ', erwartet ' + erwLinks.toFixed(1) + ')');
      ok(Math.abs(mo.segPos[0].breite - erwBreite) <= TOL,
        'b) Montag-Segment: Breite gegen Dauer 8h nachgerechnet, Toleranz ' + TOL + 'px (ist ' + mo.segPos[0].breite.toFixed(1) + ', erwartet ' + erwBreite.toFixed(1) + ')');
    }

    // ---- Dienstag: Arbeit + grober Block "Sport" (abends).
    const di = await p.evaluate(() => {
      const row = document.querySelectorAll('.wochenzeile')[1];
      const bar = row.querySelector('.wochenzeile__bar');
      const segs = [...row.querySelectorAll('.wochenzeile__seg')];
      const barRect = bar.getBoundingClientRect();
      const grob = row.querySelector('.wochenzeile__seg--grob');
      const cs = grob ? getComputedStyle(grob) : null;
      return {
        txt: row.querySelector('.wochenzeile__txt').textContent,
        segAnzahl: segs.length,
        hatGrob: !!grob,
        grobPos: grob ? (() => { const r = grob.getBoundingClientRect(); return { links: r.left - barRect.left, breite: r.width }; })() : null,
        grobBorderStyle: cs ? cs.borderTopStyle : null,
        grobRandSeiten: cs ? [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth] : null,
        barBreite: barRect.width
      };
    });
    console.log('   Di: ' + JSON.stringify(di));
    ok(di.txt === 'Arbeit 09:00 · Sport', 'b) Dienstag-Klartext nennt beide Titel, grob ohne Uhrzeit (' + JSON.stringify(di.txt) + ')');
    ok(di.hatGrob, 'b) Dienstag trägt ein .wochenzeile__seg--grob-Segment');
    ok(di.grobBorderStyle === 'dashed', 'b) das grobe Segment ist gestrichelt umrandet (' + di.grobBorderStyle + ')');
    ok(!!di.grobRandSeiten && di.grobRandSeiten.every(w => w === di.grobRandSeiten[0]) && di.grobRandSeiten[0] !== '0px',
      'b) der Rahmen läuft auf allen vier Seiten gleich um — KEIN einseitiger border-left (Impeccable-Deckel) (' + JSON.stringify(di.grobRandSeiten) + ')');
    if (di.hatGrob) {
      const vonMin = 7 * 60, bisMin = 22 * 60, span = bisMin - vonMin;
      const abschnittAbends = 17 * 60; // ABSCHNITTE["ab"].von
      const erwLinks = (abschnittAbends - vonMin) / span * di.barBreite;
      const erwBreite = 90 / span * di.barBreite; // dauer=90
      const TOL = 3;
      ok(Math.abs(di.grobPos.links - erwLinks) <= TOL,
        'b) grobes Segment sitzt exakt am Beginn seines Abschnitts (abends=17:00), Toleranz ' + TOL + 'px (ist ' + di.grobPos.links.toFixed(1) + ', erwartet ' + erwLinks.toFixed(1) + ')');
      ok(Math.abs(di.grobPos.breite - erwBreite) <= TOL,
        'b) grobes Segment: Breite gegen Dauer 90min nachgerechnet, Toleranz ' + TOL + 'px (ist ' + di.grobPos.breite.toFixed(1) + ', erwartet ' + erwBreite.toFixed(1) + ')');
    }

    // ---- Mittwoch (heute): Arbeit + sug "Lesen" -- gedämpfter als grob.
    const mi = await p.evaluate(() => {
      const row = document.querySelectorAll('.wochenzeile')[2];
      const sug = row.querySelector('.wochenzeile__seg--sug');
      const grobSonde = document.querySelector('.wochenzeile__seg--grob'); // vom Dienstag, fuer den Opazitaets-Vergleich
      return {
        tag: row.querySelector('.wochenzeile__tag').textContent,
        klasse: row.className,
        txt: row.querySelector('.wochenzeile__txt').textContent,
        hatSug: !!sug,
        sugOpacity: sug ? +getComputedStyle(sug).opacity : null,
        grobOpacity: grobSonde ? +getComputedStyle(grobSonde).opacity : null
      };
    });
    console.log('   Mi: ' + JSON.stringify(mi));
    ok(mi.tag.includes('· heute'), 'b) Mittwoch trägt den "· heute"-Marker (' + mi.tag + ')');
    ok(mi.klasse.includes('is-heute'), 'b) Mittwoch trägt die Klasse is-heute (' + mi.klasse + ')');
    ok(mi.txt === 'Arbeit 09:00', 'b) Mittwoch-Klartext zeigt nur die Arbeit — der Vorschlag zählt nicht mit (' + JSON.stringify(mi.txt) + ')');
    ok(mi.hatSug, 'b) Mittwoch trägt ein .wochenzeile__seg--sug-Segment für den Vorschlag');
    ok(mi.sugOpacity !== null && mi.grobOpacity !== null && mi.sugOpacity < mi.grobOpacity,
      'b) das sug-Segment ist gedämpfter als ein grobes (sug=' + mi.sugOpacity + ' < grob=' + mi.grobOpacity + ')');

    // ---- Donnerstag: genau zwei Einträge, keine Kappung.
    const doTxt = await p.evaluate(() => document.querySelectorAll('.wochenzeile')[3].querySelector('.wochenzeile__txt').textContent);
    ok(doTxt === 'Arbeit 09:00 · Zahnarzt 10:00', 'b) Donnerstag zeigt beide Titel ohne "+N" (' + JSON.stringify(doTxt) + ')');

    // ---- Freitag: drei Einträge -- "+1"-Deckel, Maskierung des bösartigen Titels.
    const fr = await p.evaluate((boeserTitel) => {
      const row = document.querySelectorAll('.wochenzeile')[4];
      const txtEl = row.querySelector('.wochenzeile__txt');
      return { html: txtEl.innerHTML, text: txtEl.textContent, segAnzahl: row.querySelectorAll('.wochenzeile__seg').length };
    }, BOESER_TITEL);
    console.log('   Fr: ' + JSON.stringify(fr));
    ok(fr.segAnzahl === 3, 'b) Freitag trägt drei Segmente (Arbeit, bösartiger Termin, grobes Hobby) (' + fr.segAnzahl + ')');
    ok(fr.text === 'Arbeit 09:00 · ' + BOESER_TITEL + ' 10:00 +1',
      'b) Freitag-Klartext (als Text gelesen) zeigt zwei Titel + "+1" — der bösartige Titel kommt unverändert an (' + JSON.stringify(fr.text) + ')');
    ok(!fr.html.includes('<img'), 'b) kein rohes "<img" im Markup (escaped)');
    ok(fr.html.includes('&lt;img'), 'b) der bösartige Titel steht maskiert im Markup (' + fr.html.substring(0, 80) + '…)');
    ok(dialoge.length === 0, 'b) kein onerror/alert() ist ausgeführt worden (' + JSON.stringify(dialoge) + ')');

    /* ---- c) Freigehalten / leer ------------------------------------------ */
    console.log('\n=== c) Samstag (freigehalten) / Sonntag (leer) ===');
    const c1 = await p.evaluate(() => {
      const sa = document.querySelectorAll('.wochenzeile')[5];
      const so = document.querySelectorAll('.wochenzeile')[6];
      return {
        saHtml: sa.querySelector('.wochenzeile__txt').innerHTML,
        saText: sa.querySelector('.wochenzeile__txt').textContent,
        saLeerKlasse: sa.querySelector('.wochenzeile__txt').className.includes('is-leer'),
        soText: so.querySelector('.wochenzeile__txt').textContent,
        soLeerKlasse: so.querySelector('.wochenzeile__txt').className.includes('is-leer')
      };
    });
    console.log('   ' + JSON.stringify(c1));
    ok(c1.saHtml === '<b>bewusst frei</b>', 'c) Samstag: "bewusst frei" fett, wie "ganzer Tag frei" im Frei-Gesicht (' + c1.saHtml + ')');
    ok(!c1.saLeerKlasse, 'c) "bewusst frei" trägt NICHT die is-leer-Dämpfung (eigene Betonung, kein Leerzustand)');
    ok(c1.soText === 'nichts geplant', 'c) Sonntag: "nichts geplant" (' + JSON.stringify(c1.soText) + ')');
    ok(c1.soLeerKlasse, 'c) "nichts geplant" trägt die is-leer-Dämpfung');

    /* ---- g) Trefferflächen der Zeilen ≥44px ------------------------------- */
    console.log('\n=== g) Trefferflächen der sieben Zeilen ≥44×44 ===');
    const g1 = await p.evaluate(() => [...document.querySelectorAll('.wochenzeile')].map(el => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }));
    console.log('   ' + JSON.stringify(g1));
    ok(g1.length === 7 && g1.every(r => r.w >= 44 && r.h >= 44),
      'g) alle sieben Zeilen erreichen 44×44 als echte Box (' + JSON.stringify(g1) + ')');
  }
  // Ab hier hängen e)/f)/d) inhaltlich am Belegt-Gesicht -- ohne die sieben
  // Zeilen aus b) wäre jeder weitere Klick ein Griff ins Leere (Rot-Fall:
  // #gesichtUmschalter/#wochenzeilenListe existieren auf altem Stand gar
  // nicht). Ein einziges Flag statt jede Fußzeile einzeln abzusichern.
  const belegtVerfuegbar = zeilenDa === 7;
  if (!belegtVerfuegbar) ok(false, 'b)/c)/g) übersprungen — keine sieben .wochenzeile-Zeilen gefunden');

  /* ---- e) Gesicht übersteht ‹/›-Blättern; Rückschalt auf Frei unversehrt */
  console.log('\n=== e) Gesicht bleibt beim Wochenblättern erhalten; Frei-Gesicht nach Rückschalt unversehrt ===');
  const nextDa = await p.locator('#freizeitNext').count() > 0;
  const prevDa = await p.locator('#freizeitPrev').count() > 0;
  ok(nextDa && prevDa, 'e) lokale ‹/›-Knöpfe existieren');
  if (!belegtVerfuegbar) ok(false, 'e) übersprungen — kein Belegt-Gesicht zum Testen vorhanden');
  if (nextDa && prevDa && belegtVerfuegbar) {
    await p.click('#freizeitNext'); await p.waitForTimeout(150);
    const nachNext = await p.evaluate(() => ({
      titel: document.querySelector('.sheet__title').textContent,
      zeigtBelegt: !(document.getElementById('wochenzeilenListe') || {}).hidden,
      chipPressedBelegt: document.querySelectorAll('#gesichtUmschalter .chip')[1].getAttribute('aria-pressed')
    }));
    console.log('   nach ›: ' + JSON.stringify(nachNext));
    ok(nachNext.titel === 'Nächste Woche', 'e) Titel folgt derselben Relativ-Logik im Belegt-Gesicht (' + JSON.stringify(nachNext.titel) + ')');
    ok(nachNext.zeigtBelegt, 'e) Belegt-Gesicht bleibt nach ›  aktiv (kein Rücksprung auf Frei)');
    ok(nachNext.chipPressedBelegt === 'true', 'e) "Belegt"-Chip bleibt aria-pressed=true');

    await p.click('#freizeitPrev'); await p.waitForTimeout(150); // zurück auf "diese Woche"

    const freiChipDa = await p.locator('#gesichtUmschalter .chip', { hasText: 'Frei' }).count() > 0;
    if (freiChipDa) {
      await p.locator('#gesichtUmschalter .chip', { hasText: 'Frei' }).click();
      await p.waitForTimeout(200);
    }
    const zurueckFrei = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.freizeitrow')];
      return {
        titel: document.querySelector('.sheet__title').textContent,
        anzahl: rows.length,
        moKlasse: rows[0] ? rows[0].className : null,
        miKlasse: rows[2] ? rows[2].className : null,
        miTag: rows[2] ? rows[2].querySelector('.freizeitrow__tag').textContent : null
      };
    });
    console.log('   zurück auf Frei: ' + JSON.stringify(zurueckFrei));
    ok(zurueckFrei.titel === 'Frei diese Woche', 'e) Titel wieder wortgleich "Frei diese Woche" (' + JSON.stringify(zurueckFrei.titel) + ')');
    ok(zurueckFrei.anzahl === 7, 'e) weiterhin sieben .freizeitrow-Zeilen (' + zurueckFrei.anzahl + ')');
    ok(!!zurueckFrei.moKlasse && zurueckFrei.moKlasse.includes('is-vorbei'), 'e) Montag ist weiterhin "vorbei" (' + zurueckFrei.moKlasse + ')');
    ok(!!zurueckFrei.miKlasse && zurueckFrei.miKlasse.includes('is-heute'), 'e) Mittwoch ist weiterhin "· heute" (' + zurueckFrei.miKlasse + ')');
    ok(!!zurueckFrei.miTag && zurueckFrei.miTag.includes('· heute'), 'e) der "· heute"-Marker steht weiterhin im Tag-Text (' + zurueckFrei.miTag + ')');

    // Für f)/d) danach wieder auf Belegt -- das soll die "zuletzt gewählte
    // Fläche" beim Schließen sein.
    const belegtChipDa2 = await p.locator('#gesichtUmschalter .chip', { hasText: 'Belegt' }).count() > 0;
    if (belegtChipDa2) { await p.locator('#gesichtUmschalter .chip', { hasText: 'Belegt' }).click(); await p.waitForTimeout(200); }
  }

  /* ---- f) Schließen + Wiederöffnen: zuletzt gewähltes Gesicht bleibt --- */
  console.log('\n=== f) Wiederöffnen im selben Sitzungslauf: zuletzt gewähltes Gesicht (Belegt) ===');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  const zuNachEscape = await p.evaluate(() => !document.querySelector('.sheet'));
  ok(zuNachEscape, 'f) Escape schließt das Blatt');

  await p.click('#weekLabel');
  await p.waitForTimeout(300);
  if (!belegtVerfuegbar) {
    ok(false, 'f) übersprungen — kein Belegt-Gesicht zum Testen vorhanden');
  } else {
    const f1 = await p.evaluate(() => {
      const chips = [...document.querySelectorAll('#gesichtUmschalter .chip')];
      return {
        chipPressed: chips.map(c => c.getAttribute('aria-pressed')),
        zeigtBelegt: !(document.getElementById('wochenzeilenListe') || {}).hidden,
        zeilenDa: document.querySelectorAll('.wochenzeile').length
      };
    });
    console.log('   ' + JSON.stringify(f1));
    ok(f1.chipPressed[1] === 'true' && f1.chipPressed[0] === 'false',
      'f) beim Wiederöffnen ist "Belegt" sofort aktiv markiert (' + JSON.stringify(f1.chipPressed) + ')');
    ok(f1.zeigtBelegt, 'f) das Belegt-Gesicht ist beim Wiederöffnen sofort sichtbar (kein erneuter Klick nötig)');
    ok(f1.zeilenDa === 7, 'f) sieben .wochenzeile-Zeilen stehen sofort (' + f1.zeilenDa + ')');
  }

  /* ---- d) Zeilen-Tipp in einer vorgeblätterten Woche -------------------- */
  console.log('\n=== d) Zeilen-Tipp in einer per ‹ vorgeblätterten Woche ===');
  const prevDa2 = await p.locator('#freizeitPrev').count() > 0;
  ok(prevDa2, 'd) #freizeitPrev existiert');
  if (prevDa2) {
    await p.click('#freizeitPrev'); // eine Woche zurück -> Mo 27.7.-So 2.8.2026
    await p.waitForTimeout(150);
  }
  const frZeileDa = await p.locator('.wochenzeile').count() >= 5;
  ok(frZeileDa, 'd) die vorgeblätterte Woche zeigt weiterhin Zeilen');
  if (frZeileDa) {
    const frDatum = await p.evaluate(() => document.querySelectorAll('.wochenzeile')[4].dataset.date); // Index 4 = Freitag
    console.log('   Freitag-Zeile data-date: ' + frDatum);
    ok(frDatum === '2026-07-31', 'd) Freitag der vorgeblätterten Woche ist der 31.7.2026 (war ' + frDatum + ')');

    await p.click('.wochenzeile:nth-child(5)'); // fünftes .wochenzeile-Element = Freitag
    await p.waitForTimeout(250);
    const d1 = await p.evaluate(() => ({
      sheetWeg: !document.querySelector('.sheet'),
      anchorMon: iso(mondayOf(anchor)),
      selectedDayIdx,
      mview: document.body.dataset.mview
    }));
    console.log('   ' + JSON.stringify(d1));
    ok(d1.sheetWeg, 'd) das Blatt ist nach dem Zeilen-Tipp zu');
    ok(d1.anchorMon === '2026-07-27', 'd) anchor steht auf dem Montag der vorgeblätterten Woche (27.7., war ' + d1.anchorMon + ')');
    ok(d1.selectedDayIdx === 4, 'd) selectedDayIdx zeigt auf Freitag (4), war ' + d1.selectedDayIdx);
    ok(d1.mview === 'plan', 'd) body[data-mview] ist "plan" (war ' + JSON.stringify(d1.mview) + ')');
  }

  /* ---- h) Titel-Tipp zoomt raus: Monatsblatt im Monat der zuletzt ------
     gezeigten Woche (Stufe M3.1) -------------------------------------- */
  console.log('\n=== h) Titel-Tipp zoomt raus: Monatsblatt im Monat der zuletzt gezeigten Woche ===');
  await fixtureAufbauen(p);
  // Block f) davor lässt bewusst "Belegt" aktiv (prüft dort die Persistenz)
  // — h)/i) drehen sich um den Zoom-Mechanismus, nicht ums Gesicht, darum
  // hier explizit auf die Vorgabe "Frei" zurück (j) unten prüft "Belegt"
  // gezielt und für sich).
  await p.evaluate(() => { freizeitGesicht = 'frei'; });
  await p.click('#weekLabel');
  await p.waitForTimeout(300);
  const h0 = await p.evaluate(() => {
    const el = document.getElementById('freizeitTitel');
    return { tag: el.tagName, ariaLabel: el.getAttribute('aria-label'), hoehe: el.getBoundingClientRect().height };
  });
  ok(h0.tag === 'BUTTON', 'h) #freizeitTitel ist ein echter <button> (' + h0.tag + ')');
  ok(h0.ariaLabel === 'Monatsübersicht öffnen', 'h) aria-label "Monatsübersicht öffnen" (war ' + JSON.stringify(h0.ariaLabel) + ')');
  ok(h0.hoehe >= 44, 'h) #freizeitTitel erreicht die 44px-Trefferfläche (' + Math.round(h0.hoehe) + 'px)');

  // Erst in einen Nachbarmonat blättern (Juli) — sonst wäre "Monat der
  // zuletzt gezeigten Woche" von "Monat von anchor" nicht zu unterscheiden,
  // beide wären ja August. anchor bleibt die ganze Zeit auf Montag 3.8. stehen.
  const prevDaH = await p.locator('#freizeitPrev').count() > 0;
  ok(prevDaH, 'h) #freizeitPrev existiert');
  if (prevDaH) { await p.click('#freizeitPrev'); await p.waitForTimeout(150); }
  const titelVorZoom = await p.evaluate(() => document.querySelector('.sheet__title').textContent);
  ok(titelVorZoom === 'Frei letzte Woche', 'h) eine Woche zurück (Juli-Woche): "Frei letzte Woche" (war ' + JSON.stringify(titelVorZoom) + ')');

  await p.click('#freizeitTitel');
  await p.waitForTimeout(300);
  const h1 = await p.evaluate(() => ({
    wochenBlattWeg: !document.getElementById('freizeitTitel'),
    monatTitelDa: !!document.getElementById('monatTitel'),
    monatTitelText: (document.getElementById('monatTitel') || {}).textContent || null,
    anchorIso: iso(anchor)
  }));
  console.log('   ' + JSON.stringify(h1));
  ok(h1.wochenBlattWeg, 'h) das Wochen-Blatt ist zu (modal() ersetzt es)');
  ok(h1.monatTitelDa, 'h) stattdessen ist das Monatsblatt offen (#monatTitel existiert)');
  ok(h1.monatTitelText === 'Juli 2026',
    'h) Monatsblatt zeigt Juli 2026 — den Monat der zuletzt gezeigten Woche, NICHT August (Monat von anchor), war ' + JSON.stringify(h1.monatTitelText));
  ok(h1.anchorIso === '2026-08-03', 'h) der globale anchor bleibt unbewegt (war ' + h1.anchorIso + ')');

  /* ---- i) freizeitSheet(startMontag): öffnet in der übergebenen Woche --
     (Stufe M3.2) -------------------------------------------------------- */
  console.log('\n=== i) freizeitSheet(startMontag): öffnet in der übergebenen Woche, ‹/› arbeiten von dort weiter, anchor unbewegt ===');
  await fixtureAufbauen(p);
  const i0 = await p.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    freizeitGesicht = 'frei'; // dieselbe Begründung wie bei h) oben
    return iso(anchor); // 2026-08-03
  });
  const kwStart = await p.evaluate(() => isoWeek(new Date(2026, 6, 6))); // KW von Montag 6.7.2026
  await p.evaluate(() => { freizeitSheet(new Date(2026, 6, 6)); }); // weit vor anchor
  await p.waitForTimeout(300);
  const i1 = await p.evaluate(() => ({
    titel: (document.querySelector('.sheet__title') || {}).textContent || null,
    anchorIso: iso(anchor)
  }));
  console.log('   ' + JSON.stringify(i1) + '  (erwartete KW: ' + kwStart + ')');
  ok(i1.titel === 'Frei in KW ' + kwStart + ' (6.–12. Juli)',
    'i) öffnet wortgleich in der übergebenen Woche (KW ' + kwStart + '), nicht in der Woche von anchor (war ' + JSON.stringify(i1.titel) + ')');
  ok(i1.anchorIso === i0, 'i) anchor bleibt beim Öffnen mit Startparameter unbewegt (' + i0 + ' === ' + i1.anchorIso + ')');

  const nextDaI = await p.locator('#freizeitNext').count() > 0;
  if (nextDaI) { await p.click('#freizeitNext'); await p.waitForTimeout(150); }
  const i2 = await p.evaluate(() => ({
    titel: document.querySelector('.sheet__title').textContent,
    anchorIso: iso(anchor)
  }));
  ok(i2.titel === 'Frei in KW ' + (kwStart + 1) + ' (13.–19. Juli)',
    'i) › blättert von der ÜBERGEBENEN Woche aus eine weiter, nicht von anchor (war ' + JSON.stringify(i2.titel) + ')');
  ok(i2.anchorIso === i0, 'i) anchor bleibt auch nach › unbewegt (' + i0 + ' === ' + i2.anchorIso + ')');

  /* ---- j) Gesicht übersteht den Zoom-Rundweg (Stufe M3) ----------------- */
  console.log('\n=== j) Gesicht (Belegt) übersteht Belegt -> Titel-Tipp -> Monat -> KW-Tipp zurück -> immer noch Belegt ===');
  await fixtureAufbauen(p);
  await p.click('#weekLabel');
  await p.waitForTimeout(300);
  const belegtChipRund = p.locator('#gesichtUmschalter .chip', { hasText: 'Belegt' });
  const belegtDaJ = await belegtChipRund.count() > 0;
  ok(belegtDaJ, 'j) "Belegt"-Chip existiert');
  if (belegtDaJ) { await belegtChipRund.click(); await p.waitForTimeout(200); }
  const j0 = belegtDaJ ? await p.evaluate(() => document.querySelectorAll('#gesichtUmschalter .chip')[1].getAttribute('aria-pressed')) : null;
  ok(j0 === 'true', 'j) "Belegt" ist aktiv, bevor der Rundweg losgeht (' + j0 + ')');

  const freizeitTitelDaJ = await p.locator('#freizeitTitel').count() > 0;
  if (freizeitTitelDaJ) { await p.click('#freizeitTitel'); await p.waitForTimeout(300); } // Titel-Tipp -> Monat
  const monatOffenJ = await p.evaluate(() => !!document.getElementById('monatTitel'));
  ok(monatOffenJ, 'j) Monatsblatt ist nach dem Titel-Tipp offen');

  if (monatOffenJ) {
    const kw32DaJ = await p.locator('.monatweek[data-monday="2026-08-03"]').count() > 0;
    if (kw32DaJ) { await p.click('.monatweek[data-monday="2026-08-03"]'); await p.waitForTimeout(300); } // KW-Tipp zurück (aktuelle Woche)
  }
  const j1 = await p.evaluate(() => {
    const chips = [...document.querySelectorAll('#gesichtUmschalter .chip')];
    return {
      freizeitTitelDa: !!document.getElementById('freizeitTitel'),
      zeigtBelegt: !(document.getElementById('wochenzeilenListe') || {}).hidden,
      chipPressed: chips.map(c => c.getAttribute('aria-pressed'))
    };
  });
  console.log('   ' + JSON.stringify(j1));
  ok(j1.freizeitTitelDa, 'j) das Wochen-Blatt ist nach dem KW-Tipp wieder offen');
  ok(j1.zeigtBelegt, 'j) das Belegt-Gesicht ist weiterhin aktiv — kein Rücksprung auf Frei (' + JSON.stringify(j1) + ')');
  ok(j1.chipPressed[1] === 'true' && j1.chipPressed[0] === 'false',
    'j) "Belegt"-Chip bleibt aria-pressed=true, "Frei" bleibt false (' + JSON.stringify(j1.chipPressed) + ')');

  /* ---- Screenshots: SE 320×568 + iPhone 13 375×812, je hell/dunkel, ----
     beide Gesichter -------------------------------------------------------- */
  console.log('\n--- Screenshots ---');
  await fixtureAufbauen(p);
  await p.evaluate(() => { state.settings.theme = 'light'; applyTheme(); });
  await p.click('#weekLabel');
  await p.waitForTimeout(250);
  // Sicherstellen, dass der Frei-Screenshot auch wirklich Frei zeigt.
  const freiChipShot = p.locator('#gesichtUmschalter .chip', { hasText: 'Frei' });
  if (await freiChipShot.count() > 0) { await freiChipShot.click(); await p.waitForTimeout(150); }
  await p.screenshot({ path: path.join(__dirname, 'wochenzeilen-se-frei-hell.png') });
  await p.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
  await p.waitForTimeout(120);
  await p.screenshot({ path: path.join(__dirname, 'wochenzeilen-se-frei-dunkel.png') });

  const belegtChipShot = p.locator('#gesichtUmschalter .chip', { hasText: 'Belegt' });
  if (await belegtChipShot.count() > 0) { await belegtChipShot.click(); await p.waitForTimeout(150); }
  await p.screenshot({ path: path.join(__dirname, 'wochenzeilen-se-belegt-dunkel.png') });
  await p.evaluate(() => { state.settings.theme = 'light'; applyTheme(); });
  await p.waitForTimeout(120);
  await p.screenshot({ path: path.join(__dirname, 'wochenzeilen-se-belegt-hell.png') });
  await p.evaluate(() => { closeModal(); });

  const ctx13 = await br.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Berlin' });
  const p13 = await ctx13.newPage();
  await p13.clock.setFixedTime(new Date(UHR));
  await p13.goto(F);
  await p13.waitForTimeout(500);
  await fixtureAufbauen(p13);
  await p13.click('#weekLabel');
  await p13.waitForTimeout(250);
  await p13.screenshot({ path: path.join(__dirname, 'wochenzeilen-13-frei-hell.png') });
  const belegtChip13 = p13.locator('#gesichtUmschalter .chip', { hasText: 'Belegt' });
  if (await belegtChip13.count() > 0) { await belegtChip13.click(); await p13.waitForTimeout(150); }
  await p13.screenshot({ path: path.join(__dirname, 'wochenzeilen-13-belegt-hell.png') });
  await p13.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
  await p13.waitForTimeout(120);
  await p13.screenshot({ path: path.join(__dirname, 'wochenzeilen-13-belegt-dunkel.png') });
  await ctx13.close();

  console.log('\nKonsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  console.log('\n' + (fehler.length ? fehler.length + ' FEHLER:' : 'Alle Prüfungen bestanden.'));
  fehler.forEach(f => console.log(' - ' + f));
  process.exit(fehler.length ? 1 : 0);
})();
